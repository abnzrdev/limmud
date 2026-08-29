import { Clock3, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { notifyFocusSessionComplete } from "../../lib/notifications";

interface FocusTimerProps {
  timerMode: "focus" | "stopwatch";
  timerPreset: number;
  timerPresets: number[];
  onPickPreset: (minutes: number) => void;
  onToggleMode: () => void;
}

export function FocusTimer({
  timerMode,
  timerPreset,
  timerPresets,
  onPickPreset,
  onToggleMode,
}: FocusTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timerPreset * 60);
  const [customMinutes, setCustomMinutes] = useState(String(timerPreset));
  const [isComplete, setIsComplete] = useState(false);
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    setIsRunning(false);
    setRemainingSeconds(timerMode === "focus" ? timerPreset * 60 : 0);
    setCustomMinutes(String(timerPreset));
    setIsComplete(false);
    setCustomError("");
  }, [timerMode, timerPreset]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }
    playCompletionTone();
    void notifyFocusSessionComplete().catch(() => {});
  }, [isComplete]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (timerMode === "stopwatch") {
          return current + 1;
        }

        if (current <= 1) {
          setIsRunning(false);
          setIsComplete(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, timerMode]);

  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  const primaryLabel = isComplete ? "Complete" : isRunning ? "Pause" : "Start";

  return (
    <section className={`panel-section timer-panel${isComplete ? " timer-panel-complete" : ""}`}>
      <div className="panel-title-row">
        <h3 className="panel-title panel-title-icon">
          <Clock3 aria-hidden="true" />
          Focus Timer
        </h3>
        <button className="button-secondary" type="button" onClick={onToggleMode}>
          {timerMode === "focus" ? "Switch to Stopwatch" : "Switch to Focus"}
        </button>
      </div>
      <div className="timer-readout">{timerMode === "focus" ? `${minutes}:${seconds}` : `00:${minutes}:${seconds}`}</div>
      {isComplete ? <div className="timer-complete-message">Focus session complete</div> : null}
      <div className="timer-actions">
        <button
          className="button-primary"
          type="button"
          disabled={isComplete}
          onClick={() => setIsRunning((current) => !current)}
        >
          {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {primaryLabel}
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={() => {
            setIsRunning(false);
            setRemainingSeconds(timerMode === "focus" ? timerPreset * 60 : 0);
            setIsComplete(false);
          }}
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </button>
      </div>
      <div className="preset-row">
        {timerPresets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={timerPreset === minutes && timerMode === "focus" ? "is-active" : ""}
            onClick={() => onPickPreset(minutes)}
          >
            {minutes}m
          </button>
        ))}
      </div>
      <div className="custom-timer-row">
        <input
          className="timer-input"
          inputMode="numeric"
          value={customMinutes}
          onChange={(event) => {
            setCustomMinutes(event.target.value);
            setCustomError("");
          }}
          placeholder="Custom minutes"
          aria-invalid={Boolean(customError)}
        />
        <button
          type="button"
          onClick={() => {
            const parsed = Number(customMinutes);
            if (Number.isFinite(parsed) && parsed > 0) {
              onPickPreset(Math.floor(parsed));
              setCustomError("");
              return;
            }
            setCustomError("Enter minutes above 0.");
          }}
        >
          Custom
        </button>
      </div>
      {customError ? <div className="timer-validation">{customError}</div> : null}
    </section>
  );
}

function playCompletionTone() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const audio = new AudioContextCtor();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.45);
  window.setTimeout(() => void audio.close(), 500);
}
