export function resolvePrimaryNotePath(
  videoPath: string,
  _existingFiles: string[],
): string {
  const stem = videoPath.replace(/\.[^.]+$/, "");
  return `${stem}.notes.md`;
}
