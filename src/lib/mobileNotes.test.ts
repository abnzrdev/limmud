import { describe, expect, it } from "vitest";
import { canonicalNoteName } from "./mobileNotes";

describe("Android lesson note identity", () => {
  it("matches the desktop Path.with_extension notes convention", () => {
    expect(canonicalNoteName("lesson_01.mp4")).toBe("lesson_01.notes.md");
    expect(canonicalNoteName("lesson.with.dots.mkv")).toBe("lesson.with.dots.notes.md");
  });
});
