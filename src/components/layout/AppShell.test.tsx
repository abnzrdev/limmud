// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { AppModel } from "../../hooks/useAppModel";

const panelMocks = vi.hoisted(() => ({ setLayout: vi.fn(), terminalMounts: 0 }));

vi.mock("react-resizable-panels", () => ({
  Group: ({ children, id, onLayoutChanged }: { children: React.ReactNode; id: string; onLayoutChanged?: (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => void }) => (
    <div data-testid={id}>
      {children}
      <button
        type="button"
        aria-label={`Test resize ${id}`}
        onClick={() => onLayoutChanged?.(
          id === "workspace-layout"
            ? { "course-workspace": 12, "center-workspace": 52, "right-workspace": 36 }
            : { terminal: 62, tools: 38 },
          { isUserInteraction: true },
        )}
      />
    </div>
  ),
  Panel: ({ children, id }: { children: React.ReactNode; id: string }) => <div data-panel={id}>{children}</div>,
  Separator: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div role="separator" tabIndex={0} {...props}>{children}</div>,
  useGroupRef: () => ({ current: { setLayout: panelMocks.setLayout } }),
  usePanelRef: () => ({ current: null }),
}));

vi.mock("../workspace/CourseTerminal", () => ({
  CourseTerminal: ({ visible, maximized, onToggleMaximized }: { visible: boolean; maximized: boolean; onToggleMaximized: () => void }) => {
    useEffect(() => {
      panelMocks.terminalMounts += 1;
    }, []);
    return <section aria-label="Course terminal" data-visible={visible} data-maximized={maximized}>
      <span>terminal-session</span>
      <button type="button" onClick={onToggleMaximized}>
        {maximized ? "Restore Terminal" : "Maximize Terminal"}
      </button>
    </section>;
  },
}));
vi.mock("../dictionary/DictionaryDrawer", () => ({
  DictionaryDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <aside aria-label="Dictionary drawer" hidden={!open}>
      Dictionary open
      <button type="button" onClick={onClose}>Close Dictionary</button>
    </aside>
  ),
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: () => [],
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));

afterEach(cleanup);

it("toggles zen mode without hiding the workspace", () => {
  const { container } = render(<AppShell model={modelStub()} />);

  expect(screen.getByRole("heading", { name: "Limmud" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search lessons...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Course Materials" })).toBeInTheDocument();
  expect(screen.getByText("Today")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Zen Mode" }));

  expect(container.firstElementChild).toHaveClass("app-shell--zen");
  expect(screen.queryByRole("heading", { name: "Limmud" })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Search lessons...")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Resources" })).not.toBeInTheDocument();
  expect(screen.getByText("25:00")).toBeInTheDocument();
  expect(screen.queryByText(/Loaded|Restored|tmp\/course/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Exit Zen" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "lesson.mp4" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Exit Zen" }));

  expect(container.firstElementChild).not.toHaveClass("app-shell--zen");
  expect(screen.getByRole("heading", { name: "Limmud" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search lessons...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Course Materials" })).toBeInTheDocument();
});

it("replaces the visible right workspace without unmounting Terminal or changing its layout", async () => {
  const setWorkspaceLayout = vi.fn();
  panelMocks.terminalMounts = 0;
  render(<AppShell model={modelStub({ setWorkspaceLayout })} />);
  const trigger = screen.getByRole("button", { name: "Dictionary" });
  const terminal = screen.getByLabelText("Course terminal");
  const terminalLayer = terminal.closest(".right-workspace-terminal");

  fireEvent.click(trigger);

  expect(screen.getByLabelText("Dictionary drawer")).toBeVisible();
  expect(terminal).toBeInTheDocument();
  expect(terminalLayer).toHaveAttribute("aria-hidden", "true");
  expect(terminalLayer).toHaveAttribute("inert");
  expect(terminal.closest(".right-workspace")).toHaveAttribute("data-mode", "dictionary");
  expect(screen.getByLabelText("Lesson notes")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Test resize workspace-layout" }));
  expect(setWorkspaceLayout).not.toHaveBeenCalledWith(expect.objectContaining({ rightSize: 36 }));

  fireEvent.keyDown(window, { key: "d", ctrlKey: true, shiftKey: true });
  expect(screen.getByLabelText("Dictionary drawer")).not.toBeVisible();
  expect(terminalLayer).not.toHaveAttribute("aria-hidden");
  expect(terminalLayer).not.toHaveAttribute("inert");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(panelMocks.terminalMounts).toBe(1);
});

it("hides Dictionary in Zen and restores its open mode afterwards", () => {
  render(<AppShell model={modelStub()} />);
  fireEvent.click(screen.getByRole("button", { name: "Dictionary" }));
  fireEvent.click(screen.getByRole("button", { name: "Zen Mode" }));
  expect(screen.getByLabelText("Dictionary drawer")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Exit Zen" }));
  expect(screen.getByLabelText("Dictionary drawer")).toBeVisible();
  expect(screen.getByLabelText("Course terminal")).toBeInTheDocument();
});

it("uses a closable sheet backdrop in a narrow window without remounting Terminal", () => {
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
  panelMocks.terminalMounts = 0;
  const { container } = render(<AppShell model={modelStub()} />);

  fireEvent.click(screen.getByRole("button", { name: "Dictionary" }));
  const backdrop = container.querySelector(".dictionary-backdrop");
  expect(backdrop).not.toHaveAttribute("hidden");
  expect(screen.getByLabelText("Course terminal")).toBeInTheDocument();
  fireEvent.click(backdrop!);
  expect(screen.getByLabelText("Dictionary drawer")).not.toBeVisible();
  expect(panelMocks.terminalMounts).toBe(1);

  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
});

it("exits zen mode with Escape", () => {
  const { container } = render(<AppShell model={modelStub()} />);

  fireEvent.click(screen.getByRole("button", { name: "Zen Mode" }));
  expect(container.firstElementChild).toHaveClass("app-shell--zen");
  expect(screen.getByRole("button", { name: "Exit Zen" })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });

  expect(container.firstElementChild).not.toHaveClass("app-shell--zen");
  expect(screen.queryByRole("button", { name: "Exit Zen" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Limmud" })).toBeInTheDocument();
});

it("collapses the side panels into rails", () => {
  render(<AppShell model={modelStub()} />);

  fireEvent.click(screen.getByRole("button", { name: "Collapse course sidebar" }));
  fireEvent.click(screen.getByRole("button", { name: "Collapse terminal and tools panel" }));

  expect(screen.queryByRole("heading", { name: "Course Outline" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expand course sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expand terminal and tools panel" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Course Materials" })).toHaveAttribute("title", "Course Materials");
  expect(screen.getByRole("button", { name: "Stats" })).toHaveAttribute("title", "Stats");
  expect(screen.getByRole("button", { name: "Timer" })).toHaveAttribute("title", "Timer");
  expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("title", "Todos");
  expect(screen.getByRole("heading", { name: "lesson.mp4" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Timer" }));

  expect(screen.getByRole("button", { name: "Collapse terminal and tools panel" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Timer" })).toHaveAttribute("aria-expanded", "true");
});

it("renders Terminal in the resizable right panel and keeps Notes in the center", () => {
  render(<AppShell model={modelStub()} />);

  expect(within(screen.getByTestId("workspace-layout")).getByLabelText("Course terminal")).toBeInTheDocument();
  expect(screen.getByLabelText("Lesson notes")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Terminal" })).not.toBeInTheDocument();
  expect(screen.getByRole("separator", { name: "Resize course outline and workspace" })).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("separator", { name: "Resize terminal and workspace" })).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("separator", { name: "Resize terminal and tools" })).toHaveAttribute("tabindex", "0");
});

it("persists horizontal and vertical panel layouts", () => {
  const setWorkspaceLayout = vi.fn();
  render(<AppShell model={modelStub({ setWorkspaceLayout })} />);

  fireEvent.click(screen.getByRole("button", { name: "Test resize workspace-layout" }));
  fireEvent.click(screen.getByRole("button", { name: "Test resize terminal-tools-layout" }));

  expect(setWorkspaceLayout).toHaveBeenCalledWith(expect.objectContaining({ rightSize: 36 }));
  expect(setWorkspaceLayout).toHaveBeenCalledWith(expect.objectContaining({ courseSize: 12 }));
  expect(setWorkspaceLayout).toHaveBeenCalledWith(expect.objectContaining({ verticalSplit: 62 }));
});

it("does not reapply the whole layout after persisting a panel drag", () => {
  const setWorkspaceLayout = vi.fn();
  const { rerender } = render(<AppShell model={modelStub({ setWorkspaceLayout })} />);
  panelMocks.setLayout.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Test resize workspace-layout" }));
  const savedLayout = setWorkspaceLayout.mock.calls[setWorkspaceLayout.mock.calls.length - 1]?.[0];
  rerender(<AppShell model={modelStub({ setWorkspaceLayout, workspaceLayout: savedLayout })} />);

  expect(panelMocks.setLayout).not.toHaveBeenCalled();
});

it("maximizes Terminal and restores it with Escape without remounting its workspace", () => {
  const { container } = render(<AppShell model={modelStub()} />);
  fireEvent.click(screen.getByRole("button", { name: "Maximize Terminal" }));
  expect(container.firstElementChild).toHaveClass("app-shell--terminal-maximized");
  expect(screen.getByLabelText("Course terminal")).toHaveAttribute("data-maximized", "true");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(container.firstElementChild).not.toHaveClass("app-shell--terminal-maximized");
  expect(screen.getByRole("button", { name: "Maximize Terminal" })).toBeInTheDocument();
});

it("hides Terminal in Zen without removing it and restores the same UI", () => {
  render(<AppShell model={modelStub()} />);
  fireEvent.click(screen.getByRole("button", { name: "Zen Mode" }));
  expect(screen.getByLabelText("Course terminal", { selector: "section" })).toHaveAttribute("data-visible", "false");
  expect(screen.getByRole("button", { name: "Exit Zen" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Exit Zen" }));
  expect(screen.getByLabelText("Course terminal")).toHaveAttribute("data-visible", "true");
});

it("searches course lessons from the top header", () => {
  const selectEntry = vi.fn();
  render(
    <AppShell
      model={modelStub({
        entries: [
          {
            id: "week-1",
            name: "Week 1",
            relativePath: "Week 1",
            absolutePath: "/tmp/course/Week 1",
            kind: "directory",
            children: [
              {
                id: "week-1/intro.mp4",
                name: "intro.mp4",
                relativePath: "Week 1/intro.mp4",
                absolutePath: "/tmp/course/Week 1/intro.mp4",
                kind: "video",
              },
            ],
          },
        ],
        selectEntry,
      })}
    />,
  );

  fireEvent.change(screen.getByPlaceholderText("Search lessons..."), {
    target: { value: "intro" },
  });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("button", { name: /intro/ }));

  expect(selectEntry).toHaveBeenCalledWith(
    expect.objectContaining({ relativePath: "Week 1/intro.mp4" }),
  );
});

it("shows study seconds below one minute and labels the counting scope", () => {
  render(
    <AppShell
      model={modelStub({
        studyStats: {
          todaySeconds: 18,
          totalSeconds: 43,
          streakDays: 1,
          lastStudyDate: "2026-07-15",
          todayBySource: { videoSeconds: 18, terminalSeconds: 0 },
          totalBySource: { videoSeconds: 43, terminalSeconds: 0 },
        },
      })}
    />,
  );

  expect(screen.getAllByText("18s")).toHaveLength(2);
  expect(screen.getByText("43s")).toBeInTheDocument();
  expect(screen.getByText("Active study · Video + Terminal")).toBeInTheDocument();
  expect(screen.getByText("1 day")).toBeInTheDocument();
});

function modelStub(overrides: Partial<AppModel> = {}): AppModel {
  return {
    entries: [],
    selectedEntry: {
      id: "lesson",
      name: "lesson.mp4",
      relativePath: "lesson.mp4",
      absolutePath: "/tmp/course/lesson.mp4",
      kind: "video",
    },
    selectedSubtitle: null,
    lessonEntries: [],
    currentCourseRoot: "/tmp/course",
    lastOpenedCourse: "/tmp/course",
    theme: "dark",
    timerPresets: [25],
    workspaceLayout: {
      courseSize: 14,
      rightSize: 28,
      verticalSplit: 55,
      courseCollapsed: false,
      rightCollapsed: false,
      openTools: ["stats", "resources"],
    },
    dictionaryLayout: { width: 420 },
    noteBody: "# Notes",
    noteSaveStatus: "saved",
    noteSaveError: null,
    recoveredUnsavedDraft: false,
    timerMode: "focus",
    timerPreset: 25,
    resumeTime: 0,
    shouldAutoPlaySelectedEntry: false,
    todos: [],
    quickNote: "",
    resources: [],
    completedLessons: [],
    bookmarkedLessons: [],
    bookmarkedEntries: [],
    studyStats: {
      todaySeconds: 35 * 60,
      totalSeconds: 8 * 60 * 60 + 20 * 60,
      streakDays: 3,
      lastStudyDate: "2026-07-09",
      todayBySource: { videoSeconds: 30 * 60, terminalSeconds: 5 * 60 },
      totalBySource: { videoSeconds: 8 * 60 * 60, terminalSeconds: 20 * 60 },
    },
    progressPercent: 0,
    knownCourses: [],
    status: "Loaded",
    openCourse: vi.fn(),
    openKnownCourse: vi.fn(),
    locateCourse: vi.fn(),
    changeCourseCover: vi.fn(),
    clearCourseCover: vi.fn(),
    forgetCourse: vi.fn(),
    refreshCourse: vi.fn(),
    isRefreshingCourse: false,
    openLessonFolder: vi.fn(),
    selectEntry: vi.fn(),
    setNoteBody: vi.fn(),
    saveNote: vi.fn(),
    loadTextFile: vi.fn(async () => ""),
    saveTextFile: vi.fn(async () => {}),
    pickTimerPreset: vi.fn(),
    toggleTimerMode: vi.fn(),
    toggleTheme: vi.fn(),
    setWorkspaceLayout: vi.fn(),
    setDictionaryLayout: vi.fn(),
    addTodo: vi.fn(),
    toggleTodo: vi.fn(),
    setQuickNote: vi.fn(),
    updateVideoProgress: vi.fn(),
    recordStudySeconds: vi.fn(),
    flushCourseState: vi.fn(),
    advanceToNextLesson: vi.fn(),
    importLessonResources: vi.fn(),
    openResource: vi.fn(),
    openCourseMaterial: vi.fn(),
    toggleLessonDone: vi.fn(),
    toggleLessonBookmark: vi.fn(),
    ...overrides,
  };
}
