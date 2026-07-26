import { EditorView } from "@codemirror/view";

export const notesEditorTheme = EditorView.theme({
  "&": { caretColor: "var(--editor-caret)" },
  ".cm-content": { caretColor: "var(--editor-caret)" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--editor-caret)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused": { outline: "2px solid var(--editor-focus-ring)", outlineOffset: "-2px" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--editor-caret)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-content ::selection": { backgroundColor: "var(--editor-selection)" },
});
