# Course Materials and Unified Study Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scanner-backed Course Materials and course-specific, source-attributed active study time for video and terminal without double counting.

**Architecture:** Extend the existing persistence repair path, add one pure elapsed-time tracker with a thin React hook, route existing player/xterm lifecycle signals through it in `AppShell`, and derive materials from existing scanner entries plus imported metadata. Existing refresh, guarded Tauri open/import commands, PTY lifecycle, progress, and note recovery remain authoritative.

**Tech Stack:** React 19, TypeScript 5.8, Vitest/Testing Library, Tauri v2, Rust, xterm.js, Lucide React.

## Global Constraints

- Do not commit or push.
- Preserve the already-verified Save Notes recovery and Refresh Course changes.
- Never read the filesystem directly from React or expose `.learningappoffline/`.
- `StudyActivitySource` is exactly `"video" | "terminal"`; do not implement notes activity.
- `TERMINAL_IDLE_TIMEOUT_MS = 60_000`.
- Use `performance.now()` and discard unexpectedly large timer gaps.
- Attribute overlapping time to Terminal before Video and emit at most one study second per wall-clock second.
- Never inspect, store, forward to the tracker, or log terminal input contents.
- Keep Focus Timer independent.
- Preserve symlink/course-root containment through existing Rust/Tauri commands.

---

### Task 1: Study stats migration and source-aware persistence

**Files:**
- Modify: `src/lib/persistence.ts`
- Modify: `src/test/persistence.test.ts`
- Modify: `src/hooks/useAppModel.ts`
- Modify: `src/hooks/useAppModel.test.tsx`

**Interfaces:**
- Produces: `StudySourceStats`, extended `StudyStats`, and `addStudySeconds(stats, source, seconds, now)`.
- Preserves: `serializeLessonStateRecord`, `deserializeLessonStateRecord`, `withDefaultLessonState`, streak and rollover semantics.

- [ ] **Step 1: Write failing persistence tests** for legacy totals migrating entirely to video, valid new source round trips, malformed/negative/decimal/non-finite fields, mismatched source reconciliation, today-source rollover, and unchanged streak transitions. Assert both source-sum invariants after every repair.
- [ ] **Step 2: Run `npm test -- --run src/test/persistence.test.ts`** and confirm failures are caused by missing source fields/API.
- [ ] **Step 3: Implement minimal repair and serialization** using finite non-negative integer sanitization. Missing legacy source objects assign the full overall value to video; present mismatched objects preserve terminal up to the overall total and assign the remainder to video.
- [ ] **Step 4: Replace `recordWatchedSeconds` with source-aware recording** in `useAppModel`, keeping course-root targeting and existing debounced persistence. Expose `recordStudySeconds(source, seconds, courseRoot?)` through `AppModel`.
- [ ] **Step 5: Run `npm test -- --run src/test/persistence.test.ts src/hooks/useAppModel.test.tsx`** and confirm the focused tests pass.

### Task 2: Pure elapsed-time tracker and React lifecycle hook

**Files:**
- Create: `src/hooks/studyActivityTracker.ts`
- Create: `src/hooks/studyActivityTracker.test.ts`
- Create: `src/hooks/useStudyActivityTracker.ts`
- Create: `src/hooks/useStudyActivityTracker.test.tsx`

**Interfaces:**
- Produces: `StudyActivitySource`, `TERMINAL_IDLE_TIMEOUT_MS`, `MAX_ACTIVITY_GAP_MS`, pure tracker controls, and `useStudyActivityTracker({ courseRoot, lessonId, videoActive, terminalVisible, onRecord })`.
- Hook returns: `{ activeSource, reportTerminalActivity, stopTerminalActivity, flush }`.

- [ ] **Step 1: Write failing pure-engine tests** with an injected clock for video active/paused/seeking/stalled states, terminal start/deadline refresh/timeout, no output activation API, terminal priority, no double counting, fractional accumulation, discarded sleep gaps, course-targeted flush, and unmount-style disposal.
- [ ] **Step 2: Run `npm test -- --run src/hooks/studyActivityTracker.test.ts`** and confirm the missing module/API is the failure.
- [ ] **Step 3: Implement the minimal pure engine** that settles the previous interval before each transition, stores per-source fractional milliseconds, selects terminal then video, emits only whole seconds with the captured course root, and discards gaps above the named cap.
- [ ] **Step 4: Write failing hook tests** for `visibilitychange`, hidden documents, Tauri focus loss, restored focus baselines, course/lesson change flush, and unmount flush. Mock only the Tauri window subscription boundary and clock/timers.
- [ ] **Step 5: Implement the thin hook** with a low-frequency sampling timer, `document.visibilityState`, Tauri `getCurrentWindow().onFocusChanged`, cleanup of listeners/timers, and synchronous settle-before-deactivate ordering.
- [ ] **Step 6: Run both tracker test files** and confirm all tracker behavior passes without per-second logging.

### Task 3: Video and terminal activity signals

**Files:**
- Modify: `src/components/workspace/VideoPlayer.tsx`
- Modify: `src/components/workspace/VideoPlayer.test.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Modify: `src/components/workspace/CourseTerminal.tsx`
- Modify: `src/components/workspace/CourseTerminal.test.tsx`

**Interfaces:**
- VideoPlayer produces: `onStudyActivityChange(active: boolean)` based on playing, paused, ended, seeking, and stalled lifecycle.
- CourseTerminal consumes: `onUserActivity?: () => void`, `onActivityStopped?: () => void`; callbacks are content-free.

- [ ] **Step 1: Write failing VideoPlayer tests** proving play activates, pause/end/seeking/stalled deactivate, recovery events reactivate only during playback, and progress/resume callbacks remain unchanged.
- [ ] **Step 2: Run the VideoPlayer test file** and confirm failures reflect missing activity callbacks.
- [ ] **Step 3: Add the smallest lifecycle state calculation** to VideoPlayer and thread it through LessonWorkspace without changing playback progress accounting.
- [ ] **Step 4: Write failing CourseTerminal tests** proving xterm `onData` calls generic activity before PTY write, original data still reaches PTY, callback receives no arguments, output/resize/startup do not trigger activity, and close/restart signal activity stop.
- [ ] **Step 5: Run the CourseTerminal test file** and confirm the new expectations fail for missing callbacks.
- [ ] **Step 6: Wire the callbacks at the existing xterm `onData`, close, and restart seams** without reading or logging input contents and without closing PTYs on visibility/layout changes.
- [ ] **Step 7: Run both component test files** and confirm existing terminal and video behavior remains green.

### Task 4: Wire unified tracking and update Stats UI

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tracker hook, `model.recordStudySeconds`, video lifecycle callback, terminal generic activity callback, course/lesson identity, and actual terminal visibility.
- Produces: Stats labels and non-distracting `Studying · Terminal`, `Studying · Video`, or `Idle` state.

- [ ] **Step 1: Write failing AppShell tests** for tracker wiring, terminal-hidden behavior under right collapse/Zen Mode, terminal priority UI, source rows, new explanatory copy, and Focus Timer independence.
- [ ] **Step 2: Run `npm test -- --run src/components/layout/AppShell.test.tsx`** and confirm the UI/wiring assertions fail.
- [ ] **Step 3: Instantiate the tracker once in AppShell** and pass content-free terminal/video signals. Compute terminal visibility from course presence and layout state without altering the PTY mount/lifecycle.
- [ ] **Step 4: Update StudyStatsPanel** to show Today, Total, Streak, Video today, Terminal today, “Active study · Video + Terminal,” the live state, and concise Focus Timer distinction using existing semantic variables and Play, SquareTerminal, Clock3, and Flame/CalendarDays icons.
- [ ] **Step 5: Run the AppShell and tracker tests** and confirm no overlap, hidden, or Focus Timer regressions.

### Task 5: Course Materials derivation and UI

**Files:**
- Create: `src/lib/courseMaterials.ts`
- Create: `src/lib/courseMaterials.test.ts`
- Modify: `src/components/right/AttachmentsPanel.tsx`
- Create or modify: `src/components/right/AttachmentsPanel.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/hooks/useAppModel.ts`
- Modify: `src/hooks/useAppModel.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: exact-path material rows and pure `collectCourseMaterials`, `collectLessonMaterials`, `groupMaterials`, and `filterMaterials` helpers.
- Consumes: scanner `CourseEntry[]`, selected video, lesson entries, imported `LessonResource[]`, existing `openLessonExternal`, `openResource`, import, and refresh callbacks.

- [ ] **Step 1: Write failing pure material tests** for lesson-folder association, whole-course grouping, video/internal exclusion, document classification, exact relative-path identity, duplicate filenames, filename/folder search, and deterministic group order.
- [ ] **Step 2: Run the pure material test file** and confirm failure is the missing helper module.
- [ ] **Step 3: Implement one recursive scanner-entry traversal and small classification/filter helpers**; do not add filesystem calls or a dependency.
- [ ] **Step 4: Write failing panel/model tests** for Course Materials/Add Material copy, empty states, parent-folder secondary text, collapsed summary, grouped rows, correct guarded open command, explicit-only import, refresh add/remove, selected lesson preservation, and dirty note preservation.
- [ ] **Step 5: Run the panel/model tests** and confirm failures match missing Course Materials behavior.
- [ ] **Step 6: Adapt the existing AttachmentsPanel instead of creating a parallel panel**. Merge scanner and imported rows by exact path only, retain duplicates by folder, add local search, sections/groups, Refresh, and existing Add Material action.
- [ ] **Step 7: Run material, AppShell, and model tests** and confirm refresh and note-recovery baselines remain green.

### Task 6: Full verification and manual desktop checks

**Files:**
- Modify only if a requested check exposes a defect in files already listed above.

- [ ] **Step 1: Run `npm run build`** and require successful TypeScript/Vite output.
- [ ] **Step 2: Run `npm test`** and record test-file/test totals.
- [ ] **Step 3: Confirm Rust dependencies/commands are unchanged or valid, then run `cargo test --manifest-path src-tauri/Cargo.toml`** and record totals; allow localhost binding for media-server tests if sandboxed.
- [ ] **Step 4: Use a normal writable test course in the desktop app when GUI execution is available** to perform the requested video, terminal idle/overlap, minimize, restart persistence, add/refresh, and duplicate-name scenarios. Record measured outcomes; explicitly mark unavailable GUI checks as not run.
- [ ] **Step 5: Inspect `git diff --check` and `git status --short`** to catch whitespace errors and report every changed file while preserving all pre-existing user changes.
- [ ] **Step 6: Provide the requested final recap** covering prerequisite status, exact clock/priority algorithm, idle and visibility behavior, migration rule, materials behavior, changed files, tests/totals, manual results, and limitations. Do not commit or push.
