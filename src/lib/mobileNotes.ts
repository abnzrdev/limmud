import { resolvePrimaryNotePath } from "./notePath";

export function canonicalNoteName(lessonName: string): string {
  return resolvePrimaryNotePath(lessonName, []).split("/").pop() ?? "notes.md";
}
