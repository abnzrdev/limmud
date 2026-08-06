# Video Playback Reliability and Picture-in-Picture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lesson playback reliable across source changes, resume, autoplay, Zen mode, and native Picture-in-Picture while streaming media responses with bounded memory.

**Architecture:** Keep the Vidstack player mounted and pass it only lesson-matched source records. Snapshot resume and autoplay intent per source, expose native PiP through the Vidstack 1.15.6 player instance, and stream Rust response bodies through a fixed-size buffer.

**Tech Stack:** React 19, TypeScript 5.8, Vidstack React 1.15.6, Vitest 4, Tauri 2, Rust standard library HTTP server.

## Global Constraints

- Do not install packages, commit, push, expose ports, delete data, or change infrastructure.
- Preserve unrelated and uncommitted changes.
- Diagnostics must never contain absolute paths, course names, notes, subtitles, or content.
- Do not infer native Tauri acceptance from browser or jsdom tests.

---

### Task 1: Lesson-scoped source lifecycle and one-time resume

**Files:**
- Modify: `src/components/workspace/VideoPlayer.tsx`
- Modify: `src/components/workspace/VidstackVideo.tsx`
- Test: `src/components/workspace/VideoPlayer.test.tsx`

**Interfaces:**
- Produces: a stable `VidstackVideo` receiving the current source identity, URL, initial resume position, and autoplay intent.
- Produces: callbacks for playback failures and privacy-safe event diagnostics.

- [ ] Add failing tests proving a pending old URL cannot appear after selection changes and a late old resolution is ignored.
- [ ] Run the focused Vitest file and record the expected failure, or record the unavailable-tool error.
- [ ] Add failing tests proving resume is applied once per source and pause/resume plus seek/pause/resume do not re-seek.
- [ ] Replace independent URL state with a lesson-associated source record and request generation.
- [ ] Remove the lesson-path React key, unload the old provider before activating a new source, and move resume application to one metadata-ready transition.
- [ ] Re-run the focused tests and inspect the diff.

### Task 2: Automatic playback continuity and diagnostics

**Files:**
- Modify: `src/components/workspace/VideoPlayer.tsx`
- Modify: `src/components/workspace/VidstackVideo.tsx`
- Modify: `src/hooks/useAppModel.ts` only if evidence shows autoplay intent is lost there.
- Test: `src/components/workspace/VideoPlayer.test.tsx`
- Test: `src/hooks/useAppModel.test.tsx` only if model behavior changes.

**Interfaces:**
- Consumes: lesson-scoped source identity from Task 1.
- Produces: ready-triggered autoplay and a recoverable visible playback error.

- [ ] Add failing tests for automatic next-source playback, rejected autoplay, and privacy-safe event records.
- [ ] Run focused tests and confirm the intended failure or unavailable runner.
- [ ] Carry autoplay intent to the matching source, request playback when ready, and clear the intent on success or rejection.
- [ ] Remove absolute-path/source logging and render only safe error details.
- [ ] Re-run focused tests and inspect the event ordering.

### Task 3: Native Picture-in-Picture

**Files:**
- Modify: `src/components/workspace/VidstackVideo.tsx`
- Modify: `src/components/workspace/VideoPlayer.tsx`
- Modify: `src/styles.css` only for minimal control/error styling if existing button styles are insufficient.
- Test: `src/components/workspace/VideoPlayer.test.tsx`

**Interfaces:**
- Consumes: Vidstack 1.15.6 `MediaPlayerInstance` methods and `canPictureInPicture` state.
- Produces: a support-gated toggle and visible error callback while preserving the same player session.

- [ ] Add failing tests for hidden unsupported control, enter/exit on the same session, and rejected PiP requests.
- [ ] Run focused tests and confirm the intended failure or unavailable runner.
- [ ] Retain a `MediaPlayerInstance` ref and use `enterPictureInPicture()`/`exitPictureInPicture()` with version-matched events.
- [ ] Add the minimal support-gated control and concise error state.
- [ ] Re-run focused tests and inspect the diff.

### Task 4: Bounded Rust media streaming

**Files:**
- Modify: `src-tauri/src/media_server.rs`
- Test: `src-tauri/tests/media_server_tests.rs`

**Interfaces:**
- Produces: `write_file_body(writer, file, count)` using a fixed-size buffer and exact byte count.
- Preserves: response status, CORS, `HEAD`, content length/range, open-ended ranges, root validation, and loopback binding.

- [ ] Add failing tests for full/ranged HEAD, open-ended ranges, and bounded body copying.
- [ ] Run the focused Rust test target and confirm failure or unavailable compiler.
- [ ] Split header writing from body copying and stream the exact range through a fixed-size stack buffer.
- [ ] Re-run Rust tests and inspect response bytes and headers.

### Task 5: Verification and acceptance report

**Files:**
- Review all modified files and both uncommitted design documents.

- [ ] Run focused Vitest tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Attempt only safe, non-installing native Tauri GUI acceptance; clearly report if display, dependencies, or runtime prevent it.
- [ ] Run `git diff --check`, review focused diffs, and verify no private identifiers remain in playback logs/errors.
- [ ] Report changed files, root causes, real command output, remaining risks, rollback points, and unverified GUI behavior.
