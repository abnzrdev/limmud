import { describe, expect, it } from "vitest";
import { convertSrtToVtt, pickSubtitleForVideo } from "../lib/subtitleMatch";

describe("pickSubtitleForVideo", () => {
  it("prefers same-folder exact basename matches", () => {
    const result = pickSubtitleForVideo("week1/lesson.mp4", [
      "week1/lesson.vtt",
      "week1/other.vtt",
    ]);

    expect(result).toBe("week1/lesson.vtt");
  });

  it("matches a same-folder srt subtitle for the same video basename", () => {
    const result = pickSubtitleForVideo("0. Introduction/lesson.mp4", [
      "0. Introduction/lesson.srt",
      "0. Introduction/other.srt",
    ]);

    expect(result).toBe("0. Introduction/lesson.srt");
  });

  it("converts srt timestamps to webvtt", () => {
    expect(convertSrtToVtt("1\r\n00:00:00,000 --> 00:00:01,250\r\nHello")).toBe(
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.250\nHello",
    );
  });

  it("starts converted vtt with the webvtt header", () => {
    expect(convertSrtToVtt("1\n00:00:00,000 --> 00:00:01,000\nHello")).toMatch(/^WEBVTT\n\n/);
  });
});
