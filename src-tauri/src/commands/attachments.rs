use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::persistence::LessonResource;

#[tauri::command]
pub fn import_attachment(source_path: String, target_directory: String) -> Result<String, String> {
    let imported = crate::persistence::import_attachment_file(
        &PathBuf::from(source_path),
        &PathBuf::from(target_directory),
    )
    .map_err(|error| error.to_string())?;

    Ok(imported.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_lesson_resources(
    course_root: String,
    lesson_path: String,
) -> Result<Vec<LessonResource>, String> {
    let root = PathBuf::from(course_root);
    let resources =
        crate::persistence::read_resource_metadata(&crate::fs_paths::course_resources_file(&root))
            .map_err(|error| error.to_string())?;

    Ok(resources
        .into_iter()
        .filter(|resource| lesson_path.is_empty() || resource.lesson_path == lesson_path)
        .collect())
}

#[tauri::command]
pub fn import_lesson_resources(
    course_root: String,
    lesson_path: String,
    source_paths: Vec<String>,
) -> Result<Vec<LessonResource>, String> {
    if source_paths.is_empty() {
        return Err("no resource files selected".to_string());
    }

    let root = PathBuf::from(course_root);
    let resources_dir = crate::fs_paths::course_resources_dir(&root);
    let metadata_path = crate::fs_paths::course_resources_file(&root);
    let mut existing = crate::persistence::read_resource_metadata(&metadata_path)
        .map_err(|error| error.to_string())?;
    let imported_at = unix_millis();
    let mut imported = Vec::with_capacity(source_paths.len());

    fs::create_dir_all(&resources_dir).map_err(|error| error.to_string())?;

    for (index, source) in source_paths.iter().enumerate() {
        let source_path = PathBuf::from(source);
        if !source_path.is_file() {
            return Err(format!("{source} is not a file"));
        }
        let extension = source_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .ok_or_else(|| format!("{source} has no supported extension"))?;
        let category = resource_category(&extension)
            .ok_or_else(|| format!("{extension} files are not supported"))?;
        let original_filename = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "missing resource filename".to_string())?
            .to_string();
        let id = format!("resource-{imported_at}-{index}");
        let target_path = unique_resource_path(&resources_dir, &format!("{id}.{extension}"));
        fs::copy(&source_path, &target_path).map_err(|error| error.to_string())?;
        let stored_relative_path = target_path
            .strip_prefix(&root)
            .unwrap_or(&target_path)
            .to_string_lossy()
            .replace('\\', "/");

        imported.push(LessonResource {
            id,
            original_filename,
            stored_relative_path,
            category: category.to_string(),
            lesson_path: lesson_path.clone(),
            imported_at: imported_at.clone(),
        });
    }

    existing.extend(imported.clone());
    crate::persistence::write_resource_metadata(&metadata_path, &existing)
        .map_err(|error| error.to_string())?;

    Ok(existing
        .into_iter()
        .filter(|resource| resource.lesson_path == lesson_path)
        .collect())
}

#[tauri::command]
pub fn open_resource(course_root: String, stored_relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(course_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let resource = root
        .join(stored_relative_path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !resource.starts_with(&root) || !resource.is_file() {
        return Err("resource path is outside the selected course folder".to_string());
    }

    tauri_plugin_opener::open_path(resource, None::<&str>).map_err(|error| error.to_string())
}

fn resource_category(extension: &str) -> Option<&'static str> {
    match extension {
        "png" | "jpg" | "jpeg" | "webp" => Some("image"),
        "pdf" => Some("pdf"),
        "txt" | "md" => Some("text"),
        "js" | "ts" | "jsx" | "tsx" | "html" | "css" | "py" | "rs" | "json" => Some("code"),
        _ => None,
    }
}

fn unique_resource_path(resources_dir: &Path, file_name: &str) -> PathBuf {
    let mut candidate = resources_dir.join(file_name);
    let stem = file_name
        .trim_end_matches(|ch: char| ch != '.')
        .trim_end_matches('.');
    let extension = file_name.rsplit_once('.').map(|(_, extension)| extension);
    let mut index = 1;

    while candidate.exists() {
        let next_name = match extension {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{file_name}-{index}"),
        };
        candidate = resources_dir.join(next_name);
        index += 1;
    }

    candidate
}

fn unix_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
