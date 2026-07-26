import { describe, expect, it, vi } from "vitest";
import { createStudyActivityTracker } from "./studyActivityTracker";

describe("study activity tracker", () => {
  it("attributes elapsed time once with terminal priority and keeps fractions", () => {
    let now = 0;
    const record = vi.fn();
    const tracker = createStudyActivityTracker(() => now, record);
    tracker.setContext("course-a", true);
    tracker.setVideoActive(true);
    now = 1500;
    tracker.setTerminalActive(true);
    now = 3250;
    tracker.flush();

    expect(record.mock.calls).toEqual([
      ["course-a", "video", 1],
      ["course-a", "terminal", 1],
    ]);
    now = 3500;
    tracker.setTerminalActive(false);
    now = 4000;
    tracker.flush();
    expect(record).toHaveBeenLastCalledWith("course-a", "video", 1);
  });

  it("records nothing while hidden and discards sleep gaps", () => {
    let now = 0;
    const record = vi.fn();
    const tracker = createStudyActivityTracker(() => now, record);
    tracker.setContext("course-a", true);
    tracker.setVideoActive(true);
    now = 900;
    tracker.setEligible(false);
    now = 5900;
    tracker.setEligible(true);
    now = 400_000;
    tracker.flush();
    expect(record).not.toHaveBeenCalled();
  });

  it("flushes the old course before switching", () => {
    let now = 0;
    const record = vi.fn();
    const tracker = createStudyActivityTracker(() => now, record);
    tracker.setContext("course-a", true);
    tracker.setVideoActive(true);
    now = 1200;
    tracker.setContext("course-b", true);
    expect(record).toHaveBeenCalledWith("course-a", "video", 1);
  });
});
