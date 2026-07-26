import type { CourseEntry } from "../types/course";

export function findFirstVideo(entries: CourseEntry[]): CourseEntry | null {
  for (const entry of entries) {
    if (entry.kind === "video") {
      return entry;
    }

    if (entry.children?.length) {
      const nested = findFirstVideo(entry.children);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function listLessonEntriesForSelection(
  entries: CourseEntry[],
  selectedId: string,
): CourseEntry[] {
  for (const entry of entries) {
    if (entry.id === selectedId) {
      return [entry];
    }

    if (entry.children?.some((child) => child.id === selectedId)) {
      return entry.children;
    }

    if (entry.children?.length) {
      const nested = listLessonEntriesForSelection(entry.children, selectedId);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

export function visibleCourseEntries(entries: CourseEntry[]): CourseEntry[] {
  const visible: CourseEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === "subtitle" || entry.kind === "note") {
      continue;
    }

    if (entry.kind === "directory") {
      if (!hasVideoDescendant(entry)) {
        continue;
      }

      const children = entry.children ? visibleCourseEntries(entry.children) : [];
      visible.push({ ...entry, children });
      continue;
    }

    if (entry.kind === "video") {
      visible.push({ ...entry, children: undefined });
    }
  }

  return visible;
}

export function hasVideoDescendant(entry: CourseEntry): boolean {
  return entry.kind === "video" || Boolean(entry.children?.some(hasVideoDescendant));
}

export function courseEntryDisplayName(entry: CourseEntry): string {
  if (entry.kind !== "video") {
    return entry.name;
  }

  const label = entry.name.replace(/\.[^.]+$/, "");
  const parentName = entry.relativePath.replace(/\\/g, "/").split("/").slice(-2, -1)[0];
  if (!parentName || !label.toLocaleLowerCase().startsWith(parentName.toLocaleLowerCase())) {
    return label;
  }

  return label.slice(parentName.length).replace(/^\s*[-_:|/\\]+\s*/, "") || label;
}

export function findNextVideo(entries: CourseEntry[], selectedId: string): CourseEntry | null {
  const videos = collectVideoEntries(entries);
  const currentIndex = videos.findIndex((entry) => entry.id === selectedId);
  return currentIndex >= 0 ? videos[currentIndex + 1] ?? null : null;
}

function collectVideoEntries(entries: CourseEntry[]): CourseEntry[] {
  const videos: CourseEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === "video") {
      videos.push(entry);
    }

    if (entry.children?.length) {
      videos.push(...collectVideoEntries(entry.children));
    }
  }

  return videos;
}
