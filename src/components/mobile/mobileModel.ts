import type { FileKind } from "../../types/course";

export type MobileDestination = "home" | "course" | "study" | "notes" | "tools";
export type MobileTool = "timer" | "todos" | "bookmarks" | "dictionary" | "vocabulary";

export interface MobileEntry {
  id: string;
  name: string;
  relativePath: string;
  kind: FileKind;
  children?: MobileEntry[];
}

export interface MobileLesson extends MobileEntry {
  kind: "video";
  duration: string;
  completed: boolean;
  bookmarked: boolean;
  note: string;
}

export interface MobileSection extends MobileEntry {
  kind: "directory";
  children: MobileLesson[];
}

export function lessonTitle(lesson: MobileLesson): string {
  return lesson.name.replace(/\.[^.]+$/, "");
}

export function sectionForMobileLesson(sections: MobileSection[], id: string): MobileSection | null {
  return sections.find((section) => section.children.some((lesson) => lesson.id === id)) ?? null;
}
