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
  vi.restoreAllMocks();
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
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/video.mp4"));
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.play(video);
  fireEvent.waiting(video);
  fireEvent.playing(video);
  fireEvent.seeking(video);
  fireEvent.pause(video);
  fireEvent.ended(video);
  expect(onStudyActivityChange.mock.calls.map(([active]) => active)).toEqual([false, true, false, true, false, false, false]);
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
  expect(container.querySelector("video")).not.toHaveAttribute("controls");
  expect(screen.getByTestId("vidstack-player")).toBeInTheDocument();
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

it("shows the video error code without exposing its source or path", async () => {
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
  expect(screen.getByText("Error: code 4 source not supported")).toBeInTheDocument();
  expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Path:/)).not.toBeInTheDocument();
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
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/video.mp4"));
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

it("ignores paused time and seek jumps without double-counting after resume", async () => {
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
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/video.mp4"));
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

it("requests persistence flushes on pause, ended, and cleanup", async () => {
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
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/video.mp4"));
  fireEvent.pause(video);
  Object.defineProperty(video, "duration", { configurable: true, value: 10 });
  fireEvent.ended(video);
  unmount();

  expect(onPlaybackFlush).toHaveBeenCalledTimes(3);
});

it("captures the final fractional interval when playback pauses", async () => {
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
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/video.mp4"));
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

it("never renders the previous lesson URL while the next URL is pending", async () => {
  tauriRuntime = true;
  courseMediaUrl
    .mockResolvedValueOnce("http://127.0.0.1/old.mp4")
    .mockReturnValueOnce(new Promise(() => {}));

  const { container, rerender } = renderVideoPlayer(videoEntry("old"));
  const video = container.querySelector("video") as HTMLVideoElement;
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/old.mp4"));

  rerender(videoPlayerElement(videoEntry("next")));

  expect(container.querySelector("video")).toBe(video);
  expect(video).not.toHaveAttribute("src");
});

it("ignores a media URL that resolves after its lesson was replaced", async () => {
  tauriRuntime = true;
  const oldUrl = deferred<string>();
  const nextUrl = deferred<string>();
  courseMediaUrl
    .mockReturnValueOnce(oldUrl.promise)
    .mockReturnValueOnce(nextUrl.promise);

  const { container, rerender } = renderVideoPlayer(videoEntry("old"));
  const video = container.querySelector("video") as HTMLVideoElement;
  rerender(videoPlayerElement(videoEntry("next")));

  oldUrl.resolve("http://127.0.0.1/old.mp4");
  await Promise.resolve();
  expect(video).not.toHaveAttribute("src");

  nextUrl.resolve("http://127.0.0.1/next.mp4");
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/next.mp4"));
});

it("applies saved progress once after metadata for each source", async () => {
  tauriRuntime = true;
  courseMediaUrl
    .mockResolvedValueOnce("http://127.0.0.1/old.mp4")
    .mockResolvedValueOnce("http://127.0.0.1/next.mp4");
  const { container, rerender } = renderVideoPlayer(videoEntry("old"), { resumeTime: 42 });
  const video = container.querySelector("video") as HTMLVideoElement;
  let currentTime = 0;
  const seeks: number[] = [];
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      seeks.push(value);
      currentTime = value;
    },
  });
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/old.mp4"));
  fireEvent.loadedMetadata(video);

  rerender(videoPlayerElement(videoEntry("old"), { resumeTime: 84 }));
  fireEvent.loadedMetadata(video);
  expect(seeks).toEqual([42]);

  rerender(videoPlayerElement(videoEntry("next"), { resumeTime: 11 }));
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/next.mp4"));
  fireEvent.loadedMetadata(video);
  expect(seeks).toEqual([42, 11]);
});

it("keeps the current position through pause and resume persistence updates", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/lesson.mp4");
  const { container, rerender } = renderVideoPlayer(videoEntry("lesson"), { resumeTime: 20 });
  const video = container.querySelector("video") as HTMLVideoElement;
  let currentTime = 0;
  const seeks: number[] = [];
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      seeks.push(value);
      currentTime = value;
    },
  });
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/lesson.mp4"));
  fireEvent.loadedMetadata(video);
  currentTime = 37;

  fireEvent.pause(video);
  rerender(videoPlayerElement(videoEntry("lesson"), { resumeTime: 37 }));
  fireEvent.play(video);

  expect(currentTime).toBe(37);
  expect(seeks).toEqual([20]);
});

it("keeps an intentional seek through pause and resume", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/lesson.mp4");
  const { container, rerender } = renderVideoPlayer(videoEntry("lesson"), { resumeTime: 10 });
  const video = container.querySelector("video") as HTMLVideoElement;
  let currentTime = 0;
  const seeks: number[] = [];
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      seeks.push(value);
      currentTime = value;
    },
  });
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/lesson.mp4"));
  fireEvent.loadedMetadata(video);
  currentTime = 75;
  fireEvent.seeking(video);
  fireEvent.seeked(video);
  fireEvent.pause(video);
  rerender(videoPlayerElement(videoEntry("lesson"), { resumeTime: 75 }));
  fireEvent.play(video);

  expect(currentTime).toBe(75);
  expect(seeks).toEqual([10]);
});

it("requests playback when an automatically selected source becomes ready", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/next.mp4");
  const { container } = renderVideoPlayer(videoEntry("next"), { autoPlay: true });
  const video = container.querySelector("video") as HTMLVideoElement;
  const play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(video, "play", { configurable: true, value: play });
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/next.mp4"));

  fireEvent.canPlay(video);

  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
});

it("shows a recoverable error when automatic playback is rejected", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/next.mp4");
  const { container } = renderVideoPlayer(videoEntry("next"), { autoPlay: true });
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "play", {
    configurable: true,
    value: vi.fn().mockRejectedValue(new DOMException("Not allowed", "NotAllowedError")),
  });
  await waitFor(() => expect(video).toHaveAttribute("src", "http://127.0.0.1/next.mp4"));

  fireEvent.canPlay(video);

  expect(await screen.findByText("Playback did not start automatically. Press play to continue.")).toBeInTheDocument();
});

it("records playback events without logging URLs or absolute paths", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/private-token/lesson.mp4");
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const { container } = renderVideoPlayer(videoEntry("lesson"));
  const video = container.querySelector("video") as HTMLVideoElement;
  await waitFor(() => expect(video).toHaveAttribute("src"));

  fireEvent.play(video);
  fireEvent.waiting(video);
  fireEvent.stalled(video);
  fireEvent.seeking(video);
  fireEvent.seeked(video);
  fireEvent.pause(video);

  const records = info.mock.calls.map(([, record]) => record as { event: string });
  expect(records.map(({ event }) => event)).toEqual(expect.arrayContaining([
    "source-request",
    "source-activate",
    "play",
    "waiting",
    "stalled",
    "seeking",
    "seeked",
    "pause",
  ]));
  const serialized = JSON.stringify(info.mock.calls);
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("private-token");
});

it("shows Picture-in-Picture only when the current provider supports it", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValue("http://127.0.0.1/lesson.mp4");
  Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: false });
  const unsupported = renderVideoPlayer(videoEntry("lesson"));
  expect(screen.queryByRole("button", { name: "Enter Picture-in-Picture" })).not.toBeInTheDocument();
  unsupported.unmount();

  Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: true });
  const supported = renderVideoPlayer(videoEntry("lesson"));
  const video = supported.container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "requestPictureInPicture", {
    configurable: true,
    value: vi.fn().mockResolvedValue({}),
  });
  const exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "exitPictureInPicture", {
    configurable: true,
    value: exitPictureInPicture,
  });

  fireEvent.click(await screen.findByRole("button", { name: "Enter Picture-in-Picture" }));
  expect(video.requestPictureInPicture).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByRole("button", { name: "Exit Picture-in-Picture" }));
  expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
});

it("reports Picture-in-Picture permission failures without replacing the player", async () => {
  tauriRuntime = true;
  courseMediaUrl.mockResolvedValueOnce("http://127.0.0.1/lesson.mp4");
  Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: true });
  const { container } = renderVideoPlayer(videoEntry("lesson"));
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "requestPictureInPicture", {
    configurable: true,
    value: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
  });
  const originalVideo = video;

  fireEvent.click(await screen.findByRole("button", { name: "Enter Picture-in-Picture" }));

  expect(await screen.findByText("Picture-in-Picture could not be opened (NotAllowedError).")).toBeInTheDocument();
  expect(container.querySelector("video")).toBe(originalVideo);
});

function videoEntry(id: string) {
  return {
    id,
    name: `${id}.mp4`,
    relativePath: `week/${id}.mp4`,
    absolutePath: `/tmp/course/week/${id}.mp4`,
    kind: "video" as const,
  };
}

function videoPlayerElement(
  selectedEntry: ReturnType<typeof videoEntry>,
  options: { resumeTime?: number; autoPlay?: boolean } = {},
) {
  return (
    <VideoPlayer
      courseRoot="/tmp/course"
      selectedEntry={selectedEntry}
      subtitleEntry={null}
      resumeTime={options.resumeTime ?? 0}
      autoPlay={options.autoPlay}
      onProgressChange={() => {}}
      onEnded={() => {}}
    />
  );
}

function renderVideoPlayer(
  selectedEntry: ReturnType<typeof videoEntry>,
  options: { resumeTime?: number; autoPlay?: boolean } = {},
) {
  return render(videoPlayerElement(selectedEntry, options));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function setTime(video: HTMLVideoElement, value: number) {
  Object.defineProperty(video, "currentTime", { configurable: true, value });
}
