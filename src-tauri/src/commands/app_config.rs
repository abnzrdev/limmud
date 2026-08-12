use std::collections::BTreeMap;
use std::path::Path;

#[tauri::command]
pub fn read_app_config() -> Result<BTreeMap<String, String>, String> {
    crate::persistence::read_json_map(&crate::fs_paths::app_config_file())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_app_config(state: BTreeMap<String, String>) -> Result<(), String> {
    crate::persistence::write_json_map(&crate::fs_paths::app_config_file(), &state)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn install_course_cover(course_root: String, source_path: String) -> Result<String, String> {
    crate::course_covers::install(
        &course_root,
        Path::new(&source_path),
        &crate::fs_paths::app_course_covers_dir(),
    )
    .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn remove_course_cover(course_root: String) -> Result<(), String> {
    crate::course_covers::remove(&course_root, &crate::fs_paths::app_course_covers_dir())
}
