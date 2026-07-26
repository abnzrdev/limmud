// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudyActivityTracker } from "./useStudyActivityTracker";

describe("useStudyActivityTracker", () => {
  beforeEach(() => vi.useFakeTimers());

  it("starts terminal activity on input, refreshes idle, and stops after 60 seconds", () => {
    const record = vi.fn();
    const { result } = renderHook(() => useStudyActivityTracker({
      courseRoot: "/course",
      lessonId: "lesson.mp4",
      videoActive: false,
      terminalVisible: true,
      onRecord: record,
    }));
    act(() => result.current.reportTerminalActivity());
    expect(result.current.activeSource).toBe("terminal");
    act(() => vi.advanceTimersByTime(30_000));
    act(() => result.current.reportTerminalActivity());
    act(() => vi.advanceTimersByTime(59_000));
    expect(result.current.activeSource).toBe("terminal");
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.activeSource).toBe(null);
  });
});
