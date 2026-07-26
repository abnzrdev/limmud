import { Bookmark, CheckCircle2 } from "lucide-react";
import type { SaveNoteError } from "../../lib/tauri";
import type { CourseEntry } from "../../types/course";
import { NotesTabs } from "./NotesTabs";
import { VideoPlayer } from "./VideoPlayer";

interface LessonWorkspaceProps {
  currentCourseRoot: string | null;
  selectedEntry: CourseEntry | null;
  selectedSubtitle: CourseEntry | null;
  lessonEntries: CourseEntry[];
  resumeTime: number;
  shouldAutoPlaySelectedEntry: boolean;
  noteBody: string;
  noteSaveStatus: "saved" | "unsaved" | "saving" | "failed";
  noteSaveError?: SaveNoteError | null;
  recoveredUnsavedDraft?: boolean;
  onNoteChange: (value: string) => void;
  onSaveNote: (contents?: string) => void;
  onLoadTextFile?: (relativePath: string) => Promise<string>;
  onSaveTextFile?: (relativePath: string, contents: string) => Promise<void>;
  onLookupSelection?: (text: string) => void;
  onRefreshCourse?: () => void;
  isRefreshingCourse?: boolean;
  onOpenLessonFolder?: () => void;
  onVideoProgress: (seconds: number) => void;
  onVideoEnded: (seconds: number) => void;
  onWatchedSeconds?: (seconds: number, courseRoot: string | null) => void;
  onPlaybackFlush?: () => void;
  onVideoStudyActivityChange?: (active: boolean) => void;
  isLessonDone: boolean;
  isLessonBookmarked: boolean;
  onToggleLessonDone: () => void;
  onToggleLessonBookmark: () => void;
  isFocusMode?: boolean;
}

export function LessonWorkspace({
  currentCourseRoot,
  selectedEntry,
  selectedSubtitle,
  lessonEntries,
  resumeTime,
  shouldAutoPlaySelectedEntry,
  noteBody,
  noteSaveStatus,
  noteSaveError = null,
  recoveredUnsavedDraft = false,
  onNoteChange,
  onSaveNote,
  onLoadTextFile,
  onSaveTextFile,
  onLookupSelection,
  onRefreshCourse = () => {},
  isRefreshingCourse = false,
  onOpenLessonFolder = () => {},
  onVideoProgress,
  onVideoEnded,
  onWatchedSeconds,
  onPlaybackFlush,
  onVideoStudyActivityChange,
  isLessonDone,
  isLessonBookmarked,
  onToggleLessonDone,
  onToggleLessonBookmark,
  isFocusMode = false,
}: LessonWorkspaceProps) {
  const emptyMessage =
    selectedEntry?.kind === "directory"
      ? "No videos in this folder"
      : currentCourseRoot
        ? "No supported videos found"
        : "Select a lesson";
  const breadcrumb = selectedEntry
    ? workspaceSectionLabel(selectedEntry)
    : "Open a course to begin";

  return (
    <main className={`pane panel workspace-pane${isFocusMode ? " workspace-pane-focus" : ""}`}>
      <div className="pane-header">
        <div>
          {!isFocusMode ? <p className="pane-label">Workspace</p> : null}
          <h2 className="pane-title">
            {selectedEntry ? selectedEntry.name : "No course loaded"}
          </h2>
          <div className="workspace-breadcrumb" title={selectedEntry?.relativePath}>
            {breadcrumb}
          </div>
        </div>
        {selectedEntry?.kind === "video" && !isFocusMode ? (
          <div className="workspace-actions">
            <button
              className="button-secondary"
              type="button"
              title={isLessonDone ? "Mark lesson not done" : "Mark lesson done"}
              onClick={onToggleLessonDone}
            >
              <CheckCircle2 aria-hidden="true" />
              {isLessonDone ? "Done" : "Mark Done"}
            </button>
            <button
              className="button-secondary"
              type="button"
              title={isLessonBookmarked ? "Remove bookmark" : "Bookmark lesson"}
              onClick={onToggleLessonBookmark}
            >
              <Bookmark aria-hidden="true" />
              {isLessonBookmarked ? "Bookmarked" : "Bookmark"}
            </button>
          </div>
        ) : null}
      </div>
      <section className="workspace-card">
        <VideoPlayer
          courseRoot={currentCourseRoot}
          selectedEntry={selectedEntry}
          subtitleEntry={selectedSubtitle}
          emptyMessage={emptyMessage}
          resumeTime={resumeTime}
          autoPlay={shouldAutoPlaySelectedEntry}
          onProgressChange={onVideoProgress}
          onEnded={onVideoEnded}
          onWatchedSeconds={onWatchedSeconds}
          onPlaybackFlush={onPlaybackFlush}
          onStudyActivityChange={onVideoStudyActivityChange}
        />
      <NotesTabs
          lessonPath={selectedEntry?.kind === "video" ? selectedEntry.relativePath : null}
        lessonEntries={lessonEntries}
          noteBody={noteBody}
          noteSaveStatus={noteSaveStatus}
          noteSaveError={noteSaveError}
          recoveredUnsavedDraft={recoveredUnsavedDraft}
          onNoteChange={onNoteChange}
          onSaveNote={onSaveNote}
          onLoadTextFile={onLoadTextFile}
          onSaveTextFile={onSaveTextFile}
          onLookupSelection={onLookupSelection}
          onRefreshCourse={onRefreshCourse}
          isRefreshingCourse={isRefreshingCourse}
          onOpenLessonFolder={onOpenLessonFolder}
        />
      </section>
    </main>
  );
}

function workspaceSectionLabel(entry: CourseEntry): string {
  const parts = entry.relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (entry.kind === "directory") {
    return parts[parts.length - 1] ?? entry.name;
  }

  return parts[parts.length - 2] ?? "Current lesson";
}
