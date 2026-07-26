import { describe, expect, it } from "vitest";
import { collectCourseMaterials, filterMaterials, groupMaterials } from "./courseMaterials";
import type { CourseEntry } from "../types/course";

const entries: CourseEntry[] = [{
  id: "week", name: "Week", relativePath: "Week", absolutePath: "/c/Week", kind: "directory",
  children: [
    { id: "v", name: "lesson.mp4", relativePath: "Week/lesson.mp4", absolutePath: "/c/Week/lesson.mp4", kind: "video" },
    { id: "n", name: "notes.md", relativePath: "Week/notes.md", absolutePath: "/c/Week/notes.md", kind: "note" },
    { id: "p", name: "guide.pdf", relativePath: "Week/guide.pdf", absolutePath: "/c/Week/guide.pdf", kind: "other" },
    { id: "i", name: "same.png", relativePath: "Week/same.png", absolutePath: "/c/Week/same.png", kind: "image" },
  ],
}, {
  id: "other", name: "Other", relativePath: "Other", absolutePath: "/c/Other", kind: "directory",
  children: [{ id: "i2", name: "same.png", relativePath: "Other/same.png", absolutePath: "/c/Other/same.png", kind: "image" }],
}, {
  id: "internal", name: "secret.json", relativePath: ".learningappoffline/secret.json", absolutePath: "/c/.learningappoffline/secret.json", kind: "other",
}];

describe("course materials", () => {
  it("excludes videos/internal state and preserves duplicate exact paths", () => {
    expect(collectCourseMaterials(entries).map((item) => item.relativePath)).toEqual([
      "Week/notes.md", "Week/guide.pdf", "Week/same.png", "Other/same.png",
    ]);
  });

  it("groups documents and filters by filename or folder", () => {
    const materials = collectCourseMaterials(entries);
    expect(groupMaterials(materials).Documents.map((item) => item.name)).toEqual(["guide.pdf"]);
    expect(filterMaterials(materials, "other").map((item) => item.relativePath)).toEqual(["Other/same.png"]);
    expect(filterMaterials(materials, "notes").map((item) => item.name)).toEqual(["notes.md"]);
  });
});
