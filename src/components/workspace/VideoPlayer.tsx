import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  courseMediaUrl,
  isTauriRuntime,
  openLessonExternal,
  readNote,
  toMediaUrl,
} from "../../lib/tauri";
import { convertSrtToVtt } from "../../lib/subtitleMatch";
import type { CourseEntry } from "../../types/course";

interface VideoPlayerProps {
  courseRoot: string | null;
  selectedEntry: CourseEntry | null;
  subtitleEntry: CourseEntry | null;
  emptyMessage?: string;
  resumeTime: number;
  autoPlay?: boolean;
  onProgressChange: (seconds: number) => void;
  onEnded: (seconds: number) => void;
  onWatchedSeconds?: (seconds: number, courseRoot: string | null) => void;
  onPlaybackFlush?: () => void;
  onStudyActivityChange?: (active: boolean) => void;
}

export function VideoPlayer({
  courseRoot,
  selectedEntry,
  subtitleEntry,
  emptyMessage = "Select a lesson",
  resumeTime,
  autoPlay = false,
  onProgressChange,
  onEnded,
  onWatchedSeconds,
  onPlaybackFlush,
  onStudyActivityChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastWatchTimeRef = useRef<number | null>(null);
  const watchedRemainderRef = useRef(0);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleStatus, setSubtitleStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<VideoErrorDetails | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const flushWatchedTime = (flushPersistence = false) => {
    const wholeSeconds = Math.floor(watchedRemainderRef.current + 1e-9);
    if (wholeSeconds > 0) {
      watchedRemainderRef.current -= wholeSeconds;
      onWatchedSeconds?.(wholeSeconds, courseRoot);
    }
    if (flushPersistence) {
      onPlaybackFlush?.();
    }
  };

  const captureWatchedTime = (currentTime: number) => {
    const previousTime = lastWatchTimeRef.current;
    lastWatchTimeRef.current = currentTime;
    const watchedSeconds = previousTime === null ? 0 : currentTime - previousTime;
    if (watchedSeconds > 0 && watchedSeconds <= 5) {
      watchedRemainderRef.current += watchedSeconds;
      flushWatchedTime();
    }
  };

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !selectedEntry || selectedEntry.kind !== "video") {
      return;
    }

    const applyResumeTime = () => {
      if (resumeTime > 0 && Math.abs(element.currentTime - resumeTime) > 1) {
        element.currentTime = resumeTime;
      }
    };

    applyResumeTime();
    element.addEventListener("loadedmetadata", applyResumeTime);
    return () => {
      onStudyActivityChange?.(false);
      element.removeEventListener("loadedmetadata", applyResumeTime);
    };
  }, [resumeTime, selectedEntry?.absolutePath, selectedEntry?.kind]);

  useEffect(() => {
    lastWatchTimeRef.current = null;
    if (!selectedEntry || selectedEntry.kind !== "video") {
      setSubtitleUrl(null);
      setSubtitleStatus(null);
      return;
    }

    let active = true;
    const watchedElement = videoRef.current;
    setVideoError(null);
    setOpenError(null);
    setVideoUrl(null);
    console.info("Selected video absolute path", selectedEntry.absolutePath);

    const loadUrl = courseRoot && isTauriRuntime()
      ? courseMediaUrl(courseRoot, selectedEntry.absolutePath)
      : Promise.resolve(toMediaUrl(selectedEntry.absolutePath));

    void loadUrl
      .then((url) => {
        if (!active) {
          return;
        }
        setVideoUrl(url);
        console.info("Selected video src", url);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setVideoError({
          path: selectedEntry.absolutePath,
          src: "",
          summary: `media URL error - ${message}`,
        });
      });

    return () => {
      active = false;
      if (watchedElement && lastWatchTimeRef.current !== null) {
        captureWatchedTime(watchedElement.currentTime);
      }
      flushWatchedTime(true);
      watchedRemainderRef.current = 0;
      lastWatchTimeRef.current = null;
    };
  }, [courseRoot, selectedEntry]);

  useEffect(() => {
    if (!subtitleEntry || subtitleEntry.kind !== "subtitle") {
      setSubtitleUrl(null);
      setSubtitleStatus(null);
      return;
    }

    if (subtitleEntry.name.toLowerCase().endsWith(".vtt")) {
      setSubtitleUrl(toMediaUrl(subtitleEntry.absolutePath));
      setSubtitleStatus(null);
      return;
    }

    if (!subtitleEntry.name.toLowerCase().endsWith(".srt") || !isTauriRuntime()) {
      setSubtitleUrl(null);
      setSubtitleStatus("SRT detected, conversion coming later");
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void readNote(subtitleEntry.absolutePath)
      .then((contents) => {
        if (!active) {
          return;
        }
        objectUrl = URL.createObjectURL(
          new Blob([convertSrtToVtt(contents)], { type: "text/vtt" }),
        );
        setSubtitleUrl(objectUrl);
        setSubtitleStatus("SRT converted");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setSubtitleUrl(null);
        setSubtitleStatus("Subtitle failed to load");
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [subtitleEntry]);

  if (!selectedEntry || selectedEntry.kind !== "video") {
    return <div className="workspace-preview">{emptyMessage}</div>;
  }

  if (!isTauriRuntime()) {
    return (
      <div className="workspace-preview">
        <div>
          <strong>{selectedEntry.name}</strong>
          <div className="workspace-subtitle">{selectedEntry.relativePath}</div>
          <div className="workspace-subtitle">Desktop runtime required for local playback</div>
        </div>
      </div>
    );
  }

  const openInSystemPlayer = async () => {
    if (!courseRoot) {
      setOpenError("Open a course folder before using the system player");
      return;
    }

    try {
      setOpenError(null);
      await openLessonExternal(courseRoot, selectedEntry.absolutePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOpenError(`Failed to open system player: ${message}`);
    }
  };

  return (
    <div className="workspace-preview">
      <video
        key={selectedEntry.absolutePath}
        ref={videoRef}
        className="workspace-video"
        autoPlay={autoPlay}
        controls
        preload="metadata"
        src={videoUrl ?? undefined}
        playsInline
        onLoadedMetadata={(event) => {
          showSubtitleTracks(event.currentTarget);
          setVideoError(null);
          console.info("Video loaded metadata", {
            duration: event.currentTarget.duration,
            height: event.currentTarget.videoHeight,
            src: event.currentTarget.currentSrc || videoUrl || "",
            width: event.currentTarget.videoWidth,
          });
        }}
        onCanPlay={(event) => {
          setVideoError(null);
          console.info("Video can play", {
            src: event.currentTarget.currentSrc || videoUrl || "",
          });
        }}
        onError={(event) => {
          const errorDetails = describeVideoError(
            event.currentTarget.error,
            event.currentTarget.currentSrc || videoUrl || "",
            selectedEntry.absolutePath,
          );
          setVideoError(errorDetails);
          console.error("Video error", {
            code: event.currentTarget.error?.code,
            message: event.currentTarget.error?.message,
            path: selectedEntry.absolutePath,
            src: event.currentTarget.currentSrc || videoUrl || "",
          });
        }}
        onPlay={(event) => {
          lastWatchTimeRef.current = event.currentTarget.currentTime;
          onStudyActivityChange?.(!event.currentTarget.seeking);
        }}
        onPause={(event) => {
          onStudyActivityChange?.(false);
          captureWatchedTime(event.currentTarget.currentTime);
          flushWatchedTime(true);
          lastWatchTimeRef.current = null;
        }}
        onSeeking={() => {
          onStudyActivityChange?.(false);
          lastWatchTimeRef.current = null;
        }}
        onSeeked={(event) => {
          lastWatchTimeRef.current = event.currentTarget.currentTime;
          onStudyActivityChange?.(!event.currentTarget.paused && !event.currentTarget.ended);
        }}
        onWaiting={() => onStudyActivityChange?.(false)}
        onStalled={() => onStudyActivityChange?.(false)}
        onPlaying={(event) => onStudyActivityChange?.(
          !event.currentTarget.paused && !event.currentTarget.ended && !event.currentTarget.seeking,
        )}
        onTimeUpdate={(event) => {
          const currentTime = event.currentTarget.currentTime;
          onProgressChange(currentTime);
          if (event.currentTarget.seeking) {
            lastWatchTimeRef.current = null;
            return;
          }
          if (event.currentTarget.paused) {
            return;
          }
          captureWatchedTime(currentTime);
        }}
        onEnded={(event) => {
          onStudyActivityChange?.(false);
          captureWatchedTime(event.currentTarget.currentTime);
          flushWatchedTime(true);
          watchedRemainderRef.current = 0;
          lastWatchTimeRef.current = null;
          const completedSeconds =
            event.currentTarget.duration || event.currentTarget.currentTime || resumeTime;
          onProgressChange(completedSeconds);
          onEnded(completedSeconds);
        }}
      >
        {subtitleUrl ? (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default
            onLoad={(event) => {
              event.currentTarget.track.mode = "showing";
            }}
          />
        ) : null}
      </video>
      <button className="workspace-open-button" type="button" onClick={openInSystemPlayer}>
        <ExternalLink aria-hidden="true" />
        Open in system player
      </button>
      <div className="workspace-video-meta">
        <strong>{selectedEntry.name}</strong>
        <div className="workspace-subtitle">{selectedEntry.relativePath}</div>
        {videoError ? (
          <div className="workspace-subtitle">
            <div>Video failed to load</div>
            <div>Error: {videoError.summary}</div>
            <div>Source: {videoError.src}</div>
            <div>Path: {videoError.path}</div>
          </div>
        ) : null}
        {openError ? <div className="workspace-subtitle">{openError}</div> : null}
        <div className="workspace-subtitle">
          {subtitleEntry
            ? `Subtitle: ${subtitleEntry.name}${subtitleStatus ? ` (${subtitleStatus})` : ""}`
            : "Subtitle: none matched"}
        </div>
      </div>
    </div>
  );
}

function showSubtitleTracks(video: HTMLVideoElement) {
  for (const track of Array.from(video.textTracks)) {
    if (track.kind === "subtitles" || track.kind === "captions") {
      track.mode = "showing";
    }
  }
}

interface VideoErrorDetails {
  summary: string;
  src: string;
  path: string;
}

function describeVideoError(
  error: MediaError | null,
  src: string,
  path: string,
): VideoErrorDetails {
  const label =
    error?.code === 1
      ? "aborted"
      : error?.code === 2
        ? "network"
        : error?.code === 3
          ? "decode"
          : error?.code === 4
            ? "source not supported"
            : "unknown";
  const details = error?.message ? ` - ${error.message}` : "";

  return {
    path,
    src,
    summary: `code ${error?.code ?? "unknown"} ${label}${details}`,
  };
}
