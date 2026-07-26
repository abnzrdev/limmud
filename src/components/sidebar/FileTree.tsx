import type { CourseEntry } from "../../types/course";
import { courseEntryDisplayName, visibleCourseEntries } from "../../lib/courseTree";
import { Bookmark, CheckCircle2 } from "lucide-react";

interface FileTreeProps {
  entries: CourseEntry[];
  onSelect: (entry: CourseEntry) => void;
  selectedId?: string;
  completedLessonPaths?: string[];
  bookmarkedLessonPaths?: string[];
}

export function FileTree({
  entries,
  onSelect,
  selectedId,
  completedLessonPaths = [],
  bookmarkedLessonPaths = [],
}: FileTreeProps) {
  const visibleEntries = visibleCourseEntries(entries);

  return (
    <ul className="sidebar-list">
      {visibleEntries.map((entry) => (
        <li key={entry.id}>
          <button
            className={`tree-entry tree-entry-${entry.kind === "directory" ? "folder" : "video"}${entry.id === selectedId ? " tree-entry-selected" : ""}`}
            type="button"
            onClick={() => onSelect(entry)}
            title={entry.relativePath || entry.name}
          >
            <span className="tree-entry-label">{courseEntryDisplayName(entry)}</span>
            {entry.kind === "video" && completedLessonPaths.includes(entry.relativePath) ? (
              <CheckCircle2 className="tree-entry-icon" aria-label="Done" />
            ) : null}
            {entry.kind === "video" && bookmarkedLessonPaths.includes(entry.relativePath) ? (
              <Bookmark className="tree-entry-icon" aria-label="Bookmarked" />
            ) : null}
          </button>
          {entry.children?.length ? (
            <div className="tree-children">
              <FileTree
                entries={entry.children}
                onSelect={onSelect}
                selectedId={selectedId}
                completedLessonPaths={completedLessonPaths}
                bookmarkedLessonPaths={bookmarkedLessonPaths}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
