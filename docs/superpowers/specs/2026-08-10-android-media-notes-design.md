# Android SAF Media and Lesson Notes Design

## Scope

Connect the existing Limmud mobile Study and Notes screens to the already-selected Android SAF course. This slice adds real video, VTT/SRT subtitles, and desktop-compatible lesson-note read/create/update. It does not add portable progress, completion, bookmarks, todos, vocabulary, dictionary, cloud features, broad storage permission, course copying, or `.learningappoffline/` writes.

Desktop `AppShell`, the `PathBuf` scanner, localhost media server, terminal, and existing note behavior remain unchanged.

## Existing contracts

- Lesson notes use Rust `Path::with_extension("notes.md")`: `lesson_01.mp4` maps to the sibling `lesson_01.notes.md`.
- Subtitles match a video by parent directory and filename stem. VTT is used directly; SRT is converted to VTT in memory.
- The desktop player uses Vidstack and a bounded localhost byte-range server with explicit source transitions.
- Android React state contains opaque `courseId` and entry `id` values plus provider-neutral display metadata. Raw SAF URIs and document IDs remain Kotlin-only.

## Media architecture

Vidstack remains the Limmud player and the existing mobile Study composition remains intact. The local SAF plugin owns an Android-only loopback media server bound to `127.0.0.1` on an ephemeral port. `prepareMedia(courseId, entryId)` resolves native identifiers and returns a short-lived random transport URL, MIME type, and source generation. The URL never contains a SAF URI, document ID, path, or lesson name.

The server supports `HEAD`, `GET`, single byte ranges, `206`, `Content-Range`, `Accept-Ranges`, cancellation, and bounded streaming buffers. It uses `AssetFileDescriptor` offsets/length and a seekable file channel. A provider that cannot supply seekable media returns a privacy-safe `media_not_seekable` error; it does not trigger whole-file copying. Old source tokens are revoked on lesson switches and app/player disposal.

This design is accepted only after real-phone seeking, rapid source switching, lifecycle, fullscreen, and larger-file acceptance. If the Android WebView cannot meet those tests, Media3/ExoPlayer becomes the fallback inside the same native provider-neutral boundary; no raw SAF identifiers cross to React.

## Subtitle architecture

The provider-neutral scan tree supplies subtitle entry IDs and relative metadata. Shared matching logic selects the same-folder/same-stem subtitle. Kotlin reads a bounded UTF-8 subtitle document by opaque ID. React converts SRT with the existing pure converter, creates a temporary VTT Blob URL, and revokes it on source generation changes. Subtitle contents and identifiers are never logged.

## Notes architecture

Kotlin resolves the selected lesson and canonical sibling note. It reports provider-neutral note state: absent, readable, editable, write-access-required, creation-unsupported, access-required, conflict, or error. Note content is returned only to the Notes view and is never logged.

New/relinked folder selection requests read, write, and persistable URI flags, then persists only flags actually granted. Existing read-only registrations continue scanning, playback, subtitle reading, and note reading. Saving without write access opens a scoped tree relink/upgrade flow while preserving the course ID, read grant, and app-private draft. Cancellation changes nothing.

Writability requires both a persisted write grant and relevant provider flags: `FLAG_SUPPORTS_WRITE` for an existing note or `FLAG_DIR_SUPPORTS_CREATE` for a new note. The canonical note is re-queried immediately before creation to avoid duplicates.

Typing persists a debounced recovery draft under Android `noBackupFilesDir`, keyed only by opaque course and lesson IDs. Before external mutation, the journal contains the loaded checksum, previous content, pending content, and timestamp; it contains no URI, document ID, provider ID, or path. The course-side Markdown file remains canonical.

Save uses a truncate-capable descriptor mode (`rwt`) rather than assuming `w` truncates. After flush/close, Kotlin re-reads and byte-compares the UTF-8 content. Only verified equality reports Saved and clears the journal. Failure preserves draft and recovery. Before save, the current content checksum is compared with the load marker; an external change produces a conflict without overwriting either version.

## Lifecycle and state

Study and Notes share the same selected opaque lesson identity. Async media, subtitle, and note results carry lesson/source generations so stale results are discarded. Unsaved drafts remain keyed per lesson during navigation, rotation, backgrounding, permission upgrade, and access loss.

Video pauses when the app becomes hidden. Device-local resume position may be stored app-privately by opaque course and lesson ID; it is explicitly temporary and never writes `.learningappoffline/`.

## Security and privacy

- No `MANAGE_EXTERNAL_STORAGE`, broad storage/media permission, exported component, raw content URI, fake path, whole-course/video copy, telemetry, or WebView filesystem exposure.
- Loopback transport is token-scoped, short-lived, local-only, source-revocable, and rejects malformed/range-abusive requests.
- Logs and public errors contain operation codes/counts only: never course/lesson names, relative or absolute paths, note/subtitle content, SAF URIs, document/provider IDs, or licensed metadata.
- Draft/recovery content is app-private and excluded from backup/device transfer.

## Acceptance boundary

Completion requires automated frontend/Kotlin/Rust verification plus a bundled APK on the connected Samsung phone. A privacy-safe synthetic SAF course must prove video play/pause/repeated seeks/larger-file seeking/source switching, VTT/SRT/no-subtitle behavior, fullscreen/orientation/lifecycle, existing-note read, new-note create, note update/restart, write-grant cancellation/upgrade, conflict/failure draft preservation, and SAF/mobile/desktop regressions.
