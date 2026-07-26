import { describe, expect, it } from "vitest";
import { findFirstVideo, findNextVideo, listLessonEntriesForSelection } from "../lib/courseTree";
import type { CourseEntry } from "../types/course";

describe("findFirstVideo", () => {
  it("returns the first nested video entry", () => {
    const entries: CourseEntry[] = [
      {
        id: "week-1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "week-1/lesson.mp4",
            name: "lesson.mp4",
            relativePath: "Week 1/lesson.mp4",
            absolutePath: "/tmp/course/Week 1/lesson.mp4",
            kind: "video",
          },
        ],
      },
    ];

    expect(findFirstVideo(entries)?.name).toBe("lesson.mp4");
  });
});

describe("listLessonEntriesForSelection", () => {
  it("returns siblings from the selected file's directory", () => {
    const entries: CourseEntry[] = [
      {
        id: "week-1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "week-1/lesson.mp4",
            name: "lesson.mp4",
            relativePath: "Week 1/lesson.mp4",
            absolutePath: "/tmp/course/Week 1/lesson.mp4",
            kind: "video",
          },
          {
            id: "week-1/lesson.notes.md",
            name: "lesson.notes.md",
            relativePath: "Week 1/lesson.notes.md",
            absolutePath: "/tmp/course/Week 1/lesson.notes.md",
            kind: "note",
          },
        ],
      },
    ];

    expect(
      listLessonEntriesForSelection(entries, "week-1/lesson.mp4").map(
        (entry) => entry.name,
      ),
    ).toEqual(["lesson.mp4", "lesson.notes.md"]);
  });
});

describe("findNextVideo", () => {
  it("returns the next video after the current lesson", () => {
    const entries: CourseEntry[] = [
      {
        id: "week-1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "week-1/intro.mp4",
            name: "intro.mp4",
            relativePath: "Week 1/intro.mp4",
            absolutePath: "/tmp/course/Week 1/intro.mp4",
            kind: "video",
          },
          {
            id: "week-1/deep-dive.mp4",
            name: "deep-dive.mp4",
            relativePath: "Week 1/deep-dive.mp4",
            absolutePath: "/tmp/course/Week 1/deep-dive.mp4",
            kind: "video",
          },
        ],
      },
    ];

    expect(findNextVideo(entries, "week-1/intro.mp4")?.id).toBe("week-1/deep-dive.mp4");
  });

  it("preserves nested course section order", () => {
    const entries: CourseEntry[] = [
      {
        id: "week-1",
        name: "Week 1",
        relativePath: "Week 1",
        absolutePath: "/tmp/course/Week 1",
        kind: "directory",
        children: [
          {
            id: "week-1/intro.mp4",
            name: "intro.mp4",
            relativePath: "Week 1/intro.mp4",
            absolutePath: "/tmp/course/Week 1/intro.mp4",
            kind: "video",
          },
        ],
      },
      {
        id: "week-2",
        name: "Week 2",
        relativePath: "Week 2",
        absolutePath: "/tmp/course/Week 2",
        kind: "directory",
        children: [
          {
            id: "week-2/topic-a",
            name: "Topic A",
            relativePath: "Week 2/Topic A",
            absolutePath: "/tmp/course/Week 2/Topic A",
            kind: "directory",
            children: [
              {
                id: "week-2/topic-a/lesson.mp4",
                name: "lesson.mp4",
                relativePath: "Week 2/Topic A/lesson.mp4",
                absolutePath: "/tmp/course/Week 2/Topic A/lesson.mp4",
                kind: "video",
              },
            ],
          },
        ],
      },
    ];

    expect(findNextVideo(entries, "week-1/intro.mp4")?.id).toBe("week-2/topic-a/lesson.mp4");
  });

  it("returns null for the last video in the course", () => {
    const entries: CourseEntry[] = [
      {
        id: "week-1/final.mp4",
        name: "final.mp4",
        relativePath: "Week 1/final.mp4",
        absolutePath: "/tmp/course/Week 1/final.mp4",
        kind: "video",
      },
    ];

    expect(findNextVideo(entries, "week-1/final.mp4")).toBeNull();
  });
});
