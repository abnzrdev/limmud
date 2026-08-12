import { invoke } from "@tauri-apps/api/core";
import type { MobileCourseRecord, ProviderCourseEntry } from "../components/mobile/mobileCourseModel";
import type { PortableCourseStateFiles } from "./mobileCourseState";

export type PickCourseOutcome =
  | { status: "cancelled" }
  | { status: "selected"; course: MobileCourseRecord };

export interface PreparedMedia {
  sourceId: string;
  url: string;
  mimeType: string;
  generation: number;
}

export interface MobileSubtitle {
  format: "vtt" | "srt";
  contents: string;
  generation: number;
}

export type LessonNoteStatus = "absent" | "editable" | "readOnly" | "writeAccessRequired" | "creationUnsupported" | "accessRequired";

export interface LessonNoteSnapshot {
  status: LessonNoteStatus;
  contents: string;
  checksum: string | null;
  canCreate: boolean;
  canWrite: boolean;
  draft?: string;
}

export type LessonNoteSaveResult =
  | { status: "saved"; checksum: string }
  | { status: "conflict"; checksum: string }
  | { status: "writeAccessRequired" | "creationUnsupported" | "accessRequired" | "failed" };

export interface MobileCourseService {
  pickCourse(): Promise<PickCourseOutcome>;
  restoreCourses(): Promise<MobileCourseRecord[]>;
  scanCourse(courseId: string): Promise<MobileCourseRecord>;
  relinkCourse(courseId: string): Promise<PickCourseOutcome>;
  upgradeCourseAccess(courseId: string): Promise<PickCourseOutcome>;
  prepareMedia(courseId: string, entryId: string): Promise<PreparedMedia>;
  releaseMedia(sourceId: string): Promise<void>;
  readSubtitle(courseId: string, entryId: string, generation: number): Promise<MobileSubtitle>;
  loadLessonNote(courseId: string, entryId: string): Promise<LessonNoteSnapshot>;
  saveLessonNote(courseId: string, entryId: string, contents: string, expectedChecksum: string | null): Promise<LessonNoteSaveResult>;
  saveLessonDraft(courseId: string, entryId: string, contents: string, expectedChecksum: string | null): Promise<void>;
  loadCourseState(courseId: string): Promise<CourseStateSnapshot>;
  loadCourseStateSources?(courseId: string): Promise<{ portable: CourseStateSnapshot; local: CourseStateSnapshot | null }>;
  clearLocalCourseState?(courseId: string): Promise<void>;
  saveCourseStateFile(courseId: string, file: CourseStateFile, contents: Record<string, string> | unknown[], expectedRevision: string | null): Promise<CourseStateSaveResult>;
  enterPictureInPicture(): Promise<{ status: "entered" | "unsupported" | "failed" }>;
  updateAndroidPlayback(state: AndroidPlaybackState): Promise<{ audioFocusGranted: boolean }>;
}

export interface AndroidPlaybackState {
  state: "idle" | "playing" | "paused" | "ended";
  positionSeconds: number;
  durationSeconds: number;
  canPrevious: boolean;
  canNext: boolean;
}

export type CourseStateFile = "state" | "progress" | "todos" | "vocabulary";
export type CourseStateStorage = "portable" | "localOnly";

export interface CourseStateSnapshot {
  storage: CourseStateStorage;
  revisions: Record<CourseStateFile, string | null>;
  files: PortableCourseStateFiles;
}

export type CourseStateSaveResult =
  | { status: "saved"; storage: CourseStateStorage; revision: string }
  | { status: "conflict"; storage: CourseStateStorage; revision: string }
  | { status: "malformed" | "accessRequired" | "failed"; storage: CourseStateStorage };

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

function isEntry(value: unknown): value is ProviderCourseEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if ("absolutePath" in entry) return false;
  return typeof entry.id === "string"
    && typeof entry.name === "string"
    && typeof entry.relativePath === "string"
    && ["directory", "video", "subtitle", "note", "image", "audio", "other"].includes(String(entry.kind))
    && (entry.children === undefined || Array.isArray(entry.children) && entry.children.every(isEntry));
}

function parseCourse(value: unknown): MobileCourseRecord {
  if (!value || typeof value !== "object") throw new Error("unsafe");
  const course = value as Record<string, unknown>;
  if (typeof course.courseId !== "string" || !course.courseId
    || typeof course.displayName !== "string"
    || !["available", "accessRequired"].includes(String(course.access))
    || !Array.isArray(course.entries) || !course.entries.every(isEntry)
    || !Number.isSafeInteger(course.warningCount) || Number(course.warningCount) < 0) {
    throw new Error("unsafe");
  }
  return course as unknown as MobileCourseRecord;
}

function parseOutcome(value: unknown): PickCourseOutcome {
  if (!value || typeof value !== "object") throw new Error("unsafe");
  const outcome = value as Record<string, unknown>;
  if (outcome.status === "cancelled") return { status: "cancelled" };
  if (outcome.status === "selected") return { status: "selected", course: parseCourse(outcome.course) };
  throw new Error("unsafe");
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("unsafe");
  const record = value as Record<string, unknown>;
  for (const key of ["uri", "documentUri", "documentId", "providerId", "absolutePath"]) {
    if (key in record) throw new Error("unsafe");
  }
  return record;
}

function parsePreparedMedia(value: unknown): PreparedMedia {
  const media = safeRecord(value);
  if (typeof media.sourceId !== "string" || !media.sourceId
    || typeof media.url !== "string" || !/^http:\/\/127\.0\.0\.1:\d+\/media\/[A-Za-z0-9_-]+$/.test(media.url)
    || typeof media.mimeType !== "string"
    || !Number.isSafeInteger(media.generation)) throw new Error("unsafe");
  return media as unknown as PreparedMedia;
}

function parseSubtitle(value: unknown): MobileSubtitle {
  const subtitle = safeRecord(value);
  if (!['vtt', 'srt'].includes(String(subtitle.format)) || typeof subtitle.contents !== "string" || !Number.isSafeInteger(subtitle.generation)) throw new Error("unsafe");
  return subtitle as unknown as MobileSubtitle;
}

function parseNote(value: unknown): LessonNoteSnapshot {
  const note = safeRecord(value);
  if (!['absent', 'editable', 'readOnly', 'writeAccessRequired', 'creationUnsupported', 'accessRequired'].includes(String(note.status))
    || typeof note.contents !== "string"
    || !(typeof note.checksum === "string" || note.checksum === null)
    || typeof note.canCreate !== "boolean" || typeof note.canWrite !== "boolean"
    || !(note.draft === undefined || typeof note.draft === "string")) throw new Error("unsafe");
  return note as unknown as LessonNoteSnapshot;
}

function parseSave(value: unknown): LessonNoteSaveResult {
  const result = safeRecord(value);
  if (result.status === "saved" || result.status === "conflict") {
    if (typeof result.checksum !== "string") throw new Error("unsafe");
    return result as unknown as LessonNoteSaveResult;
  }
  if (["writeAccessRequired", "creationUnsupported", "accessRequired", "failed"].includes(String(result.status))) return { status: result.status } as LessonNoteSaveResult;
  throw new Error("unsafe");
}

function stringRecord(value: unknown): Record<string, string> {
  const record = safeRecord(value);
  if (Object.values(record).some((item) => typeof item !== "string")) throw new Error("unsafe");
  return record as Record<string, string>;
}

function parseCourseState(value: unknown): CourseStateSnapshot {
  const snapshot = safeRecord(value);
  if (!['portable', 'localOnly'].includes(String(snapshot.storage))) throw new Error("unsafe");
  const revisions = safeRecord(snapshot.revisions);
  const files = safeRecord(snapshot.files);
  const revisionKeys: CourseStateFile[] = ["state", "progress", "todos", "vocabulary"];
  if (revisionKeys.some((key) => !(typeof revisions[key] === "string" || revisions[key] === null))) throw new Error("unsafe");
  if (!Array.isArray(files.vocabulary)) throw new Error("unsafe");
  return {
    storage: snapshot.storage as CourseStateStorage,
    revisions: revisions as unknown as Record<CourseStateFile, string | null>,
    files: {
      state: stringRecord(files.state),
      progress: stringRecord(files.progress),
      todos: stringRecord(files.todos),
      vocabulary: files.vocabulary as PortableCourseStateFiles["vocabulary"],
    },
  };
}

function parseCourseStateSave(value: unknown): CourseStateSaveResult {
  const result = safeRecord(value);
  if (!['portable', 'localOnly'].includes(String(result.storage))) throw new Error("unsafe");
  if (result.status === "saved" || result.status === "conflict") {
    if (typeof result.revision !== "string" || !result.revision) throw new Error("unsafe");
    return result as unknown as CourseStateSaveResult;
  }
  if (["malformed", "accessRequired", "failed"].includes(String(result.status))) {
    return { status: result.status, storage: result.storage } as CourseStateSaveResult;
  }
  throw new Error("unsafe");
}

function safeFailure(message: string, error: unknown): never {
  if (error instanceof Error && error.message === "unsafe") throw new Error("Course access returned an unsafe response.");
  throw new Error(message);
}

export function createMobileCourseService(call: InvokeFn = invoke): MobileCourseService {
  return {
    async pickCourse() {
      try { return parseOutcome(await call("plugin:saf-course|pick_course")); }
      catch (error) { return safeFailure("Limmud could not open the course folder picker.", error); }
    },
    async restoreCourses() {
      try {
        const value = await call("plugin:saf-course|restore_courses");
        if (!Array.isArray(value)) throw new Error("unsafe");
        return value.map(parseCourse);
      } catch (error) { return safeFailure("Limmud could not restore course access.", error); }
    },
    async scanCourse(courseId) {
      try { return parseCourse(await call("plugin:saf-course|scan_course", { courseId })); }
      catch (error) { return safeFailure("Limmud could not refresh this course.", error); }
    },
    async relinkCourse(courseId) {
      try { return parseOutcome(await call("plugin:saf-course|relink_course", { courseId })); }
      catch (error) { return safeFailure("Limmud could not relink this course.", error); }
    },
    async upgradeCourseAccess(courseId) {
      try { return parseOutcome(await call("plugin:saf-course|upgrade_course_access", { courseId })); }
      catch (error) { return safeFailure("Limmud could not enable course editing.", error); }
    },
    async prepareMedia(courseId, entryId) {
      try { return parsePreparedMedia(await call("plugin:saf-course|prepare_media", { courseId, entryId })); }
      catch (error) { return safeFailure("Limmud could not prepare this lesson for playback.", error); }
    },
    async releaseMedia(sourceId) {
      try { await call("plugin:saf-course|release_media", { sourceId }); }
      catch (error) { return safeFailure("Limmud could not release the previous lesson.", error); }
    },
    async readSubtitle(courseId, entryId, generation) {
      try { return parseSubtitle(await call("plugin:saf-course|read_subtitle", { courseId, entryId, generation })); }
      catch (error) { return safeFailure("Limmud could not load subtitles for this lesson.", error); }
    },
    async loadLessonNote(courseId, entryId) {
      try { return parseNote(await call("plugin:saf-course|load_lesson_note", { courseId, entryId })); }
      catch (error) { return safeFailure("Limmud could not load this lesson note.", error); }
    },
    async saveLessonNote(courseId, entryId, contents, expectedChecksum) {
      try { return parseSave(await call("plugin:saf-course|save_lesson_note", { courseId, entryId, contents, expectedChecksum })); }
      catch (error) { return safeFailure("Limmud could not save this lesson note. Your draft is preserved.", error); }
    },
    async saveLessonDraft(courseId, entryId, contents, expectedChecksum) {
      try { await call("plugin:saf-course|save_lesson_draft", { courseId, entryId, contents, expectedChecksum }); }
      catch (error) { return safeFailure("Limmud could not protect this draft.", error); }
    },
    async loadCourseState(courseId) {
      try { return parseCourseState(await call("plugin:saf-course|load_course_state", { courseId })); }
      catch (error) { return safeFailure("Limmud could not load course study state.", error); }
    },
    async loadCourseStateSources(courseId) {
      try {
        const result = safeRecord(await call("plugin:saf-course|load_course_state_sources", { courseId }));
        return { portable: parseCourseState(result.portable), local: result.local === null ? null : parseCourseState(result.local) };
      } catch (error) { return safeFailure("Limmud could not compare local and portable course state.", error); }
    },
    async clearLocalCourseState(courseId) {
      try { await call("plugin:saf-course|clear_local_course_state", { courseId }); }
      catch (error) { return safeFailure("Limmud could not finish enabling portable course saving.", error); }
    },
    async saveCourseStateFile(courseId, file, contents, expectedRevision) {
      try {
        return parseCourseStateSave(await call("plugin:saf-course|save_course_state_file", {
          courseId, file, contentsJson: JSON.stringify(contents), expectedRevision,
        }));
      } catch (error) { return safeFailure("Limmud could not save course study state. Changes remain on this device.", error); }
    },
    async enterPictureInPicture() {
      try {
        const result = safeRecord(await call("plugin:saf-course|enter_picture_in_picture", { width: 16, height: 9 }));
        if (!["entered", "unsupported", "failed"].includes(String(result.status))) throw new Error("unsafe");
        return { status: result.status } as { status: "entered" | "unsupported" | "failed" };
      } catch (error) { return safeFailure("Picture-in-Picture is unavailable.", error); }
    },
    async updateAndroidPlayback(state) {
      try {
        const result = safeRecord(await call("plugin:saf-course|update_android_playback", { ...state }));
        if (typeof result.audioFocusGranted !== "boolean") throw new Error("unsafe");
        return { audioFocusGranted: result.audioFocusGranted };
      } catch (error) { return safeFailure("Android media controls are unavailable.", error); }
    },
  };
}

export const mobileCourseService = createMobileCourseService();
