# Android First Boot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a branded Limmud Tauri application with mobile navigation on the bridged physical Android phone while preserving the desktop application.

**Architecture:** `App` selects a dedicated mobile shell only when running inside a Tauri Android runtime and otherwise retains the current desktop `AppShell`. Rust and plugin dependencies that require desktop process, filesystem, opener, or window behavior are compiled and registered only on desktop. Android storage, real courses, playback, and persistence remain out of scope.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri 2, Rust, Android Gradle/Kotlin.

## Global Constraints

- Do not read or modify user course folders or `.learningappoffline/`.
- Do not request broad storage permissions or `MANAGE_EXTERNAL_STORAGE`.
- Do not add accounts, cloud sync, analytics, or telemetry.
- Keep logs free of course names, paths, content URIs, notes, vocabulary, and licensed content.
- Do not commit or push.

---

### Task 1: Mobile runtime selection and navigation

**Files:**
- Create: `src/lib/platform.ts`
- Create: `src/components/mobile/MobileAppShell.tsx`
- Create: `src/components/mobile/MobileAppShell.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `isAndroidRuntime(): boolean` and a mobile shell with Home, Course, Study, Notes, and Tools destinations.
- Preserves: desktop `useAppModel()` and `AppShell` behavior outside Android.

- [ ] Write tests that require Android runtime selection, branded mobile rendering, five destinations, navigation, Back handling, and absence of Terminal.
- [ ] Run focused Vitest and confirm failure because the mobile shell does not exist.
- [ ] Implement the minimal platform detector, mobile shell, and responsive styles.
- [ ] Run focused and full frontend verification.

### Task 2: Android-safe Rust boundary

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/mod.rs`

**Interfaces:**
- Produces: an Android library without desktop PTY, opener, desktop filesystem commands, desktop media server, or desktop window behavior.
- Preserves: the existing desktop command set under non-mobile targets.

- [ ] Move desktop-only dependencies into target-specific Cargo sections.
- [ ] Gate desktop modules, state, plugins, commands, and exit cleanup with `cfg(not(mobile))`.
- [ ] Verify Android compilation and re-run desktop checks where system prerequisites allow.

### Task 3: Android generation and physical-device proof

**Files:**
- Generate/review: `src-tauri/gen/android/**`
- Modify only generated Android configuration required for the first boot.

**Interfaces:**
- Consumes: official Tauri CLI Android initialization and the bridged ADB server.
- Produces: installed debug application `com.abnzr.limmud` on the connected device.

- [ ] Run `npm run tauri android init` with the verified JDK, SDK, NDK, and Rust targets.
- [ ] Review generated manifests, permissions, exported components, Gradle files, and ignored artifacts.
- [ ] Build/install/launch through `ADB_SERVER_SOCKET=tcp:127.0.0.1:5039`.
- [ ] Verify branding, navigation, Back, background/foreground, rotation, and absence of Terminal using device state, screenshots, and UI hierarchy.
- [ ] Run frontend tests/build, relevant Rust tests, `git diff --check`, and final repository review.
