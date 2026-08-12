import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { CourseEntry } from "../types/course";
import type { LessonResource } from "../types/resource";
import type { DictionaryEntry, DictionarySearchResult, DictionaryStatus, SavedVocabularyItem } from "../types/dictionary";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

export async function scanCourse(path: string): Promise<CourseEntry[]> {
  const result = await invoke<unknown>("scan_course", { path });
  return normalizeCourseEntries(result);
}

export async function readNote(path: string): Promise<string> {
  return invoke<string>("read_note", { path });
}

export function readEditableTextFile(courseRoot: string, relativePath: string): Promise<string> {
  return invoke<string>("read_editable_text_file", { courseRoot, relativePath });
}

export function writeEditableTextFile(courseRoot: string, relativePath: string, contents: string): Promise<void> {
  return invoke("write_editable_text_file", { courseRoot, relativePath, contents });
}

export type SaveNoteErrorKind =
  | "permissionDenied"
  | "readOnlyFilesystem"
  | "parentMissing"
  | "lessonMissing"
  | "targetIsDirectory"
  | "outsideCourse"
  | "invalidPath"
  | "io";

export interface SaveNoteError {
  kind: SaveNoteErrorKind;
  message: string;
  attemptedPath: string;
  parentPath: string;
  osError?: string;
  recoverable: boolean;
}

export interface RecoveryDraft {
  lessonRelativePath: string;
  noteText: string;
  updatedAt: string;
  lastSaveErrorKind: SaveNoteErrorKind;
}

export async function writeNote(
  courseRoot: string,
  lessonPath: string,
  contents: string,
): Promise<void> {
  try {
    await invoke("write_note", { courseRoot, lessonPath, contents });
  } catch (error) {
    throw normalizeSaveNoteError(error);
  }
}

export async function readRecoveryDrafts(courseRoot: string): Promise<RecoveryDraft[]> {
  return invoke<RecoveryDraft[]>("read_recovery_drafts", { courseRoot });
}

export async function writeRecoveryDraft(courseRoot: string, draft: RecoveryDraft): Promise<void> {
  await invoke("write_recovery_draft", { courseRoot, draft });
}

export async function removeRecoveryDraft(courseRoot: string, lessonRelativePath: string): Promise<void> {
  await invoke("remove_recovery_draft", { courseRoot, lessonRelativePath });
}

export async function readCourseState(
  courseRoot: string,
): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("read_course_state", { courseRoot });
}

export async function writeCourseState(
  courseRoot: string,
  state: Record<string, string | undefined>,
): Promise<void> {
  await invoke("write_course_state", { courseRoot, state });
}

export async function readAppConfig(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("read_app_config");
}

export async function writeAppConfig(
  state: Record<string, string | undefined>,
): Promise<void> {
  await invoke("write_app_config", { state });
}

export async function chooseCoursePath(): Promise<string | null> {
  if (isTauriRuntime()) {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open Course Folder",
    });
    return typeof selected === "string" ? selected : null;
  }

  if (typeof window === "undefined") {
    return null;
  }
  const value = window.prompt("Enter the absolute path to a local course folder:");
  return value?.trim() ? value.trim() : null;
}

export async function chooseCourseCover(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Choose Course Cover",
    filters: [{ name: "Course cover", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export function installCourseCover(courseRoot: string, sourcePath: string): Promise<string> {
  return invoke<string>("install_course_cover", { courseRoot, sourcePath });
}

export function removeCourseCover(courseRoot: string): Promise<void> {
  return invoke("remove_course_cover", { courseRoot });
}

export async function chooseResourcePaths(): Promise<string[]> {
  if (isTauriRuntime()) {
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [
        {
          name: "Lesson resources",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "pdf",
            "txt",
            "md",
            "js",
            "ts",
            "jsx",
            "tsx",
            "html",
            "css",
            "py",
            "rs",
            "json",
          ],
        },
      ],
      title: "Import Lesson Resources",
    });
    return Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
  }

  if (typeof window === "undefined") {
    return [];
  }
  const value = window.prompt("Enter the absolute path to a local resource file:");
  return value?.trim() ? [value.trim()] : [];
}

export async function chooseDictionaryPack(): Promise<string | null> {
  const selected = await open({ directory: false, multiple: false, title: "Import Dictionary Pack", filters: [{ name: "Limmud dictionary", extensions: ["sqlite"] }] });
  return typeof selected === "string" ? selected : null;
}
export const dictionaryStatus = () => invoke<DictionaryStatus>("dictionary_status");
export const dictionaryImportPack = (sourcePath: string) => invoke<DictionaryStatus>("dictionary_import_pack", { sourcePath });
export const dictionaryRemovePack = () => invoke<void>("dictionary_remove_pack");
export const dictionarySearch = (query: string, limit = 30, offset = 0) => invoke<DictionarySearchResult[]>("dictionary_search", { query, limit, offset });
export const dictionaryGetEntry = (entryId: number) => invoke<DictionaryEntry>("dictionary_get_entry", { entryId });
export const vocabularyList = (courseRoot: string) => invoke<SavedVocabularyItem[]>("vocabulary_list", { courseRoot });
export const vocabularySave = (courseRoot: string, item: SavedVocabularyItem) => invoke<SavedVocabularyItem[]>("vocabulary_save", { courseRoot, item });
export const vocabularyUpdate = (courseRoot: string, item: SavedVocabularyItem) => invoke<SavedVocabularyItem[]>("vocabulary_update", { courseRoot, item });
export const vocabularyRemove = (courseRoot: string, id: string) => invoke<SavedVocabularyItem[]>("vocabulary_remove", { courseRoot, id });

export async function readLessonResources(
  courseRoot: string,
  lessonPath: string,
): Promise<LessonResource[]> {
  const result = await invoke<unknown>("read_lesson_resources", { courseRoot, lessonPath });
  return normalizeLessonResources(result);
}

export function readCourseResources(courseRoot: string): Promise<LessonResource[]> {
  return readLessonResources(courseRoot, "");
}

export async function importLessonResources(
  courseRoot: string,
  lessonPath: string,
  sourcePaths: string[],
): Promise<LessonResource[]> {
  const result = await invoke<unknown>("import_lesson_resources", {
    courseRoot,
    lessonPath,
    sourcePaths,
  });
  return normalizeLessonResources(result);
}

export async function openResource(courseRoot: string, storedRelativePath: string): Promise<void> {
  await invoke("open_resource", { courseRoot, storedRelativePath });
}

export async function openLessonExternal(
  courseRoot: string,
  absolutePath: string,
): Promise<void> {
  await invoke("open_lesson_external", { courseRoot, absolutePath });
}

export async function openLessonFolder(courseRoot: string, absolutePath: string): Promise<void> {
  await invoke("open_lesson_folder", { courseRoot, absolutePath });
}

export async function courseMediaUrl(
  courseRoot: string,
  absolutePath: string,
): Promise<string> {
  return invoke<string>("course_media_url", { courseRoot, absolutePath });
}

export type TerminalEvent =
  | { event: "output"; data: number[] }
  | { event: "exit"; data: number | null }
  | { event: "error"; data: string };

function terminalChannel(onEvent: (event: TerminalEvent) => void): Channel<TerminalEvent> {
  const channel = new Channel<TerminalEvent>();
  channel.onmessage = onEvent;
  return channel;
}

export function terminalStart(
  courseRoot: string,
  cols: number,
  rows: number,
  onEvent: (event: TerminalEvent) => void,
): Promise<string> {
  return invoke<string>("terminal_start", {
    courseRoot,
    cols,
    rows,
    outputChannel: terminalChannel(onEvent),
  });
}

export async function terminalWrite(sessionId: string, data: string): Promise<void> {
  await invoke("terminal_write", { sessionId, data });
}

export async function terminalResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("terminal_resize", { sessionId, cols, rows });
}

export async function terminalClose(sessionId: string): Promise<void> {
  await invoke("terminal_close", { sessionId });
}

export function terminalRestart(
  sessionId: string,
  courseRoot: string,
  cols: number,
  rows: number,
  onEvent: (event: TerminalEvent) => void,
): Promise<string> {
  return invoke<string>("terminal_restart", {
    sessionId,
    courseRoot,
    cols,
    rows,
    outputChannel: terminalChannel(onEvent),
  });
}

export function toFileUrl(path: string): string {
  return isTauriRuntime() ? convertFileSrc(path) : path;
}

export function toMediaUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  return isTauriRuntime() ? toFileProtocolUrl(normalizedPath) : encodeURI(normalizedPath);
}

function toFileProtocolUrl(path: string): string {
  if (/^[A-Za-z]:\//.test(path)) {
    const [drive, ...parts] = path.split("/");
    return `file:///${drive}/${parts.map(encodeURIComponent).join("/")}`;
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return path.startsWith("/") ? `file://${encodedPath}` : `file:///${encodedPath}`;
}

export function normalizeSaveNoteError(value: unknown): SaveNoteError {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const kind = raw.kind;
  const validKinds = new Set<SaveNoteErrorKind>([
    "permissionDenied", "readOnlyFilesystem", "parentMissing", "lessonMissing",
    "targetIsDirectory", "outsideCourse", "invalidPath", "io",
  ]);
  return {
    kind: typeof kind === "string" && validKinds.has(kind as SaveNoteErrorKind)
      ? kind as SaveNoteErrorKind
      : "io",
    message: typeof raw.message === "string" ? raw.message : String(value || "Unable to save note."),
    attemptedPath: typeof raw.attemptedPath === "string" ? raw.attemptedPath : "",
    parentPath: typeof raw.parentPath === "string" ? raw.parentPath : "",
    osError: typeof raw.osError === "string" ? raw.osError : undefined,
    recoverable: raw.recoverable !== false,
  };
}

const validKinds = new Set<CourseEntry["kind"]>([
  "directory",
  "video",
  "subtitle",
  "note",
  "image",
  "audio",
  "other",
]);

export function normalizeCourseEntries(value: unknown): CourseEntry[] {
  return Array.isArray(value)
    ? value
        .map(normalizeCourseEntry)
        .filter((entry): entry is CourseEntry => entry !== null)
    : [];
}

function normalizeCourseEntry(value: unknown): CourseEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = toNonEmptyString(raw.id);
  const name = toNonEmptyString(raw.name);
  const relativePath = firstString(raw.relativePath, raw.relative_path);
  const absolutePath = firstString(raw.absolutePath, raw.absolute_path);
  const kind = toFileKind(raw.kind);

  if (!id || !name || !relativePath || !absolutePath || !kind) {
    return null;
  }

  const children = Array.isArray(raw.children) ? normalizeCourseEntries(raw.children) : undefined;

  return children?.length
    ? { id, name, relativePath, absolutePath, kind, children }
    : { id, name, relativePath, absolutePath, kind };
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toNonEmptyString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function toFileKind(value: unknown): CourseEntry["kind"] | null {
  return typeof value === "string" && validKinds.has(value as CourseEntry["kind"])
    ? (value as CourseEntry["kind"])
    : null;
}

function normalizeLessonResources(value: unknown): LessonResource[] {
  return Array.isArray(value)
    ? value.map(normalizeLessonResource).filter((item): item is LessonResource => item !== null)
    : [];
}

function normalizeLessonResource(value: unknown): LessonResource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = toNonEmptyString(raw.id);
  const originalFilename = toNonEmptyString(raw.originalFilename);
  const storedRelativePath = toNonEmptyString(raw.storedRelativePath);
  const category = toNonEmptyString(raw.category);
  const lessonPath = toNonEmptyString(raw.lessonPath);
  const importedAt = toNonEmptyString(raw.importedAt);

  return id && originalFilename && storedRelativePath && category && lessonPath && importedAt
    ? { id, originalFilename, storedRelativePath, category, lessonPath, importedAt }
    : null;
}
