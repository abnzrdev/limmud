use std::path::{Path, PathBuf};

const COURSE_STATE_DIR_NAME: &str = ".learningappoffline";
const LEGACY_COURSE_STATE_DIR_NAME: &str = ".limmud";
const APP_CONFIG_DIR_NAME: &str = "Limmud";
const LEGACY_APP_CONFIG_DIR_NAME: &str = "Limmud";

fn preferred_dir(current: PathBuf, legacy: PathBuf) -> PathBuf {
    if current.exists() || !legacy.exists() {
        return current;
    }

    match std::fs::rename(&legacy, &current) {
        Ok(()) => current,
        Err(error) => {
            eprintln!(
                "Limmud could not migrate {} to {}: {error}",
                legacy.display(),
                current.display()
            );
            legacy
        }
    }
}

pub fn course_state_dir(course_root: &Path) -> PathBuf {
    preferred_dir(
        course_root.join(COURSE_STATE_DIR_NAME),
        course_root.join(LEGACY_COURSE_STATE_DIR_NAME),
    )
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
    let config_root = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config");
    preferred_dir(
        config_root.join(APP_CONFIG_DIR_NAME),
        config_root.join(LEGACY_APP_CONFIG_DIR_NAME),
    )
    .join("config.json")
}

pub fn app_course_covers_dir() -> PathBuf {
    app_config_file()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("course-covers")
}
