import { recordStudySeconds, type LessonState, type StudyStats, type TodoItem } from "./persistence";

export interface SavedVocabularyItem {
  id: string;
  headword: string;
  dictionaryEntryId: number;
  sourceKey: string;
  partOfSpeech: string | null;
  shortDefinition: string;
  addedAt: string;
  lessonRelativePath: string | null;
  videoPositionSeconds: number | null;
  personalNote: string;
  status: "new" | "learning" | "known";
  reviewCount: number;
  lastReviewedAt: string | null;
}

export interface PortableCourseStateFiles {
  state: Record<string, string>;
  progress: Record<string, string>;
  todos: Record<string, string>;
  vocabulary: SavedVocabularyItem[];
}

export interface PortableCourseState {
  files: PortableCourseStateFiles;
  value: LessonState & {
    selectedEntryId: string | null;
    vocabulary: SavedVocabularyItem[];
  };
  revision: string;
  updatedAt?: string;
}

export type PortableMutation =
  | { type: "setLessonCompleted"; relativePath: string; completed: boolean }
  | { type: "setLessonBookmarked"; relativePath: string; bookmarked: boolean }
  | { type: "setPlaybackProgress"; relativePath: string; seconds: number }
  | { type: "recordVideoStudySeconds"; seconds: number; today?: string }
  | { type: "setSelectedEntry"; entryId: string | null }
  | { type: "addTodo"; todo: TodoItem }
  | { type: "toggleTodo"; id: string; done: boolean }
  | { type: "removeTodo"; id: string }
  | { type: "updateVocabulary"; item: SavedVocabularyItem }
  | { type: "removeVocabulary"; id: string };

const emptyStats: StudyStats = {
  todaySeconds: 0,
  totalSeconds: 0,
  streakDays: 0,
  lastStudyDate: null,
  todayBySource: { videoSeconds: 0, terminalSeconds: 0 },
  totalBySource: { videoSeconds: 0, terminalSeconds: 0 },
};

function malformed(): never {
  throw new Error("portable_state_malformed");
}

function parseJson(value: string | undefined, fallback: unknown): unknown {
  if (value === undefined) return fallback;
  try { return JSON.parse(value); } catch { return malformed(); }
}

function stringSet(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return malformed();
  return [...new Set(value)];
}

function parseTodos(value: unknown): TodoItem[] {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object"
    || typeof (item as TodoItem).id !== "string"
    || typeof (item as TodoItem).label !== "string"
    || typeof (item as TodoItem).done !== "boolean")) return malformed();
  return value as TodoItem[];
}

function parseProgress(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed();
  const entries = Object.entries(value);
  if (entries.some(([key, seconds]) => !key || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0)) return malformed();
  return Object.fromEntries(entries);
}

function parseStats(value: unknown): StudyStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed();
  const stats = value as Record<string, unknown>;
  const source = (field: string) => {
    const item = stats[field];
    if (!item || typeof item !== "object" || Array.isArray(item)) return malformed();
    const values = item as Record<string, unknown>;
    if (!validNonNegative(values.videoSeconds) || !validNonNegative(values.terminalSeconds)) return malformed();
    return { videoSeconds: values.videoSeconds as number, terminalSeconds: values.terminalSeconds as number };
  };
  if (!validNonNegative(stats.todaySeconds) || !validNonNegative(stats.totalSeconds)
    || !validNonNegative(stats.streakDays)
    || !(stats.lastStudyDate === null || typeof stats.lastStudyDate === "string")) return malformed();
  return {
    todaySeconds: stats.todaySeconds as number,
    totalSeconds: stats.totalSeconds as number,
    streakDays: stats.streakDays as number,
    lastStudyDate: stats.lastStudyDate as string | null,
    todayBySource: source("todayBySource"),
    totalBySource: source("totalBySource"),
  };
}

function validNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateVocabulary(items: SavedVocabularyItem[]): SavedVocabularyItem[] {
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object"
    || typeof item.id !== "string" || !item.id
    || typeof item.headword !== "string" || !item.headword
    || !Number.isSafeInteger(item.dictionaryEntryId) || item.dictionaryEntryId <= 0
    || typeof item.sourceKey !== "string"
    || typeof item.shortDefinition !== "string"
    || typeof item.addedAt !== "string"
    || typeof item.personalNote !== "string"
    || !["new", "learning", "known"].includes(item.status)
    || !Number.isSafeInteger(item.reviewCount) || item.reviewCount < 0)) return malformed();
  return items.map((item) => ({ ...item }));
}

function cloneFiles(files: PortableCourseStateFiles): PortableCourseStateFiles {
  return {
    state: { ...files.state },
    progress: { ...files.progress },
    todos: { ...files.todos },
    vocabulary: files.vocabulary.map((item) => ({ ...item })),
  };
}

export function parsePortableCourseState(files: PortableCourseStateFiles): PortableCourseState {
  const cloned = cloneFiles(files);
  const timerMode: "focus" | "stopwatch" = cloned.state.timerMode === undefined || cloned.state.timerMode === "focus"
    ? "focus"
    : cloned.state.timerMode === "stopwatch" ? "stopwatch" : malformed();
  const timerPreset = cloned.state.timerPreset === undefined ? 25 : Number(cloned.state.timerPreset);
  if (!Number.isFinite(timerPreset) || timerPreset <= 0) malformed();
  const value = {
    timerMode,
    timerPreset,
    quickNote: cloned.state.quickNote ?? "",
    selectedEntryId: cloned.progress.selectedEntryId ?? null,
    completedLessons: stringSet(parseJson(cloned.progress.completedLessons, [])),
    bookmarkedLessons: stringSet(parseJson(cloned.progress.bookmarkedLessons, [])),
    videoProgress: parseProgress(parseJson(cloned.progress.videoProgress, {})),
    todos: parseTodos(parseJson(cloned.todos.todos, [])),
    studyStats: parseStats(parseJson(cloned.progress.studyStats, emptyStats)),
    vocabulary: validateVocabulary(cloned.vocabulary),
  };
  return { files: cloned, value, revision: stableRevision(cloned) };
}

export function serializePortableCourseState(state: PortableCourseState): PortableCourseStateFiles {
  const files = cloneFiles(state.files);
  files.state.timerMode = state.value.timerMode;
  files.state.timerPreset = String(state.value.timerPreset);
  files.state.quickNote = state.value.quickNote;
  files.progress.completedLessons = JSON.stringify(state.value.completedLessons);
  files.progress.bookmarkedLessons = JSON.stringify(state.value.bookmarkedLessons);
  files.progress.videoProgress = JSON.stringify(state.value.videoProgress);
  files.progress.studyStats = JSON.stringify(state.value.studyStats);
  if (state.value.selectedEntryId === null) delete files.progress.selectedEntryId;
  else files.progress.selectedEntryId = state.value.selectedEntryId;
  files.todos.todos = JSON.stringify(state.value.todos);
  files.vocabulary = state.value.vocabulary.map((item) => ({ ...item }));
  return files;
}

export function applyPortableMutation(state: PortableCourseState, mutation: PortableMutation): PortableCourseState {
  const files = serializePortableCourseState(state);
  const value = { ...state.value,
    completedLessons: [...state.value.completedLessons],
    bookmarkedLessons: [...state.value.bookmarkedLessons],
    videoProgress: { ...state.value.videoProgress },
    todos: state.value.todos.map((item) => ({ ...item })),
    vocabulary: state.value.vocabulary.map((item) => ({ ...item })),
  };
  if (mutation.type === "setLessonCompleted") value.completedLessons = setMembership(value.completedLessons, mutation.relativePath, mutation.completed);
  if (mutation.type === "setLessonBookmarked") value.bookmarkedLessons = setMembership(value.bookmarkedLessons, mutation.relativePath, mutation.bookmarked);
  if (mutation.type === "setPlaybackProgress") {
    if (!validNonNegative(mutation.seconds) || !mutation.relativePath) malformed();
    value.videoProgress[mutation.relativePath] = mutation.seconds;
  }
  if (mutation.type === "recordVideoStudySeconds") value.studyStats = recordStudySeconds(value.studyStats, mutation.seconds, mutation.today, "video");
  if (mutation.type === "setSelectedEntry") value.selectedEntryId = mutation.entryId;
  if (mutation.type === "addTodo") {
    if (value.todos.some((item) => item.id === mutation.todo.id)) malformed();
    value.todos.push({ ...mutation.todo });
  }
  if (mutation.type === "toggleTodo") value.todos = value.todos.map((item) => item.id === mutation.id ? { ...item, done: mutation.done } : item);
  if (mutation.type === "removeTodo") value.todos = value.todos.filter((item) => item.id !== mutation.id);
  if (mutation.type === "updateVocabulary") {
    validateVocabulary([mutation.item]);
    const index = value.vocabulary.findIndex((item) => item.id === mutation.item.id);
    if (index < 0) value.vocabulary.push({ ...mutation.item });
    else value.vocabulary[index] = { ...mutation.item };
  }
  if (mutation.type === "removeVocabulary") value.vocabulary = value.vocabulary.filter((item) => item.id !== mutation.id);
  const next = { ...state, files, value };
  const serialized = serializePortableCourseState(next);
  return { ...next, files: serialized, revision: stableRevision(serialized) };
}

export function reconcilePortableState(portable: PortableCourseState, local: PortableCourseState): PortableCourseState {
  const localIsNewer = Date.parse(local.updatedAt ?? "") > Date.parse(portable.updatedAt ?? "");
  const value = {
    ...portable.value,
    completedLessons: union(portable.value.completedLessons, local.value.completedLessons),
    bookmarkedLessons: union(portable.value.bookmarkedLessons, local.value.bookmarkedLessons),
    videoProgress: { ...portable.value.videoProgress },
    todos: mergeById(portable.value.todos, local.value.todos, localIsNewer),
    vocabulary: mergeById(portable.value.vocabulary, local.value.vocabulary, localIsNewer),
  };
  for (const [path, seconds] of Object.entries(local.value.videoProgress)) {
    if (localIsNewer || value.videoProgress[path] === undefined) value.videoProgress[path] = seconds;
  }
  const next = { ...portable, value, updatedAt: localIsNewer ? local.updatedAt : portable.updatedAt };
  const files = serializePortableCourseState(next);
  return { ...next, files, revision: stableRevision(files) };
}

function setMembership(values: string[], target: string, enabled: boolean): string[] {
  if (!target) malformed();
  return enabled ? union(values, [target]) : values.filter((value) => value !== target);
}

function union(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

function mergeById<T extends { id: string }>(left: T[], right: T[], preferRight: boolean): T[] {
  const merged = new Map(left.map((item) => [item.id, item]));
  for (const item of right) if (preferRight || !merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()].map((item) => ({ ...item }));
}

function stableRevision(files: PortableCourseStateFiles): string {
  const canonical = JSON.stringify({
    state: sorted(files.state), progress: sorted(files.progress), todos: sorted(files.todos), vocabulary: files.vocabulary,
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const seed = (hash >>> 0).toString(16).padStart(8, "0");
  return seed.repeat(8);
}

function sorted(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
