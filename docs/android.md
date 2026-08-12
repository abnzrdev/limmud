# Android development

Limmud Android is the mobile presentation of the same local-first product. It shares the React domain and view logic that is useful on mobile while keeping the desktop workspace, terminal, Path-based scanner, and desktop services unchanged.

## Architecture

- The repository-local Tauri mobile plugin opens `ACTION_OPEN_DOCUMENT_TREE`. Kotlin owns persisted grants, `ContentResolver`, `DocumentsContract`, tree identifiers, capability checks, and the app-private course registry. React receives only opaque course and entry IDs plus provider-neutral metadata.
- Video stays in the selected tree. Vidstack requests a short-lived opaque loopback URL; a Kotlin range server resolves that token to one SAF document and supports bounded byte ranges. It never exposes a tree URI to the WebView.
- Lesson notes use the desktop sibling convention (`lesson.mp4` → `lesson.notes.md`). Saves use provider capability checks, app-private recovery, conflict checks, a verified reread, and an explicit Save action.
- Portable study data uses the existing `.learningappoffline/state.json`, `progress.json`, `todos.json`, and `vocabulary.json` formats. Unknown fields are retained. Read-only courses fall back to clearly labelled app-private state and can be reconciled after write access is granted.
- Offline dictionary packs are validated SQLite/FTS5 databases imported into private app storage. React has only narrow status, search, and entry commands; dictionary queries never require a network service.
- Android Picture-in-Picture keeps the existing WebView player. A native framework media session mirrors play state and forwards play, pause, previous, and next actions with generic privacy-safe metadata. Ordinary backgrounding pauses video; intentional PiP may continue it.

## Data behavior

The selected course, sibling Markdown notes, and `.learningappoffline/` remain user-owned in the chosen provider. Uninstalling Limmud does not remove them. Uninstall does remove the SAF registry, imported dictionary copy, local-only fallback, timer state, drafts, and recovery records. Android backup is disabled so grants and recovery content do not transfer unexpectedly.

No account, analytics, telemetry, cloud sync, broad storage permission, or `MANAGE_EXTERNAL_STORAGE` is used. Core course study remains available with network connectivity disabled; the Android manifest retains `INTERNET` only for Tauri/WebView loopback transport.

## Development prerequisites

Follow the current official Tauri 2 Android prerequisites. A development host needs a supported JDK, Android SDK platform/build/platform/command-line tools, NDK, and the Rust Android target for the intended ABI. Configure `JAVA_HOME`, `ANDROID_HOME` (and `ANDROID_SDK_ROOT` where required), and `NDK_HOME` before invoking Tauri.

Initialize only once when the generated project is absent:

```bash
npm run tauri -- android init
```

Common development commands:

```bash
npm run tauri -- android dev
npm run tauri -- android build --debug --target aarch64 --apk --ci
npm run tauri -- android build --target aarch64 --apk --ci
npm run tauri -- android build --target aarch64 --aab --ci
```

For a remote ADB server, set `ADB_SERVER_SOCKET` only in the testing shell. Do not add device identifiers or personal paths to repository documentation.

## Release artifacts

Release APKs and AABs produced without an approved signing configuration are unsigned development artifacts. Do not upload them or create production credentials as part of ordinary development. Before distribution, separately approve application signing, Play Console metadata, store privacy declarations, and final version/version-code policy.

The Android-specific Tauri configuration applies a restrictive CSP, disables the asset protocol, and permits media/connect access only to the app and loopback transport. The manifest opts out of Android backup and contains no broad media or storage permission.

## Known limitations

- A dictionary pack must be imported locally; Limmud does not bundle or download one.
- A provider that cannot write uses device-local study state. Reconciliation is additive and preserves positive user work; destructive deletion tombstones are not part of the current desktop schema.
- Timer runtime state is device-local because the desktop course schema has timer preferences and aggregate study time, but no portable in-progress timer/session-history schema.
- Automatic PiP is intentionally disabled. PiP is entered explicitly from the playing video.
- Production signing and Play publishing are separate, credential-sensitive workflows.
