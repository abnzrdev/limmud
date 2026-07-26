interface QuickNoteBoxProps {
  quickNote: string;
  onChange: (value: string) => void;
}

export function QuickNoteBox({ quickNote, onChange }: QuickNoteBoxProps) {
  return (
    <section className="panel-section">
      <h3 className="panel-title">Quick Note</h3>
      <textarea
        className="notes-editor quick-note-editor"
        value={quickNote}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
