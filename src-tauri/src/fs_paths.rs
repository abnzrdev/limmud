use std::path::{Path, PathBuf};

pub fn course_state_dir(course_root: &Path) -> PathBuf {
    course_root.join(".learningappoffline")
}

pub fn course_state_file(course_root: &Path) -> PathBuf {
    course_state_dir(course_root).join("state.json")
}

pub fn course_progress_file(course_root: &Path) -> PathBuf {
    course_state_dir(course_root).join("progress.json")
}

pub fn course_todos_file(course_root: &Path) -> PathBuf {
    course_state_dir(course_root).join("todos.json")
}

pub fn course_recovery_file(course_root: &Path) -> PathBuf {
    course_state_dir(course_root)
        .join("recovery")
        .join("unsaved-notes.json")
}

pub fn course_resources_dir(course_root: &Path) -> PathBuf {
    course_state_dir(course_root).join("resources")
}

pub fn course_resources_file(course_root: &Path) -> PathBuf {
    course_state_dir(course_root).join("resources.json")
}

pub fn app_config_file() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("LearningAppOffline")
        .join("config.json")
}
