export function toStableId(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").trim().toLowerCase();
}
