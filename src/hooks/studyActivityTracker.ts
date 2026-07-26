import type { StudyActivitySource } from "../lib/persistence";

export const TERMINAL_IDLE_TIMEOUT_MS = 60_000;
export const MAX_ACTIVITY_GAP_MS = 5_000;

export function createStudyActivityTracker(
  now: () => number = () => performance.now(),
  record: (courseRoot: string, source: StudyActivitySource, seconds: number) => void,
) {
  let last = now();
  let courseRoot: string | null = null;
  let eligible = false;
  let video = false;
  let terminal = false;
  const remainder = { video: 0, terminal: 0 };

  const settle = () => {
    const current = now();
    const elapsed = current - last;
    last = current;
    if (!courseRoot || !eligible || elapsed <= 0 || elapsed > MAX_ACTIVITY_GAP_MS) return;
    const source: StudyActivitySource | null = terminal ? "terminal" : video ? "video" : null;
    if (!source) return;
    remainder[source] += elapsed;
    const seconds = Math.floor(remainder[source] / 1000);
    if (seconds) {
      remainder[source] -= seconds * 1000;
      record(courseRoot, source, seconds);
    }
  };

  return {
    flush: settle,
    setContext(nextCourseRoot: string | null, nextEligible: boolean) {
      settle();
      if (courseRoot !== nextCourseRoot) remainder.video = remainder.terminal = 0;
      courseRoot = nextCourseRoot;
      eligible = nextEligible;
    },
    setEligible(value: boolean) { settle(); eligible = value; },
    setVideoActive(value: boolean) { settle(); video = value; },
    setTerminalActive(value: boolean) { settle(); terminal = value; },
    activeSource(): StudyActivitySource | null {
      return courseRoot && eligible ? terminal ? "terminal" : video ? "video" : null : null;
    },
  };
}

export type StudyActivityTracker = ReturnType<typeof createStudyActivityTracker>;
