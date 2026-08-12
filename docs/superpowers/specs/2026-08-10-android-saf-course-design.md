# Android SAF Course Access Design

## Objective

Connect Limmud Android's completed adaptive mobile interface to a user-selected local course directory through Android Storage Access Framework (SAF). The slice is read-only: it selects, scans, restores, and relinks course access without copying or modifying course contents or `.learningappoffline/`.

## Existing Boundaries

- Desktop uses Rust `PathBuf`/`std::fs` traversal in `src-tauri/src/scanner.rs`, returns `CourseEntry`, and persists course-local state through existing desktop commands.
- Android currently registers a core-only Tauri application and renders `MobileAppShell` with synthetic course data.
- Desktop `AppShell`, desktop scanner traversal, terminal, persistence, media server, and desktop capabilities remain unchanged.
- The finished Home, Course, Study, Notes, Tools, navigation, and adaptive layout components remain the mobile presentation layer.

## Selected Architecture

Add a repository-local first-party Tauri plugin dedicated to SAF course access. The plugin follows Tauri's mobile plugin architecture: Rust supplies registration, typed command bindings, permission declarations, and provider-neutral response models; Kotlin supplies the Android implementation.

The plugin has no desktop implementation in this slice and is registered only for Android. It is not published as a general package and adds no JavaScript package dependency.

### Responsibilities

Kotlin owns:

- `Intent.ACTION_OPEN_DOCUMENT_TREE`
- Activity-result handling
- read-only and persistable URI grants
- raw tree URIs, provider authorities, and document IDs
- app-private course registry
- `ContentResolver` and `DocumentsContract` traversal
- mapping Android/provider failures into privacy-safe error codes

Rust owns:

- Tauri plugin registration
- narrowly scoped plugin commands and capability permissions
- serialization of provider-neutral models
- shared scan-policy tests that can run without Android

React owns:

- invoking the platform service
- loading, empty, available, and access-required application states
- selected lesson and expanded-section state
- rendering existing mobile components

React never receives or stores a raw URI, authority, document ID, or absolute filesystem path.

## Public Plugin Contract

The mobile plugin exposes these commands:

```text
pick_course() -> PickCourseOutcome
restore_courses() -> Vec<CourseRecord>
scan_course(course_id: CourseId) -> CourseRecord
relink_course(course_id: CourseId) -> PickCourseOutcome
```

`PickCourseOutcome` distinguishes `selected` from `cancelled`; cancellation is not an error.

`CourseRecord` contains:

```text
courseId: opaque UUID string
displayName: selected root's current display name
access: available | accessRequired
entries: provider-neutral recursive course entries
warningCount: number of unreadable descendants skipped
```

Each entry contains:

```text
id: opaque per-course entry token
name: current provider display name
relativePath: provider-neutral relative display path
kind: directory | video | subtitle | note | image | audio | other
children: optional nested entries
```

Mobile entries do not expose or fabricate `absolutePath`. The shared TypeScript course model makes that field optional; desktop responses continue supplying it.

Entry IDs are deterministic opaque hashes derived natively from the course ID and provider document ID. The hash is returned, while the document ID remains native. This preserves lesson selection across rescans without exposing provider identifiers.

## Native Registry

The Android plugin stores an app-private registry containing only:

```text
schemaVersion
courseId -> treeUri
```

No course copy, course tree cache, display name, lesson name, note, progress, or user content is persisted by this slice.

The registry is updated only after a picker result yields a URI and the plugin successfully attempts to take the returned read grant. A provider that supplies a non-persistable read grant may work for the current process, but the restored record becomes `accessRequired` if the grant is absent later.

The registry entry is retained when access is missing, the provider is unavailable, or scanning fails with a root access error. Relinking replaces only the URI mapped to the same `courseId` after successful selection.

## Picker and Permission Flow

The picker intent uses:

- `ACTION_OPEN_DOCUMENT_TREE`
- `FLAG_GRANT_READ_URI_PERMISSION`
- `FLAG_GRANT_PERSISTABLE_URI_PERMISSION`

The plugin never requests write permission for this slice. On a successful result it intersects returned grant flags with read and persistable flags and calls `takePersistableUriPermission` for read access when supported.

Cancellation returns `cancelled`. Security and provider failures return typed, privacy-safe errors without URI or document details.

No broad storage permission is added to the Android manifest.

## Course Traversal and Shared Policy

The current desktop scanner separates into two layers without changing its public behavior:

1. Provider-neutral policy: extension classification, skipped-name policy, natural comparison, and normalized tree ordering.
2. Desktop traversal: existing recursive `std::fs`/`PathBuf` enumeration and absolute-path population.

Android traversal queries directory children through `DocumentsContract.buildChildDocumentsUriUsingTree` and `ContentResolver.query`. The projection requests only document ID, display name, MIME type, and flags. Directories are traversed recursively; file contents and thumbnails are never opened.

Kotlin applies equivalent classification, skipped-name policy, and natural ordering. Contract fixtures are shared conceptually and asserted independently in Rust/TypeScript and Kotlin tests so desktop and Android produce compatible trees without forcing Android URIs through the Rust filesystem APIs.

Unreadable descendants are skipped and increment `warningCount`. A root query failure yields `accessRequired` for permission/provider-unavailable categories or a privacy-safe scan error for malformed provider responses. No raw exception message crosses into React.

## Mobile Application State

Replace synthetic course constants with a mobile course service and view-model state:

```text
restoring
empty
available(CourseRecord)
accessRequired(courseId)
error(safeMessage)
```

At startup the model calls `restore_courses`. An available course supplies the existing Home summary, Course hierarchy, and Study lesson metadata. An inaccessible registered course renders `Access required` and `Relink folder`; it is not deleted.

Add/Open Course invokes `pick_course`. Relink invokes `relink_course` with the existing opaque ID.

Selection after scan or refresh is preserved when the previous opaque entry ID remains. Otherwise it falls back to the first visible video. Section expansion is preserved for surviving section IDs.

The completed screen composition is unchanged. Existing synthetic notes and tools remain session-only, and the Study media area continues to state that playback is not connected.

## Error and Recovery Model

Public error codes are limited to:

```text
pickerUnavailable
permissionDenied
accessRequired
providerUnavailable
scanFailed
registryFailed
```

Frontend messages are fixed product copy selected by code, never native exception text.

- Picker cancellation leaves current state untouched.
- Selection denied or invalid leaves an existing registry mapping untouched.
- Missing persisted permission marks the course `accessRequired`.
- Unavailable removable storage marks the course `accessRequired`.
- Unreadable descendants do not abort the whole scan when the root remains readable.
- Relink success updates the mapping and rescans under the existing course ID.

## Security and Privacy

- No `MANAGE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, or `WRITE_EXTERNAL_STORAGE` permission.
- No raw SAF identifiers in WebView state, URLs, logs, errors, tests, screenshots, or documentation examples.
- No course or lesson names in diagnostic logs. Names appear only in the user-facing application data returned for rendering.
- No external files are opened for content during scanning.
- No course files are created, modified, renamed, imported, or deleted.
- No `.learningappoffline/` reads or writes are added.
- Android capability grants only the four SAF course plugin commands.
- No new exported Android component is required; the existing launcher activity remains the only exported component.

## Test Strategy

### Shared and Rust

- supported and unsupported extension classification
- natural sorting including numeric lesson prefixes
- skipped hidden/tooling/generated names
- nested provider-neutral tree normalization
- opaque course and entry identifiers do not reveal input identifiers

### Kotlin

- picker success and cancellation result mapping
- read-only intent flags
- persistable read grant attempt
- recursive directory enumeration
- read-only provider behavior
- natural sorting and classification parity fixtures
- revoked grant and unavailable provider mapping
- registry retention and relink replacement
- errors contain only stable codes

### React/mobile

- startup restoration
- Add Course invokes the platform service
- real course replaces the synthetic source
- real nested sections render in existing Course UI
- lesson selection updates Study metadata
- scan refresh preserves selection when possible
- access-required and relink actions
- picker cancellation preserves current state

### Regression and Native Acceptance

- focused plugin, shared, and mobile tests
- full frontend suite, preserving the four known unrelated VideoPlayer failures
- frontend production build
- Android Rust compile and debug APK build
- `git diff --check`
- desktop Rust tests when host system libraries permit
- manifest audit for broad permissions and exported components

The physical test creates a generic tree under Downloads containing empty placeholder videos, subtitles, notes, an unsupported file, and nested sections. Acceptance verifies picker display, selection, real hierarchy, multiple lesson selections, process restart restoration, controlled permission loss, relink, background/foreground, rotation, absence of Terminal, absence of broad permissions, and absence of fatal exceptions or ANRs.

## Data Safety and Rollback

All architecture changes are additive. Desktop course formats and `.learningappoffline/` semantics remain unchanged. The only new persistent data is the Android app-private course-ID-to-tree-URI registry and the Android system's persisted read grant.

Repository rollback removes the local plugin and mobile service changes while restoring the prior Android capability/configuration. Device rollback uninstalls or clears Limmud app data, which removes the private registry and persisted grant but never alters the external test course or user course material.

## Out of Scope

- Android video or subtitle transport
- opening SAF lesson content streams
- note, progress, todo, bookmark, or vocabulary persistence
- dictionary integration
- media resume, fullscreen, lifecycle playback, or Picture-in-Picture
- course import, copying, caching, export, cloud sync, or accounts
