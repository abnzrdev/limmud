# Limmud Mobile UI Implementation Plan

**Goal:** Replace the Android first-boot skeleton with an adaptive, product-quality Limmud mobile UI while preserving the desktop shell and deferring storage, persistence, and media transport.

**Architecture:** Keep `AppShell` and `useAppModel` as the desktop boundary. Make `MobileAppShell` a small coordinator around a mobile-safe in-memory model and focused Home, Course, Study, Notes, Tools, and navigation components. Reuse Limmud design tokens, icons, course types, and pure course-tree helpers; never call desktop filesystem/Tauri services from the mobile model.

**Constraints:** No SAF, course filesystem access, persistence writes, Android video transport, `.learningappoffline/` changes, broad storage permissions, commits, or pushes.

---

## Task 1: Specify mobile behavior with failing tests

**Files:**
- Modify: `src/components/mobile/MobileAppShell.test.tsx`
- Create: `src/components/mobile/mobileModel.test.ts`

Add focused tests for the branded Home experience, four-item contextual navigation, selecting lessons, collapsing sections, previous/next lessons, note view/edit state, Tools subviews, Zen mode, browser-history Back ordering, and compact/expanded navigation semantics. Run the focused tests and confirm the new assertions fail for the current skeleton.

## Task 2: Add the mobile-safe domain model

**Files:**
- Create: `src/components/mobile/mobileModel.ts`
- Create: `src/components/mobile/useMobileAppModel.ts`

Define privacy-safe synthetic course, section, lesson, note, todo, bookmark, and vocabulary data. Store only UI-session state. Reuse `CourseEntry` and pure course-tree helpers where appropriate. Expose destination navigation, lesson selection, section expansion, previous/next, bookmark/completion state, note editing state, tool selection, timer state, and Zen state without invoking Tauri APIs.

## Task 3: Build focused mobile screens

**Files:**
- Create: `src/components/mobile/home/MobileHome.tsx`
- Create: `src/components/mobile/course/MobileCourse.tsx`
- Create: `src/components/mobile/study/MobileStudy.tsx`
- Create: `src/components/mobile/notes/MobileNotes.tsx`
- Create: `src/components/mobile/tools/MobileTools.tsx`
- Create: `src/components/mobile/navigation/MobileNavigation.tsx`
- Create: `src/components/mobile/common/MobileHeader.tsx`
- Modify: `src/components/mobile/MobileAppShell.tsx`

Implement Home as the top-level course switcher and show Study/Course/Notes/Tools only in course context. Course renders expandable sections and real lesson state. Study provides a 16:9 explicitly nonfunctional media surface, lesson context, progress, bookmark, completion, previous/next, and Zen. Notes provides view/edit/full-screen modes and in-memory save status. Tools provides Timer, Todos, Bookmarks, Dictionary, and Vocabulary, with the dictionary backend clearly gated. Keep Terminal absent.

## Task 4: Apply Limmud’s adaptive visual system

**Files:**
- Create: `src/components/mobile/mobile.css`
- Modify: `src/components/mobile/MobileAppShell.tsx`
- Modify only if necessary to remove obsolete mobile rules: `src/styles.css`

Consume the desktop color variables and brand assets. Provide compact single-pane bottom navigation, medium rail layouts, expanded two-pane Course/Study layouts, 48px touch targets, safe-area padding, IME-safe note editing, restrained surfaces, responsive typography, portrait scrolling, landscape video dominance, and reduced-motion/focus-visible support. Do not change desktop selectors or composition.

## Task 5: Make mobile behavior tests pass

Run focused tests after each behavior implementation. Add narrowly scoped component tests only where behavior is not covered at the shell/model boundary. Do not alter unrelated VideoPlayer expectations.

## Task 6: Verify frontend and desktop regression

Run:
- `npm test -- src/components/mobile`
- `npm test`
- `npm run build`
- relevant Rust tests/checks supported by the host
- `git diff --check`

Record the four known VideoPlayer failures separately if they remain unchanged. Confirm `AppShell` is unmodified and desktop-only Terminal remains available on desktop.

## Task 7: Build and verify on the physical Android device

Verify the bridge with:
`ADB_SERVER_SOCKET=tcp:127.0.0.1:5039 ~/Android/Sdk/platform-tools/adb devices -l`

Build/install using the existing initialized Android project and bridge. Verify Home, Course, Study, Notes, Tools, navigation, Back ordering, scrolling, portrait, landscape, background/foreground, no Terminal, no crash, and no private data. Capture only privacy-safe synthetic screenshots if useful. Finish with status, changed files, checks, device evidence, placeholders, rollback, and the next SAF goal.
