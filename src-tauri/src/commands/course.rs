use crate::errors::AppResult;
use crate::models::CourseEntry;
use std::collections::BTreeMap;
use std::path::PathBuf;

#[tauri::command]
pub fn scan_course(path: String) -> Result<Vec<CourseEntry>, String> {
    scan_course_impl(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_course_state(course_root: String) -> Result<BTreeMap<String, String>, String> {
    let root = PathBuf::from(course_root);
    let state = crate::persistence::read_json_map(&crate::fs_paths::course_state_file(&root))
        .map_err(|error| error.to_string())?;
    let progress = crate::persistence::read_json_map(&crate::fs_paths::course_progress_file(&root))
        .map_err(|error| error.to_string())?;
    let todos = crate::persistence::read_json_map(&crate::fs_paths::course_todos_file(&root))
        .map_err(|error| error.to_string())?;

    Ok(crate::persistence::merge_course_state(&[
        state, progress, todos,
    ]))
}

#[tauri::command]
pub fn write_course_state(
    course_root: String,
    state: BTreeMap<String, String>,
) -> Result<(), String> {
    let root = PathBuf::from(course_root);
    let (state_fields, progress_fields, todo_fields) =
        crate::persistence::split_course_state(state);

    crate::persistence::write_json_map(&crate::fs_paths::course_state_file(&root), &state_fields)
        .map_err(|error| error.to_string())?;
    crate::persistence::write_json_map(
        &crate::fs_paths::course_progress_file(&root),
        &progress_fields,
    )
    .map_err(|error| error.to_string())?;
    crate::persistence::write_json_map(&crate::fs_paths::course_todos_file(&root), &todo_fields)
        .map_err(|error| error.to_string())
}

fn scan_course_impl(path: String) -> AppResult<Vec<CourseEntry>> {
    let root = PathBuf::from(path);
    let entries = crate::scanner::scan_course(&root)?;
    Ok(entries.into_iter().map(CourseEntry::from).collect())
}
