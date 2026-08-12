import { describe, expect, it } from "vitest";
import {
  mobileLessons,
  mobileSections,
  reconcileLessonSelection,
  type MobileCourseRecord,
  type ProviderCourseEntry,
} from "./mobileCourseModel";

const entries: ProviderCourseEntry[] = [
  {
    id: "section-01",
    name: "01 Foundations",
    relativePath: "01 Foundations",
    kind: "directory",
    children: [
      { id: "lesson-02", name: "02 Practice.mp4", relativePath: "01 Foundations/02 Practice.mp4", kind: "video" },
      { id: "subtitle-02", name: "02 Practice.srt", relativePath: "01 Foundations/02 Practice.srt", kind: "subtitle" },
      { id: "unsupported", name: "archive.zip", relativePath: "01 Foundations/archive.zip", kind: "other" },
    ],
  },
  {
    id: "section-02",
    name: "02 Review",
    relativePath: "02 Review",
    kind: "directory",
    children: [
      { id: "lesson-10", name: "10 Recall.mp4", relativePath: "02 Review/10 Recall.mp4", kind: "video" },
    ],
  },
];

const record: MobileCourseRecord = {
  courseId: "course-opaque",
  displayName: "Synthetic Course",
  access: "available",
  entries,
  warningCount: 0,
};

describe("provider-neutral mobile course model", () => {
  it("accepts entries without desktop absolute paths and keeps nested section order", () => {
    expect(mobileSections(record).map((section) => section.name)).toEqual(["01 Foundations", "02 Review"]);
    expect(mobileSections(record)[0].children.map((lesson) => lesson.id)).toEqual(["lesson-02"]);
  });

  it("returns only visible video lessons in provider order", () => {
    expect(mobileLessons(record).map((lesson) => lesson.id)).toEqual(["lesson-02", "lesson-10"]);
  });

  it("keeps root-level videos reachable through a course-files section", () => {
    const rootRecord: MobileCourseRecord = {
      ...record,
      entries: [{ id: "root-video", name: "Welcome.mp4", relativePath: "Welcome.mp4", kind: "video" }],
    };
    expect(mobileSections(rootRecord)[0]).toMatchObject({ name: "Course files", children: [{ id: "root-video" }] });
  });

  it("preserves a surviving selection and falls back to the first video", () => {
    expect(reconcileLessonSelection("lesson-10", record)).toBe("lesson-10");
    expect(reconcileLessonSelection("removed", record)).toBe("lesson-02");
  });

  it("has no selection when access is unavailable", () => {
    expect(reconcileLessonSelection("lesson-02", { ...record, access: "accessRequired", entries: [] })).toBeNull();
  });
});
