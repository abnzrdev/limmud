# Android MVP Completion Implementation Plan

> Work remains uncommitted. Every behavior change follows red-green-refactor; generated/config-only changes receive direct build verification.

**Goal:** Deliver desktop-compatible portable study state, real mobile tools/dictionary, PiP/media integration, hardening, release artifacts, and physical Samsung acceptance without altering the desktop product architecture.

## 1. Shared portable-state contract

**Likely files:** `src/lib/persistence.ts`, new `src/lib/mobileCourseState.ts`, their tests.

- Add failing literal-fixture tests for exact desktop record parsing/serialization, malformed input refusal, unknown-field preservation, semantic completion/bookmark/todo/progress/stats/vocabulary operations, revisions, and reconciliation.
- Implement provider-neutral state models and pure mutations.
- Prove Android-generated fixtures parse through the desktop parser and vice versa.

## 2. Kotlin SAF state documents and recovery

**Likely files:** SAF plugin Kotlin models/registry/plugin, new state document/recovery/local-fallback classes, Kotlin tests, Rust plugin command declarations and permissions.

- Add failing Kotlin tests for discovery/create/capability checks, verified writes, conflict, malformed data, recovery retention/clear, read-only fallback, and reconciliation.
- Implement bounded state-document I/O and semantic command boundary without native identifier exposure.
- Add commands/capabilities and audit registry compatibility.

## 3. Mobile course state integration

**Likely files:** `mobileCourseService`, `useMobileAppModel`, Home/Course/Study/Tools components and focused tests.

- Add failing UI/model tests for restore, completion, bookmarks, todos, progress checkpoints, external reload, local-only labels, enable-saving, and reconciliation.
- Replace synthetic tool state with the real course-state service while preserving layouts.
- Keep lesson notes as sibling `.notes.md` documents.

## 4. Persistent timer and study statistics

**Likely files:** new pure timer state module/tests, mobile model/tools.

- Add failing tests for start/pause/resume/reset, elapsed computation, rotation/navigation, background/process restore, clock anomalies, completion, and stats recording.
- Implement timestamp-based authority and persist desktop-compatible mode/preset/study aggregates through the course-state service.

## 5. Vocabulary

**Likely files:** shared vocabulary contract/tests, mobile model/tools, SAF state service.

- Add failing tests for exact desktop schema, validation, add/update/remove, stable-ID duplicates, portable/local-only persistence, and conflicts.
- Connect real vocabulary UI and selected lesson context.

## 6. Android offline dictionary

**Likely files:** shared Rust dictionary cfg/commands, Cargo target dependencies, SAF/dictionary picker Kotlin, mobile dictionary service/UI/tests, Android backup rules.

- Add failing Rust/frontend/Kotlin tests for pack selection/import/validation, queries, Unicode, stale searches, failed replacement, and Add to Vocabulary.
- Enable bundled rusqlite for Android and reuse current read-only search logic.
- Install only user-selected validated packs in app-private storage; never bundle/download data.

## 7. PiP, media session, focus, and noisy route

**Likely files:** `MainActivity.kt`, manifest, SAF plugin media bridge, MobilePlayer/Vidstack integration and tests.

- Add failing tests for player-state/action mapping, PiP eligibility/callbacks, background policy, focus loss, noisy route, and lifecycle cleanup.
- Implement manual PiP and provider-neutral media-session/audio bridge.
- Harden token expiry/cleanup and rerun existing media/range tests.

## 8. Security and privacy hardening

**Likely files:** Android manifest/network/backup XML, Tauri Android config/capabilities, local plugin permissions, logging/error sites.

- Inspect merged manifest and runtime WebView configuration.
- Remove TV launcher exposure, broad/unneeded capabilities, logging leaks, and excess origins while retaining loopback playback.
- Test token expiry, unknown resources, ranges, backup exclusions, and privacy-safe errors.

## 9. Performance and package size

- Establish baselines for launch, scan, player transitions, dictionary, memory, bundle, and current universal APK.
- Inspect archive contents and native symbols/ABIs; ensure no synthetic media is packaged.
- Build supported arm64 artifact and non-production AAB, evaluate safe R8/resource/Rust stripping, and verify 16 KiB alignment.
- Add scan progress/cancellation only if measured latency warrants it.

## 10. Documentation and complete verification

**Likely files:** `README.md`, Android architecture/build documentation, existing dictionary documentation.

- Document SAF/state/fallback/dictionary/media/PiP/build/release boundaries without private paths, serials, or data.
- Run focused and full frontend tests/build, Rust/plugin tests, Kotlin tests, Android Rust compilation, APK/AAB packaging, manifest/capability/privacy audits, and `git diff --check`.
- Attempt desktop native tests without installing sudo packages and report the known DBus dependency accurately if still blocked.

## 11. Physical Samsung acceptance and cleanup

- Use only an explicitly enumerated synthetic course and dictionary pack.
- Verify the complete user journey, portable round-trip, read-only/local-only/reconciliation, PiP/media/audio behavior, offline mode, lifecycle/process death, SAF/notes/navigation regressions, and package-scoped crash/ANR logs.
- Record exact synthetic external mutations; do not touch real course data.
- Remove only explicitly enumerated temporary screenshots/logs/UI dumps/artifact copies, preserving required generated Android source and every approved uncommitted change.

## Completion gate

Do not claim completion until current artifacts and physical observations prove each requested feature. Missing hardware/media-control checks are reported unverified; production signing and Play upload remain a separate user-authorized workflow.
