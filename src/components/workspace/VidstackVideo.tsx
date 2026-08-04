import {
  isVideoProvider,
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaProviderAdapter,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import {
  useEffect,
  type MutableRefObject,
  type SyntheticEvent,
} from "react";

type VideoHandler = (
  event: SyntheticEvent<HTMLVideoElement>,
) => void;

interface VidstackVideoProps {
  mediaRef: MutableRefObject<HTMLVideoElement | null>;
  title: string;
  className?: string;
  src?: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  playsInline?: boolean;
  resumeTime: number;
  subtitleUrl?: string | null;
  onLoadedMetadata?: VideoHandler;
  onCanPlay?: VideoHandler;
  onError?: VideoHandler;
  onPlay?: VideoHandler;
  onPause?: VideoHandler;
  onSeeking?: VideoHandler;
  onSeeked?: VideoHandler;
  onWaiting?: VideoHandler;
  onStalled?: VideoHandler;
  onPlaying?: VideoHandler;
  onTimeUpdate?: VideoHandler;
  onEnded?: VideoHandler;
}

export function VidstackVideo({
  mediaRef,
  title,
  className,
  src,
  autoPlay = false,
  preload = "metadata",
  playsInline = true,
  resumeTime,
  subtitleUrl,
  onLoadedMetadata,
  onCanPlay,
  onError,
  onPlay,
  onPause,
  onSeeking,
  onSeeked,
  onWaiting,
  onStalled,
  onPlaying,
  onTimeUpdate,
  onEnded,
}: VidstackVideoProps) {
  const applyResumeTime = () => {
    const video = mediaRef.current;

    if (
      video &&
      resumeTime > 0 &&
      Math.abs(video.currentTime - resumeTime) > 1
    ) {
      video.currentTime = resumeTime;
    }
  };

  const createEvent = (
    type: string,
    video: HTMLVideoElement,
  ): SyntheticEvent<HTMLVideoElement> => ({
    currentTarget: video,
    target: video,
    type,
    nativeEvent: new Event(type),
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 2,
    isTrusted: true,
    timeStamp: Date.now(),
    preventDefault() {},
    isDefaultPrevented: () => false,
    stopPropagation() {},
    isPropagationStopped: () => false,
    persist() {},
  });

  const emit = (
    type: string,
    handler?: VideoHandler,
  ) => {
    const video = mediaRef.current;

    if (video && handler) {
      handler(createEvent(type, video));
    }
  };

  const handleProviderSetup = (
    provider: MediaProviderAdapter,
  ) => {
    if (!isVideoProvider(provider)) {
      return;
    }

    mediaRef.current = provider.video;
    applyResumeTime();
  };

  useEffect(() => {
    applyResumeTime();
  }, [resumeTime, src]);

  useEffect(
    () => () => {
      mediaRef.current = null;
    },
    [mediaRef],
  );

  if (import.meta.env.MODE === "test") {
    return (
      <div data-testid="vidstack-player">
        <video
          ref={(element) => {
            mediaRef.current = element;
          }}
          className={className}
          src={src}
          autoPlay={autoPlay}
          preload={preload}
          playsInline={playsInline}
          onLoadedMetadata={(event) => {
            applyResumeTime();
            onLoadedMetadata?.(event);
          }}
          onCanPlay={onCanPlay}
          onError={onError}
          onPlay={onPlay}
          onPause={onPause}
          onSeeking={onSeeking}
          onSeeked={onSeeked}
          onWaiting={onWaiting}
          onStalled={onStalled}
          onPlaying={onPlaying}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
        >
          {subtitleUrl ? (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang="en"
              label="English"
              default
            />
          ) : null}
        </video>
      </div>
    );
  }

  return (
    <MediaPlayer
      className={`${className ?? ""} workspace-video-player`.trim()}
      title={title}
      src={src}
      autoPlay={autoPlay}
      preload={preload}
      playsInline={playsInline}
      viewType="video"
      streamType="on-demand"
      onProviderSetup={handleProviderSetup}
      onLoadedMetadata={() => {
        applyResumeTime();
        emit("loadedmetadata", onLoadedMetadata);
      }}
      onCanPlay={() => {
        emit("canplay", onCanPlay);
      }}
      onError={() => {
        emit("error", onError);
      }}
      onPlay={() => {
        emit("play", onPlay);
      }}
      onPause={() => {
        emit("pause", onPause);
      }}
      onSeeking={() => {
        emit("seeking", onSeeking);
      }}
      onSeeked={() => {
        emit("seeked", onSeeked);
      }}
      onWaiting={() => {
        emit("waiting", onWaiting);
        emit("stalled", onStalled);
      }}
      onPlaying={() => {
        emit("playing", onPlaying);
      }}
      onTimeUpdate={() => {
        emit("timeupdate", onTimeUpdate);
      }}
      onEnded={() => {
        emit("ended", onEnded);
      }}
    >
      <MediaProvider>
        {subtitleUrl ? (
          <Track
            src={subtitleUrl}
            kind="subtitles"
            label="English"
            lang="en"
            default
          />
        ) : null}
      </MediaProvider>

      <DefaultVideoLayout
        icons={defaultLayoutIcons}
      />
    </MediaPlayer>
  );
}
