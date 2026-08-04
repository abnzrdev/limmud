use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};
use limmud_lib::commands::vocabulary::{
    vocabulary_list, vocabulary_remove, vocabulary_save, vocabulary_update, SavedVocabularyItem,
};

fn item(id: &str) -> SavedVocabularyItem {
    SavedVocabularyItem {
        id: id.into(),
        headword: "run".into(),
        dictionary_entry_id: 1,
        source_key: "kaikki-wiktionary".into(),
        part_of_speech: Some("verb".into()),
        short_definition: "move swiftly".into(),
        added_at: "2026-07-24T00:00:00Z".into(),
        lesson_relative_path: Some("unit/lesson.mp4".into()),
        video_position_seconds: Some(12.0),
        personal_note: String::new(),
        status: "new".into(),
        review_count: 0,
        last_reviewed_at: None,
    }
}

#[test]
fn persists_updates_and_removes_course_relative_vocabulary() {
    let course = std::env::temp_dir().join(format!(
        "offlearn-vocabulary-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&course).unwrap();
    let root = course.to_string_lossy().into_owned();
    assert!(vocabulary_list(root.clone()).unwrap().is_empty());
    assert_eq!(
        vocabulary_save(root.clone(), item("sense-1"))
            .unwrap()
            .len(),
        1
    );
    let mut changed = item("sense-1");
    changed.personal_note = "remember this".into();
    changed.status = "learning".into();
    assert_eq!(
        vocabulary_update(root.clone(), changed).unwrap()[0].personal_note,
        "remember this"
    );
    let json = fs::read_to_string(course.join(".learningappoffline/vocabulary.json")).unwrap();
    assert!(!json.contains(course.to_string_lossy().as_ref()));
    assert!(vocabulary_remove(root, "sense-1".into())
        .unwrap()
        .is_empty());
    fs::remove_dir_all(course).unwrap();
}

#[test]
fn rejects_absolute_lesson_paths() {
    let course = std::env::temp_dir().join(format!(
        "offlearn-vocabulary-invalid-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&course).unwrap();
    let mut value = item("bad");
    value.lesson_relative_path = Some("/machine/course/lesson.mp4".into());
    assert!(vocabulary_save(course.to_string_lossy().into_owned(), value).is_err());
    fs::remove_dir_all(course).unwrap();
}
