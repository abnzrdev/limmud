use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonResource {
    pub id: String,
    pub original_filename: String,
    pub stored_relative_path: String,
    pub category: String,
    pub lesson_path: String,
    pub imported_at: String,
}

pub fn read_note_file(path: &Path) -> io::Result<String> {
    fs::read_to_string(path)
}

pub fn write_note_file(path: &Path, contents: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents)
}

pub fn import_attachment_file(source: &Path, target_directory: &Path) -> io::Result<PathBuf> {
    fs::create_dir_all(target_directory)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing file name"))?;
    let target_path = target_directory.join(file_name);
    fs::copy(source, &target_path)?;
    Ok(target_path)
}

pub fn read_resource_metadata(path: &Path) -> io::Result<Vec<LessonResource>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

pub fn write_resource_metadata(path: &Path, resources: &[LessonResource]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let raw = serde_json::to_string_pretty(resources)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    fs::write(path, format!("{raw}\n"))
}

pub fn read_json_map(path: &Path) -> io::Result<BTreeMap<String, String>> {
    if !path.exists() {
        return Ok(BTreeMap::new());
    }

    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

pub fn write_json_map(path: &Path, value: &BTreeMap<String, String>) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    fs::write(path, format!("{raw}\n"))
}

pub fn split_course_state(
    value: BTreeMap<String, String>,
) -> (
    BTreeMap<String, String>,
    BTreeMap<String, String>,
    BTreeMap<String, String>,
) {
    let mut state_fields = BTreeMap::new();
    let mut progress_fields = BTreeMap::new();
    let mut todo_fields = BTreeMap::new();

    for (key, value) in value {
        match key.as_str() {
            "todos" => {
                todo_fields.insert(key, value);
            }
            "bookmarkedLessons" | "completedLessons" | "selectedEntryId" | "studyStats"
            | "videoProgress" => {
                progress_fields.insert(key, value);
            }
            _ => {
                state_fields.insert(key, value);
            }
        }
    }

    (state_fields, progress_fields, todo_fields)
}

pub fn merge_course_state(parts: &[BTreeMap<String, String>]) -> BTreeMap<String, String> {
    let mut combined = BTreeMap::new();
    for part in parts {
        combined.extend(part.clone());
    }

    combined
}

#[cfg(test)]
mod tests {
    use super::{read_json_map, write_json_map};
    use std::collections::BTreeMap;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn json_map_round_trip_preserves_nested_json_strings() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "learning-app-offline-config-{}-{suffix}.json",
            std::process::id()
        ));
        let mut expected = BTreeMap::new();
        expected.insert("timerPresets".into(), "[25,50,90]".into());
        expected.insert(
            "workspaceLayout".into(),
            r#"{"courseSize":14,"rightSize":28,"openTools":["stats","resources"]}"#.into(),
        );

        write_json_map(&path, &expected).expect("write config");
        let restored = read_json_map(&path).expect("read config");
        fs::remove_file(path).expect("remove config fixture");

        assert_eq!(restored, expected);
    }
}
