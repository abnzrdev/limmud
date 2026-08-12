import { BookOpen, GraduationCap, NotebookPen, Wrench, type LucideIcon } from "lucide-react";
import type { MobileDestination } from "../mobileModel";

const items: { id: Exclude<MobileDestination, "home">; label: string; icon: LucideIcon }[] = [
  { id: "study", label: "Study", icon: GraduationCap },
  { id: "course", label: "Course", icon: BookOpen },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "tools", label: "Tools", icon: Wrench },
];

export function MobileNavigation({ current, onNavigate }: { current: MobileDestination; onNavigate: (value: MobileDestination) => void }) {
  return <nav className="m-navigation" aria-label="Study navigation">
    <div className="m-navigation__brand"><span>L</span><strong>Limmud</strong></div>
    {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} aria-current={current === id ? "page" : undefined} onClick={() => onNavigate(id)}><Icon /><span>{label}</span></button>)}
  </nav>;
}
