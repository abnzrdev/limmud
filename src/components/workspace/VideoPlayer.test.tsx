// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";

let tauriRuntime = false;
const { courseMediaUrl, openLessonExternal, readNote } = vi.hoisted(() => ({
  courseMediaUrl: vi.fn(),
  openLessonExternal: vi.fn(),
  readNote: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  courseMediaUrl,
  isTauriRuntime: () => tauriRuntime,
  openLessonExternal,
  toFileUrl: (value: string) => `asset://${value}`,
  toMediaUrl: (value: string) => `asset://${value.replace(/ /g, "%20")}`,
  readNote,
}));

beforeEach(() => {
  vi.clearAllMocks();
  tauriRuntime = false;
  courseMediaUrl.mockReset();
  readNote.mockReset();
  openLessonExternal.mockReset();
});

afterEach(() => {
  cleanup();
});

it("shows a desktop-runtime hint outside Tauri", () => {
  render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  expect(screen.getByText("Desktop runtime required for local playback")).toBeInTheDocument();
});

it("reports only eligible playback as study activity", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onStudyActivityChange = vi.fn();
  const { container } = render(<VideoPlayer
    courseRoot="/tmp/course"
    selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
    subtitleEntry={null}
    resumeTime={0}
    onProgressChange={() => {}}
    onEnded={() => {}}
    onStudyActivityChange={onStudyActivityChange}
  />);
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.play(video);
  fireEvent.waiting(video);
  fireEvent.playing(video);
  fireEvent.seeking(video);
  fireEvent.pause(video);
  fireEvent.ended(video);
  expect(onStudyActivityChange.mock.calls.map(([active]) => active)).toEqual([true, false, true, false, false, false]);
});

it("opens the selected lesson in the system player without changing app state", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson.mp4");
  openLessonExternal.mockResolvedValueOnce(undefined);

  render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/course/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Open in system player" }));

  await waitFor(() =>
    expect(openLessonExternal).toHaveBeenCalledWith(
      "/tmp/course",
      "/tmp/course/week1/lesson.mp4",
    ),
  );
});

it("wires the local video through localhost and keeps matching vtt track in Tauri", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson.mp4");

  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={{
        id: "lesson.vtt",
        name: "lesson.vtt",
        relativePath: "week1/lesson.vtt",
        absolutePath: "/tmp/week1/lesson.vtt",
        kind: "subtitle",
      }}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "http://127.0.0.1:1234/token/week1/lesson.mp4",
    ),
  );
  expect(courseMediaUrl).toHaveBeenCalledWith("/tmp/course", "/tmp/week1/lesson.mp4");
  expect(container.querySelector("video")).toHaveAttribute("controls");
  expect(container.querySelector("track")).toHaveAttribute("src", "asset:///tmp/week1/lesson.vtt");
  expect(screen.queryByText(/Video src:/)).not.toBeInTheDocument();
});

it("plays without crashing when no subtitle file is matched", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson.mp4");

  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "http://127.0.0.1:1234/token/week1/lesson.mp4",
    ),
  );
  expect(container.querySelector("track")).not.toBeInTheDocument();
  expect(screen.getByText("Subtitle: none matched")).toBeInTheDocument();
});

it("shows an srt conversion message and creates a track for matching srt subtitles", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson%20one.mp4");
  readNote.mockResolvedValueOnce("1\n00:00:00,000 --> 00:00:01,000\nHello");

  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson one.mp4",
        absolutePath: "/tmp/week1/lesson one.mp4",
        kind: "video",
      }}
      subtitleEntry={{
        id: "lesson.srt",
        name: "lesson.srt",
        relativePath: "week1/lesson one.srt",
        absolutePath: "/tmp/week1/lesson one.srt",
        kind: "subtitle",
      }}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "http://127.0.0.1:1234/token/week1/lesson%20one.mp4",
    ),
  );
  await waitFor(() => expect(container.querySelector("track")).toBeInTheDocument());
  const track = container.querySelector("track") as HTMLTrackElement;
  const video = container.querySelector("video") as HTMLVideoElement;
  const textTrack = { kind: "subtitles", mode: "disabled" };
  Object.defineProperty(video, "textTracks", { configurable: true, value: [textTrack] });
  fireEvent.loadedMetadata(video);

  expect(track).toHaveAttribute("label", "English");
  expect(textTrack.mode).toBe("showing");
  expect(screen.getByText("Subtitle: lesson.srt (SRT converted)")).toBeInTheDocument();
});

it("shows a subtitle error when srt conversion fails", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson.mp4");
  readNote.mockRejectedValueOnce(new Error("missing file"));

  render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={{
        id: "lesson.srt",
        name: "lesson.srt",
        relativePath: "week1/lesson.srt",
        absolutePath: "/tmp/week1/lesson.srt",
        kind: "subtitle",
      }}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  expect(await screen.findByText("Subtitle: lesson.srt (Subtitle failed to load)")).toBeInTheDocument();
});

it("shows the exact video load error when playback fails", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson%20one.mp4");

  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson one.mp4",
        absolutePath: "/tmp/week1/lesson one.mp4",
        kind: "video",
      }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />,
  );

  const video = container.querySelector("video") as HTMLVideoElement;
  await waitFor(() =>
    expect(video).toHaveAttribute(
      "src",
      "http://127.0.0.1:1234/token/week1/lesson%20one.mp4",
    ),
  );
  Object.defineProperty(video, "error", {
    configurable: true,
    value: { code: 4, message: "Format not supported" },
  });

  fireEvent.error(video);

  expect(screen.getByText("Video failed to load")).toBeInTheDocument();
  expect(screen.getByText("Error: code 4 source not supported - Format not supported")).toBeInTheDocument();
  expect(
    screen.getByText("Source: http://127.0.0.1:1234/token/week1/lesson%20one.mp4"),
  ).toBeInTheDocument();
  expect(screen.getByText("Path: /tmp/week1/lesson one.mp4")).toBeInTheDocument();
});

it("calls the ended handler with the completed duration", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1:1234/token/week1/lesson.mp4");
  const onProgressChange = vi.fn();
  const onEnded = vi.fn();

  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{
        id: "lesson.mp4",
        name: "lesson.mp4",
        relativePath: "week1/lesson.mp4",
        absolutePath: "/tmp/week1/lesson.mp4",
        kind: "video",
      }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={onProgressChange}
      onEnded={onEnded}
    />,
  );

  const video = container.querySelector("video") as HTMLVideoElement;
  await waitFor(() =>
    expect(video).toHaveAttribute("src", "http://127.0.0.1:1234/token/week1/lesson.mp4"),
  );
  Object.defineProperty(video, "duration", { configurable: true, value: 142 });

  fireEvent.ended(video);

  expect(onProgressChange).toHaveBeenCalledWith(142);
  expect(onEnded).toHaveBeenCalledWith(142);
});

it("accumulates four fractional watch deltas into one recorded second", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onWatchedSeconds = vi.fn();
  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
      onWatchedSeconds={onWatchedSeconds}
    />,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  setTime(video, 0);
  fireEvent.play(video);
  for (const time of [0.25, 0.5, 0.75, 1]) {
    setTime(video, time);
    fireEvent.timeUpdate(video);
  }

  expect(onWatchedSeconds).toHaveBeenCalledTimes(1);
  expect(onWatchedSeconds).toHaveBeenCalledWith(1, "/tmp/course");
});

it("ignores paused time and seek jumps without double-counting after resume", () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onWatchedSeconds = vi.fn();
  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
      onWatchedSeconds={onWatchedSeconds}
    />,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
  setTime(video, 0);
  fireEvent.play(video);
  setTime(video, 0.25);
  fireEvent.timeUpdate(video);
  setTime(video, 20);
  fireEvent.seeking(video);
  fireEvent.seeked(video);
  setTime(video, 20.25);
  fireEvent.timeUpdate(video);
  Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
  setTime(video, 30);
  fireEvent.timeUpdate(video);
  Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
  setTime(video, 30);
  fireEvent.play(video);
  setTime(video, 30.5);
  fireEvent.timeUpdate(video);

  expect(onWatchedSeconds).toHaveBeenCalledTimes(1);
  expect(onWatchedSeconds).toHaveBeenCalledWith(1, "/tmp/course");
});

it("ignores timeupdate events while a seek is still in progress", () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onWatchedSeconds = vi.fn();
  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
      onWatchedSeconds={onWatchedSeconds}
    />,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  Object.defineProperty(video, "seeking", { configurable: true, writable: true, value: false });
  setTime(video, 0);
  fireEvent.play(video);
  Object.defineProperty(video, "seeking", { configurable: true, writable: true, value: true });
  setTime(video, 1);
  fireEvent.seeking(video);
  setTime(video, 1.5);
  fireEvent.timeUpdate(video);
  Object.defineProperty(video, "seeking", { configurable: true, writable: true, value: false });
  fireEvent.seeked(video);
  setTime(video, 2);
  fireEvent.timeUpdate(video);

  expect(onWatchedSeconds).not.toHaveBeenCalled();
});

it("requests persistence flushes on pause, ended, and cleanup", () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onPlaybackFlush = vi.fn();
  const { container, unmount } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
      onPlaybackFlush={onPlaybackFlush}
    />,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  fireEvent.pause(video);
  Object.defineProperty(video, "duration", { configurable: true, value: 10 });
  fireEvent.ended(video);
  unmount();

  expect(onPlaybackFlush).toHaveBeenCalledTimes(3);
});

it("captures the final fractional interval when playback pauses", () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/video.mp4");
  const onWatchedSeconds = vi.fn();
  const { container } = render(
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={{ id: "lesson", name: "lesson.mp4", relativePath: "lesson.mp4", absolutePath: "/tmp/course/lesson.mp4", kind: "video" }}
      subtitleEntry={null}
      resumeTime={0}
      onProgressChange={() => {}}
      onEnded={() => {}}
      onWatchedSeconds={onWatchedSeconds}
    />,
  );
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
  setTime(video, 0);
  fireEvent.play(video);
  setTime(video, 0.6);
  fireEvent.timeUpdate(video);
  setTime(video, 1);
  Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
  fireEvent.timeUpdate(video);
  fireEvent.pause(video);

  expect(onWatchedSeconds).toHaveBeenCalledWith(1, "/tmp/course");
});

function setTime(video: HTMLVideoElement, value: number) {
  Object.defineProperty(video, "currentTime", { configurable: true, value });
}
