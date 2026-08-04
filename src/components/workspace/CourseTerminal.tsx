import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { installTerminalClipboard } from "../../lib/terminalClipboard";
import {
  Columns2,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RotateCcw,
  Rows2,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  terminalClose,
  terminalResize,
  terminalRestart,
  terminalStart,
  terminalWrite,
  type TerminalEvent,
} from "../../lib/tauri";

interface CourseTerminalProps {
  courseRoot: string | null;
  visible: boolean;
  maximized: boolean;
  onToggleMaximized: () => void;
  onUserActivity?: () => void;
  onActivityStopped?: () => void;
}

interface TerminalPaneState {
  id: string;
  label: string;
}

interface TerminalPaneProps {
  label: string;
  courseRoot: string | null;
  visible: boolean;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
  onUserActivity?: () => void;
  onActivityStopped?: () => void;
}

type TerminalLayout = "columns" | "rows";
type TerminalLifecycle = "idle" | "starting" | "running" | "failed" | "exited";

const MAX_TERMINALS = 4;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const MAX_TERMINAL_DIMENSION = 65_535;

export function safeTerminalDimensions(
  terminal: Terminal | null,
  fitAddon: FitAddon | null,
): { cols: number; rows: number; fallbackUsed: boolean; fitError: string | null } {
  let fitError: string | null = null;
  try {
    fitAddon?.fit();
  } catch (error) {
    fitError = errorMessage(error);
  }
  const valid = (value: number, fallback: number) =>
    Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= MAX_TERMINAL_DIMENSION
      ? value
      : fallback;
  const cols = fitError ? 80 : valid(terminal?.cols ?? 0, 80);
  const rows = fitError ? 24 : valid(terminal?.rows ?? 0, 24);
  return { cols, rows, fallbackUsed: Boolean(fitError) || cols !== terminal?.cols || rows !== terminal?.rows, fitError };
}

export function CourseTerminal({
  courseRoot,
  visible,
  maximized,
  onToggleMaximized,
  onUserActivity,
  onActivityStopped,
}: CourseTerminalProps) {
  const [panes, setPanes] = useState<TerminalPaneState[]>([
    { id: "terminal-pane-1", label: "Terminal 1" },
  ]);
  const [activePaneId, setActivePaneId] = useState("terminal-pane-1");
  const [layout, setLayout] = useState<TerminalLayout>("columns");
  const nextPaneNumberRef = useRef(2);

  const addTerminal = useCallback(
    (requestedLayout?: TerminalLayout) => {
      if (panes.length >= MAX_TERMINALS) return;

      const number = nextPaneNumberRef.current++;
      const pane = {
        id: `terminal-pane-${number}`,
        label: `Terminal ${number}`,
      };

      setPanes((current) =>
        current.length >= MAX_TERMINALS ? current : [...current, pane],
      );
      setActivePaneId(pane.id);

      if (requestedLayout) {
        setLayout(requestedLayout);
      }
    },
    [panes.length],
  );

  const closeTerminal = useCallback(
    (id: string) => {
      const index = panes.findIndex((pane) => pane.id === id);
      if (index < 0) return;

      if (panes.length === 1) {
        const replacement = {
          id: `terminal-pane-${nextPaneNumberRef.current++}`,
          label: "Terminal 1",
        };
        setPanes([replacement]);
        setActivePaneId(replacement.id);
        return;
      }

      const next = panes.filter((pane) => pane.id !== id);
      setPanes(next);

      if (activePaneId === id) {
        const nextActive = next[Math.min(index, next.length - 1)];
        setActivePaneId(nextActive.id);
      }
    },
    [activePaneId, panes],
  );

  const splitTerminal = useCallback(
    (nextLayout: TerminalLayout) => {
      setLayout(nextLayout);

      if (panes.length === 1) {
        addTerminal(nextLayout);
      }
    },
    [addTerminal, panes.length],
  );

  useEffect(() => {
    if (!visible) return;

    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;

      const key = event.key.toLowerCase();

      if (key === "t") {
        event.preventDefault();
        addTerminal();
        return;
      }

      if (key === "w") {
        event.preventDefault();
        closeTerminal(activePaneId);
        return;
      }

      if (event.code === "Backslash" || event.key === "\\") {
        event.preventDefault();
        splitTerminal("columns");
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    activePaneId,
    addTerminal,
    closeTerminal,
    splitTerminal,
    visible,
  ]);

  const gridStyle = {
    "--terminal-pane-count": panes.length,
  } as CSSProperties;

  return (
    <section
      className="course-terminal terminal-workspace"
      aria-label="Course terminal"
      hidden={!visible}
    >
      <header className="terminal-header">
        <div className="terminal-location" title={courseRoot ?? undefined}>
          <span>cwd</span>
          <code>{courseRoot ?? "No course open"}</code>
          <span className="terminal-count">
            {panes.length}/{MAX_TERMINALS}
          </span>
        </div>

        <div className="terminal-workspace-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="New terminal"
            title="New terminal — Ctrl+Shift+T"
            disabled={panes.length >= MAX_TERMINALS}
            onClick={() => addTerminal()}
          >
            <Plus aria-hidden="true" />
          </button>

          <button
            className="icon-button"
            type="button"
            aria-label="Split terminal vertically"
            title="Split into columns — Ctrl+Shift+\\"
            onClick={() => splitTerminal("columns")}
          >
            <Columns2 aria-hidden="true" />
          </button>

          <button
            className="icon-button"
            type="button"
            aria-label="Split terminal horizontally"
            title="Split into rows"
            onClick={() => splitTerminal("rows")}
          >
            <Rows2 aria-hidden="true" />
          </button>

          <button
            className="icon-button"
            type="button"
            aria-label={maximized ? "Restore Terminal" : "Maximize Terminal"}
            title={maximized ? "Restore Terminal" : "Maximize Terminal"}
            onClick={onToggleMaximized}
          >
            {maximized ? (
              <Minimize2 aria-hidden="true" />
            ) : (
              <Maximize2 aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <div
        className={`terminal-grid terminal-grid--${layout}`}
        data-count={panes.length}
        style={gridStyle}
      >
        {panes.map((pane) => (
          <TerminalPane
            key={pane.id}
            label={pane.label}
            courseRoot={courseRoot}
            visible={visible}
            active={activePaneId === pane.id}
            onActivate={() => setActivePaneId(pane.id)}
            onUserActivity={onUserActivity}
            onActivityStopped={onActivityStopped}
            onClose={() => closeTerminal(pane.id)}
          />
        ))}
      </div>
    </section>
  );
}

function TerminalPane({
  label,
  courseRoot,
  visible,
  active,
  onActivate,
  onClose,
  onUserActivity,
  onActivityStopped,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const closePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const fitGenerationRef = useRef(0);
  const fitTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(visible);
  const shouldRunRef = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState(
    courseRoot
      ? "Terminal ready"
      : "Open a course before starting the terminal",
  );
  const [lifecycle, setLifecycle] = useState<TerminalLifecycle>("idle");

  const receive = useCallback(
    (generation: number, event: TerminalEvent) => {
      if (generation !== generationRef.current) return;

      if (event.event === "output") {
        terminalRef.current?.write(new Uint8Array(event.data));
        return;
      }

      if (event.event === "error") {
        if (import.meta.env.DEV) console.error("terminal_event_error", { pane: label, courseRoot, error: event.data });
        setStatus(`Terminal error: ${event.data}`);
        return;
      }

      generationRef.current += 1;
      sessionRef.current = null;
      shouldRunRef.current = false;
      setLifecycle("exited");
      onActivityStopped?.();
      setStatus(
        event.data === null
          ? "Terminal exited"
          : `Terminal exited (${event.data})`,
      );
    },
    [courseRoot, label, onActivityStopped],
  );

  const fit = useCallback(() => {
    const terminal = terminalRef.current;

    if (!visibleRef.current || !terminal || !fitRef.current) return;

    const dimensions = safeTerminalDimensions(terminal, fitRef.current);
    if (dimensions.fitError) {
      setStatus(`Terminal fit failed: ${dimensions.fitError}. Using safe dimensions.`);
    }

    if (sessionRef.current) {
      void terminalResize(
        sessionRef.current,
        dimensions.cols,
        dimensions.rows,
      ).catch((error) => {
        if (mountedRef.current) {
          setStatus(`Terminal resize failed: ${errorMessage(error)}`);
        }
      });
    }
  }, []);

  const scheduleFit = useCallback(() => {
    const generation = ++fitGenerationRef.current;

    if (fitTimerRef.current !== null) {
      window.clearTimeout(fitTimerRef.current);
    }

    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;

      if (generation === fitGenerationRef.current) {
        fit();
      }
    }, 60);
  }, [fit]);

  const close = useCallback(async (userInitiated = false) => {
    onActivityStopped?.();
    if (userInitiated) {
      shouldRunRef.current = false;
    }

    generationRef.current += 1;
    const sessionId = sessionRef.current;
    sessionRef.current = null;

    if (!sessionId) {
      return closePromiseRef.current;
    }

    const pending = closePromiseRef.current
      .catch(() => {})
      .then(() => terminalClose(sessionId))
      .catch((error) => {
        if (!sessionRef.current) {
          sessionRef.current = sessionId;
        }
        throw error;
      });

    closePromiseRef.current = pending;
    return pending;
  }, [onActivityStopped]);

  const start = useCallback(() => {
    if (startPromiseRef.current || sessionRef.current) return startPromiseRef.current ?? Promise.resolve();
    if (!courseRoot) {
      setStatus("Open a course before starting the terminal");
      return Promise.resolve();
    }
    const pending = (async () => {
      shouldRunRef.current = true;
      setLifecycle("starting");
      const terminal = terminalRef.current;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const dimensions = safeTerminalDimensions(terminal, fitRef.current);
      setStatus(dimensions.fitError ? `Terminal fit failed: ${dimensions.fitError}. Starting with safe dimensions...` : "Starting terminal...");
      if (import.meta.env.DEV) console.info("terminal_start_attempt", { pane: label, courseRoot, cols: dimensions.cols, rows: dimensions.rows, fallbackUsed: dimensions.fallbackUsed });
      try {
        const sessionId = await terminalStart(courseRoot, dimensions.cols, dimensions.rows, (event) => receive(generation, event));
        if (generation !== generationRef.current) {
          await terminalClose(sessionId);
          return;
        }
        sessionRef.current = sessionId;
        setLifecycle("running");
        setStatus("Local shell — commands can change course files");
        terminal?.focus();
        scheduleFit();
      } catch (error) {
        shouldRunRef.current = false;
        setLifecycle("failed");
        if (import.meta.env.DEV) console.error("terminal_start_rejected", { pane: label, courseRoot, error: errorMessage(error) });
        if (generation === generationRef.current) setStatus(`Terminal failed to start: ${errorMessage(error)}`);
      }
    })();
    startPromiseRef.current = pending;
    void pending.finally(() => {
      if (startPromiseRef.current === pending) startPromiseRef.current = null;
    });
    return pending;
  }, [courseRoot, label, receive, scheduleFit]);

  const restart = useCallback(async () => {
    onActivityStopped?.();
    const sessionId = sessionRef.current;

    if (!courseRoot || !sessionId) {
      await start();
      return;
    }

    const terminal = terminalRef.current;
    const dimensions = safeTerminalDimensions(terminal, fitRef.current);
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setStatus("Restarting terminal...");

    try {
      const nextId = await terminalRestart(
        sessionId,
        courseRoot,
        dimensions.cols,
        dimensions.rows,
        (event) => receive(generation, event),
      );

      if (generation !== generationRef.current) {
        await terminalClose(nextId);
        return;
      }

      sessionRef.current = nextId;
      setLifecycle("running");
      terminal?.reset();
      terminal?.focus();
      setStatus("Local shell — commands can change course files");
      scheduleFit();
    } catch (error) {
      setLifecycle("failed");
      setStatus(`Terminal restart failed: ${errorMessage(error)}`);
    }
  }, [courseRoot, onActivityStopped, receive, scheduleFit, start]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const readTheme = () => {
      const style = getComputedStyle(document.documentElement);
      const color = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;

      return {
        background: color("--terminal-bg", "#020304"),
        foreground: color("--terminal-foreground", "#CC9E61"),
        cursor: color("--terminal-cursor", "#CC9E61"),
        cursorAccent: color(
          "--terminal-cursor-accent",
          "#020304",
        ),
        selectionBackground: color(
          "--terminal-selection",
          "#493925",
        ),

        black: color("--terminal-black", "#020304"),
        red: color(
          "--terminal-red",
          "#7E4B2F",
        ),
        green: color("--terminal-green", "#938172"),
        yellow: color("--terminal-yellow", "#CC9E61"),
        blue: color("--terminal-blue", "#626266"),
        magenta: color(
          "--terminal-magenta",
          "#704B3E",
        ),
        cyan: color(
          "--terminal-cyan",
          "#AD8E6A",
        ),
        white: color("--terminal-white", "#CC9E61"),

        brightBlack: color("--terminal-bright-black", "#626266"),
        brightRed: color(
          "--terminal-bright-red",
          "#9A6941",
        ),
        brightGreen: color(
          "--terminal-bright-green",
          "#AB8D6B",
        ),
        brightYellow: color(
          "--terminal-bright-yellow",
          "#D4AD79",
        ),
        brightBlue: color(
          "--terminal-bright-blue",
          "#847564",
        ),
        brightMagenta: color(
          "--terminal-bright-magenta",
          "#8E5C39",
        ),
        brightCyan: color(
          "--terminal-bright-cyan",
          "#BA9566",
        ),
        brightWhite: color(
          "--terminal-bright-white",
          "#D7B384",
        ),
      };
    };

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      scrollback: 5_000,
      theme: readTheme(),
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    const disposeClipboard = installTerminalClipboard({
      terminal,
      container,
      writeInput: async (text) => {
        const sessionId = sessionRef.current;
        if (!sessionId) {
          throw new Error("Start the terminal before pasting");
        }
        await terminalWrite(sessionId, text);
      },
      setStatus,
    });

    const input = terminal.onData((data) => {
      if (!sessionRef.current) return;

      onUserActivity?.();
      void terminalWrite(sessionRef.current, data).catch((error) => {
        if (mountedRef.current) {
          setStatus(`Terminal write failed: ${errorMessage(error)}`);
        }
      });
    });

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(container);

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = readTheme();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      disposeClipboard();
      observer.disconnect();
      themeObserver.disconnect();
      input.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [onUserActivity, scheduleFit]);

  useEffect(() => {
    visibleRef.current = visible;
    fitGenerationRef.current += 1;

    if (visible) {
      scheduleFit();
    } else if (fitTimerRef.current !== null) {
      window.clearTimeout(fitTimerRef.current);
    }
  }, [scheduleFit, visible]);

  useEffect(() => {
    if (!active || !visible) return;

    scheduleFit();
    terminalRef.current?.focus();
  }, [active, scheduleFit, visible]);

  useEffect(() => {
    if (!shouldRunRef.current) {
      setLifecycle("idle");
      setStatus(
        courseRoot
          ? "Terminal ready"
          : "Open a course before starting the terminal",
      );
      return;
    }

    let cancelled = false;

    void close()
      .then(() => {
        if (!cancelled) {
          void start();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(`Terminal close failed: ${errorMessage(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseRoot]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      fitGenerationRef.current += 1;

      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
      }

      void close().catch(() => {});
    };
  }, [close]);

  const canStart =
    Boolean(courseRoot) &&
    !sessionRef.current;

  return (
    <section
      className={`terminal-instance${
        active ? " terminal-instance--active" : ""
      }`}
      aria-label={label}
      onMouseDown={onActivate}
    >
      <header className="terminal-pane-header">
        <button
          className="terminal-pane-title"
          type="button"
          disabled={lifecycle === "starting"}
          aria-pressed={active}
          onClick={() => {
            onActivate();
            terminalRef.current?.focus();
          }}
        >
          {label}
        </button>

        <div className="terminal-pane-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Clear terminal display"
            title="Clear display"
            onClick={() => terminalRef.current?.clear()}
          >
            <Trash2 aria-hidden="true" />
          </button>

          <button
            className="icon-button button-secondary"
            type="button"
            aria-label="Restart Terminal"
            title="Restart Terminal"
            onClick={() => void restart()}
          >
            <RotateCcw aria-hidden="true" />
          </button>

          <button
            className="icon-button terminal-close-button"
            type="button"
            aria-label="Close Terminal"
            title="Close Terminal — Ctrl+Shift+W"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="terminal-status" role="status">
        {status}
      </div>

      {canStart ? (
        <button
          className="terminal-start button-primary"
          type="button"
          disabled={lifecycle === "starting"}
          onClick={() => void start()}
        >
          <Play aria-hidden="true" />
          Start Terminal
        </button>
      ) : null}

      <div className="terminal-screen" ref={containerRef} />
    </section>
  );
}
