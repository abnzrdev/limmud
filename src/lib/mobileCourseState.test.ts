import { describe, expect, it } from "vitest";
import {
  applyPortableMutation,
  parsePortableCourseState,
  reconcilePortableState,
  serializePortableCourseState,
  type PortableCourseStateFiles,
} from "./mobileCourseState";

const emptyStats = {
  todaySeconds: 0,
  totalSeconds: 0,
  streakDays: 0,
  lastStudyDate: null,
  todayBySource: { videoSeconds: 0, terminalSeconds: 0 },
  totalBySource: { videoSeconds: 0, terminalSeconds: 0 },
};

const desktopFixture: PortableCourseStateFiles = {
  state: {
    timerMode: "focus",
    timerPreset: "25",
    quickNote: "portable",
    futureState: "preserve-me",
  },
  progress: {
    completedLessons: '["Section A/lesson_01.mp4"]',
    bookmarkedLessons: "[]",
    selectedEntryId: "desktop-entry-id",
    videoProgress: '{"Section A/lesson_01.mp4":42}',
    studyStats: JSON.stringify(emptyStats),
    futureProgress: '{"version":9}',
  },
  todos: {
    todos: '[{"id":"todo-1","label":"Review","done":false}]',
    futureTodos: "keep",
  },
  vocabulary: [{
    id: "vocab-1",
    headword: "retrieval",
    dictionaryEntryId: 7,
    sourceKey: "synthetic",
    partOfSpeech: "noun",
    shortDefinition: "safe definition",
    addedAt: "2026-08-10T00:00:00.000Z",
    lessonRelativePath: "Section A/lesson_01.mp4",
    videoPositionSeconds: 42,
    personalNote: "",
    status: "new",
    reviewCount: 0,
    lastReviewedAt: null,
  }],
};

describe("portable Android course state", () => {
  it("parses the exact desktop split-file representation", () => {
    const parsed = parsePortableCourseState(desktopFixture);

    expect(parsed.value.completedLessons).toEqual(["Section A/lesson_01.mp4"]);
    expect(parsed.value.bookmarkedLessons).toEqual([]);
    expect(parsed.value.videoProgress).toEqual({ "Section A/lesson_01.mp4": 42 });
    expect(parsed.value.todos).toEqual([{ id: "todo-1", label: "Review", done: false }]);
    expect(parsed.value.vocabulary[0]).toMatchObject({ id: "vocab-1", dictionaryEntryId: 7 });
    expect(parsed.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves unknown top-level records during a semantic completion mutation", () => {
    const parsed = parsePortableCourseState(desktopFixture);
    const next = applyPortableMutation(parsed, {
      type: "setLessonCompleted",
      relativePath: "Section B/lesson_02.mp4",
      completed: true,
    });

    const files = serializePortableCourseState(next);
    expect(files.state.futureState).toBe("preserve-me");
    expect(files.progress.futureProgress).toBe('{"version":9}');
    expect(files.todos.futureTodos).toBe("keep");
    expect(JSON.parse(files.progress.completedLessons)).toEqual([
      "Section A/lesson_01.mp4",
      "Section B/lesson_02.mp4",
    ]);
    expect(files.vocabulary).toEqual(desktopFixture.vocabulary);
  });

  it("records watched video time using the desktop study-stat rules", () => {
    const state = parsePortableCourseState(desktopFixture);
    const next = applyPortableMutation(state, { type: "recordVideoStudySeconds", seconds: 12, today: "2026-08-10" });
    expect(next.value.studyStats).toMatchObject({ todaySeconds: 12, totalSeconds: 12, lastStudyDate: "2026-08-10", todayBySource: { videoSeconds: 12 } });
    expect(JSON.parse(next.files.progress.studyStats)).toMatchObject({ totalSeconds: 12 });
  });

  it("stores the current lesson using the desktop lowercase relative-path identity", () => {
    const next = applyPortableMutation(parsePortableCourseState(desktopFixture), { type: "setSelectedEntry", entryId: "section b/lesson_02.mp4" });
    expect(next.files.progress.selectedEntryId).toBe("section b/lesson_02.mp4");
  });

  it("rejects malformed known state instead of replacing it with defaults", () => {
    expect(() => parsePortableCourseState({
      ...desktopFixture,
      progress: { ...desktopFixture.progress, completedLessons: "not-json" },
    })).toThrow("portable_state_malformed");
  });

  it("applies bookmark, todo, progress, and vocabulary mutations without changing unrelated domains", () => {
    let state = parsePortableCourseState(desktopFixture);
    state = applyPortableMutation(state, { type: "setLessonBookmarked", relativePath: "Section A/lesson_01.mp4", bookmarked: true });
    state = applyPortableMutation(state, { type: "addTodo", todo: { id: "todo-2", label: "Summarize", done: false } });
    state = applyPortableMutation(state, { type: "setPlaybackProgress", relativePath: "Section A/lesson_01.mp4", seconds: 84 });
    state = applyPortableMutation(state, { type: "updateVocabulary", item: { ...desktopFixture.vocabulary[0], status: "known", reviewCount: 1 } });

    expect(state.value.bookmarkedLessons).toEqual(["Section A/lesson_01.mp4"]);
    expect(state.value.todos.map((todo) => todo.id)).toEqual(["todo-1", "todo-2"]);
    expect(state.value.videoProgress["Section A/lesson_01.mp4"]).toBe(84);
    expect(state.value.vocabulary[0]).toMatchObject({ status: "known", reviewCount: 1 });
    expect(state.value.completedLessons).toEqual(["Section A/lesson_01.mp4"]);
  });

  it("reconciles set-like domains and newer playback checkpoints semantically", () => {
    const portable = parsePortableCourseState(desktopFixture);
    let local = parsePortableCourseState({
      state: { timerMode: "focus", timerPreset: "25", quickNote: "" },
      progress: {
        completedLessons: '["Section B/lesson_02.mp4"]',
        bookmarkedLessons: '["Section C/lesson_03.mp4"]',
        videoProgress: '{"Section A/lesson_01.mp4":96}',
        studyStats: JSON.stringify(emptyStats),
      },
      todos: { todos: "[]" },
      vocabulary: [],
    });
    local = { ...local, updatedAt: "2026-08-10T02:00:00.000Z" };
    const merged = reconcilePortableState(
      { ...portable, updatedAt: "2026-08-10T01:00:00.000Z" },
      local,
    );

    expect(merged.value.completedLessons).toEqual([
      "Section A/lesson_01.mp4",
      "Section B/lesson_02.mp4",
    ]);
    expect(merged.value.bookmarkedLessons).toEqual(["Section C/lesson_03.mp4"]);
    expect(merged.value.videoProgress["Section A/lesson_01.mp4"]).toBe(96);
    expect(merged.files.progress.futureProgress).toBe('{"version":9}');
  });
});
