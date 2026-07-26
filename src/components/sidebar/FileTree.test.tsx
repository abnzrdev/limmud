// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FileTree } from "./FileTree";
import type { CourseEntry } from "../../types/course";

it("renders a shortened file entry label with the full path as a title", () => {
  render(
    <FileTree
      entries={[
        {
          id: "lesson.mp4",
          name: "Week 1 - lesson.mp4",
          relativePath: "Week 1/Week 1 - lesson.mp4",
          absolutePath: "/tmp/lesson.mp4",
          kind: "video",
        },
      ]}
      onSelect={() => {}}
    />,
  );

  const entry = screen.getByRole("button", { name: "lesson" });
  expect(entry).toBeInTheDocument();
  expect(entry).toHaveClass("tree-entry-video");
  expect(entry).toHaveAttribute("title", "Week 1/Week 1 - lesson.mp4");
});

it("shows folders and videos but hides subtitle and note items", () => {
  cleanup();

  render(
    <FileTree
      entries={[
        {
          id: "week1",
          name: "Week 1",
          relativePath: "Week 1",
          absolutePath: "/tmp/Week 1",
          kind: "directory",
          children: [
            {
              id: "week1/lesson.mp4",
              name: "lesson.mp4",
              relativePath: "Week 1/lesson.mp4",
              absolutePath: "/tmp/Week 1/lesson.mp4",
              kind: "video",
            },
            {
              id: "week1/lesson.srt",
              name: "lesson.srt",
              relativePath: "Week 1/lesson.srt",
              absolutePath: "/tmp/Week 1/lesson.srt",
              kind: "subtitle",
            },
            {
              id: "week1/lesson.notes.md",
              name: "lesson.notes.md",
              relativePath: "Week 1/lesson.notes.md",
              absolutePath: "/tmp/Week 1/lesson.notes.md",
              kind: "note",
            },
            {
              id: "week1/empty",
              name: "Empty Folder",
              relativePath: "Week 1/Empty Folder",
              absolutePath: "/tmp/Week 1/Empty Folder",
              kind: "directory",
              children: [],
            },
            {
              id: "week1/notes-only",
              name: "Notes Only",
              relativePath: "Week 1/Notes Only",
              absolutePath: "/tmp/Week 1/Notes Only",
              kind: "directory",
              children: [
                {
                  id: "week1/notes-only/readme.md",
                  name: "readme.md",
                  relativePath: "Week 1/Notes Only/readme.md",
                  absolutePath: "/tmp/Week 1/Notes Only/readme.md",
                  kind: "note",
                },
              ],
            },
            {
              id: "week1/nested",
              name: "Nested Folder",
              relativePath: "Week 1/Nested Folder",
              absolutePath: "/tmp/Week 1/Nested Folder",
              kind: "directory",
              children: [
                {
                  id: "week1/nested/deep-lesson.mp4",
                  name: "deep-lesson.mp4",
                  relativePath: "Week 1/Nested Folder/deep-lesson.mp4",
                  absolutePath: "/tmp/Week 1/Nested Folder/deep-lesson.mp4",
                  kind: "video",
                },
              ],
            },
            {
              id: "week1/code-only",
              name: "Code Only",
              relativePath: "Week 1/Code Only",
              absolutePath: "/tmp/Week 1/Code Only",
              kind: "directory",
              children: [
                {
                  id: "week1/code-only/deep",
                  name: "Deep Code",
                  relativePath: "Week 1/Code Only/Deep Code",
                  absolutePath: "/tmp/Week 1/Code Only/Deep Code",
                  kind: "directory",
                  children: [
                    {
                      id: "week1/code-only/deep/index.html",
                      name: "index.html",
                      relativePath: "Week 1/Code Only/Deep Code/index.html",
                      absolutePath: "/tmp/Week 1/Code Only/Deep Code/index.html",
                      kind: "other",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]}
      onSelect={() => {}}
    />,
  );

  expect(screen.getByText("Week 1")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Week 1" })).toHaveClass("tree-entry-folder");
  expect(screen.getAllByText("lesson")).toHaveLength(1);
  expect(screen.getByText("Nested Folder")).toBeInTheDocument();
  expect(screen.getByText("deep-lesson")).toBeInTheDocument();
  expect(screen.queryByText("Empty Folder")).not.toBeInTheDocument();
  expect(screen.queryByText("Notes Only")).not.toBeInTheDocument();
  expect(screen.queryByText("Code Only")).not.toBeInTheDocument();
  expect(screen.queryByText("Deep Code")).not.toBeInTheDocument();
  expect(screen.queryByText("lesson.srt")).not.toBeInTheDocument();
  expect(screen.queryByText("lesson.notes.md")).not.toBeInTheDocument();
  expect(screen.queryByText("readme.md")).not.toBeInTheDocument();
  expect(screen.queryByText("index.html")).not.toBeInTheDocument();
});

it("keeps scanned natural order while pruning no-video folders", () => {
  cleanup();

  render(
    <FileTree
      entries={[
        folder("Lesson 1", [video("Lesson 1/intro.mp4")]),
        folder("Lesson 2", [other("Lesson 2/index.html")]),
        folder("Lesson 10", [video("Lesson 10/recap.mp4")]),
      ]}
      onSelect={() => {}}
    />,
  );

  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "Lesson 1",
    "intro",
    "Lesson 10",
    "recap",
  ]);
});

it("renders a clean empty outline for courses without videos", () => {
  cleanup();

  render(
    <FileTree
      entries={[
        folder("Notes", [other("Notes/readme.md")]),
        folder("Subtitles", [
          {
            ...other("Subtitles/lesson.srt"),
            kind: "subtitle" as const,
          },
        ]),
      ]}
      onSelect={() => {}}
    />,
  );

  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

function folder(name: string, children: CourseEntry[]): CourseEntry {
  return {
    id: name.toLowerCase(),
    name,
    relativePath: name,
    absolutePath: `/tmp/${name}`,
    kind: "directory" as const,
    children,
  };
}

function video(path: string): CourseEntry {
  return entry(path, "video" as const);
}

function other(path: string): CourseEntry {
  return entry(path, "other" as const);
}

function entry(path: string, kind: "video" | "other"): CourseEntry {
  const parts = path.split("/");
  const name = parts[parts.length - 1] ?? path;
  return {
    id: path.toLowerCase(),
    name,
    relativePath: path,
    absolutePath: `/tmp/${path}`,
    kind,
  };
}
