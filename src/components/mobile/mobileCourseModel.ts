import type { FileKind } from "../../types/course";
import type { MobileEntry, MobileLesson, MobileSection } from "./mobileModel";

export type MobileCourseAccess = "available" | "accessRequired";

export interface ProviderCourseEntry {
  id: string;
  name: string;
  relativePath: string;
  kind: FileKind;
  children?: ProviderCourseEntry[];
}

export interface MobileCourseRecord {
  courseId: string;
  displayName: string;
  access: MobileCourseAccess;
  entries: ProviderCourseEntry[];
  warningCount: number;
}

function asMobileLesson(entry: ProviderCourseEntry): MobileLesson {
  return {
    ...entry,
    kind: "video",
    duration: "--:--",
    completed: false,
    bookmarked: false,
    note: "",
  };
}

function collectVideos(entries: ProviderCourseEntry[]): MobileLesson[] {
  return entries.flatMap((entry) => entry.kind === "video"
    ? [asMobileLesson(entry)]
    : collectVideos(entry.children ?? []));
}

function hasVideoDescendant(entry: ProviderCourseEntry): boolean {
  return entry.kind === "video" || Boolean(entry.children?.some(hasVideoDescendant));
}

function visibleProviderEntries(entries: ProviderCourseEntry[]): MobileEntry[] {
  return entries.flatMap((entry): MobileEntry[] => {
    if (entry.kind === "video") return [{ ...entry, children: undefined }];
    if (entry.kind !== "directory" || !hasVideoDescendant(entry)) return [];
    return [{ ...entry, children: visibleProviderEntries(entry.children ?? []) }];
  });
}

export function mobileSections(record: MobileCourseRecord): MobileSection[] {
  if (record.access !== "available") return [];
  const visible = visibleProviderEntries(record.entries);
  const rootLessons = visible.filter((entry) => entry.kind === "video").map((entry) => asMobileLesson(entry));
  const sections = visible
    .filter((entry) => entry.kind === "directory")
    .map((entry) => ({
      ...entry,
      kind: "directory" as const,
      children: collectVideos(entry.children ?? [] as ProviderCourseEntry[]),
    }));
  return rootLessons.length ? [{
    id: `${record.courseId}:root`,
    name: "Course files",
    relativePath: "",
    kind: "directory",
    children: rootLessons,
  }, ...sections] : sections;
}

export function mobileLessons(record: MobileCourseRecord): MobileLesson[] {
  if (record.access !== "available") return [];
  return collectVideos(visibleProviderEntries(record.entries) as ProviderCourseEntry[]);
}

export function reconcileLessonSelection(previousId: string | null, record: MobileCourseRecord): string | null {
  const lessons = mobileLessons(record);
  return lessons.some((lesson) => lesson.id === previousId) ? previousId : lessons[0]?.id ?? null;
}
