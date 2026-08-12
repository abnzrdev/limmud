# Android SAF Course Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Limmud Android to select, recursively scan, restore, and relink a real local course folder through read-only Android SAF while preserving the finished mobile presentation and desktop behavior.

**Architecture:** A repository-local `tauri-plugin-saf-course` delegates Android commands to Kotlin. Kotlin exclusively owns SAF URIs, persisted grants, registry data, and `ContentResolver` traversal; React consumes opaque course IDs and provider-neutral entries through a small platform service. Desktop retains its existing `PathBuf` traversal and UI.

**Tech Stack:** Tauri 2 local plugin, Rust, Kotlin, AndroidX Activity Result APIs, Android `ContentResolver`/`DocumentsContract`, React 19, TypeScript, Vitest, JUnit/Robolectric only if already supported by the generated Android build.

## Global Constraints

- Preserve all existing uncommitted work; do not commit or push.
- Keep `AppShell`, desktop scanner command behavior, desktop terminal, and desktop persistence unchanged.
- Read-only SAF access: no course copies, external writes, imports, renames, or deletes.
- Do not read or write `.learningappoffline/`.
- Do not request `MANAGE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, or `WRITE_EXTERNAL_STORAGE`.
- Never expose or log raw content URIs, authorities, document IDs, absolute paths, real course names, lesson names, notes, vocabulary, or licensed content.
- Keep Android video/subtitle transport, note writes, and tool persistence out of scope.

---

### Task 1: Provider-neutral course contracts and selection rules

**Files:**
- Modify: `src/types/course.ts`
- Create: `src/components/mobile/mobileCourseModel.ts`
- Test: `src/components/mobile/mobileCourseModel.test.ts`

**Interfaces:**
- Consumes: existing `CourseEntry`, `visibleCourseEntries`, and `findFirstVideo`.
- Produces: `MobileCourseRecord`, `MobileCourseAccess`, `mobileSections(record)`, `mobileLessons(record)`, `reconcileLessonSelection(previousId, record)`, and mobile-safe lesson presentation defaults.

- [ ] Write failing tests using provider-neutral entries with no `absolutePath`. Assert nested lesson extraction, unsupported-entry exclusion through existing visibility policy, natural ordered input preservation, previous selection preservation, and first-video fallback.
- [ ] Run `npm test -- src/components/mobile/mobileCourseModel.test.ts` and verify failure because the module and optional path contract do not exist.
- [ ] Make `CourseEntry.absolutePath` optional without changing desktop response data.
- [ ] Implement the minimal pure mobile course conversion and selection functions. Provider entries remain immutable and receive only transient UI defaults such as unknown duration, incomplete, unbookmarked, and empty preview note.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Frontend SAF service contract

**Files:**
- Create: `src/lib/mobileCourseService.ts`
- Test: `src/lib/mobileCourseService.test.ts`
- Modify: `src-tauri/capabilities/android.json`

**Interfaces:**
- Produces: `MobileCourseService` with `pickCourse()`, `restoreCourses()`, `scanCourse(courseId)`, and `relinkCourse(courseId)`; default implementation invokes plugin `saf-course` commands.
- Consumes: plugin outcomes containing only opaque IDs, display data, access state, entries, and warning counts.

- [ ] Write failing tests that inject a fake invoke function and assert exact command names and camel-case arguments, cancellation mapping, response validation, and rejection of responses containing populated `absolutePath`.
- [ ] Run the focused service test and verify the missing module failure.
- [ ] Implement the typed service wrapper using `invoke` from `@tauri-apps/api/core`, fixed safe frontend errors, and runtime response validation.
- [ ] Add only `saf-course:allow-pick-course`, `allow-restore-courses`, `allow-scan-course`, and `allow-relink-course` to the Android capability.
- [ ] Re-run the service tests.

### Task 3: Mobile view-model replacement

**Files:**
- Modify: `src/components/mobile/useMobileAppModel.ts`
- Modify: `src/components/mobile/mobileModel.ts`
- Modify: `src/components/mobile/MobileAppShell.tsx`
- Test: `src/components/mobile/MobileAppShell.test.tsx`

**Interfaces:**
- Consumes: `MobileCourseService`, `MobileCourseRecord`, and existing screen callbacks.
- Produces: restoring, empty, available, access-required, and safe-error UI state; `openCourse`, `relinkCourse`, and `refreshCourse` actions.

- [ ] Replace test setup with an injected fake `MobileCourseService`; first add failing tests for restore, empty Add Course, picker cancellation, real nested tree rendering, real lesson Study selection, selection preservation, access-required state, and relink.
- [ ] Run the focused mobile suite and verify failures correspond to the still-synthetic model.
- [ ] Refactor synthetic lesson presentation defaults into test fixtures only. Keep Notes and Tools preview state in memory.
- [ ] Implement async restoration and course actions in `useMobileAppModel(service)` with mounted guards and fixed privacy-safe errors.
- [ ] Pass the service into `MobileAppShell`, defaulting to the production service, and connect existing screens without changing their layout composition.
- [ ] Re-run mobile tests and retain navigation, Back, Zen, Notes, and Tools coverage.

### Task 4: Home access and recovery states

**Files:**
- Modify: `src/components/mobile/home/MobileHome.tsx`
- Modify: `src/components/mobile/mobile.css`
- Test: `src/components/mobile/MobileAppShell.test.tsx`

**Interfaces:**
- Consumes: model status, available course summary, `onAddCourse`, `onRelink`, and `onCourse`.
- Produces: enabled Add/Open Course action and existing-style access-required recovery card.

- [ ] Add failing accessible UI assertions for loading, empty library, enabled Add Course, available real course, warning count, Access required, and Relink folder.
- [ ] Run the focused suite and confirm the missing states fail.
- [ ] Make the smallest responsive additions inside the existing Home component and mobile stylesheet; do not alter the established screen hierarchy or navigation.
- [ ] Re-run the focused suite.

### Task 5: Local Tauri plugin Rust shell

**Files:**
- Create: `src-tauri/plugins/tauri-plugin-saf-course/Cargo.toml`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/build.rs`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/src/lib.rs`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/src/mobile.rs`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/src/models.rs`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/permissions/default.toml`
- Create generated permission files through the plugin build process.
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `tauri_plugin_saf_course::init<R>()`; registered mobile commands `pick_course`, `restore_courses`, `scan_course`, and `relink_course`.
- Consumes: Kotlin plugin class `SafCoursePlugin` and serializable response models.

- [ ] Write Rust unit tests first for serialization field names, stable public error codes, opaque UUID course IDs, and opaque hashed entry IDs that do not contain their source identifier.
- [ ] Run `cargo test --manifest-path src-tauri/plugins/tauri-plugin-saf-course/Cargo.toml` and verify missing implementation failures.
- [ ] Add the minimal Tauri plugin crate using `tauri-plugin` mobile registration and UUID/SHA-256 only where required for opaque identifiers.
- [ ] Declare individual command permissions with no default blanket allow-list.
- [ ] Add the plugin as an Android-target path dependency and register it only in the mobile builder.
- [ ] Re-run plugin Rust tests and Android target checking.

### Task 6: Kotlin picker, registry, and traversal

**Files:**
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/build.gradle.kts`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/settings.gradle`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/src/main/AndroidManifest.xml`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/src/main/java/com/abnzr/safcourse/SafCoursePlugin.kt`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/src/main/java/com/abnzr/safcourse/CourseRegistry.kt`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/src/main/java/com/abnzr/safcourse/CourseScanner.kt`
- Create: `src-tauri/plugins/tauri-plugin-saf-course/android/src/main/java/com/abnzr/safcourse/CourseModels.kt`
- Test: Kotlin unit tests under the plugin's `android/src/test` tree where Android framework test support permits.

**Interfaces:**
- Consumes: Tauri mobile invokes and Android Activity/ContentResolver.
- Produces: provider-neutral JSON matching `CourseRecord` and `PickCourseOutcome`; stores `courseId -> treeUri` only in private preferences.

- [ ] Add test-first pure Kotlin tests for classification, hidden-name filtering, natural comparison, recursive row-to-tree conversion, registry retention/relink replacement, and safe error objects.
- [ ] Add the plugin class and picker using Tauri's Activity result listener API or the generated Tauri-supported callback mechanism. Request only read and persistable flags; intersect with returned flags before `takePersistableUriPermission`.
- [ ] Implement registry serialization with schema version and no cached names/tree content.
- [ ] Implement recursive `DocumentsContract` queries with a minimal projection, no file-content opens, stable opaque entry hashing, skip warnings, and typed root failures.
- [ ] Implement restore/scan/relink commands without logging sensitive values or native exception messages.
- [ ] Run Kotlin tests through the plugin/generated Gradle integration. If plain JVM Android framework tests are unsupported, retain pure helper tests and cover framework calls through physical acceptance rather than adding a new test framework dependency.

### Task 7: Android integration and manifest audit

**Files:**
- Generated/updated by Tauri plugin build integration: `src-tauri/gen/android/settings.gradle`
- Generated/updated if required: `src-tauri/gen/android/app/tauri.build.gradle.kts`
- Inspect only unless integration requires it: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: local Rust/Android plugin metadata.
- Produces: packaged Kotlin plugin registered with the Tauri Android application.

- [ ] Run Android target compilation and resolve only plugin integration errors.
- [ ] Inspect the merged manifest with Gradle output and assert absence of `MANAGE_EXTERNAL_STORAGE`, broad read/write storage permissions, and new exported components.
- [ ] Verify the Android capability schema recognizes only the four plugin permissions.

### Task 8: Automated regression verification

**Files:** No new production files expected.

- [ ] Run focused mobile and service tests.
- [ ] Run plugin Rust and Kotlin tests.
- [ ] Run the full frontend suite and record the four known unrelated VideoPlayer failures without changing them.
- [ ] Run `npm run build`.
- [ ] Build the ARM64 Android debug APK.
- [ ] Attempt desktop Rust tests with existing host dependencies; do not install sudo packages.
- [ ] Run `git diff --check`, inspect `git status`, and confirm `src/components/layout/AppShell.tsx` remains unchanged.

### Task 9: Physical phone SAF acceptance

**Files:** Device-only synthetic fixtures under `Download/Limmud SAF Test`; no repository fixture contains media or private data.

- [ ] Create generic nested sections and empty `.mp4`, `.srt`, `.md`, and unsupported files on the connected phone.
- [ ] Install and launch the ARM64 debug APK through `ADB_SERVER_SOCKET=tcp:127.0.0.1:5039`.
- [ ] Tap Add Course, verify the Android system folder picker, and select the synthetic tree.
- [ ] Verify the real root name, nested sections, supported lesson entries, and unsupported filtering in the existing UI.
- [ ] Select multiple lessons and verify Study receives their real display metadata while playback stays unavailable.
- [ ] Force-stop/relaunch and verify persisted access restores and rescans without another picker.
- [ ] Simulate permission loss using app grant/app-private test controls that do not touch external course contents; verify Access required and retained registry.
- [ ] Relink the same synthetic folder and verify recovery under the same course ID.
- [ ] Verify background/foreground, portrait/landscape, Back behavior, no Terminal, no broad permission, no fatal exception, and no ANR.
- [ ] Capture only privacy-safe synthetic screenshots and report exact acceptance evidence.
