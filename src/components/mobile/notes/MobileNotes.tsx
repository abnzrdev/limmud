import { Bold, Check, Code2, Eye, Heading, Italic, List, Maximize2, Pencil, Quote } from "lucide-react";
import { lessonTitle, type MobileLesson, type MobileSection } from "../mobileModel";

type NoteStatus = "loading" | "ready" | "saving" | "saved" | "conflict" | "failed";

export function MobileNotes({ lesson, section, note, editing, dirty, status, capability, onEdit, onChange, onSave, onEnableEditing }: {
  lesson: MobileLesson; section: MobileSection; note: string; editing: boolean; dirty: boolean;
  status: NoteStatus; capability: string; onEdit: () => void; onChange: (value: string) => void;
  onSave: () => void; onEnableEditing: () => void;
}) {
  const editable = capability === "editable" || capability === "absent" || capability === "writeAccessRequired";
  const stateText = status === "saved" ? "Saved"
    : status === "conflict" ? "External change detected — draft preserved"
      : status === "failed" ? "Save failed — draft preserved"
        : dirty ? "Unsaved draft"
          : capability === "readOnly" || capability === "creationUnsupported" ? "This course is read-only on this device."
            : "Saved";
  return <div className={`m-screen m-notes${editing ? " is-editing" : ""}`}>
    <header className="m-page-header"><span className="m-eyebrow">{section.name}</span><h2>Lesson notes</h2><p>{lessonTitle(lesson)}</p></header>
    <main className="m-note-surface">
      <div className="m-note-toolbar"><div>{editing ? <>
        <button aria-label="Heading" type="button"><Heading /></button><button aria-label="Bold" type="button"><Bold /></button>
        <button aria-label="Italic" type="button"><Italic /></button><button aria-label="List" type="button"><List /></button>
        <button aria-label="Quote" type="button"><Quote /></button><button aria-label="Code" type="button"><Code2 /></button>
      </> : <span><Eye /> Reading</span>}</div>
        {editing ? <button className="m-note-done" type="button" aria-label="Save note" disabled={status === "saving"} onClick={onSave}><Check /> {status === "saving" ? "Saving…" : "Save"}</button>
          : editable ? <button className="m-note-edit" type="button" aria-label="Edit note" onClick={onEdit}><Pencil /> Edit</button>
            : capability === "writeAccessRequired" ? <button className="m-note-edit" type="button" onClick={onEnableEditing}>Enable editing</button> : null}
      </div>
      {editing ? <textarea aria-label="Markdown note" value={note} onChange={(event) => onChange(event.target.value)} autoFocus />
        : <article className="m-markdown-preview">{status === "loading" ? <p>Loading note…</p> : note.split("\n").map((line, index) => line.startsWith("# ") ? <h3 key={index}>{line.slice(2)}</h3> : line.startsWith("- ") ? <p className="m-list-line" key={index}>• {line.slice(2)}</p> : <p key={index}>{line || "\u00a0"}</p>)}</article>}
      <footer><span className={dirty || status === "failed" || status === "conflict" ? "is-dirty" : ""}>{stateText}</span><span>Markdown · course note</span></footer>
    </main>
    {editing ? <button className="m-fullscreen-note" type="button" title="Editor already uses the available mobile workspace"><Maximize2 /> Focus editor</button> : null}
  </div>;
}
