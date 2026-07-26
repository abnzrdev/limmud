import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { AlertTriangle, BookOpen, Copy, FolderOpen, RefreshCw, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { notesEditorTheme } from "../../lib/notesEditorTheme";
import { resolvePrimaryNotePath } from "../../lib/notePath";
import type { SaveNoteError } from "../../lib/tauri";
import type { CourseEntry } from "../../types/course";

interface NotesTabsProps {
  lessonPath?: string | null;
  lessonEntries: CourseEntry[];
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
}

export function NotesTabs({
  lessonPath = null,
  lessonEntries,
  noteBody,
  noteSaveStatus,
  noteSaveError = null,
  recoveredUnsavedDraft = false,
  onNoteChange,
  onSaveNote,
  onLoadTextFile = async () => "",
  onSaveTextFile = async () => {},
  onLookupSelection,
  onRefreshCourse,
  isRefreshingCourse = false,
  onOpenLessonFolder,
}: NotesTabsProps) {
  const tabs = useMemo(() => {
    const editable = lessonEntries.filter((entry) => isEditableText(entry.name));
    const primaryPath = lessonPath
      ? resolvePrimaryNotePath(lessonPath, editable.map((entry) => entry.relativePath))
      : editable[0]?.relativePath ?? "notes.md";
    const primary = editable.find((entry) => entry.relativePath === primaryPath) ?? {
      id: primaryPath,
      name: fileName(primaryPath),
      relativePath: primaryPath,
      absolutePath: "",
      kind: "note" as const,
    };
    return [primary, ...editable.filter((entry) => entry.relativePath !== primaryPath)];
  }, [lessonEntries, lessonPath]);
  const primaryPath = tabs[0].relativePath;
  const [selectedPath, setSelectedPath] = useState(primaryPath);
  const [drafts, setDrafts] = useState<Record<string, { body: string; status: NotesTabsProps["noteSaveStatus"] }>>({
    [primaryPath]: { body: noteBody, status: noteSaveStatus },
  });
  const previousLessonRef = useRef(lessonPath);
  const pendingSaveRef = useRef<number | null>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (previousLessonRef.current !== lessonPath) {
      previousLessonRef.current = lessonPath;
      setSelectedPath(primaryPath);
      setDrafts((current) => ({ ...current, [primaryPath]: { body: noteBody, status: noteSaveStatus } }));
    }
  }, [lessonPath, noteBody, noteSaveStatus, primaryPath]);
  useEffect(() => {
    setDrafts((current) => current[primaryPath]?.status === "unsaved"
      ? current
      : { ...current, [primaryPath]: { body: noteBody, status: noteSaveStatus } });
  }, [noteBody, noteSaveStatus, primaryPath]);
  useEffect(() => () => {
    if (pendingSaveRef.current !== null) window.clearTimeout(pendingSaveRef.current);
  }, []);
  const lookupSelection = () => {
    const view = editorRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const value = trimLookupText(view.state.sliceDoc(selection.from, selection.to));
    if (value.length >= 1 && value.length <= 80) onLookupSelection?.(value);
  };
  useEffect(() => {
    if (!onLookupSelection) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l" && editorRef.current?.hasFocus) {
        event.preventDefault();
        lookupSelection();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const activeDraft = drafts[selectedPath] ?? { body: selectedPath === primaryPath ? noteBody : "", status: "saved" as const };
  const selectedWasRemoved = selectedPath !== primaryPath && !tabs.some((tab) => tab.relativePath === selectedPath);

  const selectTab = async (path: string) => {
    setSelectedPath(path);
    if (!drafts[path] && path !== primaryPath) {
      try {
        const body = await onLoadTextFile(path);
        setDrafts((current) => ({ ...current, [path]: { body, status: "saved" } }));
      } catch (error) {
        setDrafts((current) => ({
          ...current,
          [path]: { body: `Unable to open ${path}: ${readableError(error)}`, status: "failed" },
        }));
      }
    }
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  const handleNoteChange = (value: string) => {
    setDrafts((current) => ({ ...current, [selectedPath]: { body: value, status: "unsaved" } }));
    if (selectedPath === primaryPath) onNoteChange(value);
    if (pendingSaveRef.current !== null) window.clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = window.setTimeout(() => {
      void saveDraft(selectedPath, value);
      pendingSaveRef.current = null;
    }, 1000);
  };

  const saveDraft = async (path = selectedPath, body = activeDraft.body) => {
    setDrafts((current) => ({ ...current, [path]: { body, status: "saving" } }));
    if (path === primaryPath) {
      onSaveNote(body);
      return;
    }
    try {
      await onSaveTextFile(path, body);
      setDrafts((current) => ({ ...current, [path]: { body, status: "saved" } }));
    } catch {
      setDrafts((current) => ({ ...current, [path]: { body, status: "failed" } }));
    }
  };

  const navigateTabs = (key: string) => {
    const current = tabs.findIndex((tab) => tab.relativePath === selectedPath);
    const next = key === "Home" ? 0 : key === "End" ? tabs.length - 1
      : key === "ArrowRight" ? (current + 1) % tabs.length
        : key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length : -1;
    if (next >= 0) void selectTab(tabs[next].relativePath);
  };

  return (
    <section className="workspace-notes" aria-label="Lesson notes">
      <div className="notes-panel">
        <div className="notes-header">
          <div className="note-tabs" role="tablist" aria-label="Lesson note files" onKeyDown={(event) => navigateTabs(event.key)}>
            {tabs.map((entry) => {
              const status = drafts[entry.relativePath]?.status;
              return <button
                className={`note-tab${entry.relativePath === selectedPath ? " note-tab-active" : ""}`}
                key={entry.relativePath}
                type="button"
                role="tab"
                aria-selected={entry.relativePath === selectedPath}
                aria-controls="notes-editor-panel"
                title={parentPath(entry.relativePath)}
                onClick={() => void selectTab(entry.relativePath)}
              >
                {entry.name}{status === "unsaved" || status === "failed" ? <span aria-label="Unsaved"> • Unsaved</span> : null}
              </button>;
            })}
          </div>
          <div className="notes-actions">
            {onLookupSelection ? <button type="button" className="button-secondary" onClick={lookupSelection}><BookOpen aria-hidden="true" /> Look up in Dictionary</button> : null}
            <span className={`notes-save-status notes-save-status-${activeDraft.status}`}>
              {saveStatusLabel(activeDraft.status)}
            </span>
            <button className="notes-save-button button-primary" type="button" onClick={() => void saveDraft()}>
              <Save aria-hidden="true" /> Save Notes
            </button>
          </div>
        </div>
        {recoveredUnsavedDraft ? <p className="notes-recovery-status">Recovered unsaved draft</p> : null}
        {selectedWasRemoved ? <p className="notes-recovery-status" role="alert">This note was removed during refresh: {selectedPath}. Its draft remains in the editor.</p> : null}
        {noteSaveError ? (
          <div className="notes-save-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>{errorHeading(noteSaveError)}</strong>
              <p>{errorExplanation(noteSaveError)}</p>
              <p><span>Folder:</span> <code>{noteSaveError.parentPath}</code></p>
              <p>Your note is still available in the editor.</p>
              <div className="notes-error-actions">
                <button type="button" className="button-secondary" onClick={() => void saveDraft()}>
                  <RotateCcw aria-hidden="true" /> Retry
                </button>
                <button type="button" className="button-secondary" onClick={() => void copyText(activeDraft.body)}>
                  <Copy aria-hidden="true" /> Copy Notes
                </button>
                <button type="button" className="icon-button" aria-label="Copy lesson folder path" title="Copy folder path" onClick={() => void copyText(noteSaveError.parentPath)}>
                  <Copy aria-hidden="true" />
                </button>
                {onOpenLessonFolder ? (
                  <button type="button" className="icon-button" aria-label="Open lesson folder" title="Open lesson folder" onClick={onOpenLessonFolder}>
                    <FolderOpen aria-hidden="true" />
                  </button>
                ) : null}
                {onRefreshCourse ? (
                  <button type="button" className="button-secondary" disabled={isRefreshingCourse} onClick={onRefreshCourse}>
                    <RefreshCw aria-hidden="true" className={isRefreshingCourse ? "is-spinning" : undefined} /> Refresh Course
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <CodeMirror
          id="notes-editor-panel"
          className="notes-editor"
          value={activeDraft.body}
          placeholder="Write notes for this lesson..."
          extensions={[markdown(), EditorView.lineWrapping, notesEditorTheme]}
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
          onChange={handleNoteChange}
          onCreateEditor={(view) => { editorRef.current = view; }}
        />
      </div>
    </section>
  );
}

function isEditableText(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".py");
}

function fileName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function parentPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.slice(0, -1).join("/") || ".";
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function trimLookupText(value: string): string {
  return value.trim().replace(/^[^\p{L}\p{N}'’\-]+|[^\p{L}\p{N}'’\-]+$/gu, "");
}

function errorHeading(error: SaveNoteError): string {
  return error.kind === "permissionDenied" || error.kind === "readOnlyFilesystem"
    ? "Cannot save beside this lesson"
    : error.kind === "lessonMissing" || error.kind === "parentMissing" || error.kind === "invalidPath"
      ? "This lesson path is no longer available"
      : "Cannot save this note";
}

function errorExplanation(error: SaveNoteError): string {
  return error.kind === "permissionDenied" || error.kind === "readOnlyFilesystem"
    ? "The lesson folder is read-only, so LearningAppOffline cannot create the notes file."
    : error.message;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard?.writeText(value);
}

function saveStatusLabel(status: NotesTabsProps["noteSaveStatus"]): string {
  return status === "unsaved" ? "Unsaved changes" : status === "saving" ? "Saving..." : status === "failed" ? "Save failed" : "Saved";
}
