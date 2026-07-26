# Note Save Recovery and Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make note saves safe and explainable, preserve unsaved content, and rescan an open course without discarding its state.

**Architecture:** Replace the arbitrary-path note command with a canonical course-root plus selected lesson path command returning a serializable `SaveNoteError`. Store only failed drafts in the existing course-local metadata directory. Keep refresh in `useAppModel`, preserving the selected lesson by canonical absolute path and replacing entries only after a successful scan.

**Tech Stack:** Rust/Tauri commands, serde, React, Vitest, existing course-local JSON persistence.

## Global Constraints

- No commits, pushes, permission changes, watchers, new dependencies, or basename identity.
- Sidecar notes remain `<video-name>.notes.md`; recovery is never presented as a successful save.
- Never log note contents or arbitrary user files.

---

### Task 1: Structured canonical note save

**Files:** `src-tauri/src/commands/notes.rs`, `src-tauri/src/persistence.rs`, Rust tests.

- [ ] Write failing tests for canonical writable saves and each structured failure kind.
- [ ] Add a serializable error type and validate canonical course root, canonical selected lesson, containment, target type, and write error kind.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.

### Task 2: Frontend note failures and recovery drafts

**Files:** `src/lib/tauri.ts`, `src/hooks/useAppModel.ts`, `src/components/workspace/NotesTabs.tsx`, styles and focused tests.

- [ ] Write failing tests for a permission error panel, retained dirty content, retry success, recovery restore/removal, and copy actions.
- [ ] Add typed Tauri error parsing and small recovery command wrappers; preserve the in-memory draft if recovery persistence fails.
- [ ] Render the accessible inline error panel and recovery status.
- [ ] Run focused frontend tests.

### Task 3: Refresh current course

**Files:** `src/hooks/useAppModel.ts`, `src/components/sidebar/CourseSidebar.tsx`, `src/components/layout/AppShell.tsx`, tests.

- [ ] Write failing tests for one scan call, loading/disabled UI, selection retention, dirty-draft retention, safe removed-selection fallback, duplicate paths, and scan failure retention.
- [ ] Rescan the existing canonical root, compare flattened path sets for summary, and replace entries only after success.
- [ ] Run focused frontend tests.

### Task 4: Full verification

- [ ] Run `npm run build`, `npm test`, and `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Manually exercise the Flutter course without changing its permissions.
