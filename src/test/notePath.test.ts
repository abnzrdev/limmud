import { describe, expect, it } from "vitest";
import { resolvePrimaryNotePath } from "../lib/notePath";

describe("resolvePrimaryNotePath", () => {
  it("prefers a video-specific notes file", () => {
    expect(
      resolvePrimaryNotePath("week1/lesson.mp4", ["week1/lesson.notes.md"]),
    ).toBe("week1/lesson.notes.md");
  });

  it("uses a video-specific notes file instead of sibling notes.md", () => {
    expect(resolvePrimaryNotePath("week1/lesson.mp4", ["week1/notes.md"])).toBe(
      "week1/lesson.notes.md",
    );
  });

  it("uses a video-specific notes file beside nested videos with spaces", () => {
    expect(
      resolvePrimaryNotePath(
        "0. Introduction/01. The power of posting on LinkedIn.mp4",
        ["0. Introduction/01. The power of posting on LinkedIn.notes.md"],
      ),
    ).toBe("0. Introduction/01. The power of posting on LinkedIn.notes.md");
  });
});
