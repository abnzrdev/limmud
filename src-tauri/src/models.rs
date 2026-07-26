use crate::scanner::ScannedEntry;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseEntry {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub kind: String,
    pub children: Option<Vec<CourseEntry>>,
}

impl From<ScannedEntry> for CourseEntry {
    fn from(value: ScannedEntry) -> Self {
        Self {
            id: value.id,
            name: value.name,
            relative_path: value.relative_path,
            absolute_path: value.absolute_path,
            kind: value.kind,
            children: value
                .children
                .map(|children| children.into_iter().map(CourseEntry::from).collect()),
        }
    }
}
