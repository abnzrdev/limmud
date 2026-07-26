// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LessonWorkspace } from "./LessonWorkspace";
import type { CourseEntry } from "../../types/course";

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: () => [],
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, placeholder }: { placeholder?: string; value: string }) => (
    <div>{value || placeholder}</div>
  ),
}));

it("renders selected lesson details and related note tabs", () => {
  const selectedEntry: CourseEntry = {
    id: "week-1/lesson.mp4",
    name: "lesson.mp4",
    relativePath: "Week 1/lesson.mp4",
    absolutePath: "/tmp/course/Week 1/lesson.mp4",
    kind: "video",
  };

  const lessonEntries: CourseEntry[] = [
    selectedEntry,
    {
      id: "week-1/lesson.notes.md",
      name: "lesson.notes.md",
      relativePath: "Week 1/lesson.notes.md",
      absolutePath: "/tmp/course/Week 1/lesson.notes.md",
      kind: "note",
    },
  ];

  const { container } = render(
    <LessonWorkspace
      currentCourseRoot="/tmp/course"
      selectedEntry={selectedEntry}
      selectedSubtitle={null}
      lessonEntries={lessonEntries}
      resumeTime={0}
      shouldAutoPlaySelectedEntry={false}
      noteBody="# Notes"
      noteSaveStatus="saved"
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onVideoProgress={() => {}}
      onVideoEnded={() => {}}
      onWatchedSeconds={() => {}}
      isLessonDone={false}
      isLessonBookmarked={false}
      onToggleLessonDone={() => {}}
      onToggleLessonBookmark={() => {}}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "lesson.mp4" }),
  ).toBeInTheDocument();
  const breadcrumb = container.querySelector(".workspace-breadcrumb");
  expect(breadcrumb).toHaveTextContent("Week 1");
  expect(breadcrumb).toHaveAttribute("title", "Week 1/lesson.mp4");
  expect(screen.getByText("lesson.notes.md")).toBeInTheDocument();
  expect(screen.getByText("# Notes")).toBeInTheDocument();
});

it("shows placeholder text when notes are empty", () => {
  const selectedEntry: CourseEntry = {
    id: "week-1/lesson.mp4",
    name: "lesson.mp4",
    relativePath: "Week 1/lesson.mp4",
    absolutePath: "/tmp/course/Week 1/lesson.mp4",
    kind: "video",
  };

  render(
    <LessonWorkspace
      currentCourseRoot="/tmp/course"
      selectedEntry={selectedEntry}
      selectedSubtitle={null}
      lessonEntries={[selectedEntry]}
      resumeTime={0}
      shouldAutoPlaySelectedEntry={false}
      noteBody=""
      noteSaveStatus="saved"
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onVideoProgress={() => {}}
      onVideoEnded={() => {}}
      onWatchedSeconds={() => {}}
      isLessonDone={false}
      isLessonBookmarked={false}
      onToggleLessonDone={() => {}}
      onToggleLessonBookmark={() => {}}
    />,
  );

  expect(screen.getByText("Write notes for this lesson...")).toBeInTheDocument();
});

it("shows no supported videos when a course is loaded without a selected lesson", () => {
  render(
    <LessonWorkspace
      currentCourseRoot="/tmp/course"
      selectedEntry={null}
      selectedSubtitle={null}
      lessonEntries={[]}
      resumeTime={0}
      shouldAutoPlaySelectedEntry={false}
      noteBody=""
      noteSaveStatus="saved"
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onVideoProgress={() => {}}
      onVideoEnded={() => {}}
      onWatchedSeconds={() => {}}
      isLessonDone={false}
      isLessonBookmarked={false}
      onToggleLessonDone={() => {}}
      onToggleLessonBookmark={() => {}}
    />,
  );

  expect(screen.getByText("No supported videos found")).toBeInTheDocument();
});

it("shows a folder empty state when the selected folder has no videos", () => {
  const selectedEntry: CourseEntry = {
    id: "empty",
    name: "Empty",
    relativePath: "Empty",
    absolutePath: "/tmp/course/Empty",
    kind: "directory",
    children: [],
  };

  render(
    <LessonWorkspace
      currentCourseRoot="/tmp/course"
      selectedEntry={selectedEntry}
      selectedSubtitle={null}
      lessonEntries={[]}
      resumeTime={0}
      shouldAutoPlaySelectedEntry={false}
      noteBody=""
      noteSaveStatus="saved"
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onVideoProgress={() => {}}
      onVideoEnded={() => {}}
      onWatchedSeconds={() => {}}
      isLessonDone={false}
      isLessonBookmarked={false}
      onToggleLessonDone={() => {}}
      onToggleLessonBookmark={() => {}}
    />,
  );

  expect(screen.getByText("No videos in this folder")).toBeInTheDocument();
});
