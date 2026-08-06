use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

static SERVER: OnceLock<MediaServer> = OnceLock::new();

struct MediaServer {
    addr: SocketAddr,
    state: Arc<Mutex<MediaState>>,
}

#[derive(Default)]
struct MediaState {
    roots: HashMap<String, PathBuf>,
    tokens_by_root: HashMap<String, String>,
    next_token: u64,
}

#[tauri::command]
pub fn course_media_url(course_root: String, absolute_path: String) -> Result<String, String> {
    let root = canonical_dir(&course_root)?;
    let media_path = canonical_file(&absolute_path)?;
    if !media_path.starts_with(&root) {
        return Err("media path is outside the selected course folder".to_string());
    }

    let server = SERVER.get_or_init(start_server);
    let token = server.register_root(&root)?;
    let relative_path = media_path
        .strip_prefix(&root)
        .map_err(|error| error.to_string())?;

    Ok(format!(
        "http://127.0.0.1:{}/{}/{}",
        server.addr.port(),
        token,
        encode_relative_path(relative_path)
    ))
}

fn canonical_dir(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if path.is_dir() {
        Ok(path)
    } else {
        Err("course root is not a directory".to_string())
    }
}

fn canonical_file(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if path.is_file() {
        Ok(path)
    } else {
        Err("media path is not a file".to_string())
    }
}

fn start_server() -> MediaServer {
    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind course media server");
    let addr = listener
        .local_addr()
        .expect("read course media server addr");
    let state = Arc::new(Mutex::new(MediaState::default()));
    let thread_state = Arc::clone(&state);

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let request_state = Arc::clone(&thread_state);
            thread::spawn(move || {
                let _ = handle_stream(stream, request_state);
            });
        }
    });

    MediaServer { addr, state }
}

impl MediaServer {
    fn register_root(&self, root: &Path) -> Result<String, String> {
        let root_key = root.to_string_lossy().to_string();
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        if let Some(token) = state.tokens_by_root.get(&root_key) {
            return Ok(token.clone());
        }

        state.next_token += 1;
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let token = format!("{nanos:x}{:x}", state.next_token);
        state.roots.insert(token.clone(), root.to_path_buf());
        state.tokens_by_root.insert(root_key, token.clone());
        Ok(token)
    }
}

fn handle_stream(mut stream: TcpStream, state: Arc<Mutex<MediaState>>) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let mut request_bytes = Vec::with_capacity(1024);
    while !request_bytes.windows(4).any(|window| window == b"\r\n\r\n") {
        let mut chunk = [0_u8; 1024];
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            return write_response(
                &mut stream,
                400,
                "Bad Request",
                "text/plain",
                None,
                b"bad request",
            );
        }
        request_bytes.extend_from_slice(&chunk[..read]);
        if request_bytes.len() > 8192 {
            return write_response(
                &mut stream,
                431,
                "Request Header Fields Too Large",
                "text/plain",
                None,
                b"request headers too large",
            );
        }
    }

    let request = String::from_utf8_lossy(&request_bytes);
    let mut lines = request.lines();
    let Some(request_line) = lines.next() else {
        return write_response(
            &mut stream,
            400,
            "Bad Request",
            "text/plain",
            None,
            b"bad request",
        );
    };
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default();
    let target = request_parts.next().unwrap_or_default();
    let range = lines.find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("range")
            .then(|| value.trim().to_string())
    });

    if method != "GET" && method != "HEAD" {
        return write_response(
            &mut stream,
            405,
            "Method Not Allowed",
            "text/plain",
            None,
            b"method not allowed",
        );
    }

    match resolve_request_path(target, &state) {
        Ok(path) => serve_file(&mut stream, method, &path, range.as_deref()),
        Err((status, message)) => write_response(
            &mut stream,
            status,
            message,
            "text/plain",
            None,
            message.as_bytes(),
        ),
    }
}

fn resolve_request_path(
    target: &str,
    state: &Arc<Mutex<MediaState>>,
) -> Result<PathBuf, (u16, &'static str)> {
    let path = target.split('?').next().unwrap_or_default();
    let path = path.strip_prefix('/').ok_or((400, "bad request"))?;
    let (token, encoded_relative_path) = path.split_once('/').ok_or((404, "not found"))?;
    let relative_path = percent_decode(encoded_relative_path).ok_or((400, "bad request"))?;
    let relative = PathBuf::from(relative_path);
    if relative.components().any(is_unsafe_component) {
        return Err((403, "forbidden"));
    }

    let root = {
        let state = state.lock().map_err(|_| (500, "server error"))?;
        state.roots.get(token).cloned().ok_or((404, "not found"))?
    };
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|_| (404, "not found"))?;
    if !path.starts_with(&root) || !path.is_file() {
        return Err((403, "forbidden"));
    }

    Ok(path)
}

fn is_unsafe_component(component: Component<'_>) -> bool {
    matches!(
        component,
        Component::ParentDir | Component::RootDir | Component::Prefix(_)
    )
}

fn serve_file(
    stream: &mut TcpStream,
    method: &str,
    path: &Path,
    range: Option<&str>,
) -> std::io::Result<()> {
    let mut file = File::open(path)?;
    let len = file.metadata()?.len();
    let content_type = content_type(path);

    if let Some((start, end)) = range.and_then(|value| parse_range(value, len)) {
        let count = end - start + 1;
        file.seek(SeekFrom::Start(start))?;
        write_partial_headers(stream, content_type, len, start, end, count)?;
        if method == "GET" {
            copy_exact(&mut file, stream, count)?;
        }
        return Ok(());
    }

    write_response_headers(stream, 200, "OK", content_type, len)?;
    if method == "GET" {
        copy_exact(&mut file, stream, len)?;
    }
    Ok(())
}

fn parse_range(header: &str, len: u64) -> Option<(u64, u64)> {
    let range = header.strip_prefix("bytes=")?;
    let (start, end) = range.split_once('-')?;
    let start = start.parse::<u64>().ok()?;
    let end = if end.is_empty() {
        len.checked_sub(1)?
    } else {
        end.parse::<u64>().ok()?.min(len.checked_sub(1)?)
    };

    (start <= end && end < len).then_some((start, end))
}

fn write_partial_headers(
    stream: &mut TcpStream,
    content_type: &str,
    total_len: u64,
    start: u64,
    end: u64,
    content_len: u64,
) -> std::io::Result<()> {
    write!(
        stream,
        "HTTP/1.1 206 Partial Content\r\nContent-Type: {content_type}\r\nContent-Length: {content_len}\r\nContent-Range: bytes {start}-{end}/{total_len}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
    )
}

fn write_response_headers(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    content_type: &str,
    content_len: u64,
) -> std::io::Result<()> {
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {content_len}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
    )
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    content_type: &str,
    content_len: Option<u64>,
    body: &[u8],
) -> std::io::Result<()> {
    let length = content_len.unwrap_or(body.len() as u64);
    write_response_headers(stream, status, reason, content_type, length)?;
    stream.write_all(body)
}

pub(crate) fn copy_exact<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    mut remaining: u64,
) -> std::io::Result<()> {
    let mut buffer = [0_u8; 64 * 1024];
    while remaining > 0 {
        let requested = remaining.min(buffer.len() as u64) as usize;
        let read = reader.read(&mut buffer[..requested])?;
        if read == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "media file ended before the response body was complete",
            ));
        }
        writer.write_all(&buffer[..read])?;
        remaining -= read as u64;
    }
    Ok(())
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "vtt" => "text/vtt",
        "srt" => "application/x-subrip",
        _ => "application/octet-stream",
    }
}

fn encode_relative_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .split('/')
        .map(percent_encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn percent_decode(value: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(value.len());
    let mut chars = value.as_bytes().iter().copied();
    while let Some(byte) = chars.next() {
        if byte != b'%' {
            bytes.push(byte);
            continue;
        }

        let high = chars.next()?;
        let low = chars.next()?;
        let decoded = hex_value(high)? * 16 + hex_value(low)?;
        bytes.push(decoded);
    }

    String::from_utf8(bytes).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
