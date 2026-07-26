import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyActivitySource } from "../lib/persistence";
import { isTauriRuntime } from "../lib/tauri";
import {
  createStudyActivityTracker,
  TERMINAL_IDLE_TIMEOUT_MS,
} from "./studyActivityTracker";

interface Options {
  courseRoot: string | null;
  lessonId: string | null;
  videoActive: boolean;
  terminalVisible: boolean;
  onRecord: (courseRoot: string, source: StudyActivitySource, seconds: number) => void;
}

export function useStudyActivityTracker(options: Options) {
  const recordRef = useRef(options.onRecord);
  recordRef.current = options.onRecord;
  const trackerRef = useRef<ReturnType<typeof createStudyActivityTracker> | null>(null);
  trackerRef.current ??= createStudyActivityTracker(
    () => performance.now(),
    (course, source, seconds) => recordRef.current(course, source, seconds),
  );
  const tracker = trackerRef.current;
  const [activeSource, setActiveSource] = useState<StudyActivitySource | null>(null);
  const idleTimer = useRef<number | null>(null);
  const focused = useRef(true);
  const syncState = useCallback(() => setActiveSource(tracker.activeSource()), [tracker]);

  useEffect(() => {
    tracker.setContext(options.courseRoot, document.visibilityState === "visible" && focused.current);
    syncState();
  }, [options.courseRoot, options.lessonId, syncState, tracker]);

  useEffect(() => { tracker.setVideoActive(options.videoActive); syncState(); }, [options.videoActive, syncState, tracker]);
  useEffect(() => {
    if (!options.terminalVisible) tracker.setTerminalActive(false);
    syncState();
  }, [options.terminalVisible, syncState, tracker]);

  useEffect(() => {
    const updateVisibility = () => {
      tracker.setEligible(document.visibilityState === "visible" && focused.current);
      syncState();
    };
    document.addEventListener("visibilitychange", updateVisibility);
    const interval = window.setInterval(() => { tracker.flush(); syncState(); }, 1000);
    let unlisten: (() => void) | undefined;
    if (isTauriRuntime()) {
      void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
        unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
          focused.current = payload;
          tracker.setEligible(payload && document.visibilityState === "visible");
          syncState();
        });
      }).catch(() => undefined);
    }
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.clearInterval(interval);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      unlisten?.();
      tracker.flush();
    };
  }, [syncState, tracker]);

  const stopTerminalActivity = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    tracker.setTerminalActive(false);
    syncState();
  }, [syncState, tracker]);

  const reportTerminalActivity = useCallback(() => {
    if (!options.terminalVisible) return;
    tracker.setTerminalActive(true);
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(stopTerminalActivity, TERMINAL_IDLE_TIMEOUT_MS);
    syncState();
  }, [options.terminalVisible, stopTerminalActivity, syncState, tracker]);

  return { activeSource, reportTerminalActivity, stopTerminalActivity, flush: tracker.flush };
}
