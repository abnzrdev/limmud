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

import { VidstackVideo } from "./VidstackVideo";
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
  const sourceRequestRef = useRef(0);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleStatus, setSubtitleStatus] = useState<string | null>(null);
  const [videoSource, setVideoSource] = useState<LessonMediaSource | null>(null);
  const [videoError, setVideoError] = useState<VideoErrorDetails | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
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
    lastWatchTimeRef.current = null;
    if (!selectedEntry || selectedEntry.kind !== "video") {
      sourceRequestRef.current += 1;
      setVideoSource(null);
      setSubtitleUrl(null);
      setSubtitleStatus(null);
      return;
    }

    const requestId = sourceRequestRef.current + 1;
    sourceRequestRef.current = requestId;
    let active = true;
    const watchedElement = videoRef.current;
    const lessonId = selectedEntry.relativePath;
    const initialTime = resumeTime;
    const shouldAutoPlay = autoPlay;
    recordMediaEvent("source-request", watchedElement, lessonId);
    setVideoError(null);
    setPlaybackError(null);
    setOpenError(null);
    setVideoSource(null);
    onStudyActivityChange?.(false);

    const loadUrl = courseRoot && isTauriRuntime()
      ? courseMediaUrl(courseRoot, selectedEntry.absolutePath)
      : Promise.resolve(toMediaUrl(selectedEntry.absolutePath));

    void loadUrl
      .then((url) => {
        if (!active || sourceRequestRef.current !== requestId) {
          return;
        }
        setVideoSource({
          autoPlay: shouldAutoPlay,
          initialTime,
          lessonId,
          url,
        });
        recordMediaEvent("source-activate", videoRef.current, lessonId);
      })
      .catch((error: unknown) => {
        if (!active || sourceRequestRef.current !== requestId) {
          return;
        }
        setVideoError({
          code: safeErrorCode(error),
          summary: "Media URL request failed",
        });
        recordMediaEvent("source-error", videoRef.current, lessonId, safeErrorCode(error));
      });

    return () => {
      active = false;
      sourceRequestRef.current += 1;
      onStudyActivityChange?.(false);
      if (watchedElement && lastWatchTimeRef.current !== null) {
        captureWatchedTime(watchedElement.currentTime);
      }
      flushWatchedTime(true);
      watchedRemainderRef.current = 0;
      lastWatchTimeRef.current = null;
    };
  }, [autoPlay, courseRoot, selectedEntry?.absolutePath, selectedEntry?.kind, selectedEntry?.relativePath]);

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

  const activeSource = videoSource?.lessonId === selectedEntry.relativePath
    ? videoSource
    : null;

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
      <VidstackVideo
        mediaRef={videoRef}
        sourceId={activeSource?.lessonId}
        className="workspace-video"
        autoPlay={activeSource?.autoPlay ?? false}
        preload="metadata"
        src={activeSource?.url}
        playsInline
        onLoadedMetadata={(event) => {
          showSubtitleTracks(event.currentTarget);
          setVideoError(null);
          recordMediaEvent("loadedmetadata", event.currentTarget, activeSource?.lessonId);
        }}
        onCanPlay={(event) => {
          setVideoError(null);
          recordMediaEvent("canplay", event.currentTarget, activeSource?.lessonId);
        }}
        onError={(event) => {
          const errorDetails = describeVideoError(event.currentTarget.error);
          setVideoError(errorDetails);
          recordMediaEvent(
            "error",
            event.currentTarget,
            activeSource?.lessonId,
            errorDetails.code,
          );
        }}
        onPlay={(event) => {
          recordMediaEvent("play", event.currentTarget, activeSource?.lessonId);
          lastWatchTimeRef.current = event.currentTarget.currentTime;
          onStudyActivityChange?.(!event.currentTarget.seeking);
        }}
        onPause={(event) => {
          recordMediaEvent("pause", event.currentTarget, activeSource?.lessonId);
          onStudyActivityChange?.(false);
          captureWatchedTime(event.currentTarget.currentTime);
          flushWatchedTime(true);
          lastWatchTimeRef.current = null;
        }}
        onSeeking={(event) => {
          recordMediaEvent("seeking", event.currentTarget, activeSource?.lessonId);
          onStudyActivityChange?.(false);
          lastWatchTimeRef.current = null;
        }}
        onSeeked={(event) => {
          recordMediaEvent("seeked", event.currentTarget, activeSource?.lessonId);
          lastWatchTimeRef.current = event.currentTarget.currentTime;
          onStudyActivityChange?.(!event.currentTarget.paused && !event.currentTarget.ended);
        }}
        onWaiting={(event) => {
          recordMediaEvent("waiting", event.currentTarget, activeSource?.lessonId);
          onStudyActivityChange?.(false);
        }}
        onStalled={(event) => {
          recordMediaEvent("stalled", event.currentTarget, activeSource?.lessonId);
          onStudyActivityChange?.(false);
        }}
        onPlaying={(event) => {
          setPlaybackError(null);
          recordMediaEvent("playing", event.currentTarget, activeSource?.lessonId);
          onStudyActivityChange?.(
            !event.currentTarget.paused && !event.currentTarget.ended && !event.currentTarget.seeking,
          );
        }}
        onTimeUpdate={(event) => {
          if (!activeSource) {
            return;
          }
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
          if (!activeSource) {
            return;
          }
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
        onPlaybackRequestError={(errorCode) => {
          setPlaybackError("Playback did not start automatically. Press play to continue.");
          recordMediaEvent("play-fail", videoRef.current, activeSource?.lessonId, errorCode);
        }}
        onDiagnostic={(event, errorCode) => {
          recordMediaEvent(event, videoRef.current, activeSource?.lessonId, errorCode);
        }}
        title={selectedEntry.name}
        initialTime={activeSource?.initialTime ?? 0}
        subtitleUrl={subtitleUrl}
      />
      {playbackError ? (
        <div className="workspace-playback-error" role="alert">{playbackError}</div>
      ) : null}
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
  code: string;
  summary: string;
}

interface LessonMediaSource {
  autoPlay: boolean;
  initialTime: number;
  lessonId: string;
  url: string;
}

function describeVideoError(error: MediaError | null): VideoErrorDetails {
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
  return {
    code: String(error?.code ?? "unknown"),
    summary: `code ${error?.code ?? "unknown"} ${label}`,
  };
}

function safeErrorCode(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name || "Error";
  }
  return "unknown";
}

function recordMediaEvent(
  event: string,
  media: HTMLVideoElement | null,
  lessonId?: string,
  errorCode?: string,
) {
  console.info("media-event", {
    errorCode,
    event,
    lessonId: lessonId ?? null,
    state: media
      ? {
          ended: media.ended,
          paused: media.paused,
          readyState: media.readyState,
          seeking: media.seeking,
        }
      : null,
  });
}
