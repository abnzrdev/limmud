import { Plus } from "lucide-react";
import { useState } from "react";
import type { TodoItem } from "../../lib/persistence";

interface TodoPanelProps {
  items: TodoItem[];
  onAddTodo: (label: string) => void;
  onToggleTodo: (id: string) => void;
}

export function TodoPanel({ items, onAddTodo, onToggleTodo }: TodoPanelProps) {
  const [draft, setDraft] = useState("");

  return (
    <section className="panel-section">
      <div className="panel-title-row">
        <h3 className="panel-title">To Do</h3>
        <button
          className="button-primary"
          type="button"
          onClick={() => {
            onAddTodo(draft);
            setDraft("");
          }}
        >
          <Plus aria-hidden="true" />
          Add
        </button>
      </div>
      <input
        className="todo-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onAddTodo(draft);
            setDraft("");
          }
        }}
        placeholder="Add a lesson task"
      />
      <ul className="detail-list">
        {items.map((item) => (
          <li key={item.id}>
            <label className="todo-row">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggleTodo(item.id)}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
