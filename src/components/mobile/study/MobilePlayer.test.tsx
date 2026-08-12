// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MobileCourseService } from "../../../lib/mobileCourseService";
import { MobilePlayer } from "./MobilePlayer";

const lesson = { id: "lesson-safe", name: "Lesson.mp4", relativePath: "Section/Lesson.mp4", kind: "video" as const, duration: "--:--", completed: false, bookmarked: false, note: "" };

function service(): MobileCourseService {
  return {
    pickCourse: async () => ({ status: "cancelled" }), restoreCourses: async () => [], scanCourse: async () => { throw new Error(); }, relinkCourse: async () => ({ status: "cancelled" }), upgradeCourseAccess: async () => ({ status: "cancelled" }),
    prepareMedia: async () => ({ sourceId: "source-safe", url: "http://127.0.0.1:31000/media/token-safe", mimeType: "video/mp4", generation: 1 }), releaseMedia: async () => undefined,
    readSubtitle: async () => { throw new Error(); }, loadLessonNote: async () => ({ status: "absent", contents: "", checksum: null, canCreate: false, canWrite: false }), saveLessonNote: async () => ({ status: "failed" }), saveLessonDraft: async () => undefined,
    loadCourseState: async () => ({ storage: "portable", revisions: { state: null, progress: null, todos: null, vocabulary: null }, files: { state: {}, progress: {}, todos: {}, vocabulary: [] } }),
    saveCourseStateFile: async () => ({ status: "saved", storage: "portable", revision: "safe" }),
    enterPictureInPicture: async () => ({ status: "entered" }), updateAndroidPlayback: async () => ({ audioFocusGranted: true }),
  };
}

afterEach(() => { cleanup(); document.documentElement.classList.remove("limmud-native-pip"); });

describe("mobile native media integration", () => {
  it("offers manual PiP only while playing and enters through the native bridge", async () => {
    const native = service();
    native.enterPictureInPicture = vi.fn(async () => ({ status: "entered" as const }));
    render(<MobilePlayer service={native} courseId="course-safe" lesson={lesson} entries={[lesson]} />);
    const video = await screen.findByTitle("Lesson.mp4");
    const button = screen.getByRole("button", { name: "Enter Picture-in-Picture" });
    expect(button).toBeDisabled();
    fireEvent.play(video);
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(native.enterPictureInPicture).toHaveBeenCalledTimes(1));
  });

  it("responds to native pause and PiP lifecycle events without creating another player", async () => {
    const native = service();
    render(<MobilePlayer service={native} courseId="course-safe" lesson={lesson} entries={[lesson]} />);
    const video = await screen.findByTitle("Lesson.mp4") as HTMLVideoElement;
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    window.dispatchEvent(new CustomEvent("limmud:native-media-action", { detail: "pause" }));
    expect(pause).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new CustomEvent("limmud:native-pip", { detail: "active" }));
    expect(document.documentElement).toHaveClass("limmud-native-pip");
    expect(screen.getAllByTestId("vidstack-player")).toHaveLength(1);
  });

  it("restores the same WebView player when Android confirms PiP after a transition pause", async () => {
    const native = service();
    render(<MobilePlayer service={native} courseId="course-safe" lesson={lesson} entries={[lesson]} />);
    const video = await screen.findByTitle("Lesson.mp4") as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue(undefined);
    fireEvent.play(video);
    fireEvent.click(screen.getByRole("button", { name: "Enter Picture-in-Picture" }));

    fireEvent.pause(video);
    window.dispatchEvent(new CustomEvent("limmud:native-pip", { detail: "active" }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.getAllByTestId("vidstack-player")).toHaveLength(1);
  });

  it("keeps the Android media session active across ordinary React rerenders", async () => {
    const native = service();
    native.updateAndroidPlayback = vi.fn(async () => ({ audioFocusGranted: true }));
    const rendered = render(<MobilePlayer service={native} courseId="course-safe" lesson={lesson} entries={[lesson]} onNext={() => undefined} canNext />);
    const video = await screen.findByTitle("Lesson.mp4") as HTMLVideoElement;
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    fireEvent.play(video);
    rendered.rerender(<MobilePlayer service={native} courseId="course-safe" lesson={lesson} entries={[lesson]} onNext={() => undefined} canNext />);
    expect(native.updateAndroidPlayback).not.toHaveBeenCalledWith(expect.objectContaining({ state: "idle" }));
  });
});
