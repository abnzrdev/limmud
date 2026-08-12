export type MobileTimerPhase = "idle" | "running" | "paused" | "completed";

export interface MobileTimerState {
  mode: "focus" | "stopwatch";
  presetMinutes: number;
  phase: MobileTimerPhase;
  accumulatedSeconds: number;
  startedAtEpochMs: number | null;
}

export interface MobileTimerReading {
  elapsedSeconds: number;
  remainingSeconds: number;
  phase: MobileTimerPhase;
}

const MAX_RESTORE_GAP_MS = 7 * 86_400_000;

export function startTimer(state: MobileTimerState, now: number): MobileTimerState {
  if (state.phase === "running" || state.phase === "completed") return state;
  return { ...state, phase: "running", startedAtEpochMs: now };
}

export function pauseTimer(state: MobileTimerState, now: number): MobileTimerState {
  if (state.phase !== "running") return state;
  const reading = readTimer(state, now);
  return {
    ...state,
    phase: reading.phase === "completed" ? "completed" : "paused",
    accumulatedSeconds: reading.elapsedSeconds,
    startedAtEpochMs: null,
  };
}

export function resetTimer(
  _state: MobileTimerState,
  mode: MobileTimerState["mode"],
  presetMinutes: number,
): MobileTimerState {
  return { mode, presetMinutes, phase: "idle", accumulatedSeconds: 0, startedAtEpochMs: null };
}

export function readTimer(state: MobileTimerState, now: number): MobileTimerReading {
  let elapsedSeconds = Math.max(0, Math.floor(state.accumulatedSeconds));
  if (state.phase === "running" && state.startedAtEpochMs !== null) {
    const gap = now - state.startedAtEpochMs;
    if (gap >= 0 && gap <= MAX_RESTORE_GAP_MS) elapsedSeconds += Math.floor(gap / 1_000);
  }
  if (state.mode === "stopwatch") return { elapsedSeconds, remainingSeconds: 0, phase: state.phase };
  const duration = Math.max(1, Math.floor(state.presetMinutes)) * 60;
  if (elapsedSeconds >= duration) return { elapsedSeconds: duration, remainingSeconds: 0, phase: "completed" };
  return { elapsedSeconds, remainingSeconds: duration - elapsedSeconds, phase: state.phase };
}
