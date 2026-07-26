# Offline Learner Dictionary Implementation Plan

> **For agentic workers:** Execute inline and preserve the existing uncommitted terminal/note/cursor fixes. Do not commit or push.

**Goal:** Build, install, query, display, and save vocabulary from a fully offline Kaikki dictionary pack with optional strict Open English WordNet 2025 enrichment.

**Architecture:** Python streams source files into a versioned SQLite/FTS5 pack. Rust validates and atomically installs the pack in app data, serves typed read-only queries, and persists per-course vocabulary. React displays a non-destructive right drawer and sends only typed command arguments.

**Tech Stack:** Python 3 standard library, SQLite/FTS5, Rust `rusqlite` bundled, Tauri v2, React 19, TypeScript, Vitest.

## Global Constraints

- No application network access, downloads, accounts, AI, telemetry, or cloud storage.
- Kaikki is primary and must work without WordNet.
- Only official Open English WordNet 2025 JSON is supported.
- Keep sources and licenses separable.
- Do not commit source dumps, generated packs, production databases, or `diagnostics/`.
- All filesystem and SQLite runtime operations execute in Rust.

---

### Task 1: Streaming Pack Builder

**Files:**
- Create: `scripts/dictionary/build_dictionary_pack.py`
- Create: `scripts/dictionary/test_build_dictionary_pack.py`
- Create: `scripts/dictionary/fixtures/kaikki-small.jsonl`
- Create: `scripts/dictionary/fixtures/oewn-2025.json`
- Modify: `.gitignore`

**Interfaces:**
- CLI: `--input PATH --output PATH [--language en] [--include-etymology] [--include-translations] [--wordnet PATH] [--limit N] [--overwrite] [--metadata-output PATH]`
- Produces schema version `1` and `build_complete=1`.

- [ ] Write failing `unittest` cases for JSONL/gzip streaming, English filtering, senses/POS/sounds/forms/relations, optional fields, malformed input, atomic failure, deterministic content, and strict OEWN 2025 metadata/shape rejection.
- [ ] Run `python3 -m unittest scripts.dictionary.test_build_dictionary_pack` and verify missing module/API failures.
- [ ] Implement schema creation, batched streaming import, versioned `import_oewn_2025`, validation, atomic replacement, recap, and metadata JSON using only stdlib.
- [ ] Re-run builder tests and build both Kaikki-only and Kaikki+WordNet fixture packs.

### Task 2: Rust Dictionary Runtime

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Create: `src-tauri/src/dictionary.rs`
- Create: `src-tauri/src/commands/dictionary.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Commands: `dictionary_status`, `dictionary_import_pack`, `dictionary_remove_pack`, `dictionary_search`, `dictionary_lookup`, `dictionary_get_entry`, `dictionary_get_related_words`, `dictionary_get_random_words`.
- All responses are serializable structs; all errors are `{ code, message }`.

- [ ] Add failing Rust tests for FTS5 availability, valid/corrupt/schema-mismatched import, Kaikki-only status, exact/normalized/form/prefix/FTS/Unicode/duplicate lookup, bounded limits, WordNet relations, missing state, and read-only opening.
- [ ] Run focused Cargo tests and verify failures caused by absent runtime.
- [ ] Add `rusqlite = { version = "0.32", features = ["bundled", "functions"] }`, confirm `ENABLE_FTS5`, and implement app-data path resolution, validation, atomic copy, bounded prepared queries, entry assembly, and removal.
- [ ] Register commands and run focused plus full Rust tests.

### Task 3: Course Vocabulary Persistence

**Files:**
- Create: `src-tauri/src/commands/vocabulary.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Commands: `vocabulary_list`, `vocabulary_save`, `vocabulary_update`, `vocabulary_remove`.
- File: `<course>/.learningappoffline/vocabulary.json`.

- [ ] Add failing tests for CRUD, duplicate senses, lesson-relative paths, status/note edits, malformed recovery, course containment, and absence of absolute paths in JSON.
- [ ] Implement canonical course-root validation and atomic JSON writes using existing persistence patterns.
- [ ] Run focused and full Rust tests.

### Task 4: Typed Frontend Boundary and Drawer

**Files:**
- Create: `src/types/dictionary.ts`
- Modify: `src/lib/tauri.ts`
- Create: `src/components/dictionary/DictionaryDrawer.tsx`
- Create: `src/components/dictionary/DictionaryDrawer.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Typed wrappers mirror Task 2/3 commands.
- Drawer props include `open`, `onClose`, `courseRoot`, `lessonRelativePath`, and `videoPositionSeconds`.

- [ ] Add failing tests for toolbar button, shortcuts, empty/import/error states, loading/stale search, exact/multiple-sense/details/attribution/no-result views, keyboard navigation, focus, themes, and vocabulary controls.
- [ ] Implement minimal typed wrappers, toolbar trigger, overlay drawer, 150 ms search, stale request guard, entry rendering, sources, and vocabulary panel.
- [ ] Run focused then full frontend tests.

### Task 5: Notes Selection Lookup

**Files:**
- Modify: `src/components/workspace/NotesTabs.tsx`
- Modify: `src/components/workspace/NotesTabs.test.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- `NotesTabs.onLookupSelection?: (text: string) => void`.
- Accept only trimmed selections of `1..=80` characters.

- [ ] Add failing tests proving selection lookup opens the dictionary, trims punctuation, leaves note/draft unchanged, and ignores invalid lengths.
- [ ] Read CodeMirror’s current selection through its existing editor ref; add action and `Ctrl+Shift+L` handler without intercepting unrelated shortcuts.
- [ ] Run focused and full frontend tests.

### Task 6: Attribution, Documentation, and Final Verification

**Files:**
- Create: `docs/dictionary-data.md`
- Modify: `.gitignore`

- [ ] Document exact Kaikki fields, official `english-wordnet-2025-json.zip`, rebuild commands, pack/app-data locations, licenses, and separation from application-source licensing.
- [ ] Run the builder on the fixture and record schema, counts, size, duration, sources, and validation.
- [ ] Run `npm run build`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- [ ] Inspect `git status --short` to confirm generated packs/dumps are absent and `diagnostics/` remains untracked.
