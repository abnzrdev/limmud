use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "lowercase")]
pub enum TerminalEvent {
    Output(Vec<u8>),
    Exit(Option<u32>),
    Error(String),
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader: Option<JoinHandle<()>>,
}

#[derive(Clone, Default)]
pub struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
    next_id: Arc<AtomicU64>,
}

impl TerminalState {
    pub fn close_all(&self) {
        let ids = self
            .sessions
            .lock()
            .map(|sessions| sessions.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        for id in ids {
            if let Err(error) = close_session(self, &id) {
                eprintln!("failed to close {id}: {error}");
            }
        }
    }

    #[cfg(test)]
    fn session_count(&self) -> usize {
        self.sessions
            .lock()
            .map(|sessions| sessions.len())
            .unwrap_or(0)
    }
}

pub(crate) fn canonical_course_root(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("course root is required".to_string());
    }
    let root = PathBuf::from(path)
        .canonicalize()
        .map_err(|error| format!("course folder is unavailable: {error}"))?;
    root.is_dir()
        .then_some(root)
        .ok_or_else(|| "course root is not a directory".to_string())
}

fn pty_size(cols: u16, rows: u16) -> Result<PtySize, String> {
    if cols == 0 || rows == 0 {
        return Err("terminal size must be greater than zero".to_string());
    }
    Ok(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })
}

fn default_shell() -> PathBuf {
    std::env::var_os("SHELL")
        .map(PathBuf::from)
        .filter(|path| is_valid_shell(path))
        .unwrap_or_else(|| PathBuf::from("/bin/bash"))
}

fn is_valid_shell(path: &std::path::Path) -> bool {
    if !path.is_absolute() || !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        return path
            .metadata()
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }
    #[cfg(not(unix))]
    true
}

fn start_session<F>(
    state: &TerminalState,
    course_root: &str,
    cols: u16,
    rows: u16,
    emit: F,
) -> Result<String, String>
where
    F: Fn(TerminalEvent) + Send + Sync + 'static,
{
    let root = canonical_course_root(course_root)?;
    let size = pty_size(cols, rows)?;
    let pair = native_pty_system()
        .openpty(size)
        .map_err(|error| format!("failed to create terminal: {error}"))?;
    let mut command = CommandBuilder::new(default_shell());
    command.cwd(&root);
    command.env("TERM", "xterm-256color");
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("failed to start shell: {error}"))?;
    drop(pair.slave);
    let mut reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("failed to open terminal output: {error}"));
        }
    };
    let writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("failed to open terminal input: {error}"));
        }
    };
    let id = format!(
        "terminal-{}",
        state.next_id.fetch_add(1, Ordering::Relaxed) + 1
    );
    let mut sessions = match state.sessions.lock() {
        Ok(sessions) => sessions,
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err("terminal state is unavailable".to_string());
        }
    };
    sessions.insert(
        id.clone(),
        TerminalSession {
            master: pair.master,
            writer,
            child,
            reader: None,
        },
    );
    drop(sessions);

    let sessions = Arc::clone(&state.sessions);
    let reader_id = id.clone();
    let handle = match thread::Builder::new()
        .name(format!("{id}-reader"))
        .spawn(move || {
            let mut buffer = [0_u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => emit(TerminalEvent::Output(buffer[..count].to_vec())),
                    Err(error) if error.raw_os_error() == Some(5) => break,
                    Err(error) => {
                        emit(TerminalEvent::Error(format!(
                            "terminal output failed: {error}"
                        )));
                        break;
                    }
                }
            }
            let session = sessions
                .lock()
                .ok()
                .and_then(|mut sessions| sessions.remove(&reader_id));
            let exit_code = session.and_then(|mut session| match session.child.try_wait() {
                Ok(Some(status)) => Some(status.exit_code()),
                Ok(None) => {
                    let _ = session.child.kill();
                    session.child.wait().ok().map(|status| status.exit_code())
                }
                Err(error) => {
                    emit(TerminalEvent::Error(format!(
                        "failed to inspect terminal process: {error}"
                    )));
                    let _ = session.child.kill();
                    session.child.wait().ok().map(|status| status.exit_code())
                }
            });
            emit(TerminalEvent::Exit(exit_code));
        }) {
        Ok(handle) => handle,
        Err(error) => {
            close_session(state, &id)?;
            return Err(format!("failed to start terminal output thread: {error}"));
        }
    };
    if let Ok(mut sessions) = state.sessions.lock() {
        if let Some(session) = sessions.get_mut(&id) {
            session.reader = Some(handle);
        }
    }
    Ok(id)
}

fn write_session(state: &TerminalState, session_id: &str, data: &str) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    let session = sessions
        .get_mut(session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|error| format!("terminal write failed: {error}"))
}

fn resize_session(
    state: &TerminalState,
    session_id: &str,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let size = pty_size(cols, rows)?;
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    sessions
        .get(session_id)
        .ok_or_else(|| "terminal session not found".to_string())?
        .master
        .resize(size)
        .map_err(|error| format!("terminal resize failed: {error}"))
}

fn close_session(state: &TerminalState, session_id: &str) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    let Some(session) = sessions.get_mut(session_id) else {
        return Ok(());
    };
    if session
        .child
        .try_wait()
        .map_err(|error| format!("failed to inspect terminal process: {error}"))?
        .is_none()
    {
        session
            .child
            .kill()
            .map_err(|error| format!("failed to stop terminal process: {error}"))?;
        session
            .child
            .wait()
            .map_err(|error| format!("failed to wait for terminal process: {error}"))?;
    }
    let session = sessions.remove(session_id).expect("session was present");
    drop(sessions);
    let TerminalSession {
        master,
        writer,
        child,
        reader,
    } = session;
    drop(master);
    drop(writer);
    drop(child);
    if let Some(reader) = reader {
        reader
            .join()
            .map_err(|_| "terminal output thread failed during cleanup".to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_start(
    state: State<'_, TerminalState>,
    course_root: String,
    cols: u16,
    rows: u16,
    output_channel: Channel<TerminalEvent>,
) -> Result<String, String> {
    start_session(&state, &course_root, cols, rows, move |event| {
        let _ = output_channel.send(event);
    })
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    write_session(&state, &session_id, &data)
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(&state, &session_id, cols, rows)
}

#[tauri::command]
pub fn terminal_close(state: State<'_, TerminalState>, session_id: String) -> Result<(), String> {
    close_session(&state, &session_id)
}

#[tauri::command]
pub fn terminal_restart(
    state: State<'_, TerminalState>,
    session_id: String,
    course_root: String,
    cols: u16,
    rows: u16,
    output_channel: Channel<TerminalEvent>,
) -> Result<String, String> {
    close_session(&state, &session_id)?;
    start_session(&state, &course_root, cols, rows, move |event| {
        let _ = output_channel.send(event);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_course() -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "learning-app-terminal-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn canonicalizes_an_existing_course_directory() {
        let course = temp_course();
        assert_eq!(
            canonical_course_root(course.to_str().unwrap()).unwrap(),
            course.canonicalize().unwrap()
        );
        fs::remove_dir_all(course).unwrap();
    }

    #[test]
    fn rejects_missing_and_non_directory_course_paths() {
        let course = temp_course();
        let file = course.join("lesson.txt");
        fs::write(&file, "lesson").unwrap();
        assert!(canonical_course_root(course.join("missing").to_str().unwrap()).is_err());
        assert!(canonical_course_root(file.to_str().unwrap()).is_err());
        fs::remove_dir_all(course).unwrap();
    }

    #[test]
    fn starts_writes_resizes_and_closes_a_course_shell() {
        let course = temp_course();
        let canonical = course.canonicalize().unwrap();
        let state = TerminalState::default();
        let (tx, rx) = mpsc::channel();
        let session_id = start_session(&state, course.to_str().unwrap(), 80, 24, move |event| {
            let _ = tx.send(event);
        })
        .unwrap();

        resize_session(&state, &session_id, 100, 30).unwrap();
        write_session(&state, &session_id, "pwd\r").unwrap();

        let mut output = Vec::new();
        for _ in 0..20 {
            if let Ok(TerminalEvent::Output(bytes)) = rx.recv_timeout(Duration::from_millis(100)) {
                output.extend(bytes);
                if String::from_utf8_lossy(&output).contains(canonical.to_str().unwrap()) {
                    break;
                }
            }
        }
        assert!(String::from_utf8_lossy(&output).contains(canonical.to_str().unwrap()));
        close_session(&state, &session_id).unwrap();
        close_session(&state, &session_id).unwrap();
        fs::remove_dir_all(course).unwrap();
    }

    #[test]
    fn unknown_sessions_return_readable_errors() {
        let state = TerminalState::default();
        assert_eq!(
            write_session(&state, "missing", "pwd\r").unwrap_err(),
            "terminal session not found"
        );
        assert_eq!(
            resize_session(&state, "missing", 80, 24).unwrap_err(),
            "terminal session not found"
        );
        close_session(&state, "missing").unwrap();
    }

    #[test]
    fn removes_session_after_child_exit() {
        let course = temp_course();
        let state = TerminalState::default();
        let session_id = start_session(&state, course.to_str().unwrap(), 80, 24, |_| {}).unwrap();
        write_session(&state, &session_id, "exit\r").unwrap();
        for _ in 0..20 {
            if state.session_count() == 0 {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        assert_eq!(state.session_count(), 0);
        fs::remove_dir_all(course).unwrap();
    }
}
