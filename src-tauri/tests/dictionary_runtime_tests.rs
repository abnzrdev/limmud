use std::{
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use limmud_lib::dictionary::{get_entry, search, validate_pack};

fn fixture_pack() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let output = std::env::temp_dir().join(format!(
        "offlearn-dictionary-{}.dict.sqlite",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let status = Command::new("python3")
        .current_dir(&root)
        .args([
            "scripts/dictionary/build_dictionary_pack.py",
            "--input",
            "scripts/dictionary/fixtures/kaikki-small.jsonl",
            "--output",
            output.to_str().unwrap(),
            "--include-etymology",
        ])
        .status()
        .expect("run fixture builder");
    assert!(status.success());
    output
}

fn fixture_pack_with_wordnet() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let archive = std::env::temp_dir().join(format!("{nonce}/english-wordnet-2025-json.zip"));
    std::fs::create_dir_all(archive.parent().unwrap()).unwrap();
    let script = format!("from pathlib import Path\nfrom scripts.dictionary.test_build_dictionary_pack import write_oewn_fixture\nwrite_oewn_fixture(Path({:?}))", archive);
    assert!(Command::new("python3")
        .current_dir(&root)
        .args(["-c", &script])
        .status()
        .unwrap()
        .success());
    let output = archive.parent().unwrap().join("wordnet.dict.sqlite");
    assert!(Command::new("python3")
        .current_dir(&root)
        .args([
            "scripts/dictionary/build_dictionary_pack.py",
            "--input",
            "scripts/dictionary/fixtures/kaikki-small.jsonl",
            "--output",
            output.to_str().unwrap(),
            "--wordnet",
            archive.to_str().unwrap(),
        ])
        .status()
        .unwrap()
        .success());
    output
}

#[test]
fn validates_and_searches_exact_form_prefix_and_fts() {
    let pack = fixture_pack();
    let status = validate_pack(&pack).expect("valid pack");
    assert_eq!(status.entry_count, 4);
    assert_eq!(search(&pack, "RUN", 30, 0).unwrap()[0].headword, "run");
    assert_eq!(
        search(&pack, "running", 30, 0).unwrap()[0]
            .matched_form
            .as_deref(),
        Some("running")
    );
    assert_eq!(search(&pack, "caf", 30, 0).unwrap()[0].headword, "café");
    assert_eq!(
        search(&pack, "young person", 30, 0).unwrap()[0].headword,
        "child"
    );
    std::fs::remove_file(pack).unwrap();
}

#[test]
fn returns_full_duplicate_entry_and_bounds_limits() {
    let pack = fixture_pack();
    let results = search(&pack, "run", 30, 0).unwrap();
    assert_eq!(results.len(), 2);
    let entry = get_entry(&pack, results[0].entry_id).unwrap();
    assert_eq!(entry.headword, "run");
    assert!(!entry.parts_of_speech[0].senses.is_empty());
    assert!(search(&pack, "run", 31, 0).is_err());
    std::fs::remove_file(pack).unwrap();
}

#[test]
fn rejects_corrupt_and_missing_packs() {
    let path = std::env::temp_dir().join("offlearn-corrupt-dictionary.sqlite");
    std::fs::write(&path, "not sqlite").unwrap();
    assert!(validate_pack(&path).is_err());
    std::fs::remove_file(path).unwrap();
    assert!(
        validate_pack(PathBuf::from("/definitely/missing/dictionary.sqlite").as_path()).is_err()
    );
}

#[test]
fn rejects_unsupported_schema_and_missing_metadata_or_license() {
    for sql in [
        "UPDATE pack_metadata SET value='999' WHERE key='schema_version'",
        "DELETE FROM pack_metadata WHERE key='build_complete'",
        "UPDATE dictionary_sources SET license_name='' WHERE source_key='kaikki-wiktionary'",
    ] {
        let pack = fixture_pack();
        rusqlite::Connection::open(&pack)
            .unwrap()
            .execute(sql, [])
            .unwrap();
        assert!(
            validate_pack(&pack).is_err(),
            "accepted invalid pack after: {sql}"
        );
        std::fs::remove_file(pack).unwrap();
    }
}

#[test]
fn enriches_kaikki_entries_with_separate_wordnet_relations() {
    let pack = fixture_pack_with_wordnet();
    let run = search(&pack, "run", 30, 0).unwrap()[0].clone();
    let entry = get_entry(&pack, run.entry_id).unwrap();
    assert!(entry
        .parts_of_speech
        .iter()
        .any(|part| part.name.starts_with("WordNet")));
    assert!(entry
        .related_words
        .iter()
        .any(|relation| relation.source == "Open English WordNet"
            && relation.target_word == "running"));
    assert!(entry
        .sources
        .iter()
        .any(|source| source.source_key == "open-english-wordnet-2025"));
    std::fs::remove_dir_all(pack.parent().unwrap()).unwrap();
}
