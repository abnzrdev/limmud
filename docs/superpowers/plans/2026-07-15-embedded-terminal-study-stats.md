# Embedded Terminal and Study Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real course-root PTY terminal and accurate, batched in-app playback statistics.

**Architecture:** Keep terminal presentation in one focused React component and process ownership in one Rust module. Reuse the existing Tauri wrapper and course-state persistence path; accumulate fractional playback at the video event boundary and debounce the existing whole-state writer.

**Tech Stack:** React 19, TypeScript, xterm.js, Tauri 2 Channels/managed state, Rust, portable-pty, Vitest.

## Global Constraints

- Preserve existing local changes and do not commit or push.
- Start a terminal only after the Terminal tab is explicitly opened.
- Use `currentCourseRoot`; never accept an executable path from the frontend.
- Keep `.learningappoffline/progress.json` compatible and local-date streak behavior intact.
- Implement production behavior test-first and run the exact requested verification commands.

---

### Task 1: Frontend terminal command boundary

**Files:**
- Modify: `src/lib/tauri.ts`
- Test: `src/test/tauri.test.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces `terminalStart(courseRoot, cols, rows, onOutput)`, `terminalWrite(sessionId, data)`, `terminalResize(sessionId, cols, rows)`, `terminalClose(sessionId)`, and `terminalRestart(sessionId, courseRoot, cols, rows, onOutput)`.

- [ ] Add failing wrapper tests that assert exact Tauri command names, camelCase arguments, Channel wiring, and return values.
- [ ] Run `npm run test:file -- src/test/tauri.test.ts` and confirm the missing-wrapper failures.
- [ ] Install official `@xterm/xterm` and `@xterm/addon-fit`; implement only the five wrappers using Tauri's existing `invoke` and `Channel`.
- [ ] Re-run the wrapper tests and confirm they pass.

### Task 2: Lazy Notes/Terminal workspace

**Files:**
- Create: `src/components/workspace/CourseTerminal.tsx`
- Modify: `src/components/workspace/NotesTabs.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Modify: `src/styles.css`
- Test: `src/components/workspace/NotesTabs.test.tsx`
- Test: `src/components/workspace/LessonWorkspace.test.tsx`

**Interfaces:**
- `CourseTerminal({ courseRoot, active })` owns one xterm/PTY session.
- `NotesTabs` receives `currentCourseRoot` and keeps `CourseTerminal` mounted after first activation.

- [ ] Add failing tests for tab selection, preserved note text, no startup before click, current root startup, input/resize forwarding, course-change/unmount close, and readable startup errors.
- [ ] Run both focused workspace tests and confirm expected failures.
- [ ] Implement `CourseTerminal` with xterm, FitAddon, `ResizeObserver`, accessible actions, lazy start, course-change restart, and complete disposal.
- [ ] Add the two main tab buttons and hidden-but-mounted terminal behavior to `NotesTabs`; pass `currentCourseRoot` from `LessonWorkspace`.
- [ ] Add minimal amber/dark layout styles using the existing workspace heights and Zen layout.
- [ ] Re-run both focused tests and confirm they pass.

### Task 3: Real PTY backend

**Files:**
- Create: `src-tauri/src/terminal.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`

**Interfaces:**
- Commands: `terminal_start`, `terminal_write`, `terminal_resize`, `terminal_close`, `terminal_restart`.
- Managed `TerminalState` owns all active sessions and `close_all()` handles application exit.

- [ ] Add Rust unit tests for canonical directories, invalid/missing paths, unique IDs, write/resize/close, unknown IDs, duplicate close, and child-exit cleanup where reliable.
- [ ] Run the terminal Rust tests and confirm failures before the module exists.
- [ ] Add `portable-pty = "0.9"`; implement shell validation, PTY creation, reader-thread Channel streaming, safe map access, idempotent close, fresh restart, and shutdown cleanup.
- [ ] Register managed state, commands, and application-exit cleanup in `lib.rs`.
- [ ] Run `cargo test terminal` and confirm the focused Rust tests pass.

### Task 4: Fractional watch accumulation

**Files:**
- Modify: `src/components/workspace/VideoPlayer.tsx`
- Test: `src/components/workspace/VideoPlayer.test.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`

**Interfaces:**
- `VideoPlayer` emits whole `onWatchedSeconds` values and calls `onPlaybackFlush` on pause, ended, and cleanup.

- [ ] Add failing tests proving four 0.25-second deltas emit one second, paused events emit nothing, seek jumps are ignored, flush fires, and ended still calls the completion handler.
- [ ] Run the focused player tests and confirm the accumulator failures.
- [ ] Implement one fractional remainder ref plus baseline reset/flush helpers; do not alter auto-advance semantics.
- [ ] Re-run the player and workspace tests and confirm they pass.

### Task 5: Debounced persistence and visible statistics

**Files:**
- Modify: `src/hooks/useAppModel.ts`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Test: `src/hooks/useAppModel.test.tsx`
- Test: `src/components/layout/AppShell.test.tsx`
- Test: `src/test/persistence.test.ts`

**Interfaces:**
- `AppModel.flushCourseState()` requests immediate persistence of the latest course snapshot.
- `formatStudyDuration(seconds)` returns seconds below 60 and readable minute/hour output otherwise.

- [ ] Add failing tests for debounced writes, explicit flush, persistence warning, restored stats, one-day first watch streak, seconds formatting, and “In-app playback only”.
- [ ] Run the three focused tests and confirm expected failures.
- [ ] Replace the eager persistence effect with one timer/ref-backed writer and explicit flush token; report write errors in `status`.
- [ ] Wire pause/end cleanup flush through `LessonWorkspace`; format durations and add the playback-only note.
- [ ] Re-run the three tests and confirm they pass.

### Task 6: Full verification and manual check

**Files:**
- Verify all changed files; do not alter unrelated files.

- [ ] Run `npm run build`.
- [ ] Run each six requested `npm run test:file -- ...` commands plus the terminal wrapper test.
- [ ] Run `cd src-tauri && cargo test`.
- [ ] Inspect `git diff --check`, `git status --short`, and the complete diff for unrelated changes.
- [ ] Launch the Tauri app when the environment supports a GUI and exercise the requested PTY/video scenarios; otherwise record the exact environmental blocker.
