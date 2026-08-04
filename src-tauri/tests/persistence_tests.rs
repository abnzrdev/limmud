#[path = "../src/fs_paths.rs"]
mod fs_paths;
#[path = "../src/persistence.rs"]
mod persistence;

use persistence::{
    import_attachment_file, merge_course_state, read_json_map, read_note_file,
    read_resource_metadata, split_course_state, write_json_map, write_note_file,
    write_resource_metadata, LessonResource,
};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_dir() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("limmud-persistence-{unique}"));
    fs::create_dir_all(&root).expect("create temp dir");
    root
}

#[test]
fn writes_and_reads_note_files() {
    let root = make_temp_dir();
    let note_path = root.join("lesson.notes.md");

    write_note_file(&note_path, "# Notes").expect("write note");
    let note = read_note_file(&note_path).expect("read note");

    assert_eq!(note, "# Notes");

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn imports_attachment_files_into_the_target_directory() {
    let root = make_temp_dir();
    let source_path = root.join("diagram.png");
    let target_dir = root.join("lesson");

    write_note_file(&source_path, "binary-enough-for-test").expect("seed source");
    let imported = import_attachment_file(&source_path, &target_dir).expect("import attachment");
    let copied = read_note_file(&imported).expect("read imported attachment");

    assert_eq!(imported, target_dir.join("diagram.png"));
    assert_eq!(copied, "binary-enough-for-test");

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn writes_and_reads_json_maps() {
    let root = make_temp_dir();
    let json_path = fs_paths::course_state_dir(&root).join("state.json");
    let mut input = BTreeMap::new();
    input.insert(
        "lastSelectedVideo".to_string(),
        "Week 1/lesson.mp4".to_string(),
    );

    write_json_map(&json_path, &input).expect("write json");
    let output = read_json_map(&json_path).expect("read json");

    assert_eq!(
        output.get("lastSelectedVideo"),
        Some(&"Week 1/lesson.mp4".to_string())
    );

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn exposes_split_course_state_paths() {
    let root = make_temp_dir();

    assert_eq!(
        fs_paths::course_progress_file(&root),
        fs_paths::course_state_dir(&root).join("progress.json")
    );
    assert_eq!(
        fs_paths::course_todos_file(&root),
        fs_paths::course_state_dir(&root).join("todos.json")
    );
    assert_eq!(
        fs_paths::course_resources_dir(&root),
        fs_paths::course_state_dir(&root).join("resources")
    );
    assert_eq!(
        fs_paths::course_resources_file(&root),
        fs_paths::course_state_dir(&root).join("resources.json")
    );

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn writes_and_reads_resource_metadata() {
    let root = make_temp_dir();
    let resources_path = fs_paths::course_resources_file(&root);
    let resources = vec![LessonResource {
        id: "resource-1".to_string(),
        original_filename: "diagram final.png".to_string(),
        stored_relative_path: ".learningappoffline/resources/resource-1.png".to_string(),
        category: "image".to_string(),
        lesson_path: "Week 1/lesson.mp4".to_string(),
        imported_at: "12345".to_string(),
    }];

    write_resource_metadata(&resources_path, &resources).expect("write resource metadata");
    let output = read_resource_metadata(&resources_path).expect("read resource metadata");

    assert_eq!(output, resources);

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn splits_and_merges_course_state_records() {
    let mut input = BTreeMap::new();
    input.insert("timerMode".to_string(), "focus".to_string());
    input.insert(
        "selectedEntryId".to_string(),
        "week-1/lesson.mp4".to_string(),
    );
    input.insert(
        "completedLessons".to_string(),
        "[\"week-1/lesson.mp4\"]".to_string(),
    );
    input.insert(
        "bookmarkedLessons".to_string(),
        "[\"week-1/lesson.mp4\"]".to_string(),
    );
    input.insert("todos".to_string(), "[{\"id\":\"1\"}]".to_string());
    input.insert(
        "videoProgress".to_string(),
        "{\"week-1/lesson.mp4\":12}".to_string(),
    );
    input.insert(
        "studyStats".to_string(),
        "{\"todaySeconds\":120,\"totalSeconds\":360,\"streakDays\":2,\"lastStudyDate\":\"2026-07-09\"}".to_string(),
    );

    let (state, progress, todos) = split_course_state(input);
    let merged = merge_course_state(&[state.clone(), progress.clone(), todos.clone()]);

    assert_eq!(state.get("timerMode"), Some(&"focus".to_string()));
    assert_eq!(
        progress.get("selectedEntryId"),
        Some(&"week-1/lesson.mp4".to_string())
    );
    assert_eq!(
        progress.get("videoProgress"),
        Some(&"{\"week-1/lesson.mp4\":12}".to_string())
    );
    assert_eq!(
        progress.get("completedLessons"),
        Some(&"[\"week-1/lesson.mp4\"]".to_string())
    );
    assert_eq!(
        progress.get("studyStats"),
        Some(&"{\"todaySeconds\":120,\"totalSeconds\":360,\"streakDays\":2,\"lastStudyDate\":\"2026-07-09\"}".to_string())
    );
    assert_eq!(
        progress.get("bookmarkedLessons"),
        Some(&"[\"week-1/lesson.mp4\"]".to_string())
    );
    assert_eq!(todos.get("todos"), Some(&"[{\"id\":\"1\"}]".to_string()));
    assert_eq!(merged.get("timerMode"), Some(&"focus".to_string()));
    assert_eq!(
        merged.get("selectedEntryId"),
        Some(&"week-1/lesson.mp4".to_string())
    );
    assert_eq!(
        merged.get("videoProgress"),
        Some(&"{\"week-1/lesson.mp4\":12}".to_string())
    );
    assert_eq!(
        merged.get("studyStats"),
        Some(&"{\"todaySeconds\":120,\"totalSeconds\":360,\"streakDays\":2,\"lastStudyDate\":\"2026-07-09\"}".to_string())
    );
    assert_eq!(merged.get("todos"), Some(&"[{\"id\":\"1\"}]".to_string()));
}
