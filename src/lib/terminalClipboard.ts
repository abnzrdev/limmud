import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Terminal } from "@xterm/xterm";

type ClipboardTerminal = Pick<
  Terminal,
  | "attachCustomKeyEventHandler"
  | "clearSelection"
  | "getSelection"
  | "hasSelection"
>;

interface InstallTerminalClipboardOptions {
  terminal: ClipboardTerminal;
  container: HTMLElement;
  writeInput: (text: string) => Promise<void>;
  setStatus: (message: string) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function copyTerminalSelection(
  terminal: Pick<ClipboardTerminal, "clearSelection" | "getSelection">,
  setStatus: (message: string) => void,
): Promise<boolean> {
  const selectedText = terminal.getSelection();

  if (!selectedText) {
    setStatus("Select terminal text before copying");
    return false;
  }

  try {
    await writeText(selectedText);
    terminal.clearSelection();
    setStatus("Terminal text copied");
    return true;
  } catch (error) {
    setStatus(`Terminal copy failed: ${errorMessage(error)}`);
    return false;
  }
}

export async function pasteTerminalClipboard(
  writeInput: (text: string) => Promise<void>,
  setStatus: (message: string) => void,
): Promise<boolean> {
  try {
    const clipboardText = await readText();

    if (!clipboardText) {
      setStatus("Clipboard is empty");
      return false;
    }

    await writeInput(clipboardText);
    setStatus("Clipboard pasted");
    return true;
  } catch (error) {
    setStatus(`Terminal paste failed: ${errorMessage(error)}`);
    return false;
  }
}

export function installTerminalClipboard({
  terminal,
  container,
  writeInput,
  setStatus,
}: InstallTerminalClipboardOptions): () => void {
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown" || !event.ctrlKey || !event.shiftKey) {
      return true;
    }

    const key = event.key.toLowerCase();

    if (key === "c") {
      event.preventDefault();
      event.stopPropagation();
      void copyTerminalSelection(terminal, setStatus);
      return false;
    }

    if (key === "v") {
      event.preventDefault();
      event.stopPropagation();
      void pasteTerminalClipboard(writeInput, setStatus);
      return false;
    }

    return true;
  });

  const handleContextMenu = (event: MouseEvent) => {
    if (!terminal.hasSelection()) {
      return;
    }

    event.preventDefault();
    void copyTerminalSelection(terminal, setStatus);
  };

  container.addEventListener("contextmenu", handleContextMenu);

  return () => {
    container.removeEventListener("contextmenu", handleContextMenu);
  };
}
