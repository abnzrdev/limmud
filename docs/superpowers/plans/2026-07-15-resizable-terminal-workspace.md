# Resizable Terminal Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing terminal into a persistent resizable right workspace above compact Tools while Notes remains below Video.

**Architecture:** `AppShell` owns a three-panel horizontal group (course, center, right), the nested Terminal/Tools group, and validated global layout state. `CourseTerminal` remains one mounted component/session and receives only visibility and maximize callbacks; its existing observer performs debounced positive-size fitting. Existing course, video, notes, stats, resources, bookmarks, timer, and todos components are reused.

**Tech Stack:** React 19, TypeScript, `react-resizable-panels` 4.x, xterm.js 6, Tauri 2, Vitest, CSS variables.

## Global Constraints

- Add only `react-resizable-panels` as a new dependency.
- Preserve `diagnostics/` and all existing local changes.
- Do not commit or push.
- Persist only validated relative layout sizes, collapsed state, and known open Tool keys.
- Never recreate a PTY for resize, maximize, tab changes, or Zen Mode.
- Never send zero columns or rows to the PTY.

---

### Task 1: Install and Verify the Panel API

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: installed exports `Group`, `Panel`, `Separator`, and ref/layout types used by later tasks.

- [ ] Install `react-resizable-panels`.
- [ ] Read the installed package exports and TypeScript declarations for `Group`, `Panel`, `Separator`, `defaultLayout`, `onLayoutChanged`, collapse, refs, separator attributes, and sizing units.
- [ ] Record the exact installed version and use only its current names.

### Task 2: Add Validated Workspace Layout Persistence

**Files:**
- Modify: `src/lib/persistence.ts`
- Modify: `src/test/persistence.test.ts`
- Modify: `src/hooks/useAppModel.ts`
- Modify: `src/hooks/useAppModel.test.tsx`

**Interfaces:**
- Produces: `WorkspaceLayout`, `defaultWorkspaceLayout`, `sanitizeWorkspaceLayout(value)`, `AppModel.workspaceLayout`, and `AppModel.setWorkspaceLayout(layout)`.
- Persists: global config key `workspaceLayout` as JSON.

- [ ] Write failing persistence tests for valid restoration, independent invalid-size fallback, unknown Tool removal, and a maximum of two open Tools.
- [ ] Run `npm run test:file -- src/test/persistence.test.ts` and confirm failures are caused by missing layout support.
- [ ] Add the minimal layout type, defaults, sanitizer, and global serialization/deserialization.
- [ ] Run the persistence test and confirm it passes.
- [ ] Write failing hook tests proving hydration and write-back use the sanitized layout.
- [ ] Add layout state to `useAppModel` and its existing global-config effect.
- [ ] Run `npm run test:file -- src/hooks/useAppModel.test.tsx` and confirm it passes.

### Task 3: Make Notes Permanent and Terminal Visibility Safe

**Files:**
- Modify: `src/components/workspace/NotesTabs.tsx`
- Modify: `src/components/workspace/NotesTabs.test.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Modify: `src/components/workspace/LessonWorkspace.test.tsx`
- Modify: `src/components/workspace/CourseTerminal.tsx`
- Create: `src/components/workspace/CourseTerminal.test.tsx`

**Interfaces:**
- `NotesTabs` no longer accepts `currentCourseRoot` and renders only Notes.
- `CourseTerminal` accepts `courseRoot`, `visible`, `maximized`, and `onToggleMaximized`.

- [ ] Replace Notes tab tests with failing tests that assert no Terminal tab and persistent Notes content.
- [ ] Run the Notes and LessonWorkspace tests and confirm the missing behavior fails.
- [ ] Remove terminal lazy loading and tab state from `NotesTabs`; keep existing editor/save behavior unchanged.
- [ ] Add failing `CourseTerminal` tests for explicit start, positive resize, hidden zero-size suppression, maximize/restore using one session, and accessible icon actions.
- [ ] Update `CourseTerminal` to remain mounted, debounce fit/resize, cancel stale callbacks, use semantic xterm theme variables, and expose maximize/restore.
- [ ] Run the three workspace test files and confirm they pass.

### Task 4: Build the Nested Resizable AppShell

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `model.workspaceLayout`, `model.setWorkspaceLayout`, `CourseTerminal` visibility/maximize props.
- Produces: horizontal `Group` with center/right panels and nested vertical Terminal/Tools `Group`.

- [ ] Write failing AppShell tests proving Terminal is in the right panel, Notes remains in center, separators are labeled, layout changes persist, collapse/expand works, maximize preserves one terminal, Escape restores, and Zen hides without closing.
- [ ] Run `npm run test:file -- src/components/layout/AppShell.test.tsx` and confirm expected failures.
- [ ] Add the horizontal and vertical groups using installed `Group`, `Panel`, and `Separator` APIs with 72/28 and 55/45 defaults, validated min/max constraints, collapse buttons, and reset-on-double-click refs.
- [ ] Move existing Tool accordions into the lower right panel, add compact summaries, internal scrolling, and a two-open limit.
- [ ] Keep the same `CourseTerminal` element mounted while CSS/state switches normal, maximized, and Zen visibility.
- [ ] Add Escape handling precedence: restore terminal maximize first, then exit Zen.
- [ ] Run AppShell and workspace tests and confirm they pass.

### Task 5: Apply Semantic Themes and Controls

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/workspace/LessonWorkspace.tsx`
- Modify: `src/components/right/AttachmentsPanel.tsx`
- Modify: `src/components/right/FocusTimer.tsx`
- Modify: `src/components/right/TodoPanel.tsx`
- Modify relevant existing component tests only when their accessible labels change.

**Interfaces:**
- Produces semantic tokens `--app-bg`, `--panel-bg`, `--surface-bg`, `--text`, `--muted`, `--accent`, `--border`, `--focus-ring`, and consistent button variants.

- [ ] Write failing assertions for Sun/Moon theme controls, labeled icon-only controls, and semantic theme selectors.
- [ ] Replace amber tokens and embedded terminal colors with the supplied palette variables.
- [ ] Add shared primary, secondary, ghost, destructive, focus, hover, active, disabled, narrow-row, and separator styles.
- [ ] Update buttons to the requested Lucide icons and accessible names without changing business logic.
- [ ] Add wide/medium/narrow layout rules while preserving existing collapsed rails.
- [ ] Run AppShell and all affected component tests.

### Task 6: Verification and Live Tauri Checks

**Files:**
- No production files unless verification exposes a tested defect.

- [ ] Run `npm run build`.
- [ ] Run each requested `npm run test:file -- ...` command.
- [ ] Run `npm test`.
- [ ] Run `git diff --check`.
- [ ] Run `cargo test` only if Rust files changed; otherwise retain the last verified Rust result and state that Rust was untouched.
- [ ] In the live Tauri app verify course opening, explicit terminal start, horizontal and vertical resizing, FitAddon, interactive session survival, maximize/restore, Zen session survival, restart persistence, both themes, keyboard separators/focus rings, and wide/medium/narrow behavior.
- [ ] Report exact changed files, dependency/version, persisted JSON format, lifecycle behavior, automated results, manual results, warnings, and any unverifiable scenario.

### Task 7: Screenshot Follow-up and Config Reliability

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/styles.css`
- Modify: `src/lib/persistence.ts`
- Modify: `src-tauri/src/persistence.rs`
- Modify relevant frontend and Rust tests.

- [ ] Move the course outline into the horizontal Group as a draggable/collapsible Panel with a labeled separator.
- [ ] Persist validated `courseSize` and `courseCollapsed` fields.
- [ ] Make Panel inner surfaces and `CourseTerminal` fill width/height so xterm resizes with the actual panel.
- [ ] Replace comma-splitting JSON map parsing with `serde_json` and add a nested-string round-trip regression test.
- [ ] Verify collapse/expand and restart restoration in the live Tauri app.
