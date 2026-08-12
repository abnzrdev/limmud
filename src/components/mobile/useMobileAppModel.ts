import { useEffect, useMemo, useRef, useState } from "react";
import type { LessonNoteSnapshot, MobileCourseService } from "../../lib/mobileCourseService";
import {
  applyPortableMutation,
  parsePortableCourseState,
  reconcilePortableState,
  serializePortableCourseState,
  type PortableCourseState,
  type PortableMutation,
} from "../../lib/mobileCourseState";
import { pauseTimer, readTimer, resetTimer, startTimer, type MobileTimerState } from "../../lib/mobileTimer";
import type { DictionaryEntry } from "../../types/dictionary";
import { createTodoItem } from "../../lib/persistence";
import {
  mobileLessons,
  mobileSections,
  reconcileLessonSelection,
  type MobileCourseRecord,
} from "./mobileCourseModel";
import { sectionForMobileLesson, type MobileDestination, type MobileTool } from "./mobileModel";

function viewFromState(state: unknown): MobileDestination {
  if (state && typeof state === "object") {
    const value = (state as Record<string, unknown>).limmudMobileView;
    if (["home", "course", "study", "notes", "tools"].includes(String(value))) return value as MobileDestination;
  }
  return "home";
}

export function useMobileAppModel(service: MobileCourseService) {
  const [destination, setDestination] = useState<MobileDestination>(() => viewFromState(window.history.state));
  const [course, setCourse] = useState<MobileCourseRecord | null>(null);
  const [status, setStatus] = useState<"restoring" | "empty" | "ready" | "error">("restoring");
  const [safeError, setSafeError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set<string>());
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSnapshots, setNoteSnapshots] = useState<Record<string, LessonNoteSnapshot>>({});
  const [noteStatus, setNoteStatus] = useState<"loading" | "ready" | "saving" | "saved" | "conflict" | "failed">("loading");
  const [zen, setZen] = useState(false);
  const [tool, setTool] = useState<MobileTool>("timer");
  const [timer, setTimer] = useState<MobileTimerState>({ mode: "focus", presetMinutes: 25, phase: "idle", accumulatedSeconds: 0, startedAtEpochMs: null });
  const [timerHydratedCourseId, setTimerHydratedCourseId] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [courseState, setCourseState] = useState<PortableCourseState | null>(null);
  const [stateStorage, setStateStorage] = useState<"portable" | "localOnly">("portable");
  const stateRef = useRef<PortableCourseState | null>(null);
  const revisionRef = useRef({ state: null, progress: null, todos: null, vocabulary: null } as Record<"state" | "progress" | "todos" | "vocabulary", string | null>);
  const stateWriteQueue = useRef(Promise.resolve());
  const pendingStateMutations = useRef<Array<[PortableMutation, "state" | "progress" | "todos" | "vocabulary"]>>([]);

  const installCourse = (next: MobileCourseRecord) => {
    setCourse(next);
    setSelectedLessonId((current) => reconcileLessonSelection(current, next));
    setExpandedSections((current) => {
      const ids = new Set(mobileSections(next).map((section) => section.id));
      const surviving = new Set([...current].filter((id) => ids.has(id)));
      return surviving.size ? surviving : ids;
    });
    setStatus("ready");
    setSafeError(null);
  };

  useEffect(() => {
    if (!course || course.access !== "available") {
      stateRef.current = null;
      setCourseState(null);
      return;
    }
    let active = true;
    let loading = false;
    const loadState = () => {
      if (loading) return;
      loading = true;
      service.loadCourseState(course.courseId).then((snapshot) => {
        if (!active) return;
        const parsed = parsePortableCourseState(snapshot.files);
        stateRef.current = parsed;
        revisionRef.current = { ...snapshot.revisions };
        setCourseState(parsed);
        setStateStorage(snapshot.storage);
        if (parsed.value.selectedEntryId) {
          const restored = mobileLessons(course).find((item) => item.relativePath.toLowerCase() === parsed.value.selectedEntryId);
          if (restored) setSelectedLessonId(restored.id);
        }
        const pending = pendingStateMutations.current.splice(0);
        for (const [mutation, file] of pending) persistMutation(mutation, file);
      }).catch(() => {
        if (active) setSafeError("Limmud could not load this course’s study state.");
      }).finally(() => { loading = false; });
    };
    const onVisibility = () => { if (document.visibilityState === "visible" && pendingStateMutations.current.length === 0) loadState(); };
    loadState();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisibility); };
  }, [course?.courseId, course?.access, service]);

  useEffect(() => {
    if (!course || !courseState) return;
    const fallback = resetTimer(timer, courseState.value.timerMode, courseState.value.timerPreset);
    try {
      const stored = localStorage.getItem(`limmud.mobile.timer.${course.courseId}`);
      if (!stored) { setTimer(fallback); setTimerHydratedCourseId(course.courseId); return; }
      const value = JSON.parse(stored) as MobileTimerState;
      if (!value || !["focus", "stopwatch"].includes(value.mode)
        || !["idle", "running", "paused", "completed"].includes(value.phase)
        || typeof value.presetMinutes !== "number" || typeof value.accumulatedSeconds !== "number"
        || !(value.startedAtEpochMs === null || typeof value.startedAtEpochMs === "number")) {
        setTimer(fallback);
      } else setTimer(value);
      setTimerHydratedCourseId(course.courseId);
    } catch { setTimer(fallback); setTimerHydratedCourseId(course.courseId); }
  }, [course?.courseId, courseState?.revision]);

  useEffect(() => {
    if (!course || timerHydratedCourseId !== course.courseId) return;
    localStorage.setItem(`limmud.mobile.timer.${course.courseId}`, JSON.stringify(timer));
  }, [course?.courseId, timer, timerHydratedCourseId]);

  useEffect(() => {
    if (timer.phase !== "running") return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [timer.phase]);

  useEffect(() => {
    let mounted = true;
    service.restoreCourses().then((courses) => {
      if (!mounted) return;
      if (courses[0]) installCourse(courses[0]);
      else setStatus("empty");
    }).catch(() => { if (mounted) { setSafeError("Limmud could not restore course access."); setStatus("error"); } });
    return () => { mounted = false; };
  }, [service]);

  useEffect(() => {
    if (!window.history.state?.limmudMobileView) window.history.replaceState({ limmudMobileView: destination }, "", window.location.href);
    const onPopState = (event: PopStateEvent) => { setNoteEditing(false); setZen(false); setDestination(viewFromState(event.state)); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const baseLessons = course ? mobileLessons(course) : [];
  const completed = new Set(courseState?.value.completedLessons ?? []);
  const bookmarked = new Set(courseState?.value.bookmarkedLessons ?? []);
  const lessons = baseLessons.map((item) => ({
    ...item,
    completed: completed.has(item.relativePath),
    bookmarked: bookmarked.has(item.relativePath),
  }));
  const lessonStateById = new Map(lessons.map((item) => [item.id, item]));
  const sections = (course ? mobileSections(course) : []).map((item) => ({
    ...item,
    children: item.children.map((child) => lessonStateById.get(child.id) ?? child),
  }));
  const selectedIndex = lessons.findIndex((item) => item.id === selectedLessonId);
  const lesson = lessons[selectedIndex] ?? null;
  const section = lesson ? sectionForMobileLesson(sections, lesson.id) : null;

  useEffect(() => {
    if (!course || !lesson) return;
    let active = true;
    setNoteStatus("loading");
    service.loadLessonNote(course.courseId, lesson.id).then((snapshot) => {
      if (!active) return;
      setNoteSnapshots((current) => ({ ...current, [lesson.id]: snapshot }));
      setNoteDrafts((current) => lesson.id in current ? current : { ...current, [lesson.id]: snapshot.draft ?? snapshot.contents });
      setNoteDirty(snapshot.draft !== undefined);
      setNoteStatus("ready");
    }).catch(() => { if (active) setNoteStatus("failed"); });
    return () => { active = false; };
  }, [course?.courseId, lesson?.id, service]);

  useEffect(() => {
    if (!course || !lesson || !noteDirty) return;
    const timeout = window.setTimeout(() => {
      void service.saveLessonDraft(course.courseId, lesson.id, noteDrafts[lesson.id] ?? "", noteSnapshots[lesson.id]?.checksum ?? null);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [course?.courseId, lesson?.id, noteDirty, noteDrafts, noteSnapshots, service]);

  const navigate = (next: MobileDestination) => {
    if (next === destination || next !== "home" && !lesson) return;
    window.history.pushState({ limmudMobileView: next }, "", window.location.href);
    setNoteEditing(false); setZen(false); setDestination(next);
  };
  const selectLesson = (id: string) => {
    setSelectedLessonId(id);
    const selected = lessons.find((item) => item.id === id);
    if (selected) persistMutation({ type: "setSelectedEntry", entryId: selected.relativePath.toLowerCase() }, "progress");
    window.history.pushState({ limmudMobileView: "study", lessonId: id }, "", window.location.href);
    setDestination("study");
  };
  const pickCourse = async () => {
    try { const outcome = await service.pickCourse(); if (outcome.status === "selected") installCourse(outcome.course); }
    catch { setSafeError("Limmud could not open the course folder picker."); setStatus("error"); }
  };
  const relinkCourse = async () => {
    if (!course) return;
    try { const outcome = await service.relinkCourse(course.courseId); if (outcome.status === "selected") installCourse(outcome.course); }
    catch { setSafeError("Limmud could not relink this course."); }
  };
  const saveNote = async () => {
    if (!course || !lesson) return;
    setNoteStatus("saving");
    const snapshot = noteSnapshots[lesson.id];
    const result = await service.saveLessonNote(course.courseId, lesson.id, noteDrafts[lesson.id] ?? "", snapshot?.checksum ?? null).catch(() => ({ status: "failed" as const }));
    if (result.status === "saved") {
      setNoteSnapshots((current) => ({ ...current, [lesson.id]: { ...(current[lesson.id] ?? { status: "editable", contents: "", canCreate: true, canWrite: true }), contents: noteDrafts[lesson.id] ?? "", checksum: result.checksum } }));
      setNoteDirty(false); setNoteEditing(false); setNoteStatus("saved");
    } else if (result.status === "writeAccessRequired") {
      setNoteStatus("ready");
      await enableNoteEditing();
    } else setNoteStatus(result.status === "conflict" ? "conflict" : "failed");
  };
  const enableNoteEditing = async () => {
    if (!course) return;
    const outcome = await service.upgradeCourseAccess(course.courseId);
    if (outcome.status === "selected") installCourse(outcome.course);
  };
  const enableCourseSaving = async () => {
    if (!course || !service.loadCourseStateSources || !service.clearLocalCourseState) return;
    try {
      const outcome = await service.upgradeCourseAccess(course.courseId);
      if (outcome.status !== "selected") return;
      const sources = await service.loadCourseStateSources(course.courseId);
      if (!sources.local) { installCourse(outcome.course); return; }
      const merged = reconcilePortableState(parsePortableCourseState(sources.portable.files), parsePortableCourseState(sources.local.files));
      const files = serializePortableCourseState(merged);
      for (const file of ["state", "progress", "todos", "vocabulary"] as const) {
        const result = await service.saveCourseStateFile(course.courseId, file, files[file], sources.portable.revisions[file]);
        if (result.status !== "saved" || result.storage !== "portable") throw new Error("reconcile_failed");
      }
      await service.clearLocalCourseState(course.courseId);
      stateRef.current = merged;
      setCourseState(merged);
      setStateStorage("portable");
      installCourse(outcome.course);
    } catch {
      setSafeError("Course saving could not be enabled. Your device-only state remains protected.");
    }
  };

  const persistMutation = (mutation: PortableMutation, file: "state" | "progress" | "todos" | "vocabulary") => {
    const current = stateRef.current;
    if (!course) return;
    if (!current) {
      pendingStateMutations.current.push([mutation, file]);
      return;
    }
    const next = applyPortableMutation(current, mutation);
    stateRef.current = next;
    setCourseState(next);
    const courseId = course.courseId;
    const contents = serializePortableCourseState(next)[file];
    stateWriteQueue.current = stateWriteQueue.current.then(async () => {
      const result = await service.saveCourseStateFile(courseId, file, contents, revisionRef.current[file]);
      if (result.status === "saved") {
        revisionRef.current = { ...revisionRef.current, [file]: result.revision };
        setStateStorage(result.storage);
      } else if (result.status === "conflict") {
        const snapshot = await service.loadCourseState(courseId);
        const refreshed = parsePortableCourseState(snapshot.files);
        stateRef.current = refreshed;
        revisionRef.current = { ...snapshot.revisions };
        setCourseState(refreshed);
        setStateStorage(snapshot.storage);
        setSafeError("Course state changed elsewhere. Limmud reloaded the latest version.");
      } else {
        setSafeError("Study state could not be saved. Your current changes remain visible.");
      }
    }).catch(() => setSafeError("Study state could not be saved. Your current changes remain visible."));
  };

  return useMemo(() => ({
    destination, navigate, course, status, safeError, lesson, section, sections,
    selectedIndex, lessonCount: lessons.length,
    previousLesson: () => selectedIndex > 0 && selectLesson(lessons[selectedIndex - 1].id),
    nextLesson: () => selectedIndex < lessons.length - 1 && selectLesson(lessons[selectedIndex + 1].id),
    selectLesson, pickCourse, relinkCourse,
    expandedSections,
    toggleSection: (id: string) => setExpandedSections((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }),
    note: lesson ? noteDrafts[lesson.id] ?? "" : "",
    noteEditing, noteDirty, noteStatus, noteCapability: lesson ? noteSnapshots[lesson.id]?.status ?? "accessRequired" : "accessRequired",
    editNote: () => { setNoteEditing(true); setNoteDirty(false); },
    updateNote: (value: string) => { if (lesson) setNoteDrafts((current) => ({ ...current, [lesson.id]: value })); setNoteDirty(true); },
    saveNote, enableNoteEditing,
    zen, setZen, tool, setTool,
    timer: readTimer(timer, timerNow),
    timerMode: timer.mode,
    timerPreset: timer.presetMinutes,
    toggleTimer: () => {
      const now = Date.now();
      setTimerNow(now);
      setTimer((current) => current.phase === "running" ? pauseTimer(current, now) : startTimer(current, now));
    },
    resetTimer: () => setTimer((current) => resetTimer(current, current.mode, current.presetMinutes)),
    stateStorage,
    enableCourseSaving,
    completedCount: courseState?.value.completedLessons.filter((path) => lessons.some((item) => item.relativePath === path)).length ?? 0,
    todos: courseState?.value.todos ?? [],
    vocabulary: courseState?.value.vocabulary ?? [],
    bookmarkedLessons: lessons.filter((item) => item.bookmarked),
    toggleTodo: (id: string) => {
      const todo = stateRef.current?.value.todos.find((item) => item.id === id);
      if (todo) persistMutation({ type: "toggleTodo", id, done: !todo.done }, "todos");
    },
    addTodo: (label: string) => {
      const trimmed = label.trim();
      if (trimmed) persistMutation({ type: "addTodo", todo: createTodoItem(trimmed) }, "todos");
    },
    toggleBookmark: () => { if (lesson) persistMutation({ type: "setLessonBookmarked", relativePath: lesson.relativePath, bookmarked: !lesson.bookmarked }, "progress"); },
    toggleCompleted: () => { if (lesson) persistMutation({ type: "setLessonCompleted", relativePath: lesson.relativePath, completed: !lesson.completed }, "progress"); },
    resumeTime: lesson ? courseState?.value.videoProgress[lesson.relativePath] ?? 0 : 0,
    updatePlaybackProgress: (seconds: number) => { if (lesson) persistMutation({ type: "setPlaybackProgress", relativePath: lesson.relativePath, seconds }, "progress"); },
    recordVideoStudySeconds: (seconds: number) => persistMutation({ type: "recordVideoStudySeconds", seconds }, "progress"),
    completePlayback: (seconds: number) => {
      if (!lesson) return;
      persistMutation({ type: "setPlaybackProgress", relativePath: lesson.relativePath, seconds }, "progress");
      if (!lesson.completed) persistMutation({ type: "setLessonCompleted", relativePath: lesson.relativePath, completed: true }, "progress");
    },
    addVocabulary: (entry: DictionaryEntry) => {
      if (!lesson || stateRef.current?.value.vocabulary.some((item) => item.dictionaryEntryId === entry.id)) return;
      const part = entry.partsOfSpeech[0];
      const source = entry.sources[0];
      const definition = part?.senses[0]?.definition;
      if (!part || !source || !definition) return;
      const id = globalThis.crypto?.randomUUID?.() ?? `vocabulary-${Date.now()}`;
      persistMutation({ type: "updateVocabulary", item: {
        id, headword: entry.headword, dictionaryEntryId: entry.id, sourceKey: source.sourceKey,
        partOfSpeech: part.name, shortDefinition: definition, addedAt: new Date().toISOString(),
        lessonRelativePath: lesson.relativePath, videoPositionSeconds: courseState?.value.videoProgress[lesson.relativePath] ?? null,
        personalNote: "", status: "new", reviewCount: 0, lastReviewedAt: null,
      } }, "vocabulary");
    },
    removeVocabulary: (id: string) => persistMutation({ type: "removeVocabulary", id }, "vocabulary"),
  }), [course, courseState, destination, expandedSections, lesson, lessons, noteDirty, noteDrafts, noteEditing, noteSnapshots, noteStatus, safeError, section, sections, selectedIndex, stateStorage, status, timer, timerNow, tool, zen]);
}
