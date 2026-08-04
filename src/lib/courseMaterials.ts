import type { CourseEntry, FileKind } from "../types/course";

export type MaterialGroup = "Notes" | "Subtitles" | "Images" | "Audio" | "Documents" | "Other";
export interface CourseMaterial {
  id: string;
  name: string;
  relativePath: string;
  parentFolder: string;
  absolutePath: string;
  kind: FileKind;
  group: MaterialGroup;
}

const documentExtensions = new Set(["pdf", "doc", "docx", "odt", "rtf", "txt", "csv", "xls", "xlsx", "ppt", "pptx"]);
export const materialGroups: MaterialGroup[] = ["Notes", "Subtitles", "Images", "Audio", "Documents", "Other"];

export function collectCourseMaterials(entries: CourseEntry[]): CourseMaterial[] {
  return entries.flatMap((entry): CourseMaterial[] => {
    const pathParts = entry.relativePath.replace(/\\/g, "/").split("/");
    if (pathParts.includes(".limmud") || pathParts.includes(".learningappoffline")) return [];
    if (entry.kind === "directory") return collectCourseMaterials(entry.children ?? []);
    if (entry.kind === "video") return [];
    const normalized = entry.relativePath.replace(/\\/g, "/");
    return [{
      ...entry,
      id: entry.relativePath,
      parentFolder: normalized.split("/").slice(0, -1).join("/") || ".",
      group: materialGroup(entry),
    }];
  });
}

export function collectLessonMaterials(materials: CourseMaterial[], lesson: CourseEntry | null) {
  if (!lesson || lesson.kind !== "video") return [];
  const folder = lesson.relativePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || ".";
  return materials.filter((item) => item.parentFolder === folder);
}

export function filterMaterials(materials: CourseMaterial[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized
    ? materials.filter((item) => item.name.toLocaleLowerCase().includes(normalized) || item.relativePath.toLocaleLowerCase().includes(normalized))
    : materials;
}

export function groupMaterials(materials: CourseMaterial[]) {
  return Object.fromEntries(materialGroups.map((group) => [group, materials.filter((item) => item.group === group)])) as Record<MaterialGroup, CourseMaterial[]>;
}

function materialGroup(entry: CourseEntry): MaterialGroup {
  if (entry.kind === "note") return "Notes";
  if (entry.kind === "subtitle") return "Subtitles";
  if (entry.kind === "image") return "Images";
  if (entry.kind === "audio") return "Audio";
  const extension = entry.name.toLocaleLowerCase().split(".").pop() ?? "";
  return documentExtensions.has(extension) ? "Documents" : "Other";
}
