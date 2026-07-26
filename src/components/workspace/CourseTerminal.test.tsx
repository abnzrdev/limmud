// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CourseTerminal } from "./CourseTerminal";

const { dataCallbacks, fitAddonFit, resizeCallbacks, terminalDimensions, terminalClose, terminalResize, terminalRestart, terminalStart, terminalWrite } = vi.hoisted(() => ({
  dataCallbacks: [] as Array<(data: string) => void>,
  fitAddonFit: vi.fn(),
  resizeCallbacks: [] as ResizeObserverCallback[],
  terminalDimensions: { cols: 80, rows: 24 },
  terminalClose: vi.fn(),
  terminalResize: vi.fn(),
  terminalRestart: vi.fn(),
  terminalStart: vi.fn(),
  terminalWrite: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  terminalClose,
  terminalResize,
  terminalRestart,
  terminalStart,
  terminalWrite,
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    get cols() { return terminalDimensions.cols; }
    get rows() { return terminalDimensions.rows; }
    open = vi.fn();
    write = vi.fn();
    clear = vi.fn();
    reset = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    getSelection = vi.fn(() => "");
    hasSelection = vi.fn(() => false);
    clearSelection = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    onData(callback: (data: string) => void) { dataCallbacks.push(callback); return { dispose: vi.fn() }; }
  },
}));

vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = fitAddonFit; } }));

beforeEach(() => {
  vi.clearAllMocks();
  resizeCallbacks.length = 0;
  dataCallbacks.length = 0;
  terminalDimensions.cols = 80;
  terminalDimensions.rows = 24;
  terminalStart.mockResolvedValue("terminal-1");
  terminalClose.mockResolvedValue(undefined);
  terminalResize.mockResolvedValue(undefined);
  terminalRestart.mockResolvedValue("terminal-2");
  terminalWrite.mockResolvedValue(undefined);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
    observe = vi.fn();
    disconnect = vi.fn();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("starts only from the explicit Start Terminal action", async () => {
  render(
    <CourseTerminal
      courseRoot="/tmp/course"
      visible
      maximized={false}
      onToggleMaximized={() => {}}
    />,
  );

  expect(terminalStart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledWith(
    "/tmp/course",
    80,
    24,
    expect.any(Function),
  ));
});

it("falls back when fit throws and never starts with zero dimensions", async () => {
  fitAddonFit.mockImplementationOnce(() => { throw new Error("pane has no size"); });
  terminalDimensions.cols = 0;
  terminalDimensions.rows = 0;
  render(<CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledWith("/tmp/course", 80, 24, expect.any(Function)));
  expect(screen.getByRole("status")).toHaveTextContent("Local shell");
});

it.each([
  [Number.NaN, Number.NaN],
  [-1, 24],
  [65_536, 24],
])("uses safe defaults for invalid fitted dimensions %s x %s", async (cols, rows) => {
  terminalDimensions.cols = cols;
  terminalDimensions.rows = rows;
  render(<CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledWith("/tmp/course", 80, 24, expect.any(Function)));
});

it("ignores a second Start click while startup is pending", async () => {
  let resolveStart!: (id: string) => void;
  terminalStart.mockReturnValueOnce(new Promise((resolve) => { resolveStart = resolve; }));
  render(<CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={() => {}} />);
  const start = screen.getByRole("button", { name: "Start Terminal" });
  fireEvent.click(start);
  expect(start).toBeDisabled();
  fireEvent.click(start);
  expect(terminalStart).toHaveBeenCalledTimes(1);
  resolveStart("terminal-1");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Start Terminal" })).not.toBeInTheDocument());
});

it("signals generic user activity before forwarding the original PTY input", async () => {
  const onUserActivity = vi.fn();
  render(<CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={() => {}} onUserActivity={onUserActivity} />);
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalled());
  dataCallbacks[0]("secret command\r");
  expect(onUserActivity).toHaveBeenCalledWith();
  expect(terminalWrite).toHaveBeenCalledWith("terminal-1", "secret command\r");
});

it("fits visible resizes but never sends zero dimensions while hidden", async () => {
  vi.useFakeTimers();
  const props = { courseRoot: "/tmp/course", maximized: false, onToggleMaximized: () => {} };
  const { rerender } = render(<CourseTerminal {...props} visible />);
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await vi.runAllTimersAsync();
  resizeCallbacks[0]([], {} as ResizeObserver);
  await vi.runAllTimersAsync();
  expect(fitAddonFit).toHaveBeenCalled();
  expect(terminalResize).toHaveBeenCalledWith("terminal-1", 80, 24);

  terminalResize.mockClear();
  rerender(<CourseTerminal {...props} visible={false} />);
  resizeCallbacks[0]([], {} as ResizeObserver);
  await vi.runAllTimersAsync();
  expect(terminalResize).not.toHaveBeenCalled();
  expect(terminalClose).not.toHaveBeenCalled();
});

it("maximizes and restores without starting another session", async () => {
  const onToggleMaximized = vi.fn();
  const { rerender } = render(
    <CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={onToggleMaximized} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Maximize Terminal" }));
  expect(onToggleMaximized).toHaveBeenCalled();

  rerender(<CourseTerminal courseRoot="/tmp/course" visible maximized onToggleMaximized={onToggleMaximized} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore Terminal" }));
  expect(terminalStart).toHaveBeenCalledTimes(1);
});

it("closes the old session and starts in the next course root", async () => {
  terminalStart.mockResolvedValueOnce("terminal-1").mockResolvedValueOnce("terminal-2");
  const props = { visible: true, maximized: false, onToggleMaximized: () => {} };
  const { rerender } = render(<CourseTerminal {...props} courseRoot="/tmp/course-a" />);
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledWith(
    "/tmp/course-a",
    80,
    24,
    expect.any(Function),
  ));

  rerender(<CourseTerminal {...props} courseRoot="/tmp/course-b" />);
  await waitFor(() => expect(terminalClose).toHaveBeenCalledWith("terminal-1"));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledWith(
    "/tmp/course-b",
    80,
    24,
    expect.any(Function),
  ));
});

it("closes an active session on unmount", async () => {
  const { unmount } = render(
    <CourseTerminal courseRoot="/tmp/course" visible maximized={false} onToggleMaximized={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  await waitFor(() => expect(terminalStart).toHaveBeenCalledTimes(1));
  unmount();
  await waitFor(() => expect(terminalClose).toHaveBeenCalledWith("terminal-1"));
});

it("shows a readable startup failure", async () => {
  terminalStart.mockRejectedValueOnce(new Error("course directory is missing"));
  render(
    <CourseTerminal courseRoot="/tmp/missing" visible maximized={false} onToggleMaximized={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start Terminal" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Terminal failed to start: course directory is missing",
  );
  expect(screen.getByRole("button", { name: "Start Terminal" })).toBeEnabled();
});
