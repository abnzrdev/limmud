// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppModel } from "./useAppModel";

const {
  chooseCoursePath,
  chooseResourcePaths,
  importLessonResources,
  openResource,
  readAppConfig,
  readCourseState,
  readCourseResources,
  readRecoveryDrafts,
  readLessonResources,
  readNote,
  removeRecoveryDraft,
  scanCourse,
  writeRecoveryDraft,
  writeAppConfig,
  writeCourseState,
  writeNote,
  chooseCourseCover,
  installCourseCover,
  removeCourseCover,
} = vi.hoisted(() => ({
  chooseCoursePath: vi.fn(),
  chooseResourcePaths: vi.fn(),
  importLessonResources: vi.fn(),
  openResource: vi.fn(),
  readAppConfig: vi.fn(),
  readCourseState: vi.fn(),
  readCourseResources: vi.fn(),
  readRecoveryDrafts: vi.fn(),
  readLessonResources: vi.fn(),
  readNote: vi.fn(),
  removeRecoveryDraft: vi.fn(),
  scanCourse: vi.fn(),
  writeRecoveryDraft: vi.fn(),
  writeAppConfig: vi.fn(),
  writeCourseState: vi.fn(),
  writeNote: vi.fn(),
  chooseCourseCover: vi.fn(),
  installCourseCover: vi.fn(),
  removeCourseCover: vi.fn(),
}));

vi.mock("../lib/tauri", () => ({
  chooseCoursePath,
  chooseResourcePaths,
  chooseCourseCover,
  courseMediaUrl: vi.fn(),
  importLessonResources,
  isTauriRuntime: () => true,
  openLessonExternal: vi.fn(),
  openResource,
  readAppConfig,
  readCourseState,
  readCourseResources,
  readRecoveryDrafts,
  readLessonResources,
  readNote,
  removeRecoveryDraft,
  scanCourse,
  toMediaUrl: (value: string) => value,
  installCourseCover,
  removeCourseCover,
  writeAppConfig,
  writeRecoveryDraft,
  writeCourseState,
  writeNote,
}));

describe("useAppModel auto advance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
    readAppConfig.mockResolvedValue({});
    readCourseState.mockResolvedValue({});
    readCourseResources.mockResolvedValue([]);
    readRecoveryDrafts.mockResolvedValue([]);
    readLessonResources.mockResolvedValue([]);
    writeAppConfig.mockResolvedValue(undefined);
    writeCourseState.mockResolvedValue(undefined);
    writeNote.mockResolvedValue(undefined);
    writeRecoveryDraft.mockResolvedValue(undefined);
    removeRecoveryDraft.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates and persists validated workspace layout settings", async () => {
    readAppConfig.mockResolvedValue({
      workspaceLayout:
        '{"courseSize":16,"rightSize":34,"verticalSplit":61,"courseCollapsed":true,"rightCollapsed":true,"openTools":["timer"]}',
    });
    const { result } = renderHook(() => useAppModel());

    await waitFor(() => expect(result.current.workspaceLayout).toEqual({
      courseSize: 16,
      rightSize: 34,
      verticalSplit: 61,
      courseCollapsed: true,
      rightCollapsed: true,
      openTools: ["timer"],
    }));

    act(() => result.current.setWorkspaceLayout({
      courseSize: 18,
      rightSize: 40,
      verticalSplit: 50,
      courseCollapsed: false,
      rightCollapsed: false,
      openTools: ["stats", "todos"],
    }));

    await waitFor(() => expect(writeAppConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workspaceLayout:
          '{"courseSize":18,"rightSize":40,"verticalSplit":50,"courseCollapsed":false,"rightCollapsed":false,"openTools":["stats","todos"]}',
      }),
    ));
  });

  it("keeps a remembered missing course visible as unavailable", async () => {
    readAppConfig.mockResolvedValue({
      knownCourses: JSON.stringify([{ root: "/synthetic/missing", name: "Unavailable Course", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null }]),
    });
    scanCourse.mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() => useAppModel());
    await waitFor(() => expect(result.current.knownCourses).toHaveLength(1));

    expect(result.current.knownCourses[0]).toMatchObject({ name: "Unavailable Course", available: false });
    expect(result.current.currentCourseRoot).toBeNull();
  });

  it("relocates a missing course without touching the old course folder", async () => {
    readAppConfig.mockResolvedValue({
      knownCourses: JSON.stringify([{ root: "/synthetic/missing", name: "Unavailable Course", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null }]),
    });
    scanCourse.mockRejectedValueOnce(new Error("not found")).mockResolvedValue(courseEntries());
    chooseCoursePath.mockResolvedValue("/synthetic/relocated");
    const { result } = renderHook(() => useAppModel());
    await waitFor(() => expect(result.current.knownCourses[0]?.available).toBe(false));

    await act(async () => { expect(await result.current.locateCourse("/synthetic/missing")).toBe(true); });

    expect(result.current.currentCourseRoot).toBe("/synthetic/relocated");
    expect(result.current.knownCourses.map((course) => course.root)).toEqual(["/synthetic/relocated"]);
    expect(removeCourseCover).not.toHaveBeenCalled();
  });

  it("opens a remembered course through the existing course loader", async () => {
    readAppConfig.mockResolvedValue({
      knownCourses: JSON.stringify([{ root: "/synthetic/course-a", name: "Course A", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null }]),
    });
    scanCourse.mockResolvedValue(courseEntries());
    readCourseState.mockResolvedValue({
      selectedEntryId: "week-1/second.mp4",
      videoProgress: '{"Week 1/second.mp4":73}',
    });
    const { result } = renderHook(() => useAppModel());
    await waitFor(() => expect(result.current.knownCourses[0]?.available).toBe(true));

    await act(async () => { expect(await result.current.openKnownCourse("/synthetic/course-a")).toBe(true); });
    expect(result.current.currentCourseRoot).toBe("/synthetic/course-a");
    expect(result.current.selectedEntry?.id).toBe("week-1/second.mp4");
    expect(result.current.resumeTime).toBe(73);
  });

  it("persists changed and removed local course covers", async () => {
    readAppConfig.mockResolvedValue({
      knownCourses: JSON.stringify([{ root: "/synthetic/course-a", name: "Course A", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null }]),
    });
    scanCourse.mockResolvedValue(courseEntries());
    chooseCourseCover.mockResolvedValue("/synthetic/source.webp");
    installCourseCover.mockResolvedValue("/synthetic/app-data/course.webp");
    removeCourseCover.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAppModel());
    await waitFor(() => expect(result.current.knownCourses[0]?.available).toBe(true));

    await act(async () => { await result.current.changeCourseCover("/synthetic/course-a"); });
    expect(result.current.knownCourses[0].coverPath).toBe("/synthetic/app-data/course.webp");
    await waitFor(() => expect(writeAppConfig).toHaveBeenLastCalledWith(expect.objectContaining({ knownCourses: expect.stringContaining("course.webp") })));

    await act(async () => { await result.current.clearCourseCover("/synthetic/course-a"); });
    expect(removeCourseCover).toHaveBeenCalledWith("/synthetic/course-a");
    expect(result.current.knownCourses[0].coverPath).toBeNull();
  });

  it("selects the next lesson and reloads notes when the current video ends", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote
      .mockResolvedValueOnce("Intro notes")
      .mockResolvedValueOnce("Second notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    expect(result.current.selectedEntry?.id).toBe("week-1/intro.mp4");
    expect(result.current.noteBody).toBe("Intro notes");

    await act(async () => {
      await result.current.advanceToNextLesson(120);
    });

    await waitFor(() => expect(result.current.selectedEntry?.id).toBe("week-1/second.mp4"));
    expect(result.current.noteBody).toBe("Second notes");
    expect(result.current.resumeTime).toBe(0);
    expect(result.current.shouldAutoPlaySelectedEntry).toBe(true);
    expect(result.current.completedLessons).toEqual(["Week 1/intro.mp4"]);
    expect(result.current.progressPercent).toBe(50);
    expect(result.current.status).toBe("Loaded course");
  });

  it("does not duplicate completion when an already done lesson ends", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote
      .mockResolvedValueOnce("Intro notes")
      .mockResolvedValueOnce("Second notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    act(() => {
      result.current.toggleLessonDone();
    });

    await act(async () => {
      await result.current.advanceToNextLesson(120);
    });

    await waitFor(() => expect(result.current.selectedEntry?.id).toBe("week-1/second.mp4"));
    expect(result.current.completedLessons).toEqual(["Week 1/intro.mp4"]);
  });

  it("sets an end-of-course status on the last lesson", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote
      .mockResolvedValueOnce("Intro notes")
      .mockResolvedValueOnce("Second notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    await act(async () => {
      await result.current.advanceToNextLesson(120);
    });

    await waitFor(() => expect(result.current.selectedEntry?.id).toBe("week-1/second.mp4"));

    await act(async () => {
      await result.current.advanceToNextLesson(180);
    });

    expect(result.current.selectedEntry?.id).toBe("week-1/second.mp4");
    expect(result.current.status).toBe("End of course");
  });

  it("shows only the saved note file name in status", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    await act(async () => {
      await result.current.saveNote("Updated notes");
    });

    expect(writeNote).toHaveBeenCalledWith(
      "/tmp/course",
      "/tmp/course/Week 1/intro.mp4",
      "Updated notes",
    );
    expect(result.current.status).toBe("Saved intro.notes.md");
  });

  it("keeps a failed note dirty and writes a recovery draft", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Existing note");
    writeNote.mockRejectedValue({
      kind: "permissionDenied",
      message: "permission denied",
      parentPath: "/tmp/course/Week 1",
      attemptedPath: "/tmp/course/Week 1/intro.notes.md",
      recoverable: true,
    });
    const { result } = renderHook(() => useAppModel());

    await act(async () => { await result.current.openCourse(); });
    act(() => result.current.setNoteBody("Keep this draft"));
    await act(async () => { await result.current.saveNote(); });

    expect(result.current.noteBody).toBe("Keep this draft");
    expect(result.current.noteSaveStatus).toBe("failed");
    expect(result.current.noteSaveError?.kind).toBe("permissionDenied");
    expect(writeRecoveryDraft).toHaveBeenCalledWith("/tmp/course", expect.objectContaining({
      lessonRelativePath: "Week 1/intro.mp4",
      noteText: "Keep this draft",
      lastSaveErrorKind: "permissionDenied",
    }));
  });

  it("restores a recovery draft and removes it after a real save", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readRecoveryDrafts.mockResolvedValue([{
      lessonRelativePath: "Week 1/intro.mp4", noteText: "Recovered", updatedAt: "now", lastSaveErrorKind: "permissionDenied",
    }]);
    const { result } = renderHook(() => useAppModel());

    await act(async () => { await result.current.openCourse(); });
    expect(result.current.noteBody).toBe("Recovered");
    expect(result.current.recoveredUnsavedDraft).toBe(true);
    await act(async () => { await result.current.saveNote(); });

    expect(removeRecoveryDraft).toHaveBeenCalledWith("/tmp/course", "Week 1/intro.mp4");
  });

  it("rescans once and preserves the selected exact path", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());

    await act(async () => { await result.current.openCourse(); });
    await act(async () => { await result.current.refreshCourse(); });

    expect(scanCourse).toHaveBeenCalledTimes(2);
    expect(result.current.selectedEntry?.absolutePath).toBe("/tmp/course/Week 1/intro.mp4");
    expect(result.current.status).toBe("Course refreshed · 0 added · 0 removed");
  });

  it("imports resources for the selected lesson", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    chooseResourcePaths.mockResolvedValue(["/tmp/diagram.png", "/tmp/example.ts"]);
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    importLessonResources.mockResolvedValue([
      {
        id: "resource-1",
        originalFilename: "diagram.png",
        storedRelativePath: ".learningappoffline/resources/resource-1.png",
        category: "image",
        lessonPath: "Week 1/intro.mp4",
        importedAt: "12345",
      },
    ]);
    readCourseResources.mockResolvedValue([
      {
        id: "resource-1",
        originalFilename: "diagram.png",
        storedRelativePath: ".learningappoffline/resources/resource-1.png",
        category: "image",
        lessonPath: "Week 1/intro.mp4",
        importedAt: "12345",
      },
    ]);

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    await act(async () => {
      await result.current.importLessonResources();
    });

    expect(importLessonResources).toHaveBeenCalledWith("/tmp/course", "Week 1/intro.mp4", [
      "/tmp/diagram.png",
      "/tmp/example.ts",
    ]);
    expect(result.current.resources).toHaveLength(1);
    expect(result.current.status).toBe("Imported 2 resources");
  });

  it("toggles lesson completion and exposes course progress", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    act(() => {
      result.current.toggleLessonDone();
    });

    expect(result.current.completedLessons).toEqual(["Week 1/intro.mp4"]);
    expect(result.current.progressPercent).toBe(50);
    expect(result.current.status).toBe("Lesson marked done");

    act(() => {
      result.current.toggleLessonDone();
    });

    expect(result.current.completedLessons).toEqual([]);
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.status).toBe("Lesson marked not done");
  });

  it("toggles lesson bookmarks and exposes bookmarked entries", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    act(() => {
      result.current.toggleLessonBookmark();
    });

    expect(result.current.bookmarkedLessons).toEqual(["Week 1/intro.mp4"]);
    expect(result.current.bookmarkedEntries).toEqual([
      expect.objectContaining({ id: "week-1/intro.mp4" }),
    ]);
    expect(result.current.status).toBe("Lesson bookmarked");

    act(() => {
      result.current.toggleLessonBookmark();
    });

    expect(result.current.bookmarkedLessons).toEqual([]);
    expect(result.current.bookmarkedEntries).toEqual([]);
    expect(result.current.status).toBe("Bookmark removed");
  });

  it("tracks local watched study seconds for the current course", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    act(() => {
      result.current.recordStudySeconds("video", 95.8);
    });

    expect(result.current.studyStats).toMatchObject({
      todaySeconds: 95,
      totalSeconds: 95,
      streakDays: 1,
    });
    expect(result.current.studyStats.lastStudyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("debounces frequent course progress writes", async () => {
    vi.useFakeTimers();
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });
    writeCourseState.mockClear();
    act(() => {
      result.current.recordStudySeconds("video", 1);
      result.current.recordStudySeconds("video", 1);
      result.current.recordStudySeconds("video", 1);
    });

    expect(writeCourseState).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(749));
    expect(writeCourseState).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(writeCourseState).toHaveBeenCalledTimes(1);
  });

  it("flushes the latest stats and reports persistence failures", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());
    await act(async () => {
      await result.current.openCourse();
    });
    writeCourseState.mockClear();
    act(() => result.current.recordStudySeconds("video", 1));
    await act(async () => result.current.flushCourseState());

    expect(writeCourseState).toHaveBeenCalledWith(
      "/tmp/course",
      expect.objectContaining({
        studyStats: expect.stringContaining('"todaySeconds":1'),
      }),
    );

    writeCourseState.mockRejectedValueOnce(new Error("disk full"));
    await act(async () => result.current.flushCourseState());
    expect(result.current.status).toBe("Progress save failed: disk full");
  });

  it("flushes a watched second recorded in the same tick", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());
    await act(async () => result.current.openCourse());
    writeCourseState.mockClear();

    await act(async () => {
      result.current.recordStudySeconds("video", 1);
      await result.current.flushCourseState();
    });

    expect(writeCourseState).toHaveBeenCalledWith(
      "/tmp/course",
      expect.objectContaining({
        studyStats: expect.stringContaining('"todaySeconds":1'),
      }),
    );
  });

  it("keeps a progress save warning visible while opening another course", async () => {
    chooseCoursePath.mockResolvedValueOnce("/tmp/course").mockResolvedValueOnce("/tmp/next");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());
    await act(async () => result.current.openCourse());
    writeCourseState.mockRejectedValueOnce(new Error("disk full"));

    await act(async () => result.current.openCourse());

    expect(result.current.status).toContain("Progress save failed: disk full");
    expect(result.current.status).toContain("Loaded next");
  });

  it("ignores a late watch update from the previous course", async () => {
    chooseCoursePath.mockResolvedValueOnce("/tmp/course").mockResolvedValueOnce("/tmp/next");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const { result } = renderHook(() => useAppModel());
    await act(async () => result.current.openCourse());
    await act(async () => result.current.openCourse());

    act(() => result.current.recordStudySeconds("video", 1, "/tmp/course"));

    expect(result.current.studyStats.totalSeconds).toBe(0);
  });

  it("restores persisted study stats for the course", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(courseEntries());
    readNote.mockResolvedValue("Intro notes");
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    readCourseState.mockResolvedValue({
      studyStats: JSON.stringify({ todaySeconds: 12, totalSeconds: 50, streakDays: 1, lastStudyDate: date }),
    });
    const { result } = renderHook(() => useAppModel());

    await act(async () => result.current.openCourse());

    expect(result.current.studyStats).toEqual({
      todaySeconds: 12,
      totalSeconds: 50,
      streakDays: 1,
      lastStudyDate: date,
      todayBySource: { videoSeconds: 12, terminalSeconds: 0 },
      totalBySource: { videoSeconds: 50, terminalSeconds: 0 },
    });
  });

  it("selects the first playable video inside a selected folder", async () => {
    chooseCoursePath.mockResolvedValue("/tmp/course");
    scanCourse.mockResolvedValue(folderSelectionEntries());
    readNote.mockResolvedValue("Nested notes");

    const { result } = renderHook(() => useAppModel());

    await act(async () => {
      await result.current.openCourse();
    });

    await act(async () => {
      await result.current.selectEntry(result.current.entries[1]);
    });

    expect(result.current.selectedEntry?.id).toBe("week-2/nested/lesson.mp4");
    expect(result.current.status).toBe("Loaded course");

    await act(async () => {
      await result.current.selectEntry(result.current.entries[2]);
    });

    expect(result.current.selectedEntry?.id).toBe("empty");
    expect(result.current.status).toBe("No videos in Empty");
    expect(result.current.noteBody).toBe("");
  });
});

function courseEntries() {
  return [
    {
      id: "week-1",
      name: "Week 1",
      relativePath: "Week 1",
      absolutePath: "/tmp/course/Week 1",
      kind: "directory" as const,
      children: [
        {
          id: "week-1/intro.mp4",
          name: "intro.mp4",
          relativePath: "Week 1/intro.mp4",
          absolutePath: "/tmp/course/Week 1/intro.mp4",
          kind: "video" as const,
        },
        {
          id: "week-1/intro.srt",
          name: "intro.srt",
          relativePath: "Week 1/intro.srt",
          absolutePath: "/tmp/course/Week 1/intro.srt",
          kind: "subtitle" as const,
        },
        {
          id: "week-1/second.mp4",
          name: "second.mp4",
          relativePath: "Week 1/second.mp4",
          absolutePath: "/tmp/course/Week 1/second.mp4",
          kind: "video" as const,
        },
      ],
    },
  ];
}

function folderSelectionEntries() {
  return [
    {
      id: "week-1",
      name: "Week 1",
      relativePath: "Week 1",
      absolutePath: "/tmp/course/Week 1",
      kind: "directory" as const,
      children: [
        {
          id: "week-1/intro.mp4",
          name: "intro.mp4",
          relativePath: "Week 1/intro.mp4",
          absolutePath: "/tmp/course/Week 1/intro.mp4",
          kind: "video" as const,
        },
      ],
    },
    {
      id: "week-2",
      name: "Week 2",
      relativePath: "Week 2",
      absolutePath: "/tmp/course/Week 2",
      kind: "directory" as const,
      children: [
        {
          id: "week-2/nested",
          name: "Nested",
          relativePath: "Week 2/Nested",
          absolutePath: "/tmp/course/Week 2/Nested",
          kind: "directory" as const,
          children: [
            {
              id: "week-2/nested/lesson.mp4",
              name: "Nested - lesson.mp4",
              relativePath: "Week 2/Nested/Nested - lesson.mp4",
              absolutePath: "/tmp/course/Week 2/Nested/Nested - lesson.mp4",
              kind: "video" as const,
            },
          ],
        },
      ],
    },
    {
      id: "empty",
      name: "Empty",
      relativePath: "Empty",
      absolutePath: "/tmp/course/Empty",
      kind: "directory" as const,
      children: [],
    },
  ];
}
