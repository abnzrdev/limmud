import { useCallback, useEffect, useRef, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import type { MobileCourseService, PreparedMedia } from "../../../lib/mobileCourseService";
import { subtitleSourceForLesson } from "../../../lib/mobileMedia";
import { convertSrtToVtt } from "../../../lib/subtitleMatch";
import type { ProviderCourseEntry } from "../mobileCourseModel";
import type { MobileLesson } from "../mobileModel";
import { VidstackVideo } from "../../workspace/VidstackVideo";

function flatten(entries: ProviderCourseEntry[]): ProviderCourseEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])]);
}

export function MobilePlayer({ service, courseId, lesson, entries, initialTime = 0, onProgress, onEnded, onStudySeconds, onPrevious, onNext, canPrevious = false, canNext = false }: {
  service: MobileCourseService;
  courseId: string;
  lesson: MobileLesson;
  entries: ProviderCourseEntry[];
  initialTime?: number;
  onProgress?: (seconds: number) => void;
  onEnded?: (seconds: number) => void;
  onStudySeconds?: (seconds: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
}) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef(0);
  const checkpointRef = useRef(0);
  const lastMediaTimeRef = useRef<number | null>(null);
  const watchedSecondsRef = useRef(0);
  const previousActionRef = useRef(onPrevious);
  const nextActionRef = useRef(onNext);
  const pipActiveRef = useRef(false);
  const pipPlaybackIntentRef = useRef(false);
  const [source, setSource] = useState<PreparedMedia | null>(null);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [, setPipActive] = useState(false);
  previousActionRef.current = onPrevious;
  nextActionRef.current = onNext;

  const publishPlayback = useCallback((state: "idle" | "playing" | "paused" | "ended") => {
    const media = mediaRef.current;
    if (!media) return Promise.resolve({ audioFocusGranted: true });
    return service.updateAndroidPlayback({ state, positionSeconds: Number.isFinite(media.currentTime) ? media.currentTime : 0, durationSeconds: Number.isFinite(media.duration) ? media.duration : 0, canPrevious, canNext });
  }, [canNext, canPrevious, service]);

  useEffect(() => {
    const request = ++requestRef.current;
    let prepared: PreparedMedia | null = null;
    let objectUrl: string | null = null;
    setSource(null); setSubtitleUrl(null); setError(null); lastMediaTimeRef.current = null; watchedSecondsRef.current = 0;
    const subtitle = subtitleSourceForLesson(
      lesson.relativePath,
      flatten(entries).filter((entry) => entry.kind === "subtitle").map(({ id, relativePath }) => ({ id, relativePath })),
    );
    void service.prepareMedia(courseId, lesson.id).then(async (next) => {
      prepared = next;
      if (request !== requestRef.current) return service.releaseMedia(next.sourceId);
      setSource(next);
      if (!subtitle) return;
      const loaded = await service.readSubtitle(courseId, subtitle.id, request);
      if (request !== requestRef.current || loaded.generation !== request) return;
      const contents = loaded.format === "srt" ? convertSrtToVtt(loaded.contents) : loaded.contents;
      objectUrl = URL.createObjectURL(new Blob([contents], { type: "text/vtt" }));
      setSubtitleUrl(objectUrl);
    }).catch(() => { if (request === requestRef.current) setError("This lesson could not be prepared for playback."); });
    return () => {
      requestRef.current += 1;
      mediaRef.current?.pause();
      if (prepared) void service.releaseMedia(prepared.sourceId);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, entries, lesson.id, lesson.relativePath, service]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden && !pipActiveRef.current) mediaRef.current?.pause(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const onNativeAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      const media = mediaRef.current;
      if (action === "play") { pipPlaybackIntentRef.current = true; void media?.play(); }
      if (action === "pause") { pipPlaybackIntentRef.current = false; media?.pause(); }
      if (action === "next" && canNext) nextActionRef.current?.();
      if (action === "previous" && canPrevious) previousActionRef.current?.();
    };
    const onPip = (event: Event) => {
      const active = (event as CustomEvent<string>).detail === "active";
      pipActiveRef.current = active;
      setPipActive(active);
      document.documentElement.classList.toggle("limmud-native-pip", active);
      if (active && pipPlaybackIntentRef.current) void mediaRef.current?.play();
    };
    window.addEventListener("limmud:native-media-action", onNativeAction);
    window.addEventListener("limmud:native-pip", onPip);
    return () => {
      window.removeEventListener("limmud:native-media-action", onNativeAction);
      window.removeEventListener("limmud:native-pip", onPip);
      document.documentElement.classList.remove("limmud-native-pip");
      pipActiveRef.current = false;
      pipPlaybackIntentRef.current = false;
      void publishPlayback("idle");
    };
  }, [canNext, canPrevious, publishPlayback]);

  if (error) return <div className="m-media__state" role="alert">{error}</div>;
  if (!source) return <div className="m-media__state">Preparing lesson…</div>;
  return <><VidstackVideo
    mediaRef={mediaRef}
    sourceId={source.sourceId}
    title={lesson.name}
    className="m-mobile-video"
    src={source.url}
    initialTime={initialTime ?? 0}
    subtitleUrl={subtitleUrl}
    preload="metadata"
    playsInline
    onPlay={async (event) => {
      setPlaying(true);
      lastMediaTimeRef.current = event.currentTarget.currentTime;
      const result = await publishPlayback("playing");
      if (!result.audioFocusGranted) event.currentTarget.pause();
    }}
    onTimeUpdate={(event) => {
      const seconds = event.currentTarget.currentTime;
      const previous = lastMediaTimeRef.current;
      if (!event.currentTarget.paused && previous !== null) {
        const delta = seconds - previous;
        if (delta > 0 && delta <= 2) watchedSecondsRef.current += delta;
        if (watchedSecondsRef.current >= 10) {
          const watched = Math.floor(watchedSecondsRef.current);
          watchedSecondsRef.current -= watched;
          onStudySeconds?.(watched);
        }
      }
      lastMediaTimeRef.current = seconds;
      if (Math.abs(seconds - checkpointRef.current) >= 10) {
        checkpointRef.current = seconds;
        onProgress?.(seconds);
      }
    }}
    onPause={(event) => {
      setPlaying(false);
      if (document.documentElement.classList.contains("limmud-native-pip")) pipPlaybackIntentRef.current = false;
      checkpointRef.current = event.currentTarget.currentTime;
      onProgress?.(event.currentTarget.currentTime);
      const watched = Math.floor(watchedSecondsRef.current);
      if (watched > 0) { watchedSecondsRef.current -= watched; onStudySeconds?.(watched); }
      void publishPlayback("paused");
    }}
    onEnded={(event) => {
      setPlaying(false);
      const seconds = event.currentTarget.duration || event.currentTarget.currentTime;
      checkpointRef.current = seconds;
      onEnded?.(seconds);
      void publishPlayback("ended");
    }}
  /><button type="button" className="m-native-pip" aria-label="Enter Picture-in-Picture" disabled={!playing} onClick={() => {
    pipActiveRef.current = true;
    pipPlaybackIntentRef.current = true;
    setPipActive(true);
    void service.enterPictureInPicture().then((result) => { if (result.status !== "entered") { pipActiveRef.current = false; setPipActive(false); } });
  }}><PictureInPicture2 /></button></>;
}
