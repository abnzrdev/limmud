# Offline Learner Dictionary Design

## Scope

Limmud gains a completely offline dictionary made of two independent parts:

1. `scripts/dictionary/build_dictionary_pack.py` converts a local Kaikki/Wiktextract JSONL dump and, optionally, the official Open English WordNet 2025 JSON export into one versioned SQLite pack.
2. Rust installs that prepared pack into Tauri application data and serves bounded, typed dictionary and course-vocabulary commands to React.

The application never downloads dictionary data, processes raw dumps, accepts SQL, or keeps querying a user-selected path. Kaikki is sufficient by itself. WordNet is optional enrichment and remains identifiable in separate tables and results.

## Pack and Builder

Schema version 1 uses SQLite with FTS5. `dictionary_sources` records source key, release/build dates, license, attribution, homepage, and schema version. Kaikki data uses `entries`, `senses`, `examples`, `pronunciations`, `forms`, and `relations`. WordNet data uses `wordnet_synsets`, `wordnet_lemmas`, and `wordnet_relations`. Every Kaikki entry references its source; WordNet rows remain in WordNet-only tables.

FTS tables index entry headwords/normalized headwords/definitions and forms. Relation targets are indexed for synonym discovery. Normalization is Unicode-aware `strip().casefold()` in Python and Unicode lowercase in Rust. Apostrophes, hyphens, and non-ASCII spelling are preserved.

The builder uses only Python’s standard library. It streams `.jsonl` and `.jsonl.gz`, filters `lang_code`, batches inserts in transactions, builds into a sibling temporary file, writes an incomplete build marker in metadata, validates schema/integrity/counts, marks the pack complete, and atomically replaces the requested output. Errors remove the temporary file. Production dumps and databases are ignored by Git; small licensed fixtures are retained.

Kaikki fields retained: word, language code, part of speech, etymology when enabled, glosses/raw glosses, sense tags/IDs, examples and translations when enabled, IPA, pronunciation tags, audio filename only, forms, synonyms, antonyms, derived/related/compound terms, and form-of links. URLs, HTML, templates, categories, warnings, and debug fields are discarded.

The optional WordNet adapter accepts only the official `english-wordnet-2025-json.zip` layout and release metadata. It rejects other JSON shapes and releases. The parser is isolated behind a version-keyed adapter function so a later release can be added explicitly.

## Installation and Runtime

Rust adds `rusqlite` with bundled SQLite/FTS5 support. Installation:

1. User selects a local `.sqlite` or `.dict.sqlite` pack.
2. Rust opens it read-only, validates `PRAGMA integrity_check`, schema version, completion marker, source/license records, and required tables.
3. Rust checks available space, copies to a temporary file under Tauri app data, validates the copy, then atomically renames it to `dictionary/dictionary.sqlite`.
4. Metadata and source license texts are exported beside the database.

Lookups always open the installed database read-only. Commands validate query size, limits, offsets, entry IDs, course roots, and lesson-relative paths. Normal search is capped at 30 results and runs in Tauri async commands via blocking tasks where appropriate.

Search order is exact headword, exact normalized headword, exact form, prefix headword, then FTS. Results are deduplicated by entry ID while preserving priority. No-result responses contain no invented content.

## Course Vocabulary

Vocabulary is stored per course at `.learningappoffline/vocabulary.json` through Rust. Records contain dictionary entry ID and source key, allowing duplicate senses, plus headword, short definition, optional part of speech, lesson-relative path, video position, note, status, and review metadata. Absolute paths are rejected and never serialized. Saving vocabulary never mutates the global pack.

## React UI

`AppShell` owns a right-side overlay drawer so opening Dictionary does not replace or unmount video, notes, or terminal sessions. A `BookOpen` toolbar button and `Ctrl+Shift+D` toggle it. The drawer supports:

- install/status and setup states;
- debounced search with stale-response suppression;
- keyboard result navigation and entry details;
- IPA, meanings, examples, forms, relations, etymology, and explicit sources;
- source/license screen;
- recent searches held locally;
- save-to-course vocabulary controls;
- compact vocabulary list filtered by New/Learning/Known and text.

CodeMirror exposes only its current 1–80 character selection through a callback. `Ctrl+Shift+L` and a “Look up in Dictionary” action trim surrounding punctuation, open the drawer, and populate search without changing or saving the note.

## Errors, Accessibility, and Performance

Rust returns structured error codes for missing/invalid/corrupt/unsupported packs, disk space, installation, query, and vocabulary failures. Dictionary failures remain isolated from course playback and editing.

The drawer uses dialog/complementary semantics, labelled controls, visible focus, selected result state, focus restoration, Up/Down/Enter/Escape navigation, and `Ctrl+L` search focus. Definitions use normal high-contrast surfaces rather than lime backgrounds.

The builder streams input; runtime queries are indexed, bounded, and return only search summaries or one selected entry. Search is debounced 150 ms and stale responses are ignored.

## Verification

Tests cover builder streaming/gzip/filtering/extraction/atomicity/WordNet strictness; Rust schema/integrity/import/search/lookup/read-only/vocabulary behavior; and React installation/search/details/keyboard/selection/vocabulary/accessibility behavior. Final verification runs the fixture builder, frontend build/tests, Rust tests, and `git diff --check`.
