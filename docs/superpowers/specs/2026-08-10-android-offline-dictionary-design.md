# Android Offline Dictionary Design

## Architecture

Android reuses the current Rust SQLite/FTS5 dictionary schema, validation, search ranking, entry lookup, attribution, and result types. `rusqlite` remains bundled so Android does not depend on a device SQLite build having compatible FTS features.

The dictionary is not bundled and is never downloaded. A narrow Android picker selects a user-supplied Limmud dictionary SQLite pack. Kotlin owns the returned content URI, streams it into an opaque temporary file in app-private storage, enforces a size limit and available-space check, then hands only the app-private destination to the Rust validator. React never receives the URI or path.

After integrity, schema, completion-marker, and license validation, the temporary file is renamed to `dictionary/dictionary.sqlite`. Failed imports remove only the known temporary file and preserve the existing installed pack. The database and temporary files are excluded from backup/device transfer because the pack is reconstructable and potentially large.

## Commands and UI

The mobile command surface is narrow: status, select/import pack, search, get entry, related words, random words if already exposed, and remove pack. Search validates query length and pagination and runs off the UI thread. A generation cancels or ignores stale results.

Tools uses the existing Limmud dictionary visual language and reports installed, unavailable, importing, ready, and privacy-safe error states. Dictionary results can create an existing-schema vocabulary item in the selected course’s portable/local-only state. No arbitrary SQL or filesystem path crosses to React.

## Acceptance

Automated tests cover exact/form/prefix/FTS searches, missing and malformed packs, Unicode, repeated/stale queries, validation, interrupted import, and dictionary-to-vocabulary. Physical acceptance uses a privacy-safe small valid test pack and network-disabled operation. Full production dictionary content remains a separately supplied pack, so APK size is independent of corpus size.
