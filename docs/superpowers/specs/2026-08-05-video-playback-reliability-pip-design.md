# Video Playback Reliability and Picture-in-Picture Design

## Goal

Make lesson playback reliable across manual and automatic lesson changes, pause/resume, seeking, Zen mode, and native Picture-in-Picture while retaining one playback session and bounded media-server memory use.

## Constraints

- Keep one stable Vidstack player where practical; do not remount it for lesson path changes.
- Use the APIs and TypeScript contracts shipped by `@vidstack/react` 1.15.6.
- Do not create a second Tauri window or change infrastructure.
- Preserve loopback-only media serving, canonical path validation, root tokens, CORS, `HEAD`, `Content-Length`, `Content-Range`, and byte-range semantics.
- Diagnostics may contain only event names, media state, relative lesson identifiers, requested ranges, and error codes.
- Preserve unrelated and uncommitted changes. Do not install packages, commit, push, expose ports, or delete user data.

## Observed Causes

The selected lesson and resolved media URL currently live in separate state. After a selection changes, React first renders the new lesson with the previous URL, then an effect clears that URL. A `key` based on the absolute lesson path remounts the player during that transient render. Automatic advance also waits for persistence and lesson-note work before selecting the next lesson, so the ended player can remain idle before a newly mounted player attempts autoplay.

Saved progress is applied in both `VideoPlayer` and `VidstackVideo`, and both effects depend on the continually updated `resumeTime`. Normal progress persistence can therefore cause new seeks during pause/resume or after a user seek instead of acting only as initial source restoration.

The Rust media server allocates the entire requested range or file and reads it into memory before writing the response. Large open-ended ranges can amplify memory use and delay delivery of the first bytes.

## Player Architecture

`VideoPlayer` will own a lesson-scoped media source whose identity and URL are inseparable. A resolved URL is eligible for rendering only when its relative lesson identifier matches the current selection. Each URL request receives a monotonically increasing generation; cleanup invalidates the generation, and late results from older generations are ignored.

On selection change the active source becomes empty before a newly resolved source can be activated. The media element is explicitly paused and unloaded without remounting the Vidstack `MediaPlayer`. The player remains mounted across lesson changes so controls, provider lifecycle, PiP, and Zen layout use one session.

The initial saved time is snapshotted per selected source. Metadata readiness applies that snapshot at most once for that source. Later `resumeTime` changes from progress persistence do not seek. Pausing and resuming therefore retain the media element's current position, and an intentional seek remains authoritative.

## Automatic Playback and Buffering

Automatic advance continues to mark the completed lesson and select the next video with an autoplay intent. The source lifecycle carries that intent until the matching new source is ready. Playback is requested after readiness through Vidstack's player API rather than relying only on a remounted element's `autoPlay` attribute.

Autoplay or play rejection clears any pending autoplay state and presents a concise recoverable playback error, leaving the normal play control usable instead of implying perpetual loading. Waiting, stalled, playing, pause, source-change, readiness, and failure transitions feed privacy-safe diagnostic records for tests and manual acceptance.

## Picture-in-Picture

`VidstackVideo` will retain a `MediaPlayerInstance` ref. It will expose a minimal PiP toggle only when the instance state reports `canPictureInPicture`. The toggle calls the version-matched `enterPictureInPicture()` and `exitPictureInPicture()` methods, and state follows Vidstack's PiP change event.

Permission, support, and API failures produce a short visible error and a diagnostic error code. PiP uses the same player/provider, source, position, subtitles, automatic-next behavior, and surrounding Zen state; no extra window or media element is created.

## Media Server

Full and partial GET responses will write headers first, then seek and copy the requested byte count through a fixed-size buffer. HEAD responses write identical length and range headers without reading a body. Existing request parsing, root-token resolution, canonical containment checks, loopback binding, content types, CORS, and range calculations remain intact.

Tests will cover full responses, bounded ranged responses, HEAD behavior, open-ended ranges, and header correctness. A test seam around the copy routine will verify that reads never exceed the fixed chunk size without relying on source-text assertions.

## Verification

Frontend regression tests will cover stale URL rejection, absence of the old URL during a new lesson render, one resume seek per source, pause/resume and seek/pause/resume position retention, automatic next playback in normal and Zen layouts, autoplay rejection, and PiP support and errors. Rust tests will cover full, ranged, open-ended, and HEAD responses plus bounded copying.

The intended commands are focused Vitest tests, `npm test`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`. The current environment has neither installed frontend dependencies nor `cargo`; commands that remain unavailable will be reported verbatim and no packages will be installed. Native Tauri GUI acceptance remains a separate manual activity and will not be inferred from browser or jsdom tests.
