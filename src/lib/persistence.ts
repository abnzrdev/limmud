export interface TodoItem {
  id: string;
  label: string;
  done: boolean;
}

export interface LessonState {
  timerMode: "focus" | "stopwatch";
  timerPreset: number;
  todos: TodoItem[];
  quickNote: string;
  videoProgress: Record<string, number>;
  completedLessons: string[];
  bookmarkedLessons: string[];
  studyStats: StudyStats;
}

export interface StudyStats {
  todaySeconds: number;
  totalSeconds: number;
  streakDays: number;
  lastStudyDate: string | null;
  todayBySource: StudySourceStats;
  totalBySource: StudySourceStats;
}

export interface StudySourceStats {
  videoSeconds: number;
  terminalSeconds: number;
}

export type StudyActivitySource = "video" | "terminal";

export interface LessonStateRecord {
  [key: string]: string | undefined;
  timerMode: string;
  timerPreset: string;
  todos: string;
  quickNote: string;
  selectedEntryId?: string;
  videoProgress?: string;
  completedLessons?: string;
  bookmarkedLessons?: string;
  studyStats?: string;
}

export interface GlobalConfigRecord {
  [key: string]: string | undefined;
  lastOpenedCourse?: string;
  theme: string;
  timerPresets: string;
  workspaceLayout?: string;
  dictionaryLayout?: string;
}

export type ToolPanelKey = "stats" | "resources" | "bookmarks" | "timer" | "todos";

export interface WorkspaceLayout {
  courseSize: number;
  rightSize: number;
  verticalSplit: number;
  courseCollapsed: boolean;
  rightCollapsed: boolean;
  openTools: ToolPanelKey[];
}

export interface DictionaryLayoutState {
  width: number;
}

export const defaultWorkspaceLayout: WorkspaceLayout = {
  courseSize: 14,
  rightSize: 28,
  verticalSplit: 55,
  courseCollapsed: false,
  rightCollapsed: false,
  openTools: ["stats", "resources"],
};

export const defaultDictionaryLayout: DictionaryLayoutState = { width: 420 };

export interface GlobalConfig {
  lastOpenedCourse: string | null;
  theme: "light" | "dark";
  timerPresets: number[];
  windowBounds: unknown;
  workspaceLayout: WorkspaceLayout;
  dictionaryLayout: DictionaryLayoutState;
}

const toolPanelKeys: ToolPanelKey[] = ["stats", "resources", "bookmarks", "timer", "todos"];

export function sanitizeWorkspaceLayout(value: unknown): WorkspaceLayout {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  let courseSize = typeof source.courseSize === "number" && Number.isFinite(source.courseSize) && source.courseSize >= 10 && source.courseSize <= 24
    ? source.courseSize
    : defaultWorkspaceLayout.courseSize;
  const rightSize = typeof source.rightSize === "number" && Number.isFinite(source.rightSize) && source.rightSize >= 20 && source.rightSize <= 55
    ? source.rightSize
    : defaultWorkspaceLayout.rightSize;
  if (courseSize + rightSize > 72) courseSize = defaultWorkspaceLayout.courseSize;
  const verticalSplit = typeof source.verticalSplit === "number" && Number.isFinite(source.verticalSplit) && source.verticalSplit >= 30 && source.verticalSplit <= 75
    ? source.verticalSplit
    : defaultWorkspaceLayout.verticalSplit;
  const openTools = Array.isArray(source.openTools)
    ? [...new Set(source.openTools.filter((key): key is ToolPanelKey => toolPanelKeys.includes(key as ToolPanelKey)))].slice(0, 2)
    : defaultWorkspaceLayout.openTools;
  return {
    courseSize,
    rightSize,
    verticalSplit,
    courseCollapsed: typeof source.courseCollapsed === "boolean" ? source.courseCollapsed : false,
    rightCollapsed: typeof source.rightCollapsed === "boolean" ? source.rightCollapsed : false,
    openTools,
  };
}

export function sanitizeDictionaryLayout(value: unknown): DictionaryLayoutState {
  const width = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).width
    : undefined;
  return {
    width: typeof width === "number" && Number.isFinite(width) && width >= 360 && width <= 620
      ? width
      : defaultDictionaryLayout.width,
  };
}

function sanitizeTimerPresets(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [25, 50, 90];
  }

  const presets = value.filter((item): item is number => typeof item === "number");
  return presets.length > 0 ? presets : [25, 50, 90];
}

export function withDefaultGlobalConfig(value: Record<string, unknown>): GlobalConfig {
  return {
    lastOpenedCourse:
      typeof value.lastOpenedCourse === "string" ? value.lastOpenedCourse : null,
    theme: value.theme === "light" ? "light" : "dark",
    timerPresets: sanitizeTimerPresets(value.timerPresets),
    windowBounds: value.windowBounds ?? null,
    workspaceLayout: sanitizeWorkspaceLayout(value.workspaceLayout),
    dictionaryLayout: sanitizeDictionaryLayout(value.dictionaryLayout),
  };
}

export function withDefaultLessonState(value: Record<string, unknown>): LessonState {
  return {
    timerMode: value.timerMode === "stopwatch" ? "stopwatch" : "focus",
    timerPreset: typeof value.timerPreset === "number" ? value.timerPreset : 25,
    todos: Array.isArray(value.todos) ? (value.todos as TodoItem[]) : [],
    quickNote: typeof value.quickNote === "string" ? value.quickNote : "",
    completedLessons: stringArray(value.completedLessons),
    bookmarkedLessons: stringArray(value.bookmarkedLessons),
    videoProgress:
      value.videoProgress &&
      typeof value.videoProgress === "object" &&
      !Array.isArray(value.videoProgress)
        ? Object.fromEntries(
            Object.entries(value.videoProgress).filter(
              (entry): entry is [string, number] => typeof entry[1] === "number",
            ),
          )
        : {},
    studyStats: sanitizeStudyStats(value.studyStats),
  };
}

export function createTodoItem(label: string): TodoItem {
  return {
    id: `${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    label,
    done: false,
  };
}

export function toggleTodoItem(items: TodoItem[], targetId: string): TodoItem[] {
  return items.map((item) =>
    item.id === targetId ? { ...item, done: !item.done } : item,
  );
}

export function serializeLessonStateRecord(
  value: LessonState & { selectedEntryId?: string | null },
): LessonStateRecord {
  return {
    timerMode: value.timerMode,
    timerPreset: String(value.timerPreset),
    todos: JSON.stringify(value.todos),
    quickNote: value.quickNote,
    selectedEntryId: value.selectedEntryId ?? undefined,
    videoProgress: JSON.stringify(value.videoProgress),
    completedLessons: JSON.stringify(value.completedLessons),
    bookmarkedLessons: JSON.stringify(value.bookmarkedLessons),
    studyStats: JSON.stringify(value.studyStats),
  };
}

export function deserializeLessonStateRecord(
  value: Record<string, string>,
): LessonState & { selectedEntryId: string | null } {
  let todos: TodoItem[] = [];
  let videoProgress: Record<string, number> = {};
  let completedLessons: string[] = [];
  let bookmarkedLessons: string[] = [];
  let studyStats = sanitizeStudyStats({});
  try {
    const parsed = JSON.parse(value.todos ?? "[]");
    todos = Array.isArray(parsed) ? (parsed as TodoItem[]) : [];
  } catch {
    todos = [];
  }

  try {
    const parsed = JSON.parse(value.videoProgress ?? "{}");
    videoProgress =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, number] => typeof entry[1] === "number",
            ),
          )
        : {};
  } catch {
    videoProgress = {};
  }

  try {
    completedLessons = stringArray(JSON.parse(value.completedLessons ?? "[]"));
  } catch {
    completedLessons = [];
  }

  try {
    bookmarkedLessons = stringArray(JSON.parse(value.bookmarkedLessons ?? "[]"));
  } catch {
    bookmarkedLessons = [];
  }

  try {
    studyStats = sanitizeStudyStats(JSON.parse(value.studyStats ?? "{}"));
  } catch {
    studyStats = sanitizeStudyStats({});
  }

  return {
    timerMode: value.timerMode === "stopwatch" ? "stopwatch" : "focus",
    timerPreset: Number(value.timerPreset) || 25,
    todos,
    quickNote: value.quickNote ?? "",
    selectedEntryId: value.selectedEntryId ?? null,
    videoProgress,
    completedLessons,
    bookmarkedLessons,
    studyStats,
  };
}

export function recordStudySeconds(
  current: StudyStats,
  seconds: number,
  today = localDateKey(new Date()),
  source: StudyActivitySource = "video",
): StudyStats {
  const addedSeconds = Math.max(0, Math.floor(seconds));
  if (addedSeconds < 1) {
    return current;
  }

  const sameDay = current.lastStudyDate === today;
  const continuedStreak = current.lastStudyDate
    ? isPreviousDay(current.lastStudyDate, today)
    : false;

  const todayBySource = sameDay
    ? current.todayBySource
    : { videoSeconds: 0, terminalSeconds: 0 };
  const sourceKey = source === "terminal" ? "terminalSeconds" : "videoSeconds";

  return {
    todaySeconds: (sameDay ? current.todaySeconds : 0) + addedSeconds,
    totalSeconds: current.totalSeconds + addedSeconds,
    streakDays: sameDay ? current.streakDays : continuedStreak ? current.streakDays + 1 : 1,
    lastStudyDate: today,
    todayBySource: {
      ...todayBySource,
      [sourceKey]: todayBySource[sourceKey] + addedSeconds,
    },
    totalBySource: {
      ...current.totalBySource,
      [sourceKey]: current.totalBySource[sourceKey] + addedSeconds,
    },
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sanitizeStudyStats(value: unknown): StudyStats {
  const stats =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const lastStudyDate = typeof stats.lastStudyDate === "string" ? stats.lastStudyDate : null;
  const todaySeconds = nonNegativeInteger(stats.todaySeconds);
  const totalSeconds = nonNegativeInteger(stats.totalSeconds);

  return {
    todaySeconds,
    totalSeconds,
    streakDays: lastStudyDate ? nonNegativeInteger(stats.streakDays) : 0,
    lastStudyDate,
    todayBySource: repairSourceStats(stats.todayBySource, todaySeconds),
    totalBySource: repairSourceStats(stats.totalBySource, totalSeconds),
  };
}

function repairSourceStats(value: unknown, total: number): StudySourceStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { videoSeconds: total, terminalSeconds: 0 };
  }
  const source = value as Record<string, unknown>;
  const terminalSeconds = Math.min(total, nonNegativeInteger(source.terminalSeconds));
  return { videoSeconds: total - terminalSeconds, terminalSeconds };
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPreviousDay(previous: string, today: string): boolean {
  const previousDay = dateOrdinal(previous);
  const todayDay = dateOrdinal(today);
  return previousDay !== null && todayDay !== null && todayDay - previousDay === 1;
}

function dateOrdinal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

export function serializeGlobalConfigRecord(value: {
  lastOpenedCourse: string | null;
  theme: "light" | "dark";
  timerPresets: number[];
  windowBounds: unknown;
  workspaceLayout?: WorkspaceLayout;
  dictionaryLayout?: DictionaryLayoutState;
}): GlobalConfigRecord {
  return {
    lastOpenedCourse: value.lastOpenedCourse ?? undefined,
    theme: value.theme,
    timerPresets: JSON.stringify(value.timerPresets),
    workspaceLayout: JSON.stringify(sanitizeWorkspaceLayout(value.workspaceLayout)),
    dictionaryLayout: JSON.stringify(sanitizeDictionaryLayout(value.dictionaryLayout)),
  };
}

export function deserializeGlobalConfigRecord(
  value: Record<string, string | undefined>,
): GlobalConfig {
  let timerPresets: number[] = [25, 50, 90];
  let workspaceLayout: unknown;
  let dictionaryLayout: unknown;
  try {
    const parsed = JSON.parse(value.timerPresets ?? "[25,50,90]");
    timerPresets = sanitizeTimerPresets(parsed);
  } catch {
    timerPresets = [25, 50, 90];
  }
  try {
    workspaceLayout = JSON.parse(value.workspaceLayout ?? "null");
  } catch {
    workspaceLayout = null;
  }
  try {
    dictionaryLayout = JSON.parse(value.dictionaryLayout ?? "null");
  } catch {
    dictionaryLayout = null;
  }

  return withDefaultGlobalConfig({
    lastOpenedCourse: value.lastOpenedCourse ?? null,
    theme: value.theme,
    timerPresets,
    workspaceLayout,
    dictionaryLayout,
  });
}
