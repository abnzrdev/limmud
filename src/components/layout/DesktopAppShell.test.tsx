// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DesktopAppShell } from "./DesktopAppShell";

const model = vi.hoisted(() => ({
  knownCourses: [{ root: "/synthetic/course-a", name: "Course A", lastOpenedAt: "2026-08-10T10:00:00.000Z", coverPath: null, coverUrl: null, available: true, completedLessons: 1, totalLessons: 2, selectedEntryId: "lesson-2", selectedLessonName: "Lesson Two", lessonNames: ["Lesson One", "Lesson Two"], bookmarkedLessonNames: [], noteNames: [] }],
  theme: "dark",
  currentCourseRoot: null,
  selectedEntry: null,
  openKnownCourse: vi.fn(async () => true),
  locateCourse: vi.fn(async () => true),
  openCourse: vi.fn(),
  toggleTheme: vi.fn(),
  changeCourseCover: vi.fn(),
  clearCourseCover: vi.fn(),
  forgetCourse: vi.fn(),
}));

vi.mock("../../hooks/useAppModel", () => ({ useAppModel: () => model }));
vi.mock("./AppShell", () => ({ AppShell: ({ onDashboard }: { onDashboard: () => void }) => <div><h1>Study workspace</h1><button onClick={onDashboard}>Dashboard Home</button></div> }));
vi.mock("../dictionary/DictionaryDrawer", () => ({ DictionaryDrawer: () => null }));

it("starts on Dashboard, resumes the existing workspace, and returns home", async () => {
  render(<DesktopAppShell />);
  expect(screen.getByRole("heading", { name: "Your courses" })).toBeInTheDocument();
  expect(screen.queryByText("Zen Mode")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Continue Lesson Two/ }));
  await waitFor(() => expect(model.openKnownCourse).toHaveBeenCalledWith("/synthetic/course-a"));
  expect(screen.getByRole("heading", { name: "Study workspace" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Dashboard Home" }));
  expect(screen.getByRole("heading", { name: "Your courses" })).toBeInTheDocument();
});
