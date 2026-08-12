import { describe, expect, it, vi } from "vitest";
import { createMobileCourseService } from "./mobileCourseService";

const available = {
  courseId: "course-safe",
  displayName: "Synthetic Course",
  access: "available",
  entries: [{ id: "lesson-safe", name: "Lesson 1.mp4", relativePath: "Lesson 1.mp4", kind: "video" }],
  warningCount: 0,
};

describe("mobile SAF course service", () => {
  it("invokes the four narrow plugin commands with opaque IDs", async () => {
    const invoke = vi.fn(async (command: string) => command.endsWith("restore_courses") ? [available] : command.endsWith("pick_course") || command.endsWith("relink_course") ? { status: "selected", course: available } : available);
    const service = createMobileCourseService(invoke);

    await service.pickCourse();
    await service.restoreCourses();
    await service.scanCourse("course-safe");
    await service.relinkCourse("course-safe");

    expect(invoke.mock.calls).toEqual([
      ["plugin:saf-course|pick_course"],
      ["plugin:saf-course|restore_courses"],
      ["plugin:saf-course|scan_course", { courseId: "course-safe" }],
      ["plugin:saf-course|relink_course", { courseId: "course-safe" }],
    ]);
  });

  it("returns picker cancellation without treating it as an error", async () => {
    const service = createMobileCourseService(vi.fn(async () => ({ status: "cancelled" })));
    await expect(service.pickCourse()).resolves.toEqual({ status: "cancelled" });
  });

  it("rejects native responses that leak an absolute path", async () => {
    const leaked = { ...available, entries: [{ ...available.entries[0], absolutePath: "/private/course/Lesson 1.mp4" }] };
    const service = createMobileCourseService(vi.fn(async () => [leaked]));
    await expect(service.restoreCourses()).rejects.toThrow("Course access returned an unsafe response.");
  });

  it("maps native failures to fixed privacy-safe application errors", async () => {
    const service = createMobileCourseService(vi.fn(async () => { throw new Error("sensitive native detail"); }));
    await expect(service.restoreCourses()).rejects.toThrow("Limmud could not restore course access.");
  });

  it("prepares and releases media using only opaque application identifiers", async () => {
    const invoke = vi.fn(async (command: string) => command.endsWith("prepare_media")
      ? { sourceId: "source-safe", url: "http://127.0.0.1:31000/media/token-safe", mimeType: "video/mp4", generation: 7 }
      : null);
    const service = createMobileCourseService(invoke);

    await expect(service.prepareMedia("course-safe", "lesson-safe")).resolves.toEqual({
      sourceId: "source-safe",
      url: "http://127.0.0.1:31000/media/token-safe",
      mimeType: "video/mp4",
      generation: 7,
    });
    await service.releaseMedia("source-safe");

    expect(invoke.mock.calls).toEqual([
      ["plugin:saf-course|prepare_media", { courseId: "course-safe", entryId: "lesson-safe" }],
      ["plugin:saf-course|release_media", { sourceId: "source-safe" }],
    ]);
  });

  it("loads subtitles and notes without accepting leaked provider identifiers", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command.endsWith("read_subtitle")) return { format: "srt", contents: "synthetic", generation: 3 };
      if (command.endsWith("load_lesson_note")) return {
        status: "editable", contents: "# Synthetic", checksum: "checksum-safe", canCreate: true, canWrite: true,
      };
      throw new Error("unexpected");
    });
    const service = createMobileCourseService(invoke);

    await expect(service.readSubtitle("course-safe", "subtitle-safe", 3)).resolves.toEqual({ format: "srt", contents: "synthetic", generation: 3 });
    await expect(service.loadLessonNote("course-safe", "lesson-safe")).resolves.toMatchObject({ status: "editable", contents: "# Synthetic" });

    const leaking = createMobileCourseService(vi.fn(async () => ({
      status: "editable", contents: "", checksum: "safe", canCreate: true, canWrite: true, documentUri: "content://private",
    })));
    await expect(leaking.loadLessonNote("course-safe", "lesson-safe")).rejects.toThrow("unsafe response");
  });

  it("saves notes and upgrades editing access without changing course identity", async () => {
    const invoke = vi.fn(async (command: string) => command.endsWith("save_lesson_note")
      ? { status: "saved", checksum: "new-checksum" }
      : { status: "selected", course: available });
    const service = createMobileCourseService(invoke);

    await expect(service.saveLessonNote("course-safe", "lesson-safe", "# Draft", "old-checksum")).resolves.toEqual({ status: "saved", checksum: "new-checksum" });
    await expect(service.upgradeCourseAccess("course-safe")).resolves.toEqual({ status: "selected", course: available });

    expect(invoke.mock.calls).toEqual([
      ["plugin:saf-course|save_lesson_note", { courseId: "course-safe", entryId: "lesson-safe", contents: "# Draft", expectedChecksum: "old-checksum" }],
      ["plugin:saf-course|upgrade_course_access", { courseId: "course-safe" }],
    ]);
  });

  it("persists an unsaved Markdown draft through the native no-backup store", async () => {
    const invoke = vi.fn(async () => null);
    const service = createMobileCourseService(invoke);

    await service.saveLessonDraft("course-safe", "lesson-safe", "# Unsaved synthetic draft", "base-safe");

    expect(invoke).toHaveBeenCalledWith("plugin:saf-course|save_lesson_draft", {
      courseId: "course-safe", entryId: "lesson-safe", contents: "# Unsaved synthetic draft", expectedChecksum: "base-safe",
    });
  });

  it("loads portable course state as raw desktop-compatible records without native identifiers", async () => {
    const invoke = vi.fn(async () => ({
      storage: "portable",
      revisions: { state: "state-rev", progress: "progress-rev", todos: "todos-rev", vocabulary: "vocabulary-rev" },
      files: {
        state: { timerMode: "focus", timerPreset: "25", quickNote: "" },
        progress: { completedLessons: "[]", bookmarkedLessons: "[]", videoProgress: "{}", studyStats: "{}" },
        todos: { todos: "[]" },
        vocabulary: [],
      },
    }));
    const service = createMobileCourseService(invoke);

    await expect(service.loadCourseState("course-safe")).resolves.toMatchObject({
      storage: "portable",
      revisions: { progress: "progress-rev" },
      files: { state: { timerMode: "focus" } },
    });
    expect(invoke).toHaveBeenCalledWith("plugin:saf-course|load_course_state", { courseId: "course-safe" });
  });

  it("saves one canonical state document with optimistic conflict protection", async () => {
    const invoke = vi.fn(async () => ({ status: "saved", storage: "portable", revision: "next-rev" }));
    const service = createMobileCourseService(invoke);

    await expect(service.saveCourseStateFile(
      "course-safe",
      "progress",
      { completedLessons: '["Section A/lesson_01.mp4"]' },
      "progress-rev",
    )).resolves.toEqual({ status: "saved", storage: "portable", revision: "next-rev" });
    expect(invoke).toHaveBeenCalledWith("plugin:saf-course|save_course_state_file", {
      courseId: "course-safe",
      file: "progress",
      contentsJson: '{"completedLessons":"[\\"Section A/lesson_01.mp4\\"]"}',
      expectedRevision: "progress-rev",
    });
  });

  it("accepts explicit local-only and conflict outcomes without exposing native errors", async () => {
    const local = createMobileCourseService(vi.fn(async () => ({ status: "saved", storage: "localOnly", revision: "local-rev" })));
    await expect(local.saveCourseStateFile("course-safe", "todos", { todos: "[]" }, null)).resolves.toMatchObject({ storage: "localOnly" });

    const conflict = createMobileCourseService(vi.fn(async () => ({ status: "conflict", storage: "portable", revision: "external-rev" })));
    await expect(conflict.saveCourseStateFile("course-safe", "state", {}, "old-rev")).resolves.toEqual({
      status: "conflict", storage: "portable", revision: "external-rev",
    });
  });

  it("enters native Android PiP and mirrors provider-neutral playback state", async () => {
    const invoke = vi.fn(async (command: string) => command.endsWith("enter_picture_in_picture")
      ? { status: "entered" }
      : { audioFocusGranted: true });
    const service = createMobileCourseService(invoke);

    await expect(service.enterPictureInPicture()).resolves.toEqual({ status: "entered" });
    await expect(service.updateAndroidPlayback({
      state: "playing", positionSeconds: 12, durationSeconds: 60, canPrevious: false, canNext: true,
    })).resolves.toEqual({ audioFocusGranted: true });
    expect(invoke.mock.calls).toEqual([
      ["plugin:saf-course|enter_picture_in_picture", { width: 16, height: 9 }],
      ["plugin:saf-course|update_android_playback", {
        state: "playing", positionSeconds: 12, durationSeconds: 60, canPrevious: false, canNext: true,
      }],
    ]);
  });
});
