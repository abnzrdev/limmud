#[path = "../src/commands/open_external.rs"]
mod open_external;

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_course_dir() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("learning-app-offline-open-{unique}"));
    fs::create_dir_all(&root).expect("create temp dir");
    root
}

#[test]
fn rejects_opening_lessons_outside_course_root() {
    let root = make_temp_course_dir();
    let outside_root = make_temp_course_dir();
    let outside = outside_root.join("outside.mp4");
    fs::write(&outside, b"video").expect("write outside video");

    let result = open_external::resolve_lesson_path(
        root.to_string_lossy().as_ref(),
        outside.to_string_lossy().as_ref(),
    );

    assert_eq!(
        result.expect_err("outside path should be rejected"),
        "lesson path is outside the selected course folder",
    );

    fs::remove_dir_all(root).expect("cleanup root");
    fs::remove_dir_all(outside_root).expect("cleanup outside");
}
