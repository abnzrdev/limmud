import { describe, expect, it } from "vitest";
import { subtitleSourceForLesson } from "./mobileMedia";

describe("mobile subtitle selection", () => {
  it("uses the existing same-folder and same-stem rule", () => {
    expect(subtitleSourceForLesson("Section/lesson_01.mp4", [
      { id: "wrong", relativePath: "Other/lesson_01.vtt" },
      { id: "right", relativePath: "Section/lesson_01.srt" },
    ])).toEqual({ id: "right", relativePath: "Section/lesson_01.srt" });
  });
});
