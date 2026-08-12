# Android Portable Study State Design

## Scope and source of truth

Android will use the existing desktop `.learningappoffline/` representation. Desktop `AppShell`, `PathBuf` commands, terminal, and human lesson-note convention remain unchanged. Android state I/O stays behind the repository-local SAF plugin; React receives only opaque `courseId`, opaque entry IDs, and provider-neutral values.

The current desktop layout is authoritative:

- `state.json`: a JSON object whose values are strings. It currently owns `timerMode`, `timerPreset`, `quickNote`, and unknown state keys.
- `progress.json`: a JSON object whose values are strings. It currently owns `bookmarkedLessons`, `completedLessons`, `selectedEntryId`, `studyStats`, `videoProgress`, and unknown progress keys.
- `todos.json`: a JSON object whose `todos` value is a JSON-encoded string array of `{id,label,done}` objects, plus any unknown keys.
- `vocabulary.json`: a JSON array of the existing `SavedVocabularyItem` schema.

Android does not create an alternative canonical state directory and does not perform the desktop legacy `.limmud` rename.

## Shared domain and identities

Pure TypeScript helpers parse, validate, serialize, and semantically mutate the desktop records. Relative lesson paths remain the portable lesson identity because that is what desktop completion, bookmarks, progress, vocabulary context, and selected lesson already use. Opaque Android entry IDs remain transport identities and are mapped to validated provider-neutral relative lesson paths at the native boundary.

Malformed known values produce a recoverable state error; they are never replaced with defaults on disk. Unknown top-level keys and unknown nested fields are preserved byte-for-value where possible. Frontend state never contains SAF URI, document ID, provider authority, or an absolute path.

## SAF write transaction

Each Android semantic mutation performs:

1. Resolve the selected course and target state document natively.
2. Read the latest bounded UTF-8 contents or treat a genuinely absent file as a new document.
3. Validate the outer shape and the known field being changed.
4. Compare the supplied revision checksum with the latest revision when applicable.
5. Write an app-private recovery record under `noBackupFilesDir`, keyed by opaque IDs and containing previous/pending bytes, checksums, and operation code—never native identifiers.
6. Apply only the requested semantic mutation while preserving unrelated/unknown data.
7. Create `.learningappoffline/` or the specific canonical file only when provider capability flags allow it.
8. Use a truncate-capable descriptor, close it, reread the document, parse it, and verify the expected checksum/value.
9. Report success and clear recovery only after verification.

SAF is not claimed to be atomic. Conflicts and verification failures retain the UI state and recovery record and return privacy-safe result codes.

## Read-only fallback and reconciliation

Readable courses remain fully usable. If course-side state is not writable, mutations are stored in an app-private `noBackupFilesDir` fallback keyed by opaque `courseId`; the UI labels it `Saved on this device`. The fallback contains provider-neutral state only and survives restart but not uninstall.

When portable and local-only state both exist, reconciliation is explicit:

- completion/bookmarks: stable-path set union, with later explicit toggles represented as timestamped local operations so an intentional removal is not lost;
- todos: merge by stable todo ID; conflicts require review when both sides changed the same item;
- playback: choose the newest valid checkpoint by per-entry timestamp, falling back to the more meaningful position only when timestamps are absent;
- study statistics: merge timestamped Android sessions into desktop-compatible aggregates without double counting; legacy aggregate-only conflicts require review rather than addition;
- vocabulary: merge by stable item ID; changed same-ID items require review;
- selected lesson and timer configuration: choose the explicitly newer local operation.

Successful reconciliation rereads and verifies course-side state before removing the corresponding local operations. No course-side state is silently overwritten.

## Feature behavior

- Completion and bookmarks update Course, Home progress, Study, and Tools immediately, then settle to portable or local-only persistence.
- Todos retain the desktop `{id,label,done}` schema; Android adds create/toggle/remove UI only where the current model supports safe semantic operations.
- Playback progress checkpoints on pause, lesson transition, background, ended, and a bounded debounce while playing. It does not write per frame.
- The timer stores mode, preset, authoritative started/paused timestamps, accumulated elapsed time, and completed-session operations privately while active. Portable desktop state receives existing timer fields and `studyStats`; no incompatible session-history file is invented.
- Vocabulary uses the exact desktop `SavedVocabularyItem` fields and file. Dictionary-to-vocabulary creates the same representation.

## Recovery, reload, and privacy

Course state is reloaded on course restore/rescan, foreground return, and before every mutation. Async results carry a generation so stale reads cannot replace newer state. External changes are surfaced and merged semantically.

Registry, fallback, drafts, and recovery live in `noBackupFilesDir` or are explicitly excluded from backup. No state contents, course/lesson names, relative paths, dictionary queries, todos, or vocabulary are logged. Errors expose operation codes and user-actionable product states only.
