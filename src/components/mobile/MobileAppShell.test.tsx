// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileCourseService } from "../../lib/mobileCourseService";
import type { MobileCourseRecord } from "./mobileCourseModel";
import { MobileAppShell } from "./MobileAppShell";

const realCourse: MobileCourseRecord = {
  courseId: "course-safe",
  displayName: "Synthetic SAF Course",
  access: "available" as const,
  warningCount: 0,
  entries: [
    { id: "section-start", name: "Getting started", relativePath: "Getting started", kind: "directory" as const, children: [
      { id: "lesson-orientation", name: "Course orientation.mp4", relativePath: "Getting started/Course orientation.mp4", kind: "video" as const },
      { id: "subtitle-orientation", name: "Course orientation.vtt", relativePath: "Getting started/Course orientation.vtt", kind: "subtitle" as const },
      { id: "lesson-rhythm", name: "Build a study rhythm.mp4", relativePath: "Getting started/Build a study rhythm.mp4", kind: "video" as const },
    ] },
    { id: "section-practice", name: "Core practice", relativePath: "Core practice", kind: "directory" as const, children: [
      { id: "lesson-review", name: "Focused review.mp4", relativePath: "Core practice/Focused review.mp4", kind: "video" as const },
      { id: "lesson-recall", name: "Practice active recall.mp4", relativePath: "Core practice/Practice active recall.mp4", kind: "video" as const },
    ] },
  ],
};

function serviceWith(course: MobileCourseRecord = realCourse): MobileCourseService {
  return {
    pickCourse: async () => ({ status: "selected", course }),
    restoreCourses: async () => [course],
    scanCourse: async () => course,
    relinkCourse: async () => ({ status: "selected", course }),
    upgradeCourseAccess: async () => ({ status: "selected", course }),
    prepareMedia: async () => ({ sourceId: "source-safe", url: "http://127.0.0.1:31000/media/token-safe", mimeType: "video/mp4", generation: 0 }),
    releaseMedia: async () => undefined,
    readSubtitle: async (_courseId, _entryId, generation) => ({ format: "vtt", contents: "WEBVTT\n\n00:00.000 --> 00:01.000\nSynthetic", generation }),
    loadLessonNote: async () => ({ status: "editable", contents: "# Existing synthetic note", checksum: "old-safe", canCreate: true, canWrite: true }),
    saveLessonNote: async () => ({ status: "saved", checksum: "new-safe" }),
    saveLessonDraft: async () => undefined,
    loadCourseState: async () => ({
      storage: "portable",
      revisions: { state: null, progress: null, todos: null, vocabulary: null },
      files: { state: {}, progress: {}, todos: {}, vocabulary: [] },
    }),
    saveCourseStateFile: async () => ({ status: "saved", storage: "portable", revision: "state-safe" }),
    enterPictureInPicture: async () => ({ status: "entered" }),
    updateAndroidPlayback: async () => ({ audioFocusGranted: true }),
  };
}

async function renderAvailable() {
  render(<MobileAppShell service={serviceWith()} />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
}

beforeEach(() => {
  window.history.replaceState({ limmudMobileView: "home" }, "", "/");
  localStorage.clear();
});

afterEach(cleanup);

describe("Limmud mobile shell", () => {
  it("opens on a branded, privacy-safe home outside the four study destinations", async () => {
    await renderAvailable();

    expect(screen.getByRole("heading", { name: "Limmud" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add course/i })).toBeEnabled();
    expect(screen.getByText(/media playback is available/i)).toBeInTheDocument();
    expect(screen.queryByText(/remain disconnected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Study navigation" })).not.toBeInTheDocument();
    expect(screen.queryByText(/terminal/i)).not.toBeInTheDocument();
  });

  it("enters course context with exactly four primary destinations", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));

    const navigation = screen.getByRole("navigation", { name: "Study navigation" });
    expect(navigation).toBeInTheDocument();
    for (const destination of ["Study", "Course", "Notes", "Tools"]) {
      expect(screen.getByRole("button", { name: destination })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Home" })).not.toBeInTheDocument();
  });

  it("selects a real lesson from an expandable course outline and opens Study", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /view course outline/i }));

    fireEvent.click(screen.getByRole("button", { name: /collapse core practice/i }));
    expect(screen.queryByRole("button", { name: /open focused review/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expand core practice/i }));
    fireEvent.click(screen.getByRole("button", { name: /open focused review/i }));

    expect(screen.getByRole("heading", { name: "Focused review" })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.classList.contains("m-eyebrow") === true && element.textContent?.startsWith("Core practice") === true)).toBeInTheDocument();
  });

  it("moves to previous and next lessons while retaining current lesson state", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    expect(screen.getByRole("heading", { name: "Course orientation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next lesson/i }));
    expect(screen.getByRole("heading", { name: "Build a study rhythm" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /previous lesson/i }));
    expect(screen.getByRole("heading", { name: "Course orientation" })).toBeInTheDocument();
  });

  it("prepares the selected real lesson and renders it in the Limmud player", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));

    const video = await screen.findByTitle("Course orientation.mp4");
    expect(video).toHaveAttribute("src", "http://127.0.0.1:31000/media/token-safe");
    expect(video.querySelector("track")).toBeInTheDocument();
    expect(screen.queryByText(/playback not connected/i)).not.toBeInTheDocument();
  });

  it("loads an existing lesson note and reports Saved only after verified save", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    expect(await screen.findByText("Existing synthetic note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /markdown note/i }), { target: { value: "# Updated synthetic note" } });
    fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeInTheDocument());
  });

  it("switches notes between view and keyboard-friendly edit modes", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    const editor = screen.getByRole("textbox", { name: /markdown note/i });
    expect(editor).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: "# Review\n\nA safer study rhythm." } });
    expect(screen.getByText(/unsaved draft/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeInTheDocument());
  });

  it("opens each study tool without exposing a terminal", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));

    for (const tool of ["Study Timer", "Todos", "Bookmarks", "Dictionary", "Vocabulary"]) {
      fireEvent.click(screen.getByRole("button", { name: tool }));
      expect(screen.getByRole("heading", { name: tool })).toBeInTheDocument();
      if (tool === "Dictionary") expect(screen.getByText("Offline Dictionary")).toBeInTheDocument();
    }
    expect(screen.queryByText(/terminal/i)).not.toBeInTheDocument();
  });

  it("hydrates a running device timer before persisting the initial UI state", async () => {
    localStorage.setItem("limmud.mobile.timer.course-safe", JSON.stringify({
      mode: "focus", presetMinutes: 25, phase: "running", accumulatedSeconds: 0,
      startedAtEpochMs: Date.now() - 5_000,
    }));
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));

    await waitFor(() => expect(screen.getByText("Session in progress")).toBeInTheDocument());
    expect(screen.queryByText("Ready when you are")).not.toBeInTheDocument();
  });

  it("enters and leaves mobile Zen mode", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter zen mode/i }));
    expect(screen.queryByRole("navigation", { name: "Study navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exit zen mode/i })).toBeInTheDocument();
  });

  it("restores course then home when Android Back changes browser history", async () => {
    await renderAvailable();
    fireEvent.click(screen.getByRole("button", { name: /view course outline/i }));
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { limmudMobileView: "course" } }));
    });
    expect(screen.getByRole("heading", { name: "Course outline" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { limmudMobileView: "home" } }));
    });
    expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument();
  });

  it("opens the picker from an empty library and installs the selected real course", async () => {
    const selected = serviceWith();
    const service: MobileCourseService = { ...selected, restoreCourses: async () => [] };
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Courses" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /add course/i }));
    await waitFor(() => expect(screen.getByText("Synthetic SAF Course")).toBeInTheDocument());
  });

  it("shows Access required and relinks without deleting the registered course", async () => {
    const unavailable = { ...realCourse, displayName: "Saved course", access: "accessRequired" as const, entries: [] };
    render(<MobileAppShell service={{
      ...serviceWith(unavailable),
      relinkCourse: async (courseId) => ({ status: "selected", course: { ...realCourse, courseId } }),
    }} />);
    await waitFor(() => expect(screen.getByText("Access required")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /relink folder/i }));
    await waitFor(() => expect(screen.getByText("Synthetic SAF Course")).toBeInTheDocument());
    expect(screen.queryByText("Access required")).not.toBeInTheDocument();
  });

  it("hydrates desktop-compatible completion and bookmarks into Course and Study", async () => {
    const service = serviceWith();
    service.loadCourseState = async () => ({
      storage: "portable",
      revisions: { state: "s", progress: "p", todos: "t", vocabulary: "v" },
      files: {
        state: { timerMode: "focus", timerPreset: "25", quickNote: "" },
        progress: {
          completedLessons: '["Getting started/Course orientation.mp4"]',
          bookmarkedLessons: '["Getting started/Course orientation.mp4"]',
          videoProgress: "{}",
          studyStats: JSON.stringify({ todaySeconds: 0, totalSeconds: 0, streakDays: 0, lastStudyDate: null, todayBySource: { videoSeconds: 0, terminalSeconds: 0 }, totalBySource: { videoSeconds: 0, terminalSeconds: 0 } }),
        },
        todos: { todos: "[]" },
        vocabulary: [],
      },
    });
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /view course outline/i }));

    expect(screen.getByText("25%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open course orientation/i }));
    expect(screen.getByRole("button", { name: "Bookmark" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Mark incomplete" })).toBeInTheDocument();
  });

  it("persists completion and bookmark toggles to the canonical progress record", async () => {
    const saved: Record<string, string>[] = [];
    const service = serviceWith();
    service.saveCourseStateFile = async (_courseId, file, contents) => {
      if (file === "progress") saved.push(contents as Record<string, string>);
      return { status: "saved", storage: "portable", revision: `next-${saved.length}` };
    };
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

    await waitFor(() => expect(saved).toHaveLength(2));
    expect(JSON.parse(saved[0].bookmarkedLessons)).toEqual(["Getting started/Course orientation.mp4"]);
    expect(JSON.parse(saved[1].completedLessons)).toEqual(["Getting started/Course orientation.mp4"]);
  });

  it("uses real todos and labels app-private fallback state", async () => {
    const service = serviceWith();
    service.loadCourseState = async () => ({
      storage: "localOnly",
      revisions: { state: null, progress: null, todos: "local-t", vocabulary: null },
      files: {
        state: {}, progress: {},
        todos: { todos: '[{"id":"todo-real","label":"Review portable state","done":false}]' },
        vocabulary: [],
      },
    });
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(screen.getByText("Review portable state")).toBeInTheDocument();
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(screen.queryByText("Review today’s key idea")).not.toBeInTheDocument();
  });

  it("reconciles protected device-only state only after write access succeeds", async () => {
    const service = serviceWith();
    const localFiles = { state: {}, progress: { completedLessons: '["Getting started/Course orientation.mp4"]' }, todos: {}, vocabulary: [] };
    service.loadCourseState = async () => ({ storage: "localOnly", revisions: { state: null, progress: "local", todos: null, vocabulary: null }, files: localFiles });
    service.loadCourseStateSources = async () => ({
      portable: { storage: "portable", revisions: { state: null, progress: null, todos: null, vocabulary: null }, files: { state: {}, progress: {}, todos: {}, vocabulary: [] } },
      local: { storage: "localOnly", revisions: { state: null, progress: "local", todos: null, vocabulary: null }, files: localFiles },
    });
    service.saveCourseStateFile = vi.fn(async () => ({ status: "saved" as const, storage: "portable" as const, revision: "merged" }));
    service.clearLocalCourseState = vi.fn(async () => undefined);
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enable course saving" }));
    await waitFor(() => expect(service.clearLocalCourseState).toHaveBeenCalledTimes(1));
    expect(service.saveCourseStateFile).toHaveBeenCalledTimes(4);
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });

  it("opens a bookmarked lesson from Tools", async () => {
    const service = serviceWith();
    service.loadCourseState = async () => ({
      storage: "portable",
      revisions: { state: null, progress: "p", todos: null, vocabulary: null },
      files: { state: {}, progress: { bookmarkedLessons: '["Core practice/Focused review.mp4"]' }, todos: {}, vocabulary: [] },
    });
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Bookmarks" }));
    fireEvent.click(await screen.findByRole("button", { name: /open bookmarked lesson focused review/i }));
    expect(screen.getByRole("heading", { name: "Focused review" })).toBeInTheDocument();
  });

  it("resumes from portable playback progress and checkpoints pause", async () => {
    const saved: Record<string, string>[] = [];
    const service = serviceWith();
    service.loadCourseState = async () => ({
      storage: "portable",
      revisions: { state: null, progress: "progress-base", todos: null, vocabulary: null },
      files: {
        state: {},
        progress: { videoProgress: '{"Getting started/Course orientation.mp4":42}' },
        todos: {}, vocabulary: [],
      },
    });
    service.saveCourseStateFile = async (_courseId, file, contents) => {
      if (file === "progress") saved.push(contents as Record<string, string>);
      return { status: "saved", storage: "portable", revision: "progress-next" };
    };
    render(<MobileAppShell service={service} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Resume studying" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /resume lesson/i }));
    const video = await screen.findByTitle("Course orientation.mp4") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(42);
    Object.defineProperty(video, "currentTime", { configurable: true, value: 73 });
    fireEvent.pause(video);

    await waitFor(() => expect(saved.length).toBeGreaterThan(0));
    expect(JSON.parse(saved[saved.length - 1].videoProgress)["Getting started/Course orientation.mp4"]).toBe(73);
  });
});
