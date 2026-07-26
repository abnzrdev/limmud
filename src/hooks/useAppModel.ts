import { useEffect, useRef, useState } from "react";
import {
  findFirstVideo,
  findNextVideo,
  listLessonEntriesForSelection,
} from "../lib/courseTree";
import { resolvePrimaryNotePath } from "../lib/notePath";
import {
  createTodoItem,
  deserializeGlobalConfigRecord,
  deserializeLessonStateRecord,
  localDateKey,
  recordStudySeconds,
  sanitizeDictionaryLayout,
  sanitizeWorkspaceLayout,
  serializeGlobalConfigRecord,
  serializeLessonStateRecord,
  toggleTodoItem,
  withDefaultGlobalConfig,
  withDefaultLessonState,
  type DictionaryLayoutState,
  type WorkspaceLayout,
  type StudyActivitySource,
} from "../lib/persistence";
import { pickSubtitleForVideo } from "../lib/subtitleMatch";
import {
  chooseCoursePath,
  chooseResourcePaths,
  importLessonResources as importLessonResourcesCommand,
  isTauriRuntime,
  openResource as openResourceCommand,
  openLessonExternal as openLessonExternalCommand,
  openLessonFolder as openLessonFolderCommand,
  readAppConfig,
  readCourseState,
  readRecoveryDrafts,
  readCourseResources,
  readEditableTextFile,
  readNote,
  removeRecoveryDraft,
  scanCourse,
  type SaveNoteError,
  type SaveNoteErrorKind,
  writeRecoveryDraft,
  writeAppConfig,
  writeCourseState,
  writeEditableTextFile,
  writeNote,
} from "../lib/tauri";
import type { CourseEntry } from "../types/course";
import type { LessonResource } from "../types/resource";

export interface AppModel {
  entries: CourseEntry[];
  selectedEntry: CourseEntry | null;
  selectedSubtitle: CourseEntry | null;
  lessonEntries: CourseEntry[];
  shouldAutoPlaySelectedEntry: boolean;
  currentCourseRoot: string | null;
  lastOpenedCourse: string | null;
  theme: "light" | "dark";
  timerPresets: number[];
  workspaceLayout: WorkspaceLayout;
  dictionaryLayout: DictionaryLayoutState;
  noteBody: string;
  noteSaveStatus: "saved" | "unsaved" | "saving" | "failed";
  noteSaveError: SaveNoteError | null;
  recoveredUnsavedDraft: boolean;
  timerMode: "focus" | "stopwatch";
  timerPreset: number;
  resumeTime: number;
  todos: ReturnType<typeof withDefaultLessonState>["todos"];
  quickNote: string;
  resources: LessonResource[];
  completedLessons: string[];
  bookmarkedLessons: string[];
  bookmarkedEntries: CourseEntry[];
  studyStats: ReturnType<typeof withDefaultLessonState>["studyStats"];
  progressPercent: number;
  status: string;
  openCourse: () => void;
  refreshCourse: () => void;
  isRefreshingCourse: boolean;
  openLessonFolder: () => void;
  selectEntry: (entry: CourseEntry) => void;
  advanceToNextLesson: (completedSeconds: number) => Promise<void>;
  setNoteBody: (value: string) => void;
  saveNote: (contents?: string) => void;
  loadTextFile: (relativePath: string) => Promise<string>;
  saveTextFile: (relativePath: string, contents: string) => Promise<void>;
  pickTimerPreset: (minutes: number) => void;
  toggleTimerMode: () => void;
  toggleTheme: () => void;
  setWorkspaceLayout: (layout: WorkspaceLayout) => void;
  setDictionaryLayout: (layout: DictionaryLayoutState) => void;
  addTodo: (label: string) => void;
  toggleTodo: (id: string) => void;
  setQuickNote: (value: string) => void;
  updateVideoProgress: (seconds: number) => void;
  recordStudySeconds: (
    source: StudyActivitySource,
    seconds: number,
    courseRoot?: string | null,
  ) => void;
  flushCourseState: () => Promise<void>;
  importLessonResources: () => void;
  openResource: (resource: LessonResource) => void;
  openCourseMaterial: (entry: CourseEntry) => void;
  toggleLessonDone: () => void;
  toggleLessonBookmark: () => void;
}

const starterEntries: CourseEntry[] = [
  {
    id: "course/week-1",
    name: "Week 1",
    relativePath: "course/Week 1",
    absolutePath: "/tmp/course/Week 1",
    kind: "directory",
    children: [
      {
        id: "course/week-1/welcome.mp4",
        name: "welcome.mp4",
        relativePath: "course/Week 1/welcome.mp4",
        absolutePath: "/tmp/course/Week 1/welcome.mp4",
        kind: "video",
      },
      {
        id: "course/week-1/welcome.vtt",
        name: "welcome.vtt",
        relativePath: "course/Week 1/welcome.vtt",
        absolutePath: "/tmp/course/Week 1/welcome.vtt",
        kind: "subtitle",
      },
      {
        id: "course/week-1/notes.md",
        name: "notes.md",
        relativePath: "course/Week 1/notes.md",
        absolutePath: "/tmp/course/Week 1/notes.md",
        kind: "note",
      },
    ],
  },
];

export function useAppModel(): AppModel {
  const lessonDefaults = withDefaultLessonState({});
  const appDefaults = withDefaultGlobalConfig({});
  const [entries, setEntries] = useState<CourseEntry[]>(starterEntries);
  const [currentCourseRoot, setCurrentCourseRoot] = useState<string | null>(null);
  const [lastOpenedCourse, setLastOpenedCourse] = useState<string | null>(
    appDefaults.lastOpenedCourse,
  );
  const [theme, setTheme] = useState<"light" | "dark">(appDefaults.theme);
  const [timerPresets, setTimerPresets] = useState<number[]>(appDefaults.timerPresets);
  const [workspaceLayout, setWorkspaceLayout] = useState(appDefaults.workspaceLayout);
  const [dictionaryLayout, setDictionaryLayout] = useState(appDefaults.dictionaryLayout);
  const [selectedEntry, setSelectedEntry] = useState<CourseEntry | null>(
    findFirstVideo(starterEntries),
  );
  const [shouldAutoPlaySelectedEntry, setShouldAutoPlaySelectedEntry] = useState(false);
  const [noteBody, setNoteBody] = useState("# Welcome\n\nThis is the starter lesson note.");
  const [noteSaveStatus, setNoteSaveStatus] = useState<AppModel["noteSaveStatus"]>("saved");
  const [noteSaveError, setNoteSaveError] = useState<SaveNoteError | null>(null);
  const [recoveredUnsavedDraft, setRecoveredUnsavedDraft] = useState(false);
  const [isRefreshingCourse, setIsRefreshingCourse] = useState(false);
  const [timerMode, setTimerMode] = useState(lessonDefaults.timerMode);
  const [timerPreset, setTimerPreset] = useState(lessonDefaults.timerPreset);
  const [todos, setTodos] = useState(lessonDefaults.todos);
  const [quickNote, setQuickNote] = useState(lessonDefaults.quickNote);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>(
    lessonDefaults.completedLessons,
  );
  const [bookmarkedLessons, setBookmarkedLessons] = useState<string[]>(
    lessonDefaults.bookmarkedLessons,
  );
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>(
    lessonDefaults.videoProgress,
  );
  const [studyStats, setStudyStats] = useState(lessonDefaults.studyStats);
  const studyStatsRef = useRef(lessonDefaults.studyStats);
  const currentCourseRootRef = useRef<string | null>(null);
  const persistenceErrorRef = useRef<string | null>(null);
  const [status, setStatus] = useState("Starter course shell loaded");
  const [didHydrateAppConfig, setDidHydrateAppConfig] = useState(!isTauriRuntime());
  const pendingCourseWriteRef = useRef<{
    courseRoot: string;
    state: ReturnType<typeof serializeLessonStateRecord>;
  } | null>(null);
  const courseWriteTimerRef = useRef<number | null>(null);

  const lessonEntries = selectedEntry
    ? listLessonEntriesForSelection(entries, selectedEntry.id)
    : [];
  const notePath =
    selectedEntry?.kind === "video"
      ? resolvePrimaryNotePath(
          selectedEntry.relativePath,
          lessonEntries.map((entry) => entry.relativePath),
        )
      : null;
  const selectedSubtitle =
    selectedEntry?.kind === "video"
      ? findEntryByRelativePath(
          lessonEntries,
          pickSubtitleForVideo(
            selectedEntry.relativePath,
            lessonEntries
              .filter((entry) => entry.kind === "subtitle")
              .map((entry) => entry.relativePath),
          ),
        )
      : null;
  const resumeTime = selectedEntry ? videoProgress[selectedEntry.relativePath] ?? 0 : 0;
  const videoEntries = collectVideoEntries(entries);
  const bookmarkedEntries = videoEntries.filter((entry) =>
    bookmarkedLessons.includes(entry.relativePath),
  );
  const completedVisibleCount = videoEntries.filter((entry) =>
    completedLessons.includes(entry.relativePath),
  ).length;
  const progressPercent = videoEntries.length
    ? Math.round((completedVisibleCount / videoEntries.length) * 100)
    : 0;
  const visibleStudyStats =
    studyStats.lastStudyDate === localDateKey(new Date())
      ? studyStats
      : {
          ...studyStats,
          todaySeconds: 0,
          todayBySource: { videoSeconds: 0, terminalSeconds: 0 },
        };
  if (currentCourseRoot) {
    pendingCourseWriteRef.current = {
      courseRoot: currentCourseRoot,
      state: serializeLessonStateRecord({
        timerMode,
        timerPreset,
        todos,
        quickNote,
        selectedEntryId: selectedEntry?.id ?? null,
        videoProgress,
        completedLessons,
        bookmarkedLessons,
        studyStats,
      }),
    };
  }

  async function persistPendingCourseState(): Promise<string | null> {
    if (courseWriteTimerRef.current !== null) {
      window.clearTimeout(courseWriteTimerRef.current);
      courseWriteTimerRef.current = null;
    }
    const pending = pendingCourseWriteRef.current;
    if (!pending || !isTauriRuntime()) {
      return null;
    }
    try {
      await writeCourseState(pending.courseRoot, pending.state);
      persistenceErrorRef.current = null;
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = `Progress save failed: ${message}`;
      persistenceErrorRef.current = warning;
      setStatus(warning);
      return warning;
    }
  }

  async function flushCourseState(): Promise<void> {
    await persistPendingCourseState();
  }

  useEffect(() => {
    if (!currentCourseRoot || !isTauriRuntime()) {
      return;
    }
    if (courseWriteTimerRef.current !== null) {
      window.clearTimeout(courseWriteTimerRef.current);
    }
    courseWriteTimerRef.current = window.setTimeout(() => {
      void flushCourseState();
    }, 750);
    return () => {
      if (courseWriteTimerRef.current !== null) {
        window.clearTimeout(courseWriteTimerRef.current);
        courseWriteTimerRef.current = null;
      }
    };
  }, [
    currentCourseRoot,
    quickNote,
    selectedEntry?.id,
    bookmarkedLessons,
    completedLessons,
    timerMode,
    timerPreset,
    studyStats,
    todos,
    videoProgress,
  ]);

  useEffect(() => {
    return () => {
      const pending = pendingCourseWriteRef.current;
      if (pending && isTauriRuntime()) {
        void writeCourseState(pending.courseRoot, pending.state);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void (async () => {
      try {
        const savedConfig = await readAppConfig();
        const hydrated = deserializeGlobalConfigRecord(savedConfig);
        setLastOpenedCourse(hydrated.lastOpenedCourse);
        setTheme(hydrated.theme);
        setTimerPresets(hydrated.timerPresets);
        setWorkspaceLayout(hydrated.workspaceLayout);
        setDictionaryLayout(hydrated.dictionaryLayout);
        if (hydrated.lastOpenedCourse) {
          await loadCourseFromPath(hydrated.lastOpenedCourse, { restoring: true });
        }
      } catch {
        // Browser/dev mode remains usable without native config access.
      } finally {
        setDidHydrateAppConfig(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isTauriRuntime() || !didHydrateAppConfig) {
      return;
    }

    const configRecord = serializeGlobalConfigRecord({
      lastOpenedCourse,
      theme,
      timerPresets,
      windowBounds: null,
      workspaceLayout,
      dictionaryLayout,
    });

    void writeAppConfig(configRecord).catch(() => {
      // Preserve UI responsiveness if app config persistence fails.
    });
  }, [didHydrateAppConfig, dictionaryLayout, lastOpenedCourse, theme, timerPresets, workspaceLayout]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = theme;
  }, [theme]);

  async function loadCourseFromPath(
    path: string,
    options: { restoring?: boolean } = {},
  ): Promise<void> {
    const persistenceWarning = currentCourseRoot && currentCourseRoot !== path
      ? await persistPendingCourseState()
      : null;
    const finishStatus = (message: string) => {
      setStatus(persistenceWarning ? `${message} — ${persistenceWarning}` : message);
    };
    setStatus(options.restoring ? `Restoring ${path}...` : `Loading ${path}...`);

    try {
      const scannedEntries = await scanCourse(path);
      const savedState = await readCourseState(path).catch(() => ({}));
      const hydratedState = deserializeLessonStateRecord(savedState);
      const firstVideo = findFirstVideo(scannedEntries);
      const restoredSelection =
        (hydratedState.selectedEntryId
          ? findEntryById(scannedEntries, hydratedState.selectedEntryId)
          : null) ?? firstVideo;

      currentCourseRootRef.current = path;
      setCurrentCourseRoot(path);
      setLastOpenedCourse(path);
      setEntries(scannedEntries);
      setSelectedEntry(restoredSelection);
      setShouldAutoPlaySelectedEntry(false);
      setNoteBody("");
      setNoteSaveStatus("saved");
      setTimerMode(hydratedState.timerMode);
      setTimerPreset(hydratedState.timerPreset);
      setTodos(hydratedState.todos);
      setQuickNote(hydratedState.quickNote);
      setVideoProgress(hydratedState.videoProgress);
      setCompletedLessons(hydratedState.completedLessons);
      setBookmarkedLessons(hydratedState.bookmarkedLessons);
      studyStatsRef.current = hydratedState.studyStats;
      setStudyStats(hydratedState.studyStats);
      if (restoredSelection && restoredSelection.kind === "video") {
        await loadNoteForSelection(scannedEntries, restoredSelection, path);
        setResources(await loadResourcesForSelection(restoredSelection, path));
      }
      if (!scannedEntries.length) {
        finishStatus(`Loaded ${path} (folder is empty)`);
        return;
      }

      if (!firstVideo) {
        finishStatus(`Loaded ${path} (no videos found)`);
        return;
      }

      finishStatus(options.restoring ? `Restored ${path}` : `Loaded ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown course loading error";
      if (options.restoring) {
        currentCourseRootRef.current = null;
        setCurrentCourseRoot(null);
        setLastOpenedCourse(null);
        setStatus(`Failed to restore course: ${message}`);
        return;
      }

      finishStatus(`Failed to load course: ${message}`);
    }
  }

  async function loadNoteForSelection(
    sourceEntries: CourseEntry[],
    entry: CourseEntry,
    courseRoot: string | null,
  ) {
    const selectionItems = listLessonEntriesForSelection(sourceEntries, entry.id);
    const selectedNotePath = resolvePrimaryNotePath(
      entry.relativePath,
      selectionItems.map((item) => item.relativePath),
    );

    if (!isTauriRuntime() || !courseRoot) {
      setNoteBody("");
      return;
    }

    const recovered = (await readRecoveryDrafts(courseRoot).catch(() => [])).find(
      (draft) => draft.lessonRelativePath === entry.relativePath,
    );
    if (recovered) {
      setNoteBody(recovered.noteText);
      setNoteSaveStatus("unsaved");
      setNoteSaveError(null);
      setRecoveredUnsavedDraft(true);
      setStatus("Recovered unsaved draft");
      return;
    }
    try {
      const loadedNote = await readNote(`${courseRoot}/${selectedNotePath}`);
      setNoteBody(loadedNote);
      setNoteSaveStatus("saved");
      setNoteSaveError(null);
      setRecoveredUnsavedDraft(false);
    } catch {
      setNoteBody("");
      setNoteSaveStatus("saved");
      setNoteSaveError(null);
      setRecoveredUnsavedDraft(false);
    }
  }

  async function preserveUnsavedDraft(
    entry = selectedEntry,
    contents = noteBody,
    errorKind: SaveNoteErrorKind = noteSaveError?.kind ?? "io",
  ): Promise<void> {
    if (!entry || entry.kind !== "video" || !currentCourseRoot || !contents || !isTauriRuntime()) {
      return;
    }
    try {
      await writeRecoveryDraft(currentCourseRoot, {
        lessonRelativePath: entry.relativePath,
        noteText: contents,
        updatedAt: new Date().toISOString(),
        lastSaveErrorKind: errorKind,
      });
    } catch {
      setStatus("Could not store a recovery draft. Copy Notes before leaving this lesson.");
    }
  }

  function saveVideoProgressForEntry(entry: CourseEntry, seconds: number) {
    if (entry.kind !== "video") {
      return;
    }

    setVideoProgress((current) => {
      const rounded = Math.max(0, Math.floor(seconds));
      const previous = current[entry.relativePath] ?? 0;
      if (Math.abs(previous - rounded) < 1) {
        return current;
      }

      return {
        ...current,
        [entry.relativePath]: rounded,
      };
    });
  }

  async function selectEntryInternal(
    sourceEntries: CourseEntry[],
    entry: CourseEntry,
    options: { autoPlay?: boolean; statusMessage?: string } = {},
  ) {
    await flushCourseState();
    if (noteSaveStatus !== "saved") {
      await preserveUnsavedDraft();
    }
    setSelectedEntry(entry);
    setShouldAutoPlaySelectedEntry(Boolean(options.autoPlay));
    if (entry.kind === "video") {
      await loadNoteForSelection(sourceEntries, entry, currentCourseRoot);
      setResources(await loadResourcesForSelection(entry, currentCourseRoot));
    } else {
      setNoteBody("");
      setNoteSaveStatus("saved");
      setResources([]);
    }
    if (options.statusMessage) {
      setStatus(options.statusMessage);
    }
  }

  return {
    entries,
    shouldAutoPlaySelectedEntry,
    currentCourseRoot,
    lastOpenedCourse,
    theme,
    timerPresets,
    workspaceLayout,
    dictionaryLayout,
    selectedEntry,
    selectedSubtitle,
    lessonEntries,
    noteBody,
    noteSaveStatus,
    noteSaveError,
    recoveredUnsavedDraft,
    isRefreshingCourse,
    timerMode,
    timerPreset,
    resumeTime,
    todos,
    quickNote,
    resources,
    completedLessons,
    bookmarkedLessons,
    bookmarkedEntries,
    studyStats: visibleStudyStats,
    progressPercent,
    status,
    openCourse: async () => {
      const path = await chooseCoursePath();
      if (!path) {
        setStatus("Course loading cancelled");
        return;
      }

      await loadCourseFromPath(path);
    },
    refreshCourse: async () => {
      if (!currentCourseRoot || isRefreshingCourse) {
        return;
      }
      await preserveUnsavedDraft();
      setIsRefreshingCourse(true);
      setStatus("Refreshing course...");
      try {
        const scannedEntries = await scanCourse(currentCourseRoot);
        const previousVideos = collectVideoEntries(entries);
        const refreshedVideos = collectVideoEntries(scannedEntries);
        const previousPaths = new Set(previousVideos.map((entry) => entry.absolutePath));
        const refreshedPaths = new Set(refreshedVideos.map((entry) => entry.absolutePath));
        const added = refreshedVideos.filter((entry) => !previousPaths.has(entry.absolutePath)).length;
        const removed = previousVideos.filter((entry) => !refreshedPaths.has(entry.absolutePath)).length;
        const preserved = selectedEntry
          ? refreshedVideos.find((entry) => entry.absolutePath === selectedEntry.absolutePath) ?? null
          : null;
        const fallback = preserved ?? findFirstVideo(scannedEntries);
        setEntries(scannedEntries);
        setResources(await readCourseResources(currentCourseRoot).catch(() => resources));
        if (preserved) {
          setSelectedEntry(preserved);
          setStatus(`Course refreshed · ${added} added · ${removed} removed`);
        } else if (fallback) {
          setSelectedEntry(fallback);
          await loadNoteForSelection(scannedEntries, fallback, currentCourseRoot);
          setResources(await loadResourcesForSelection(fallback, currentCourseRoot));
          setStatus(
            selectedEntry
              ? `Selected lesson was removed. Course refreshed · ${added} added · ${removed} removed`
              : `Course refreshed · ${added} added · ${removed} removed`,
          );
        } else {
          setSelectedEntry(null);
          setResources([]);
          setStatus(`Course refreshed · ${added} added · ${removed} removed · no videos found`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Could not refresh the course: ${message}`);
      } finally {
        setIsRefreshingCourse(false);
      }
    },
    openLessonFolder: async () => {
      if (!selectedEntry || selectedEntry.kind !== "video" || !currentCourseRoot) {
        return;
      }
      try {
        await openLessonFolderCommand(currentCourseRoot, selectedEntry.absolutePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Could not open lesson folder: ${message}`);
      }
    },
    selectEntry: async (entry) => {
      const video = entry.kind === "directory" ? findFirstVideo(entry.children ?? []) : entry;
      await selectEntryInternal(entries, video ?? entry, {
        statusMessage: video ? undefined : `No videos in ${entry.name}`,
      });
    },
    advanceToNextLesson: async (completedSeconds) => {
      if (!selectedEntry || selectedEntry.kind !== "video") {
        return;
      }

      saveVideoProgressForEntry(selectedEntry, completedSeconds);
      setCompletedLessons((current) => addString(current, selectedEntry.relativePath));
      const nextEntry = findNextVideo(entries, selectedEntry.id);
      if (!nextEntry) {
        setShouldAutoPlaySelectedEntry(false);
        setStatus("End of course");
        return;
      }

      await selectEntryInternal(entries, nextEntry, {
        autoPlay: true,
      });
    },
    setNoteBody: (value) => {
      setNoteBody(value);
      setNoteSaveStatus("unsaved");
      setNoteSaveError(null);
      setRecoveredUnsavedDraft(false);
    },
    saveNote: async (contents = noteBody) => {
      if (!selectedEntry || selectedEntry.kind !== "video" || !notePath || !currentCourseRoot) {
        setStatus("Select a video lesson before saving notes");
        setNoteSaveStatus("failed");
        return;
      }

      if (!isTauriRuntime()) {
        setStatus("Running in browser mode. Note saving needs the Tauri desktop runtime.");
        setNoteSaveStatus("failed");
        return;
      }

      try {
        setNoteSaveStatus("saving");
        await writeNote(currentCourseRoot, selectedEntry.absolutePath, contents);
        setStatus(`Saved ${fileNameOf(notePath)}`);
        setNoteSaveStatus("saved");
        setNoteSaveError(null);
        setRecoveredUnsavedDraft(false);
        void removeRecoveryDraft(currentCourseRoot, selectedEntry.relativePath).catch(() => {
          setStatus("Saved note, but the recovery draft could not be removed.");
        });
      } catch (error) {
        const saveError = error as SaveNoteError;
        await preserveUnsavedDraft(selectedEntry, contents, saveError.kind ?? "io");
        setNoteSaveError(saveError);
        setStatus(`Failed to save note: ${saveError.message ?? "Unknown note save error"}`);
        setNoteSaveStatus("failed");
      }
    },
    loadTextFile: async (relativePath) => {
      if (!currentCourseRoot || !isTauriRuntime()) throw new Error("Text files require an open course in the desktop app.");
      return readEditableTextFile(currentCourseRoot, relativePath);
    },
    saveTextFile: async (relativePath, contents) => {
      if (!currentCourseRoot || !isTauriRuntime()) throw new Error("Text files require an open course in the desktop app.");
      await writeEditableTextFile(currentCourseRoot, relativePath, contents);
      setStatus(`Saved ${fileNameOf(relativePath)}`);
    },
    pickTimerPreset: (minutes) => {
      setTimerPreset(minutes);
      if (!timerPresets.includes(minutes)) {
        setTimerPresets((current) => [...current, minutes].sort((a, b) => a - b));
      }
      setStatus(`Timer preset set to ${minutes} minutes`);
    },
    toggleTimerMode: () => {
      setTimerMode((current) => (current === "focus" ? "stopwatch" : "focus"));
    },
    toggleTheme: () => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      setStatus(`Theme switched to ${nextTheme}`);
    },
    setWorkspaceLayout: (layout) => setWorkspaceLayout(sanitizeWorkspaceLayout(layout)),
    setDictionaryLayout: (layout) => setDictionaryLayout(sanitizeDictionaryLayout(layout)),
    addTodo: (label) => {
      const trimmed = label.trim();
      if (!trimmed) {
        setStatus("Enter a to-do item before adding it");
        return;
      }

      setTodos((current) => [...current, createTodoItem(trimmed)]);
      setStatus(`Added to-do: ${trimmed}`);
    },
    toggleTodo: (id) => {
      setTodos((current) => toggleTodoItem(current, id));
    },
    setQuickNote,
    updateVideoProgress: (seconds) => {
      if (!selectedEntry || selectedEntry.kind !== "video") {
        return;
      }
      saveVideoProgressForEntry(selectedEntry, seconds);
    },
    recordStudySeconds: (source, seconds, sourceCourseRoot) => {
      if (
        sourceCourseRoot !== undefined &&
        sourceCourseRoot !== currentCourseRootRef.current
      ) {
        return;
      }
      const nextStats = recordStudySeconds(studyStatsRef.current, seconds, undefined, source);
      studyStatsRef.current = nextStats;
      setStudyStats(nextStats);
      const pending = pendingCourseWriteRef.current;
      if (pending && pending.courseRoot === currentCourseRootRef.current) {
        pending.state = {
          ...pending.state,
          studyStats: JSON.stringify(nextStats),
        };
      }
    },
    flushCourseState,
    importLessonResources: async () => {
      if (!selectedEntry || selectedEntry.kind !== "video" || !currentCourseRoot) {
        setStatus("Select a video lesson before importing resources");
        return;
      }

      if (!isTauriRuntime()) {
        setStatus("Running in browser mode. Resource import needs the Tauri desktop runtime.");
        return;
      }

      const sourcePaths = await chooseResourcePaths();
      if (!sourcePaths.length) {
        setStatus("Resource import cancelled");
        return;
      }

      try {
        await importLessonResourcesCommand(
          currentCourseRoot,
          selectedEntry.relativePath,
          sourcePaths,
        );
        setResources(await readCourseResources(currentCourseRoot));
        setStatus(`Imported ${sourcePaths.length} resource${sourcePaths.length === 1 ? "" : "s"}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown resource import error";
        setStatus(`Failed to import resources: ${message}`);
      }
    },
    openResource: async (resource) => {
      if (!currentCourseRoot) {
        setStatus("Open a course before opening resources");
        return;
      }

      try {
        await openResourceCommand(currentCourseRoot, resource.storedRelativePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown resource open error";
        setStatus(`Failed to open resource: ${message}`);
      }
    },
    openCourseMaterial: async (entry) => {
      if (!currentCourseRoot) return;
      try {
        await openLessonExternalCommand(currentCourseRoot, entry.absolutePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to open material: ${message}`);
      }
    },
    toggleLessonDone: () => {
      if (!selectedEntry || selectedEntry.kind !== "video") {
        setStatus("Select a video lesson before marking done");
        return;
      }

      setCompletedLessons((current) => toggleString(current, selectedEntry.relativePath));
      setStatus(
        completedLessons.includes(selectedEntry.relativePath)
          ? "Lesson marked not done"
          : "Lesson marked done",
      );
    },
    toggleLessonBookmark: () => {
      if (!selectedEntry || selectedEntry.kind !== "video") {
        setStatus("Select a video lesson before bookmarking");
        return;
      }

      setBookmarkedLessons((current) => toggleString(current, selectedEntry.relativePath));
      setStatus(
        bookmarkedLessons.includes(selectedEntry.relativePath)
          ? "Bookmark removed"
          : "Lesson bookmarked",
      );
    },
  };
}

function toggleString(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function addString(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function collectVideoEntries(entries: CourseEntry[]): CourseEntry[] {
  const videos: CourseEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "video") {
      videos.push(entry);
    }
    if (entry.children?.length) {
      videos.push(...collectVideoEntries(entry.children));
    }
  }
  return videos;
}

async function loadResourcesForSelection(entry: CourseEntry, courseRoot: string | null) {
  if (!isTauriRuntime() || !courseRoot || entry.kind !== "video") {
    return [];
  }

  try {
    return await readCourseResources(courseRoot);
  } catch {
    return [];
  }
}

function fileNameOf(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "notes.md";
}

function findEntryById(entries: CourseEntry[], id: string): CourseEntry | null {
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }

    if (entry.children?.length) {
      const nested = findEntryById(entry.children, id);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function findEntryByRelativePath(
  entries: CourseEntry[],
  relativePath: string | null,
): CourseEntry | null {
  if (!relativePath) {
    return null;
  }

  return entries.find((entry) => entry.relativePath === relativePath) ?? null;
}
