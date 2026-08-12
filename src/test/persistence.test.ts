import { describe, expect, it } from "vitest";
import {
  createTodoItem,
  deserializeLessonStateRecord,
  deserializeGlobalConfigRecord,
  recordStudySeconds,
  sanitizeWorkspaceLayout,
  serializeLessonStateRecord,
  serializeGlobalConfigRecord,
  toggleTodoItem,
  withDefaultGlobalConfig,
  withDefaultLessonState,
} from "../lib/persistence";

describe("withDefaultGlobalConfig", () => {
  it("restores only valid remembered course registry entries", () => {
    expect(withDefaultGlobalConfig({
      knownCourses: [
        { root: "/synthetic/course-a", name: "Course A", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null },
        { root: "", name: "Broken", lastOpenedAt: "nope" },
      ],
    }).knownCourses).toEqual([
      { root: "/synthetic/course-a", name: "Course A", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null },
    ]);
  });

  it("fills missing timer presets and theme", () => {
    expect(withDefaultGlobalConfig({})).toMatchObject({
      theme: "dark",
      timerPresets: [25, 50, 90],
    });
  });

  it("preserves configured timer presets when provided", () => {
    expect(withDefaultGlobalConfig({ timerPresets: [15, 30] }).timerPresets).toEqual(
      [15, 30],
    );
  });

  it("falls back to defaults when config shape is invalid", () => {
    expect(
      withDefaultGlobalConfig({ theme: "neon", timerPresets: "bad" as never }),
    ).toMatchObject({
      theme: "dark",
      timerPresets: [25, 50, 90],
    });
  });
});

describe("withDefaultLessonState", () => {
  it("creates default timer mode, todos, and quick note", () => {
    expect(withDefaultLessonState({})).toMatchObject({
      timerMode: "focus",
      timerPreset: 25,
      todos: [],
      quickNote: "",
      videoProgress: {},
      completedLessons: [],
      bookmarkedLessons: [],
      studyStats: {
        todaySeconds: 0,
        totalSeconds: 0,
        streakDays: 0,
        lastStudyDate: null,
        todayBySource: { videoSeconds: 0, terminalSeconds: 0 },
        totalBySource: { videoSeconds: 0, terminalSeconds: 0 },
      },
    });
  });
});

describe("todo helpers", () => {
  it("creates a new unchecked todo item", () => {
    expect(createTodoItem("Review stack operations")).toMatchObject({
      label: "Review stack operations",
      done: false,
    });
  });

  it("toggles only the matching todo item", () => {
    const first = createTodoItem("A");
    const second = createTodoItem("B");

    expect(toggleTodoItem([first, second], second.id)).toEqual([
      first,
      { ...second, done: true },
    ]);
  });
});

describe("lesson state record helpers", () => {
  it("round trips remembered courses through the global config record", () => {
    const knownCourses = [{
      root: "/synthetic/course-a",
      name: "Course A",
      lastOpenedAt: "2026-08-10T10:00:00.000Z",
      coverPath: "/synthetic/app-data/covers/a.webp",
    }];
    const record = serializeGlobalConfigRecord({
      lastOpenedCourse: knownCourses[0].root,
      knownCourses,
      theme: "dark",
      timerPresets: [25],
      windowBounds: null,
    });

    expect(deserializeGlobalConfigRecord(record).knownCourses).toEqual(knownCourses);
  });

  it("serializes lesson state into a string record", () => {
    const todo = createTodoItem("Review queue examples");

    expect(
      serializeLessonStateRecord({
        timerMode: "focus",
        timerPreset: 50,
        todos: [todo],
        quickNote: "Remember amortized analysis",
        videoProgress: { "week1/lesson.mp4": 42 },
        completedLessons: ["week1/lesson.mp4"],
        bookmarkedLessons: ["week1/lesson.mp4"],
        studyStats: {
          todaySeconds: 2100,
          totalSeconds: 30_000,
          streakDays: 3,
          lastStudyDate: "2026-07-09",
          todayBySource: { videoSeconds: 1500, terminalSeconds: 600 },
          totalBySource: { videoSeconds: 24_000, terminalSeconds: 6000 },
        },
      }),
    ).toMatchObject({
      timerMode: "focus",
      timerPreset: "50",
      quickNote: "Remember amortized analysis",
      videoProgress: "{\"week1/lesson.mp4\":42}",
      completedLessons: "[\"week1/lesson.mp4\"]",
      bookmarkedLessons: "[\"week1/lesson.mp4\"]",
      studyStats:
        "{\"todaySeconds\":2100,\"totalSeconds\":30000,\"streakDays\":3,\"lastStudyDate\":\"2026-07-09\",\"todayBySource\":{\"videoSeconds\":1500,\"terminalSeconds\":600},\"totalBySource\":{\"videoSeconds\":24000,\"terminalSeconds\":6000}}",
    });
  });

  it("deserializes a string record back into lesson state", () => {
    expect(
      deserializeLessonStateRecord({
        timerMode: "stopwatch",
        timerPreset: "90",
        todos: JSON.stringify([{ id: "a", label: "Task A", done: true }]),
        quickNote: "Use iterative solution",
        videoProgress: "{\"week1/lesson.mp4\":73}",
        completedLessons: "[\"week1/lesson.mp4\"]",
        bookmarkedLessons: "[\"week2/lesson.mp4\"]",
        studyStats:
          "{\"todaySeconds\":2100,\"totalSeconds\":30000,\"streakDays\":3,\"lastStudyDate\":\"2026-07-09\"}",
      }),
    ).toMatchObject({
      timerMode: "stopwatch",
      timerPreset: 90,
      quickNote: "Use iterative solution",
      todos: [{ id: "a", label: "Task A", done: true }],
      videoProgress: { "week1/lesson.mp4": 73 },
      completedLessons: ["week1/lesson.mp4"],
      bookmarkedLessons: ["week2/lesson.mp4"],
      studyStats: {
        todaySeconds: 2100,
        totalSeconds: 30_000,
        streakDays: 3,
        lastStudyDate: "2026-07-09",
        todayBySource: { videoSeconds: 2100, terminalSeconds: 0 },
        totalBySource: { videoSeconds: 30_000, terminalSeconds: 0 },
      },
    });
  });

  it("rolls study stats into a simple local streak", () => {
    const first = recordStudySeconds(withDefaultLessonState({}).studyStats, 65, "2026-07-08");
    const second = recordStudySeconds(first, 125, "2026-07-09");
    const sameDay = recordStudySeconds(second, 10, "2026-07-09");

    expect(sameDay).toEqual({
      todaySeconds: 135,
      totalSeconds: 200,
      streakDays: 2,
      lastStudyDate: "2026-07-09",
      todayBySource: { videoSeconds: 135, terminalSeconds: 0 },
      totalBySource: { videoSeconds: 200, terminalSeconds: 0 },
    });
  });

  it("starts a streak only after at least one watched second", () => {
    const empty = withDefaultLessonState({}).studyStats;
    const untouched = recordStudySeconds(empty, 0, "2026-07-15");
    const watched = recordStudySeconds(untouched, 1, "2026-07-15");

    expect(untouched).toEqual(empty);
    expect(watched).toEqual({
      todaySeconds: 1,
      totalSeconds: 1,
      streakDays: 1,
      lastStudyDate: "2026-07-15",
      todayBySource: { videoSeconds: 1, terminalSeconds: 0 },
      totalBySource: { videoSeconds: 1, terminalSeconds: 0 },
    });
  });

  it("repairs malformed and mismatched source totals without changing overall totals", () => {
    const state = withDefaultLessonState({
      studyStats: {
        todaySeconds: 12.9,
        totalSeconds: 100,
        streakDays: -2,
        lastStudyDate: "2026-07-15",
        todayBySource: { videoSeconds: -4, terminalSeconds: 5.8 },
        totalBySource: { videoSeconds: Number.NaN, terminalSeconds: 140 },
      },
    }).studyStats;

    expect(state).toEqual({
      todaySeconds: 12,
      totalSeconds: 100,
      streakDays: 0,
      lastStudyDate: "2026-07-15",
      todayBySource: { videoSeconds: 7, terminalSeconds: 5 },
      totalBySource: { videoSeconds: 0, terminalSeconds: 100 },
    });
  });

  it("records terminal seconds and resets today's source totals on rollover", () => {
    const previous = withDefaultLessonState({
      studyStats: {
        todaySeconds: 20,
        totalSeconds: 50,
        streakDays: 2,
        lastStudyDate: "2026-07-14",
        todayBySource: { videoSeconds: 15, terminalSeconds: 5 },
        totalBySource: { videoSeconds: 40, terminalSeconds: 10 },
      },
    }).studyStats;

    expect(recordStudySeconds(previous, 3, "2026-07-15", "terminal")).toEqual({
      todaySeconds: 3,
      totalSeconds: 53,
      streakDays: 3,
      lastStudyDate: "2026-07-15",
      todayBySource: { videoSeconds: 0, terminalSeconds: 3 },
      totalBySource: { videoSeconds: 40, terminalSeconds: 13 },
    });
  });
});

describe("global config record helpers", () => {
  it("persists Dictionary width independently from Terminal layout", () => {
    const record = serializeGlobalConfigRecord({
      lastOpenedCourse: null,
      theme: "dark",
      timerPresets: [25],
      windowBounds: null,
      workspaceLayout: {
        courseSize: 14, rightSize: 28, verticalSplit: 55,
        courseCollapsed: false, rightCollapsed: false, openTools: ["stats"],
      },
      dictionaryLayout: { width: 512 },
    });

    expect(record.dictionaryLayout).toBe('{"width":512}');
    expect(deserializeGlobalConfigRecord(record).dictionaryLayout).toEqual({ width: 512 });
    expect(deserializeGlobalConfigRecord({ ...record, dictionaryLayout: '{"width":900}' }).dictionaryLayout).toEqual({ width: 420 });
  });

  it("serializes last opened course and timer presets", () => {
    expect(
      serializeGlobalConfigRecord({
        lastOpenedCourse: "/tmp/course",
        theme: "dark",
        timerPresets: [25, 50, 90],
        windowBounds: null,
        workspaceLayout: {
          courseSize: 16,
          rightSize: 32,
          verticalSplit: 60,
          courseCollapsed: false,
          rightCollapsed: true,
          openTools: ["stats", "todos"],
        },
      }),
    ).toMatchObject({
      lastOpenedCourse: "/tmp/course",
      theme: "dark",
      timerPresets: "[25,50,90]",
      workspaceLayout:
        '{"courseSize":16,"rightSize":32,"verticalSplit":60,"courseCollapsed":false,"rightCollapsed":true,"openTools":["stats","todos"]}',
    });
  });

  it("deserializes timer presets from the stored record", () => {
    expect(
      deserializeGlobalConfigRecord({
        lastOpenedCourse: "/tmp/course",
        theme: "light",
        timerPresets: "[15,30]",
        workspaceLayout:
          '{"courseSize":15,"rightSize":35,"verticalSplit":65,"courseCollapsed":true,"rightCollapsed":true,"openTools":["timer"]}',
      }),
    ).toMatchObject({
      lastOpenedCourse: "/tmp/course",
      theme: "light",
      timerPresets: [15, 30],
      workspaceLayout: {
        courseSize: 15,
        rightSize: 35,
        verticalSplit: 65,
        courseCollapsed: true,
        rightCollapsed: true,
        openTools: ["timer"],
      },
    });
  });

  it("falls back when decoded timer presets are empty", () => {
    expect(
      deserializeGlobalConfigRecord({
        theme: "dark",
        timerPresets: "[]",
      }),
    ).toMatchObject({
      theme: "dark",
      timerPresets: [25, 50, 90],
    });
  });

  it("validates restored layout fields independently", () => {
    expect(
      sanitizeWorkspaceLayout({
        courseSize: 90,
        rightSize: 80,
        verticalSplit: 62,
        courseCollapsed: "yes",
        rightCollapsed: "yes",
        openTools: ["stats", "unknown", "resources", "todos"],
      }),
    ).toEqual({
      courseSize: 14,
      rightSize: 28,
      verticalSplit: 62,
      courseCollapsed: false,
      rightCollapsed: false,
      openTools: ["stats", "resources"],
    });
  });

  it("falls back when stored layout JSON is invalid", () => {
    expect(
      deserializeGlobalConfigRecord({
        theme: "dark",
        timerPresets: "[25]",
        workspaceLayout: "not-json",
      }).workspaceLayout,
    ).toEqual({
      courseSize: 14,
      rightSize: 28,
      verticalSplit: 55,
      courseCollapsed: false,
      rightCollapsed: false,
      openTools: ["stats", "resources"],
    });
  });
});
