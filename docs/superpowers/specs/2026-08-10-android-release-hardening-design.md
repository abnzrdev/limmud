# Android Release Hardening Design

## Security boundaries

Android keeps only narrow SAF, state, dictionary, and media commands. It exposes no terminal, PTY, arbitrary process, broad filesystem, or raw native identifiers. The merged manifest should require only `INTERNET` for Tauri/loopback transport, with no broad storage/media permission. Only the launcher activity is exported. Unneeded TV launcher declarations are removed.

Android CSP/network configuration permits bundled app content and loopback media only. Desktop asset protocol behavior is not changed unless a shared tightening is proven safe. The range server and every log/error path receive explicit privacy review.

## App-private data classification

- Persistent: SAF registry and installed dictionary, both removed on uninstall; registry is never backed up and dictionary is excluded as reconstructable.
- Recovery: note/state journals and unsaved drafts in `noBackupFilesDir`, cleared only after verified success.
- Local-only fallback: user study state in `noBackupFilesDir`, retained until explicit successful reconciliation or uninstall.
- Cache: bounded transient media/dictionary import artifacts with deterministic cleanup.

External course material, sibling Markdown notes, and `.learningappoffline/` remain after uninstall.

## Performance and artifacts

Measurements cover cold/warm launch, small/large SAF scans, course navigation, first frame, seek, lesson switching, notes, dictionary queries, and memory after repeated playback. Scan progress/cancellation is added only if measurements show visible blocking.

APK/AAB inspection attributes size to ABI-specific Rust libraries, symbols, frontend assets, resources, and accidental fixtures. Synthetic media is never packaged. Physical testing uses an arm64 build. Universal debug, arm64 APK, and unsigned/non-production AAB sizes and SHA-256 values are reported separately. Release shrinking is enabled only with regression evidence. Native libraries are inspected for 16 KiB page alignment.

## Release boundary

Application ID, versions, SDKs, icons, adaptive icon, manifest, backup rules, network security, capabilities, R8 rules, AAB generation, and documentation are audited. No Play upload, production key, credentials, or signing workflow is executed. If Gradle requires signing credentials for a final release artifact, work stops before that credential-sensitive boundary and reports the remaining step.
