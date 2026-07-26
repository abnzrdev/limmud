# Resizable Terminal Workspace Design

## Goal

Move the existing PTY terminal from the Notes tabs into a persistent, resizable right workspace containing Terminal above compact Tools, while keeping Notes below Video and preserving the same PTY through layout changes, maximize, and Zen Mode.

## Architecture

`AppShell` owns the workspace layout and all persisted layout state. In normal mode one horizontal `react-resizable-panels` `Group` contains the collapsible course outline, the center `LessonWorkspace`, and the collapsible right workspace, with labeled separators between all three. The right panel contains a vertical `Group` with the existing `CourseTerminal`, a horizontal `Separator`, and the compact Tools accordions.

`CourseTerminal` stays mounted after its first explicit Start action. Visibility is passed as a prop; hidden, Zen, and maximized transitions never recreate the component or session. Its `ResizeObserver` schedules `FitAddon.fit()` and sends only positive columns and rows to Rust. Repeated observer callbacks are debounced and stale callbacks are cancelled.

Terminal maximize is local `AppShell` state. It hides the course sidebar, center workspace, separators, and Tools while rendering the same terminal component as the sole main workspace. Escape restores normal layout. Zen hides the right workspace while keeping it mounted and shows only the lesson title, video, notes, timer/status, and Exit Zen.

## Persistence

The existing global app configuration stores one JSON `workspaceLayout` value:

```json
{
  "courseSize": 14,
  "rightSize": 28,
  "verticalSplit": 55,
  "courseCollapsed": false,
  "rightCollapsed": false,
  "openTools": ["stats", "resources"]
}
```

Restoration accepts finite sizes only. `courseSize` is constrained to 10–24, `rightSize` to 20–55, `verticalSplit` to 30–75, collapsed fields must be boolean, and `openTools` contains only known tool keys with at most two entries. Invalid fields fall back independently. Terminal output, PID, maximize state, Zen state, and absolute paths are not persisted. Rust reads and writes the string map with `serde_json`, preserving nested JSON strings intact.

## Interaction and Accessibility

Use the current official `Group`, `Panel`, and `Separator` API. Horizontal and vertical separators expose keyboard resizing through the library, have visible focus/hover/drag states, a larger hit target, `aria-label`, and a `GripVertical` or rotated grip icon. The right panel can collapse and expand from labeled icon buttons. Double-click restores the default split through the group imperative API if supported by the installed version.

Important actions retain text and Lucide icons. Familiar compact actions use icon-only buttons with `aria-label` and `title`. Tool headers include summary text and permit at most two expanded sections.

## Theme

Semantic CSS variables map the supplied palette:

- Dark: background `#0F1206`, panel `#1A1E0A`, elevated `#2C2E18`, text `#F1F4E3`, accent `#E6FF01`, border derived from `#656B35`.
- Light: background `#F1F4E3`, light ivory panels, text `#0F1206`, secondary `#2C2E18`, accent `#E6FF01`, border `#656B35`.

Electric Lime is limited to accents, focus rings, and selected-state details. Selected and completed states retain icons/text so they do not rely on color alone.

## Responsive Behavior

Wide layouts show course, center, and right workspaces. Medium layouts preserve existing collapsible rails. Narrow layouts automatically hide the course sidebar and present the right workspace as a full-width temporary layer when expanded, keeping the video at a usable width.

## Testing

Frontend tests cover notes-only placement, panel composition and persistence validation, collapse/expand, keyboard-accessible separators, terminal fit and positive PTY sizes, maximize/Escape, Zen session preservation, themes, summaries, and existing application behavior. A Rust regression test covers app-config strings containing arrays and nested layout JSON.
