# Embedded Terminal and Study Statistics Design

## Goal

Add a lazy-started interactive course terminal beside Notes and make in-app video watch statistics accurate, visible below one minute, and reliably persisted.

## Terminal

`NotesTabs` owns the Notes/Terminal selection. Notes remains controlled by `noteBody`; after the Terminal tab is first selected, `CourseTerminal` stays mounted and is hidden rather than destroyed when Notes is selected. Closing a session leaves the terminal view open with a Start action. A missing course root shows “Open a course before starting the terminal”.

`CourseTerminal` owns xterm.js, `FitAddon`, and one backend session ID. It starts only after the Terminal tab is selected, writes xterm keyboard/paste data to Tauri, streams PTY bytes through a Tauri `Channel`, and closes on unmount or course-root change. A `ResizeObserver` fits and resizes the PTY for tab visibility, window size, sidebar changes, and Zen Mode. The header shows the course root, a real-local-shell warning, and accessible Clear, Restart, and Close actions.

Rust owns process creation. `TerminalState` is Tauri managed state containing a mutex-protected session map and an atomic ID counter. Each session stores the PTY master, writer, child, and reader cleanup handle. `terminal_start` canonicalizes an existing directory, chooses a valid `$SHELL` or `/bin/bash`, opens a `portable-pty`, spawns the reader off the main thread, and returns a unique ID. Write and resize reject unknown sessions; close is idempotent; restart closes then starts a fresh session. EOF removes the session, and application exit closes all remaining sessions.

## Study statistics

The current defect is `recordStudySeconds` flooring every fractional `timeupdate` delta. `VideoPlayer` will instead keep a fractional remainder and emit only accumulated whole seconds. Play establishes the baseline, seeking resets it, paused events do not add time, and pause/end/lesson cleanup flush any complete accumulated seconds without double-counting. External-player launches remain excluded.

`useAppModel` continues storing integer `StudyStats`, so the existing `.learningappoffline/progress.json` schema and local-date streak logic remain compatible. Course-state writes are debounced, with explicit flush requests for pause/end/lesson/course changes. Write failures update the visible status instead of being swallowed. Stats display seconds under 60, then minutes/hours, plus “In-app playback only”.

## Verification

Frontend tests cover lazy terminal start, course root, command wrappers, resize/write/close, course-change/unmount cleanup, readable errors, Notes preservation, fractional accumulation, seek/pause exclusion, duration formatting, persistence/restore, first-day streak, and existing auto/manual completion. Rust tests cover path validation and the practical session lifecycle/error cases. Run every command requested by the user and attempt manual Tauri verification when a graphical session is available.
