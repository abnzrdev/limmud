import { pickSubtitleForVideo } from "./subtitleMatch";

export interface MobileSubtitleEntry {
  id: string;
  relativePath: string;
}

export function subtitleSourceForLesson(
  videoRelativePath: string,
  subtitles: MobileSubtitleEntry[],
): MobileSubtitleEntry | null {
  const selected = pickSubtitleForVideo(videoRelativePath, subtitles.map((entry) => entry.relativePath));
  return subtitles.find((entry) => entry.relativePath === selected) ?? null;
}
