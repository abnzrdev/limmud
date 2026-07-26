use std::path::{Path, PathBuf};

#[tauri::command]
pub fn open_lesson_external(course_root: String, absolute_path: String) -> Result<(), String> {
    let path = resolve_lesson_path(&course_root, &absolute_path)?;
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_lesson_folder(course_root: String, absolute_path: String) -> Result<(), String> {
    let lesson = resolve_lesson_path(&course_root, &absolute_path)?;
    let folder = lesson
        .parent()
        .ok_or_else(|| "lesson folder is unavailable".to_string())?;
    tauri_plugin_opener::open_path(folder, None::<&str>).map_err(|error| error.to_string())
}

pub fn resolve_lesson_path(course_root: &str, absolute_path: &str) -> Result<PathBuf, String> {
    let root = canonical_dir(course_root)?;
    let lesson = canonical_file(absolute_path)?;
    if !lesson.starts_with(&root) {
        return Err("lesson path is outside the selected course folder".to_string());
    }

    Ok(lesson)
}

fn canonical_dir(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if path.is_dir() {
        Ok(path)
    } else {
        Err("course root is not a directory".to_string())
    }
}

fn canonical_file(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if path.is_file() {
        Ok(path)
    } else {
        Err("lesson path is not a file".to_string())
    }
}
