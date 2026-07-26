# Course Materials and Unified Study Activity Design

## Scope

Add a Course Materials panel and course-specific active study tracking for video and terminal activity. Reuse the existing scanner, guarded Tauri open/import commands, refresh workflow, playback progress, PTY lifecycle, and course-state persistence. Do not add online services, accounts, AI, telemetry, or notes activity.

The existing Save Notes recovery and Refresh Course work is the baseline. It passed the production build, all 102 frontend tests, and all 32 Rust tests before this feature began.

## Course Materials

Rename the Resources panel to Course Materials and its Import Resources action to Add Material, using the existing Lucide Upload or FilePlus2 icon.

Derive material rows from the scanner-provided `CourseEntry[]`; React must not read the filesystem. Exclude videos, directories, and every `.learningappoffline/` entry. Preserve each file's exact relative path as its identity so duplicate filenames in separate folders remain separate.

“This lesson” contains every supported non-video scanner entry in the selected video's parent folder, plus imported attachments associated with that lesson. “Whole course” contains every non-video material in the scanned course and imported resource metadata, grouped as Notes, Subtitles, Images, Audio, Documents, and Other. PDF and recognized document extensions classified as `other` belong in Documents; remaining `other` files stay in Other. Each row shows the filename and its parent folder.

A single local search field filters on case-insensitive filename and relative folder/path. Empty states distinguish no selected lesson, no lesson materials, no course materials, and no search matches. The collapsed summary reports file and non-empty type counts.

Opening a scanner material uses the existing course-root-contained external-open command. Opening an imported attachment uses the existing guarded resource-open command. Add Material retains the existing import workflow and performs no copying until the user explicitly selects files. Refresh invokes the completed Refresh Course workflow, replacing scanner results while preserving the selected lesson when its exact identity still exists and retaining dirty notes, terminal sessions, todos, bookmarks, progress, and stats.

## Study Stats Persistence

Extend `StudyStats` with `todayBySource` and `totalBySource`, each containing integer, non-negative `videoSeconds` and `terminalSeconds`.

Use one repair rule: sanitize overall totals first to finite, non-negative integers, sanitize source fields the same way, then reconcile each source pair to its corresponding overall total. If the source object is missing (legacy data), attribute the complete overall total to video. If source fields exist but their sum differs, preserve valid terminal attribution up to the overall total and assign the remainder to video. This preserves authoritative overall totals while producing the invariant:

```ts
todaySeconds === todayBySource.videoSeconds + todayBySource.terminalSeconds
totalSeconds === totalBySource.videoSeconds + totalBySource.terminalSeconds
```

Malformed JSON falls back through the existing default-state path. Day rollover resets `todaySeconds` and both today source fields while retaining total fields and existing streak behavior. Serialization remains course-specific under `.learningappoffline/`.

## Activity Tracker

Create a small pure elapsed-time engine and a thin `useStudyActivityTracker` React hook. Supported sources are exactly `"video" | "terminal"`; notes are not implemented.

The engine uses injected/default `performance.now()`. It stores the previous sample time and fractional elapsed milliseconds. On each state transition or sampling tick, it first settles the elapsed interval under the state that was active before the transition. It accepts elapsed time only while the document is visible and the Tauri window is focused. Unexpectedly large timer gaps are discarded rather than credited, preventing sleep/resume jumps.

For each accepted interval, choose one source only:

1. Terminal when terminal activity is active and visible.
2. Otherwise video when valid playback activity is active.
3. Otherwise idle.

Whole seconds are emitted through one course-scoped callback and removed from that source's fractional remainder; fractions survive ordinary samples and are flushed into the correct course before course changes or unmount. Because each interval receives one source, totals cannot double count. Video progress continues independently of study attribution.

## Video Activity

Reuse the existing player lifecycle. Video activity is eligible only while playing and not paused, ended, seeking, or stalled. It becomes ineligible immediately on pause, end, seek start, stall, lesson change, course change, hidden document, focus loss, or unmount. Existing playback progress and resume behavior remain unchanged.

## Terminal Activity

Add `onUserActivity?: () => void` to `CourseTerminal` and its pane boundary. Invoke it from xterm's existing `onData` callback immediately before forwarding the original data to the PTY. The callback receives no data, and no command or output content is inspected, stored, or logged.

Genuine input starts terminal activity and resets `TERMINAL_IDLE_TIMEOUT_MS = 60_000`. Terminal attribution continues until that deadline to include brief reading and thinking. Output, resize, startup, focus, and background commands do not activate it. Close, restart, hidden terminal, course change, focus loss, document hiding, idle timeout, and unmount settle elapsed time and stop terminal eligibility. Ordinary panel collapse, Zen Mode, and maximize/restore do not close the PTY; visibility alone controls whether the existing session can accrue time.

## Visibility and Focus

Listen to `visibilitychange` and `document.visibilityState`. In Tauri, subscribe to the current window's `onFocusChanged`; browser tests and browser development use document focus as the safe fallback. Hidden or unfocused transitions synchronously settle the prior eligible interval and then block accrual. Returning visible or focused starts a new timing baseline, never credits the hidden interval, and does not itself activate a source.

## UI

The Stats panel displays Today, Total, Streak, Video today, and Terminal today. Replace the old note with “Active study · Video + Terminal.” Add a subdued live label derived from the tracker's selected source: “Studying · Terminal,” “Studying · Video,” or “Idle,” using existing semantic theme variables and the requested Lucide icons.

Keep Focus Timer independent and add concise copy clarifying that it is user-controlled while Study Time is automatically measured active interaction. Terminal state must not start or stop the timer.

## Course and Lifecycle Boundaries

Before changing courses, settle activity against the old course and stop its eligibility. Load and hydrate the new course before allowing new attribution. Lesson changes settle the current interval and reset video eligibility; terminal may become eligible again only through genuine input. Terminal close/restart and layout-hidden transitions settle terminal time without changing the existing PTY behavior beyond explicit close/restart actions.

## Logging

No per-second logs. Development-only lifecycle logs may contain source start/stop, idle timeout, seconds flushed, course-relative lesson identity, and persistence failures. Never log terminal input/output, note contents, copied contents, or unrelated absolute paths.

## Testing and Verification

Use test-first changes. Persistence tests cover legacy migration, round trips, malformed values, reconciliation invariants, day rollover, and unchanged streak behavior. Tracker tests use a fake clock and cover video states, terminal input/deadline refresh, ignored output, visibility/focus, priority/no-double-counting, fractions, sleep gaps, course changes, and unmount. CourseTerminal tests cover content-free activity callbacks while preserving PTY writes and ignoring output/resize, plus close/restart stopping state. Materials tests cover grouping, exclusions, exact paths, duplicates, search, refresh add/remove, preserved selection/dirty notes, and guarded opening.

Final automated verification runs `npm run build`, `npm test`, and `cargo test --manifest-path src-tauri/Cargo.toml`. Manual verification uses a normal writable course and records which requested scenarios can be completed in the available desktop environment; unavailable GUI-only checks are reported, not claimed.

## Non-Goals and Limits

- No notes activity source.
- No direct React filesystem access.
- No new dependency or Rust command unless an existing guarded command cannot represent an explicitly required open action.
- No PTY closure caused only by layout changes.
- No commits or pushes.
