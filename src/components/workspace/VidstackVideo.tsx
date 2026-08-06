import {
  canUsePictureInPicture,
  isVideoProvider,
  MediaPlayer,
  MediaProvider,
  PIPButton,
  PictureInPictureExitIcon,
  PictureInPictureIcon,
  Track,
  type MediaPlayerInstance,
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
  useRef,
  useState,
  type MutableRefObject,
  type SyntheticEvent,
} from "react";

type VideoHandler = (
  event: SyntheticEvent<HTMLVideoElement>,
) => void;

interface VidstackVideoProps {
  mediaRef: MutableRefObject<HTMLVideoElement | null>;
  sourceId?: string;
  title: string;
  className?: string;
  src?: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  playsInline?: boolean;
  initialTime: number;
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
  onPlaybackRequestError?: (errorCode: string) => void;
  onDiagnostic?: (event: string, errorCode?: string) => void;
}

export function VidstackVideo({
  mediaRef,
  sourceId,
  title,
  className,
  src,
  autoPlay = false,
  preload = "metadata",
  playsInline = true,
  initialTime,
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
  onPlaybackRequestError,
  onDiagnostic,
}: VidstackVideoProps) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const resumedSourceRef = useRef<string | null>(null);
  const autoplaySourceRef = useRef<string | null>(null);
  const [canPictureInPicture, setCanPictureInPicture] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [pictureInPictureError, setPictureInPictureError] = useState<string | null>(null);

  const applyInitialTime = () => {
    const video = mediaRef.current;
    if (!video || !sourceId || resumedSourceRef.current === sourceId) {
      return;
    }

    resumedSourceRef.current = sourceId;
    if (initialTime > 0 && Math.abs(video.currentTime - initialTime) > 1) {
      video.currentTime = initialTime;
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

  const updatePictureInPictureSupport = () => {
    setCanPictureInPicture(canUsePictureInPicture(mediaRef.current));
  };

  const handleProviderSetup = (
    provider: MediaProviderAdapter,
  ) => {
    if (!isVideoProvider(provider)) {
      return;
    }

    mediaRef.current = provider.video;
    updatePictureInPictureSupport();
  };

  const requestAutoPlay = () => {
    if (!autoPlay || !sourceId || autoplaySourceRef.current === sourceId) {
      return;
    }

    autoplaySourceRef.current = sourceId;
    const request = playerRef.current?.play() ?? mediaRef.current?.play();
    void request?.catch((error: unknown) => {
      onPlaybackRequestError?.(errorCode(error));
    });
  };

  const toggleTestPictureInPicture = async () => {
    try {
      setPictureInPictureError(null);
      if (pictureInPicture) {
        await document.exitPictureInPicture();
        setPictureInPicture(false);
        onDiagnostic?.("picture-in-picture-exit");
      } else {
        await mediaRef.current?.requestPictureInPicture();
        setPictureInPicture(true);
        onDiagnostic?.("picture-in-picture-enter");
      }
    } catch (error) {
      onDiagnostic?.("picture-in-picture-error", errorCode(error));
      setPictureInPictureError(
        `Picture-in-Picture could not be ${pictureInPicture ? "closed" : "opened"} (${errorCode(error)}).`,
      );
    }
  };

  useEffect(() => {
    if (!sourceId) {
      setPictureInPictureError(null);
    }
  }, [sourceId]);

  useEffect(() => {
    updatePictureInPictureSupport();
  }, [src]);

  useEffect(
    () => () => {
      mediaRef.current = null;
      playerRef.current = null;
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
          preload={preload}
          playsInline={playsInline}
          onLoadedMetadata={(event) => {
            applyInitialTime();
            onLoadedMetadata?.(event);
          }}
          onCanPlay={(event) => {
            onCanPlay?.(event);
            requestAutoPlay();
          }}
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
        {canPictureInPicture ? (
          <button type="button" onClick={() => void toggleTestPictureInPicture()}>
            {pictureInPicture ? "Exit" : "Enter"} Picture-in-Picture
          </button>
        ) : null}
        {pictureInPictureError ? <div role="alert">{pictureInPictureError}</div> : null}
      </div>
    );
  }

  return (
    <>
      <MediaPlayer
        ref={playerRef}
        className={`${className ?? ""} workspace-video-player`.trim()}
        title={title}
        src={src}
        autoPlay={false}
        preload={preload}
        playsInline={playsInline}
        viewType="video"
        streamType="on-demand"
        onProviderSetup={handleProviderSetup}
        onLoadedMetadata={() => {
          applyInitialTime();
          emit("loadedmetadata", onLoadedMetadata);
        }}
        onCanPlay={() => {
          emit("canplay", onCanPlay);
          requestAutoPlay();
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
        }}
        onStalled={() => {
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
        onPictureInPictureChange={(active) => {
          setPictureInPicture(active);
          setPictureInPictureError(null);
          onDiagnostic?.(active ? "picture-in-picture-enter" : "picture-in-picture-exit");
        }}
        onPictureInPictureError={(error) => {
          onDiagnostic?.("picture-in-picture-error", errorCode(error));
          setPictureInPictureError(
            `Picture-in-Picture request failed (${errorCode(error)}).`,
          );
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
          slots={{
            pipButton: canPictureInPicture ? (
              <PIPButton
                className="vds-button"
                aria-label={`${pictureInPicture ? "Exit" : "Enter"} Picture-in-Picture`}
              >
                {pictureInPicture
                  ? <PictureInPictureExitIcon className="vds-icon" />
                  : <PictureInPictureIcon className="vds-icon" />}
              </PIPButton>
            ) : null,
          }}
        />
      </MediaPlayer>
      {pictureInPictureError ? (
        <div className="workspace-playback-error" role="alert">{pictureInPictureError}</div>
      ) : null}
    </>
  );
}

function errorCode(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name || "Error";
  }
  return "unknown";
}
