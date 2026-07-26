// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyTerminalSelection,
  installTerminalClipboard,
  pasteTerminalClipboard,
} from "./terminalClipboard";

const clipboard = vi.hoisted(() => ({
  readText: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => clipboard);

function createTerminal() {
  let keyHandler: ((event: KeyboardEvent) => boolean) | null = null;
  let selection = "";

  return {
    terminal: {
      attachCustomKeyEventHandler: vi.fn(
        (handler: (event: KeyboardEvent) => boolean) => {
          keyHandler = handler;
        },
      ),
      clearSelection: vi.fn(() => {
        selection = "";
      }),
      getSelection: vi.fn(() => selection),
      hasSelection: vi.fn(() => Boolean(selection)),
    },
    getKeyHandler: () => keyHandler,
    setSelection: (value: string) => {
      selection = value;
    },
  };
}

describe("terminal clipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clipboard.readText.mockResolvedValue("");
    clipboard.writeText.mockResolvedValue(undefined);
  });

  it("copies the selected terminal text", async () => {
    const fixture = createTerminal();
    const setStatus = vi.fn();
    fixture.setSelection("selected output");

    await expect(
      copyTerminalSelection(fixture.terminal, setStatus),
    ).resolves.toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith("selected output");
    expect(fixture.terminal.clearSelection).toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith("Terminal text copied");
  });

  it("pastes clipboard text into the active PTY", async () => {
    const writeInput = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();
    clipboard.readText.mockResolvedValue("flutter run");

    await expect(
      pasteTerminalClipboard(writeInput, setStatus),
    ).resolves.toBe(true);

    expect(writeInput).toHaveBeenCalledWith("flutter run");
    expect(setStatus).toHaveBeenLastCalledWith("Clipboard pasted");
  });

  it("handles Ctrl+Shift+C, Ctrl+Shift+V and right-click", async () => {
    const fixture = createTerminal();
    const container = document.createElement("div");
    const writeInput = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();

    fixture.setSelection("copied output");
    clipboard.readText.mockResolvedValue("pasted input");

    const cleanup = installTerminalClipboard({
      terminal: fixture.terminal,
      container,
      writeInput,
      setStatus,
    });

    const handler = fixture.getKeyHandler();
    expect(handler).not.toBeNull();

    expect(
      handler!(
        new KeyboardEvent("keydown", {
          key: "C",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe(false);

    await vi.waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith("copied output");
    });

    expect(
      handler!(
        new KeyboardEvent("keydown", {
          key: "V",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe(false);

    await vi.waitFor(() => {
      expect(writeInput).toHaveBeenCalledWith("pasted input");
    });

    fixture.setSelection("right click output");

    container.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );

    await vi.waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith(
        "right click output",
      );
    });

    cleanup();
  });
});
