export type FileKind =
  | "directory"
  | "video"
  | "subtitle"
  | "note"
  | "image"
  | "audio"
  | "other";

export interface CourseEntry {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: FileKind;
  children?: CourseEntry[];
}
