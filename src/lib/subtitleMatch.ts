function baseName(path: string): string {
  return path.split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
}

export function convertSrtToVtt(contents: string): string {
  return `WEBVTT\n\n${contents.replace(/\r/g, "").replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2",
  )}`;
}

export function pickSubtitleForVideo(
  videoPath: string,
  subtitlePaths: string[],
): string | null {
  const folder = videoPath.split("/").slice(0, -1).join("/");
  const videoBase = baseName(videoPath);

  return (
    subtitlePaths.find((candidate) => {
      const candidateFolder = candidate.split("/").slice(0, -1).join("/");
      return candidateFolder === folder && baseName(candidate) === videoBase;
    }) ?? null
  );
}
