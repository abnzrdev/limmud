import { afterEach, describe, expect, it, vi } from "vitest";
import {
  courseMediaUrl,
  normalizeCourseEntries,
  openLessonExternal,
  terminalClose,
  terminalResize,
  terminalRestart,
  terminalStart,
  terminalWrite,
  toMediaUrl,
} from "../lib/tauri";

const { channels, invokeMock } = vi.hoisted(() => ({
  channels: [] as Array<{ onmessage?: (value: unknown) => void }>,
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage?: (value: unknown) => void;

    constructor() {
      channels.push(this);
    }
  },
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  invoke: invokeMock,
}));

afterEach(() => {
  invokeMock.mockReset();
  channels.length = 0;
  vi.unstubAllGlobals();
});

describe("terminal commands", () => {
  it("starts and restarts with the current course root and output channel", async () => {
    const onOutput = vi.fn();
    invokeMock.mockResolvedValueOnce("terminal-1").mockResolvedValueOnce("terminal-2");

    await expect(terminalStart("/tmp/course", 90, 30, onOutput)).resolves.toBe("terminal-1");
    channels[0].onmessage?.({ event: "output", data: [36, 32] });
    await expect(
      terminalRestart("terminal-1", "/tmp/next", 100, 40, onOutput),
    ).resolves.toBe("terminal-2");

    expect(onOutput).toHaveBeenCalledWith({ event: "output", data: [36, 32] });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "terminal_start", {
      courseRoot: "/tmp/course",
      cols: 90,
      rows: 30,
      outputChannel: channels[0],
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "terminal_restart", {
      sessionId: "terminal-1",
      courseRoot: "/tmp/next",
      cols: 100,
      rows: 40,
      outputChannel: channels[1],
    });
  });

  it("forwards write, resize, and close to their exact commands", async () => {
    invokeMock.mockResolvedValue(undefined);

    await terminalWrite("terminal-1", "pwd\r");
    await terminalResize("terminal-1", 120, 42);
    await terminalClose("terminal-1");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "terminal_write", {
      sessionId: "terminal-1",
      data: "pwd\r",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "terminal_resize", {
      sessionId: "terminal-1",
      cols: 120,
      rows: 42,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "terminal_close", {
      sessionId: "terminal-1",
    });
  });
});

describe("normalizeCourseEntries", () => {
  it("accepts nested scanner payloads from Rust with snake_case paths", () => {
    expect(
      normalizeCourseEntries([
        {
          id: "week 1",
          name: "Week 1",
          relative_path: "Week 1",
          absolute_path: "/tmp/course/Week 1",
          kind: "directory",
          children: [
            {
              id: "week 1/lesson one.mp4",
              name: "Lesson One.mp4",
              relative_path: "Week 1/Lesson One.mp4",
              absolute_path: "/tmp/course/Week 1/Lesson One.mp4",
              kind: "video",
            },
            {
              id: "week 1/lesson one.srt",
              name: "Lesson One.srt",
              relative_path: "Week 1/Lesson One.srt",
              absolute_path: "/tmp/course/Week 1/Lesson One.srt",
              kind: "subtitle",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "week 1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "week 1/lesson one.mp4",
            name: "Lesson One.mp4",
            relativePath: "Week 1/Lesson One.mp4",
            absolutePath: "/tmp/course/Week 1/Lesson One.mp4",
            kind: "video",
          },
          {
            id: "week 1/lesson one.srt",
            name: "Lesson One.srt",
            relativePath: "Week 1/Lesson One.srt",
            absolutePath: "/tmp/course/Week 1/Lesson One.srt",
            kind: "subtitle",
          },
        ],
      },
    ]);
  });

  it("drops invalid scanner rows and keeps nested valid entries", () => {
    expect(
      normalizeCourseEntries([
        null,
        {
          id: "Week 1",
          name: "Week 1",
          relativePath: "Week 1",
          absolutePath: "/tmp/course/Week 1",
          kind: "directory",
          children: [
            null,
            {
              id: "Week 1/lesson.mp4",
              name: "lesson.mp4",
              relativePath: "Week 1/lesson.mp4",
              absolutePath: "/tmp/course/Week 1/lesson.mp4",
              kind: "video",
              children: "bad",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "Week 1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "Week 1/lesson.mp4",
            name: "lesson.mp4",
            relativePath: "Week 1/lesson.mp4",
            absolutePath: "/tmp/course/Week 1/lesson.mp4",
            kind: "video",
          },
        ],
      },
    ]);
  });

  it("encodes spaces in generated media urls", () => {
    expect(toMediaUrl("/tmp/Offline Courses/lesson one.mp4")).toBe(
      "/tmp/Offline%20Courses/lesson%20one.mp4",
    );
  });

  it("uses a file url for Tauri media playback without double encoding paths", () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {
        convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
      },
    });

    const result = toMediaUrl("/tmp/course/Week 1/Lesson One.mp4");

    expect(result).toContain("file:///tmp/course/Week%201");
    expect(result).toContain("Lesson%20One.mp4");
    expect(result).not.toContain("%252F");
    expect(result).not.toContain("asset://");
  });
});

describe("openLessonExternal", () => {
  it("asks Rust to open a lesson inside the current course root", async () => {
    invokeMock.mockResolvedValue(undefined);

    await openLessonExternal("/tmp/course", "/tmp/course/week 1/lesson.mp4");

    expect(invokeMock).toHaveBeenCalledWith("open_lesson_external", {
      absolutePath: "/tmp/course/week 1/lesson.mp4",
      courseRoot: "/tmp/course",
    });
  });
});

describe("courseMediaUrl", () => {
  it("asks Rust for a localhost media URL scoped to the current course root", async () => {
    invokeMock.mockResolvedValue("http://127.0.0.1:1234/token/week%201/lesson.mp4");

    await expect(
      courseMediaUrl("/tmp/course", "/tmp/course/week 1/lesson.mp4"),
    ).resolves.toBe("http://127.0.0.1:1234/token/week%201/lesson.mp4");

    expect(invokeMock).toHaveBeenCalledWith("course_media_url", {
      absolutePath: "/tmp/course/week 1/lesson.mp4",
      courseRoot: "/tmp/course",
    });
  });
});
