# Limmud

**A focused, local-first desktop and Android workspace for studying offline course material.**

Online course platforms are useful for distribution, but their feeds, recommendations, notifications, and browser distractions can make focused study harder. Limmud brings downloaded course material into one desktop workspace so learners can watch lessons, take notes, track progress, and use study tools without sending their course data to a cloud service.

> Project status: active, early-stage development (`0.1.0`). Desktop and Android development builds support the core workflow; signed releases are not available yet.

## Features

- Scan a local course folder and organize nested lessons in a course outline.
- Play local videos with subtitle support and resume saved playback positions.
- Write Markdown notes beside course content with save and recovery handling.
- Mark lessons complete, bookmark lessons, track focused study time, and manage todos.
- Use an embedded multi-pane terminal without leaving the study workspace.
- Search an optional offline dictionary and save course vocabulary locally.
- Resize and persist the course, learning, terminal, tools, and dictionary layouts.
- Switch between light, dark, and distraction-reduced Zen modes.
- On Android, open user-selected course trees through SAF and use a responsive phone/tablet workspace without broad storage access.

## Screenshots

Screenshots are being prepared for the first public release. Place reviewed images in [`docs/screenshots/`](docs/screenshots/) using the filenames documented there.

<!-- Replace this comment with the images after checking that they contain no usernames, local paths, private course names, emails, or licensed course content.
![Main workspace](docs/screenshots/main-workspace.png)
![Course lesson view](docs/screenshots/course-lesson-view.png)
![Notes and todos](docs/screenshots/notes-todos.png)
![Video progress](docs/screenshots/video-progress.png)
-->

## How it works

1. Choose a folder containing offline course files.
2. The Rust backend scans supported files and exposes them to the React interface.
3. Select a lesson to play its video, load subtitles, edit notes, or open related material.
4. Learning state is saved under `.learningappoffline/` inside the selected course folder.
5. App-wide preferences are stored in the operating system's application config directory.

Course videos, notes, progress, todos, vocabulary, and terminal sessions stay on the user's machine. The application does not require an account or a hosted backend.

## Tech stack

- [Tauri 2](https://v2.tauri.app/) and Rust
- React 19 and TypeScript
- Vite
- CodeMirror
- xterm.js
- SQLite/FTS5 for optional offline dictionary packs
- Vitest and Testing Library

## Local setup

### Prerequisites

- Node.js LTS and npm
- Rust stable
- Platform dependencies required by Tauri 2

Follow the official [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for Linux, macOS, or Windows before running the desktop app.

### Install and run

```bash
git clone https://github.com/abnzrdev/limmud.git
cd limmud
npm ci
npm run tauri -- dev
```

The browser-only Vite interface can be started with:

```bash
npm run dev
```

Native filesystem, terminal, and persistence features require the Tauri desktop runtime.

## Development commands

```bash
npm run dev                 # Start the Vite development server
npm run tauri -- dev        # Start the desktop app in development
npm run build               # Type-check and build the frontend
npm test                    # Run the frontend test suite once
npm run test:watch          # Run frontend tests in watch mode
npm run tauri -- build      # Build a desktop bundle
cargo test --manifest-path src-tauri/Cargo.toml
```

The offline dictionary pack builder has its own documentation in [`docs/dictionary-data.md`](docs/dictionary-data.md).
Android architecture, development builds, data behavior, and release limitations are documented in [`docs/android.md`](docs/android.md).

## Data and privacy

Limmud is local-first:

- It has no required account, analytics service, telemetry endpoint, or cloud database.
- Course state is stored inside the selected course folder.
- Global UI preferences are stored in the platform application config directory.
- Imported dictionary packs are local SQLite files.

Review the contents of a course folder before sharing it: `.learningappoffline/` may contain personal notes, todos, progress, and saved vocabulary.

## Roadmap

- Publish signed, platform-specific desktop builds.
- Add keyboard shortcuts for common study actions.
- Improve subtitle search and synchronization controls.
- Persist and restore desktop window bounds.
- Add optional lesson-answer voice recording.

See [`TODO.md`](TODO.md) for the working backlog.

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Security issues should follow [`SECURITY.md`](SECURITY.md).

## Portfolio summary

A concise, factual project summary for portfolio use is available in [`docs/portfolio-summary.md`](docs/portfolio-summary.md).

## License

Copyright © 2026 Abenezer. Released under the [MIT License](LICENSE).
