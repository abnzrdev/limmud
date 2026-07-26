import { describe, expect, it } from "vitest";
import { toStableId } from "../lib/ids";

describe("toStableId", () => {
  it("normalizes separators and casing for relative paths", () => {
    expect(toStableId("Week 1\\Video.MP4")).toBe("week 1/video.mp4");
  });
});
