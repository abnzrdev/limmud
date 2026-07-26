// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { NotesTabs, trimLookupText } from "./NotesTabs";

vi.mock("@codemirror/lang-markdown", () => ({ markdown: () => [] }));
vi.mock("@codemirror/view", () => ({ EditorView: { lineWrapping: "line-wrapping", theme: () => "notes-theme" } }));
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Notes" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

afterEach(() => cleanup());

it("trims punctuation without changing meaningful apostrophes and hyphens", () => {
  expect(trimLookupText(" “well-being!” ")).toBe("well-being");
  expect(trimLookupText("don't")).toBe("don't");
});

it("keeps Notes permanently visible without a Terminal tab", () => {
  function Harness() {
    const [note, setNote] = useState("draft");
    return (
      <NotesTabs
        lessonEntries={[]}
        noteBody={note}
        noteSaveStatus="saved"
        onNoteChange={setNote}
        onSaveNote={() => {}}
      />
    );
  }

  render(<Harness />);
  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
    target: { value: "kept draft" },
  });

  expect(screen.queryByRole("tab", { name: "Terminal" })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("kept draft");
});

it("debounces note autosave", () => {
  vi.useFakeTimers();
  const onSaveNote = vi.fn();
  render(
    <NotesTabs
      lessonEntries={[]}
      noteBody=""
      noteSaveStatus="saved"
      onNoteChange={() => {}}
      onSaveNote={onSaveNote}
    />,
  );

  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
    target: { value: "# Draft" },
  });
  vi.advanceTimersByTime(999);
  expect(onSaveNote).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onSaveNote).toHaveBeenCalledWith("# Draft");
  vi.useRealTimers();
});

it("explains permission failures without discarding the dirty note", () => {
  const onSaveNote = vi.fn();
  render(
    <NotesTabs
      lessonEntries={[]}
      noteBody="Keep this draft"
      noteSaveStatus="failed"
      noteSaveError={{
        kind: "permissionDenied",
        message: "permission denied",
        attemptedPath: "/tmp/course/Week 1/lesson.notes.md",
        parentPath: "/tmp/course/Week 1",
        recoverable: true,
      }}
      onNoteChange={() => {}}
      onSaveNote={onSaveNote}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Cannot save beside this lesson");
  expect(screen.getByRole("alert")).toHaveTextContent("/tmp/course/Week 1");
  expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Keep this draft");
  expect(screen.getByRole("button", { name: "Copy Notes" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onSaveNote).toHaveBeenCalledWith("Keep this draft");
});

const lessonEntries = [
  { id: "video", name: "lesson.mp4", relativePath: "unit/lesson.mp4", absolutePath: "/course/unit/lesson.mp4", kind: "video" as const },
  { id: "sidecar", name: "lesson.notes.md", relativePath: "unit/lesson.notes.md", absolutePath: "/course/unit/lesson.notes.md", kind: "note" as const },
  { id: "one", name: "notes.md", relativePath: "unit/a/notes.md", absolutePath: "/course/unit/a/notes.md", kind: "note" as const },
  { id: "two", name: "notes.md", relativePath: "unit/b/notes.md", absolutePath: "/course/unit/b/notes.md", kind: "note" as const },
];

it("renders exact-path note buttons and loads a clicked tab without changing video", async () => {
  const load = vi.fn(async (path: string) => `loaded ${path}`);
  const selectVideo = vi.fn();
  render(<NotesTabs
    lessonPath="unit/lesson.mp4"
    lessonEntries={lessonEntries}
    noteBody="sidecar"
    noteSaveStatus="saved"
    onNoteChange={() => {}}
    onSaveNote={() => {}}
    onLoadTextFile={load}
    onSaveTextFile={vi.fn()}
  />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(tabs[1]).toHaveAttribute("title", "unit/a");
  fireEvent.click(tabs[1]);
  expect(await screen.findByDisplayValue("loaded unit/a/notes.md")).toBeInTheDocument();
  expect(load).toHaveBeenCalledWith("unit/a/notes.md");
  expect(selectVideo).not.toHaveBeenCalled();
});

it("preserves separate drafts and clears only the saved tab", async () => {
  const save = vi.fn(async () => {});
  render(<NotesTabs
    lessonPath="unit/lesson.mp4"
    lessonEntries={lessonEntries}
    noteBody="sidecar"
    noteSaveStatus="saved"
    onNoteChange={() => {}}
    onSaveNote={() => {}}
    onLoadTextFile={async (path) => path}
    onSaveTextFile={save}
  />);
  const tabs = screen.getAllByRole("tab");
  fireEvent.click(tabs[1]);
  fireEvent.change(await screen.findByRole("textbox", { name: "Notes" }), { target: { value: "draft a" } });
  fireEvent.click(tabs[2]);
  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "draft b" } });
  fireEvent.click(tabs[1]);
  expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("draft a");
  fireEvent.click(screen.getByRole("button", { name: "Save Notes" }));
  expect(save).toHaveBeenCalledWith("unit/a/notes.md", "draft a");
  expect(tabs[1]).not.toHaveTextContent("Unsaved");
  expect(tabs[2]).toHaveTextContent("Unsaved");
});

it("supports arrow, Home, and End tab navigation", () => {
  render(<NotesTabs lessonPath="unit/lesson.mp4" lessonEntries={lessonEntries} noteBody="sidecar" noteSaveStatus="saved" onNoteChange={() => {}} onSaveNote={() => {}} onLoadTextFile={async () => ""} onSaveTextFile={async () => {}} />);
  const tablist = screen.getByRole("tablist");
  fireEvent.keyDown(tablist, { key: "End" });
  const tabs = screen.getAllByRole("tab");
  expect(tabs[tabs.length - 1]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tablist, { key: "Home" });
  expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tablist, { key: "ArrowRight" });
  expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
});

it("keeps the exact draft and reports a selected note removed by refresh", async () => {
  const { rerender } = render(<NotesTabs lessonPath="unit/lesson.mp4" lessonEntries={lessonEntries} noteBody="sidecar" noteSaveStatus="saved" onNoteChange={() => {}} onSaveNote={() => {}} onLoadTextFile={async () => "draft"} onSaveTextFile={async () => {}} />);
  fireEvent.click(screen.getAllByRole("tab")[1]);
  await screen.findByDisplayValue("draft");
  rerender(<NotesTabs lessonPath="unit/lesson.mp4" lessonEntries={lessonEntries.filter((entry) => entry.id !== "one")} noteBody="sidecar" noteSaveStatus="saved" onNoteChange={() => {}} onSaveNote={() => {}} onLoadTextFile={async () => ""} onSaveTextFile={async () => {}} />);
  expect(screen.getByRole("alert")).toHaveTextContent("unit/a/notes.md");
  expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("draft");
});
