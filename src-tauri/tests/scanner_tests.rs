#[path = "../src/scanner.rs"]
mod scanner;

use scanner::{classify_extension, scan_course};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_course_dir() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("learning-app-offline-{unique}"));
    fs::create_dir_all(&root).expect("create temp dir");
    root
}

#[test]
fn classifies_supported_video_extensions() {
    assert_eq!(classify_extension("mp4"), "video");
    assert_eq!(classify_extension("mkv"), "video");
    assert_eq!(classify_extension("webm"), "video");
    assert_eq!(classify_extension("vtt"), "subtitle");
    assert_eq!(classify_extension("srt"), "subtitle");
    assert_eq!(classify_extension("md"), "note");
}

#[test]
fn scans_supported_files_recursively() {
    let root = make_temp_course_dir();
    let lesson_dir = root.join("Week 1");
    fs::create_dir_all(&lesson_dir).expect("create lesson dir");

    fs::write(lesson_dir.join("lesson.mp4"), b"video").expect("write video");
    fs::write(lesson_dir.join("lesson.vtt"), b"subtitle").expect("write subtitle");
    fs::write(lesson_dir.join("notes.md"), b"# notes").expect("write notes");
    fs::write(lesson_dir.join("ignore.bin"), b"ignored").expect("write other");

    let entries = scan_course(&root).expect("scan course");
    let names: Vec<_> = entries.iter().map(|entry| entry.name.as_str()).collect();
    let lesson_entry = entries
        .iter()
        .find(|entry| entry.name == "Week 1")
        .expect("find lesson directory");
    let children = lesson_entry.children.as_ref().expect("directory children");
    let child_names: Vec<_> = children.iter().map(|entry| entry.name.as_str()).collect();

    assert!(names.contains(&"Week 1"));
    assert!(child_names.contains(&"lesson.mp4"));
    assert!(child_names.contains(&"lesson.vtt"));
    assert!(child_names.contains(&"notes.md"));
    assert!(child_names.contains(&"ignore.bin"));

    fs::remove_dir_all(root).expect("cleanup temp dir");
}

#[test]
fn scans_nested_course_folders_with_spaces_and_media() {
    let root = make_temp_course_dir().join("Offline Courses");
    let course_dir = root.join("Example Course");
    let intro_dir = course_dir.join("0. Introduction");
    let goals_dir = course_dir.join("1. Setting Learning Goals");
    fs::create_dir_all(&intro_dir).expect("create intro dir");
    fs::create_dir_all(&goals_dir).expect("create goals dir");

    fs::write(intro_dir.join("01. Course introduction.mp4"), b"video").expect("write intro video");
    fs::write(intro_dir.join("01. Course introduction.srt"), b"subtitle")
        .expect("write intro subtitle");
    fs::write(
        goals_dir.join("01. Define your learning goals.mp4"),
        b"video",
    )
    .expect("write nested video");
    fs::write(goals_dir.join("notes.txt"), b"notes").expect("write notes");

    let entries = scan_course(&course_dir).expect("scan nested course");
    let first_section = entries
        .iter()
        .find(|entry| entry.name == "0. Introduction")
        .expect("find intro section");
    let second_section = entries
        .iter()
        .find(|entry| entry.name == "1. Setting Learning Goals")
        .expect("find goals section");

    assert!(first_section
        .children
        .as_ref()
        .expect("intro children")
        .iter()
        .any(|entry| entry.kind == "video" && entry.name.ends_with(".mp4")));
    assert!(first_section
        .children
        .as_ref()
        .expect("intro children")
        .iter()
        .any(|entry| entry.kind == "subtitle" && entry.name.ends_with(".srt")));
    assert!(second_section
        .children
        .as_ref()
        .expect("goals children")
        .iter()
        .any(|entry| entry.kind == "video" && entry.name.ends_with(".mp4")));

    fs::remove_dir_all(root).expect("cleanup temp dir");
}

#[test]
fn scans_entries_in_natural_order_without_dropping_folders() {
    let root = make_temp_course_dir();
    let section_1 = root.join("1. Intro");
    let section_2 = root.join("2. Basics");
    let section_10 = root.join("10. Unicode Урок");
    let empty_section = root.join("11. Empty Folder");
    let notes_only = root.join("12. Notes Only");
    fs::create_dir_all(&section_1).expect("create section 1");
    fs::create_dir_all(&section_2).expect("create section 2");
    fs::create_dir_all(&section_10).expect("create section 10");
    fs::create_dir_all(&empty_section).expect("create empty section");
    fs::create_dir_all(&notes_only).expect("create notes-only section");

    fs::write(section_1.join("1. Welcome.mp4"), b"video").expect("write video 1");
    fs::write(section_1.join("10. Later.mp4"), b"video").expect("write video 10");
    fs::write(section_1.join("2. Setup.mp4"), b"video").expect("write video 2");
    fs::write(section_2.join("Lesson with spaces.mp4"), b"video").expect("write spaced video");
    fs::write(section_10.join("Урок 2.mp4"), b"video").expect("write unicode video 2");
    fs::write(section_10.join("Урок 10.mp4"), b"video").expect("write unicode video 10");
    fs::write(notes_only.join("notes.txt"), b"notes").expect("write notes");

    let entries = scan_course(&root).expect("scan course");
    let names: Vec<_> = entries.iter().map(|entry| entry.name.as_str()).collect();
    let section_1_children: Vec<_> = entries[0]
        .children
        .as_ref()
        .expect("section 1 children")
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    let section_10_children: Vec<_> = entries[2]
        .children
        .as_ref()
        .expect("section 10 children")
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();

    assert_eq!(
        names,
        [
            "1. Intro",
            "2. Basics",
            "10. Unicode Урок",
            "11. Empty Folder",
            "12. Notes Only"
        ]
    );
    assert_eq!(
        section_1_children,
        ["1. Welcome.mp4", "2. Setup.mp4", "10. Later.mp4"]
    );
    assert_eq!(section_10_children, ["Урок 2.mp4", "Урок 10.mp4"]);
    assert_eq!(
        entries[3]
            .children
            .as_ref()
            .expect("empty folder children")
            .len(),
        0
    );
    assert_eq!(
        entries[4]
            .children
            .as_ref()
            .expect("notes-only children")
            .first()
            .expect("notes entry")
            .kind,
        "note"
    );

    fs::remove_dir_all(root).expect("cleanup temp dir");
}

#[test]
fn skips_internal_learningappoffline_state_from_scan_results() {
    let root = make_temp_course_dir();
    let course_dir = root.join("Course");
    let internal_dir = course_dir.join(".learningappoffline");
    fs::create_dir_all(&internal_dir).expect("create internal dir");
    fs::write(course_dir.join("lesson.mp4"), b"video").expect("write lesson");
    fs::write(internal_dir.join("state.json"), b"{}").expect("write state");
    fs::write(internal_dir.join("progress.json"), b"{}").expect("write progress");
    fs::write(internal_dir.join("todos.json"), b"{}").expect("write todos");

    let entries = scan_course(&course_dir).expect("scan course");

    assert!(entries.iter().any(|entry| entry.name == "lesson.mp4"));
    assert!(!entries
        .iter()
        .any(|entry| entry.name == ".learningappoffline"));

    fs::remove_dir_all(root).expect("cleanup temp dir");
}
