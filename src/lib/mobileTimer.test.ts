import { describe, expect, it } from "vitest";
import { pauseTimer, readTimer, resetTimer, startTimer, type MobileTimerState } from "./mobileTimer";

const idle: MobileTimerState = {
  mode: "focus",
  presetMinutes: 25,
  phase: "idle",
  accumulatedSeconds: 0,
  startedAtEpochMs: null,
};

describe("persistent mobile timer", () => {
  it("derives elapsed time from an authoritative timestamp rather than interval ticks", () => {
    const running = startTimer(idle, 1_000);
    expect(readTimer(running, 11_900)).toMatchObject({ elapsedSeconds: 10, remainingSeconds: 1_490, phase: "running" });
  });

  it("pauses and resumes without counting paused wall time", () => {
    const paused = pauseTimer(startTimer(idle, 1_000), 11_000);
    expect(paused).toMatchObject({ phase: "paused", accumulatedSeconds: 10, startedAtEpochMs: null });
    const resumed = startTimer(paused, 31_000);
    expect(readTimer(resumed, 36_000).elapsedSeconds).toBe(15);
  });

  it("restores a persisted running timer and completes at the preset boundary", () => {
    const running = startTimer({ ...idle, presetMinutes: 1 }, 1_000);
    expect(readTimer(JSON.parse(JSON.stringify(running)), 61_000)).toEqual({
      elapsedSeconds: 60,
      remainingSeconds: 0,
      phase: "completed",
    });
  });

  it("does not run backward or accept an implausible multi-day clock jump", () => {
    const running = startTimer(idle, 10_000);
    expect(readTimer(running, 5_000).elapsedSeconds).toBe(0);
    expect(readTimer(running, 10_000 + 8 * 86_400_000).elapsedSeconds).toBe(0);
  });

  it("resets to the selected preset and mode", () => {
    expect(resetTimer({ ...idle, phase: "paused", accumulatedSeconds: 99 }, "stopwatch", 50)).toEqual({
      mode: "stopwatch",
      presetMinutes: 50,
      phase: "idle",
      accumulatedSeconds: 0,
      startedAtEpochMs: null,
    });
  });
});
