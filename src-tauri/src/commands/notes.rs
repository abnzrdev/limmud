use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SaveNoteErrorKind {
    PermissionDenied,
    ReadOnlyFilesystem,
    ParentMissing,
    LessonMissing,
    TargetIsDirectory,
    OutsideCourse,
    InvalidPath,
    Io,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNoteError {
    pub kind: SaveNoteErrorKind,
    pub message: String,
    pub attempted_path: String,
    pub parent_path: String,
    pub os_error: Option<String>,
    pub recoverable: bool,
}

impl SaveNoteError {
    fn new(
        kind: SaveNoteErrorKind,
        message: impl Into<String>,
        attempted_path: &Path,
        parent_path: &Path,
        os_error: Option<String>,
    ) -> Self {
        Self {
            kind,
            message: message.into(),
            attempted_path: display_path(attempted_path),
            parent_path: display_path(parent_path),
            os_error,
            recoverable: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDraft {
    pub lesson_relative_path: String,
    pub note_text: String,
    pub updated_at: String,
    pub last_save_error_kind: String,
}

#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
    crate::persistence::read_note_file(&PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_editable_text_file(
    course_root: String,
    relative_path: String,
) -> Result<String, String> {
    let path = resolve_editable_text_file(&course_root, &relative_path)?;
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_editable_text_file(
    course_root: String,
    relative_path: String,
    contents: String,
) -> Result<(), String> {
    let path = resolve_editable_text_file(&course_root, &relative_path)?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn resolve_editable_text_file(course_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    validate_relative_path(relative_path)?;
    let relative = Path::new(relative_path);
    if relative
        .components()
        .any(|part| part.as_os_str() == ".learningappoffline")
    {
        return Err("internal course files are not editable".to_string());
    }
    let supported = |path: &Path| {
        matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .map(str::to_ascii_lowercase)
                .as_deref(),
            Some("md" | "txt" | "py")
        )
    };
    if !supported(relative) {
        return Err("file type is not editable".to_string());
    }
    let root = canonical_course_root(course_root).map_err(|error| error.to_string())?;
    let requested = root.join(relative);
    let resolved = requested
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !resolved.starts_with(&root) || !resolved.is_file() || !supported(&resolved) {
        return Err("editable file is outside the course or is not a supported file".to_string());
    }
    Ok(resolved)
}

#[tauri::command]
pub fn write_note(
    course_root: String,
    lesson_path: String,
    contents: String,
) -> Result<(), SaveNoteError> {
    write_note_for_lesson(&course_root, &lesson_path, &contents)
}

pub fn write_note_for_lesson(
    course_root: &str,
    lesson_path: &str,
    contents: &str,
) -> Result<(), SaveNoteError> {
    let requested_lesson = PathBuf::from(lesson_path);
    let requested_parent = requested_lesson.parent().unwrap_or_else(|| Path::new(""));
    let root = canonical_course_root(course_root).map_err(|error| {
        save_error(
            SaveNoteErrorKind::InvalidPath,
            "The selected course folder is unavailable.",
            &requested_lesson,
            requested_parent,
            Some(error.to_string()),
        )
    })?;

    if !requested_lesson.is_absolute() {
        return Err(save_error(
            SaveNoteErrorKind::InvalidPath,
            "The selected lesson path is invalid.",
            &requested_lesson,
            requested_parent,
            None,
        ));
    }
    if !requested_parent.exists() {
        return Err(save_error(
            SaveNoteErrorKind::ParentMissing,
            "The lesson folder no longer exists. Refresh the course before saving.",
            &requested_lesson,
            requested_parent,
            None,
        ));
    }

    let lesson = requested_lesson.canonicalize().map_err(|error| {
        let kind = if error.kind() == io::ErrorKind::NotFound {
            SaveNoteErrorKind::LessonMissing
        } else {
            SaveNoteErrorKind::InvalidPath
        };
        save_error(
            kind,
            "The selected lesson is unavailable. Refresh the course before saving.",
            &requested_lesson,
            requested_parent,
            Some(error.to_string()),
        )
    })?;
    let parent = lesson.parent().unwrap_or_else(|| Path::new(""));

    if !lesson.is_file() {
        return Err(save_error(
            SaveNoteErrorKind::LessonMissing,
            "The selected lesson is not a file. Refresh the course before saving.",
            &lesson,
            parent,
            None,
        ));
    }
    if !lesson.starts_with(&root) {
        return Err(save_error(
            SaveNoteErrorKind::OutsideCourse,
            "The selected lesson is outside the current course folder.",
            &lesson,
            parent,
            None,
        ));
    }

    let target = lesson.with_extension("notes.md");
    if target.is_dir() {
        return Err(save_error(
            SaveNoteErrorKind::TargetIsDirectory,
            "The notes path is a folder, not a file.",
            &target,
            parent,
            None,
        ));
    }

    eprintln!(
        "note_save_start canonical_course_root={} attempted_path={}",
        display_path(&root),
        display_path(&target)
    );
    crate::persistence::write_note_file(&target, contents).map_err(|error| {
        let kind = match error.kind() {
            io::ErrorKind::PermissionDenied => SaveNoteErrorKind::PermissionDenied,
            io::ErrorKind::ReadOnlyFilesystem => SaveNoteErrorKind::ReadOnlyFilesystem,
            io::ErrorKind::NotFound => SaveNoteErrorKind::ParentMissing,
            _ => SaveNoteErrorKind::Io,
        };
        save_error(
            kind,
            "LearningAppOffline could not save the note beside this lesson.",
            &target,
            parent,
            Some(error.to_string()),
        )
    })
}

#[tauri::command]
pub fn read_recovery_drafts(course_root: String) -> Result<Vec<RecoveryDraft>, String> {
    let path = recovery_file(&course_root)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_recovery_draft(course_root: String, draft: RecoveryDraft) -> Result<(), String> {
    validate_relative_path(&draft.lesson_relative_path)?;
    let path = recovery_file(&course_root)?;
    let mut drafts = read_recovery_drafts(course_root)?;
    drafts.retain(|item| item.lesson_relative_path != draft.lesson_relative_path);
    drafts.push(draft);
    write_recovery_drafts(&path, &drafts)
}

#[tauri::command]
pub fn remove_recovery_draft(
    course_root: String,
    lesson_relative_path: String,
) -> Result<(), String> {
    validate_relative_path(&lesson_relative_path)?;
    let path = recovery_file(&course_root)?;
    let mut drafts = read_recovery_drafts(course_root)?;
    let before = drafts.len();
    drafts.retain(|item| item.lesson_relative_path != lesson_relative_path);
    if before != drafts.len() {
        write_recovery_drafts(&path, &drafts)?;
    }
    Ok(())
}

fn canonical_course_root(course_root: &str) -> io::Result<PathBuf> {
    let root = Path::new(course_root).canonicalize()?;
    if root.is_dir() {
        Ok(root)
    } else {
        Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "course root is not a directory",
        ))
    }
}

fn recovery_file(course_root: &str) -> Result<PathBuf, String> {
    canonical_course_root(course_root)
        .map(|root| crate::fs_paths::course_recovery_file(&root))
        .map_err(|error| error.to_string())
}

fn write_recovery_drafts(path: &Path, drafts: &[RecoveryDraft]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let raw = serde_json::to_string_pretty(drafts).map_err(|error| error.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|error| error.to_string())
}

fn validate_relative_path(value: &str) -> Result<(), String> {
    let path = Path::new(value);
    if value.trim().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        Err("lesson relative path is invalid".to_string())
    } else {
        Ok(())
    }
}

fn save_error(
    kind: SaveNoteErrorKind,
    message: impl Into<String>,
    attempted_path: &Path,
    parent_path: &Path,
    os_error: Option<String>,
) -> SaveNoteError {
    let error = SaveNoteError::new(kind, message, attempted_path, parent_path, os_error);
    eprintln!(
        "note_save_failed kind={:?} attempted_path={} os_error={}",
        error.kind,
        error.attempted_path,
        error.os_error.as_deref().unwrap_or("none")
    );
    error
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        read_editable_text_file, write_editable_text_file, write_note_for_lesson, SaveNoteError,
        SaveNoteErrorKind,
    };
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("learning-app-offline-notes-{name}-{unique}"));
        fs::create_dir_all(&path).expect("create temp directory");
        path
    }

    #[test]
    fn reads_and_writes_supported_text_files_inside_course() {
        let course = temp_dir("editable-text");
        let file = course.join("unit").join("notes.txt");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "first").unwrap();
        assert_eq!(
            read_editable_text_file(
                course.to_string_lossy().into_owned(),
                "unit/notes.txt".into()
            )
            .unwrap(),
            "first"
        );
        write_editable_text_file(
            course.to_string_lossy().into_owned(),
            "unit/notes.txt".into(),
            "second".into(),
        )
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "second");
        fs::remove_dir_all(course).unwrap();
    }

    #[test]
    fn rejects_unsupported_missing_and_escaping_text_paths() {
        let course = temp_dir("editable-text-reject");
        fs::write(course.join("binary.pdf"), "pdf").unwrap();
        let root = course.to_string_lossy().into_owned();
        assert!(read_editable_text_file(root.clone(), "binary.pdf".into()).is_err());
        assert!(read_editable_text_file(root.clone(), "missing.md".into()).is_err());
        assert!(read_editable_text_file(root, "../outside.md".into()).is_err());
        fs::remove_dir_all(course).unwrap();
    }

    #[test]
    fn rejects_a_same_named_lesson_outside_the_canonical_course() {
        let course = temp_dir("course");
        let outside = temp_dir("outside");
        let inside_lesson = course.join("unit-a").join("intro.mp4");
        let outside_lesson = outside.join("unit-b").join("intro.mp4");
        fs::create_dir_all(inside_lesson.parent().expect("inside parent")).expect("create inside");
        fs::create_dir_all(outside_lesson.parent().expect("outside parent"))
            .expect("create outside");
        fs::write(&inside_lesson, "video").expect("write inside lesson");
        fs::write(&outside_lesson, "video").expect("write outside lesson");

        let error = write_note_for_lesson(
            course.to_str().expect("course path"),
            outside_lesson.to_str().expect("outside lesson path"),
            "draft",
        )
        .expect_err("outside lesson must be rejected");

        assert_eq!(error.kind, SaveNoteErrorKind::OutsideCourse);
        assert!(!inside_lesson.with_extension("notes.md").exists());
        assert!(!outside_lesson.with_extension("notes.md").exists());

        fs::remove_dir_all(course).expect("remove course");
        fs::remove_dir_all(outside).expect("remove outside directory");
    }

    #[test]
    fn serializes_structured_errors() {
        let error = SaveNoteError::new(
            SaveNoteErrorKind::PermissionDenied,
            "not writable",
            std::path::Path::new("/course/lesson.notes.md"),
            std::path::Path::new("/course"),
            Some("permission denied".to_string()),
        );
        let value = serde_json::to_value(error).expect("serialize error");
        assert_eq!(value["kind"], "permissionDenied");
        assert_eq!(value["parentPath"], "/course");
    }

    #[test]
    fn writes_beside_the_exact_selected_lesson_path() {
        let course = temp_dir("exact-path");
        let first = course.join("one").join("lesson.mp4");
        let second = course.join("two").join("lesson.mp4");
        fs::create_dir_all(first.parent().expect("first parent")).expect("create first parent");
        fs::create_dir_all(second.parent().expect("second parent")).expect("create second parent");
        fs::write(&first, "video").expect("write first lesson");
        fs::write(&second, "video").expect("write second lesson");

        write_note_for_lesson(course.to_str().unwrap(), first.to_str().unwrap(), "first")
            .expect("write first");
        write_note_for_lesson(course.to_str().unwrap(), second.to_str().unwrap(), "second")
            .expect("write second");

        assert_eq!(
            fs::read_to_string(first.with_extension("notes.md")).unwrap(),
            "first"
        );
        assert_eq!(
            fs::read_to_string(second.with_extension("notes.md")).unwrap(),
            "second"
        );
        fs::remove_dir_all(course).expect("remove course");
    }

    #[test]
    fn reports_missing_parent_and_directory_targets() {
        let course = temp_dir("invalid-targets");
        let missing = course.join("missing").join("lesson.mp4");
        let missing_error =
            write_note_for_lesson(course.to_str().unwrap(), missing.to_str().unwrap(), "draft")
                .expect_err("missing parent");
        assert_eq!(missing_error.kind, SaveNoteErrorKind::ParentMissing);

        let lesson = course.join("lesson.mp4");
        fs::write(&lesson, "video").expect("write lesson");
        fs::create_dir(lesson.with_extension("notes.md")).expect("create target directory");
        let target_error =
            write_note_for_lesson(course.to_str().unwrap(), lesson.to_str().unwrap(), "draft")
                .expect_err("target directory");
        assert_eq!(target_error.kind, SaveNoteErrorKind::TargetIsDirectory);
        fs::remove_dir_all(course).expect("remove course");
    }

    #[cfg(unix)]
    #[test]
    fn maps_read_only_lesson_directory_to_permission_denied() {
        use std::os::unix::fs::PermissionsExt;

        let course = temp_dir("permission-denied");
        let lesson_dir = course.join("locked");
        let lesson = lesson_dir.join("lesson.mp4");
        fs::create_dir_all(&lesson_dir).expect("create lesson directory");
        fs::write(&lesson, "video").expect("write lesson");
        fs::set_permissions(&lesson_dir, fs::Permissions::from_mode(0o555))
            .expect("lock directory");

        let result =
            write_note_for_lesson(course.to_str().unwrap(), lesson.to_str().unwrap(), "draft");
        fs::set_permissions(&lesson_dir, fs::Permissions::from_mode(0o755))
            .expect("unlock directory");
        let error = result.expect_err("read-only lesson directory must reject notes");
        assert_eq!(error.kind, SaveNoteErrorKind::PermissionDenied);
        fs::remove_dir_all(course).expect("remove course");
    }
}
