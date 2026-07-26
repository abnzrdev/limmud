import {
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import type { CourseEntry } from "../../types/course";
import { courseEntryDisplayName } from "../../lib/courseTree";
import { StatusMessage } from "../common/StatusMessage";
import { FileTree } from "./FileTree";

interface CourseSidebarProps {
  entries: CourseEntry[];
  onOpenCourse: () => void;
  onRefreshCourse?: () => void;
  isRefreshing?: boolean;
  onSelectEntry: (entry: CourseEntry) => void;
  selectedEntry: CourseEntry | null;
  status: string;
  completedLessonPaths?: string[];
  bookmarkedLessonPaths?: string[];
  progressPercent?: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function CourseSidebar({
  entries,
  onOpenCourse,
  onRefreshCourse,
  isRefreshing = false,
  onSelectEntry,
  selectedEntry,
  status,
  completedLessonPaths = [],
  bookmarkedLessonPaths = [],
  progressPercent = 0,
  collapsed = false,
  onToggleCollapsed,
}: CourseSidebarProps) {
  return (
    <aside className={`pane panel course-pane${collapsed ? " pane-collapsed" : ""}`}>
      <div className="pane-header">
        {collapsed ? null : (
          <div>
            <p className="pane-label">Course</p>
            <h2 className="pane-title">Course Outline</h2>
          </div>
        )}
        {onToggleCollapsed ? (
          <button
            className="pane-collapse-button"
            type="button"
            aria-label={collapsed ? "Expand course sidebar" : "Collapse course sidebar"}
            title={collapsed ? "Expand course" : "Collapse course"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <button
          className="open-course-button open-course-button-rail"
          type="button"
          title="Open course folder"
          aria-label="Open course folder"
          onClick={onOpenCourse}
        >
          <FolderOpen aria-hidden="true" />
        </button>
      ) : (
        <>
          <button className="open-course-button" type="button" onClick={onOpenCourse}>
            <FolderOpen aria-hidden="true" />
            Open Course Folder
          </button>
          {onRefreshCourse ? (
            <button
              className="button-secondary course-refresh-button"
              type="button"
              aria-label="Refresh Course"
              title="Refresh Course"
              disabled={isRefreshing}
              onClick={onRefreshCourse}
            >
              <RefreshCw aria-hidden="true" className={isRefreshing ? "is-spinning" : undefined} />
              Refresh Course
            </button>
          ) : null}
          <FileTree
            entries={entries}
            onSelect={onSelectEntry}
            selectedId={selectedEntry?.id}
            completedLessonPaths={completedLessonPaths}
            bookmarkedLessonPaths={bookmarkedLessonPaths}
          />
          <StatusMessage>{status}</StatusMessage>
          <div className="course-progress" title={`${progressPercent}% complete`}>
            <div className="course-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="status-row" title={selectedEntry?.relativePath}>
            <span className="status-dot" />
            <span className="status-text">
              {selectedEntry ? `Now: ${courseEntryDisplayName(selectedEntry)}` : "Offline mode"}
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
