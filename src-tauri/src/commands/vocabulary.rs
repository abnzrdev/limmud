use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedVocabularyItem {
    pub id: String,
    pub headword: String,
    pub dictionary_entry_id: i64,
    pub source_key: String,
    pub part_of_speech: Option<String>,
    pub short_definition: String,
    pub added_at: String,
    pub lesson_relative_path: Option<String>,
    pub video_position_seconds: Option<f64>,
    pub personal_note: String,
    pub status: String,
    pub review_count: u32,
    pub last_reviewed_at: Option<String>,
}

fn vocabulary_file(course_root: &str) -> Result<PathBuf, String> {
    let root = Path::new(course_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !root.is_dir() {
        return Err("Course root is not a directory".into());
    }
    Ok(crate::fs_paths::course_state_dir(&root).join("vocabulary.json"))
}

fn validate(item: &SavedVocabularyItem) -> Result<(), String> {
    if item.id.trim().is_empty()
        || item.headword.trim().is_empty()
        || item.dictionary_entry_id <= 0
        || !matches!(item.status.as_str(), "new" | "learning" | "known")
    {
        return Err("Invalid vocabulary item".into());
    }
    if let Some(path) = &item.lesson_relative_path {
        let path = Path::new(path);
        if path.is_absolute()
            || path.components().any(|part| {
                matches!(
                    part,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err("Vocabulary lesson path must be course-relative".into());
        }
    }
    Ok(())
}

fn read_items(path: &Path) -> Result<Vec<SavedVocabularyItem>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Vocabulary file is malformed: {error}"))
}

fn write_items(path: &Path, values: &[SavedVocabularyItem]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid vocabulary path")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(values).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vocabulary_list(course_root: String) -> Result<Vec<SavedVocabularyItem>, String> {
    read_items(&vocabulary_file(&course_root)?)
}

#[tauri::command]
pub fn vocabulary_save(
    course_root: String,
    item: SavedVocabularyItem,
) -> Result<Vec<SavedVocabularyItem>, String> {
    validate(&item)?;
    let path = vocabulary_file(&course_root)?;
    let mut values = read_items(&path)?;
    if values.iter().any(|value| value.id == item.id) {
        return Err("Vocabulary item already exists".into());
    }
    values.push(item);
    write_items(&path, &values)?;
    Ok(values)
}

#[tauri::command]
pub fn vocabulary_update(
    course_root: String,
    item: SavedVocabularyItem,
) -> Result<Vec<SavedVocabularyItem>, String> {
    validate(&item)?;
    let path = vocabulary_file(&course_root)?;
    let mut values = read_items(&path)?;
    let current = values
        .iter_mut()
        .find(|value| value.id == item.id)
        .ok_or("Vocabulary item was not found")?;
    *current = item;
    write_items(&path, &values)?;
    Ok(values)
}

#[tauri::command]
pub fn vocabulary_remove(
    course_root: String,
    id: String,
) -> Result<Vec<SavedVocabularyItem>, String> {
    let path = vocabulary_file(&course_root)?;
    let mut values = read_items(&path)?;
    values.retain(|value| value.id != id);
    write_items(&path, &values)?;
    Ok(values)
}
