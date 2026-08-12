import { Bookmark, Check, ChevronDown, ChevronRight, Circle, Clock3, FileVideo2, Play } from "lucide-react";
import { lessonTitle, type MobileLesson, type MobileSection } from "../mobileModel";

interface MobileCourseProps {
  courseName: string;
  sections: MobileSection[];
  selectedId: string;
  completedCount: number;
  lessonCount: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

export function MobileCourse({ courseName, sections, selectedId, completedCount, lessonCount, expanded, onToggle, onSelect }: MobileCourseProps) {
  const selected = sections.flatMap((section) => section.children).find((lesson) => lesson.id === selectedId);
  if (!selected) return null;
  return <div className="m-screen m-course-screen">
    <header className="m-page-header"><span className="m-eyebrow">{courseName}</span><h2>Course outline</h2><div className="m-course-progress"><div><span>Course progress</span><strong>{lessonCount ? Math.round(completedCount / lessonCount * 100) : 0}%</strong></div><div className="m-progress"><span style={{ width: `${lessonCount ? completedCount / lessonCount * 100 : 0}%` }} /></div></div></header>
    <div className="m-adaptive-panes"><main className="m-outline">{sections.map((section, index) => <section className="m-section" key={section.id}>
      <button type="button" className="m-section-toggle" aria-label={`${expanded.has(section.id) ? "Collapse" : "Expand"} ${section.name}`} aria-expanded={expanded.has(section.id)} onClick={() => onToggle(section.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.name}</strong><small>{section.children.length} lessons</small></div>{expanded.has(section.id) ? <ChevronDown /> : <ChevronRight />}</button>
      {expanded.has(section.id) ? <div className="m-lessons">{section.children.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} active={lesson.id === selectedId} onSelect={onSelect} />)}</div> : null}
    </section>)}</main><aside className="m-course-preview"><span className="m-eyebrow">Up next</span><div className="m-preview-media"><FileVideo2 /><span>Video lesson</span></div><h3>{lessonTitle(selected)}</h3><p>Continue from your current lesson in the focused Study view.</p><button className="m-primary" type="button" onClick={() => onSelect(selected.id)}><Play fill="currentColor" /> Open lesson</button></aside></div>
  </div>;
}

function LessonRow({ lesson, active, onSelect }: { lesson: MobileLesson; active: boolean; onSelect: (id: string) => void }) {
  return <button type="button" className={`m-lesson${active ? " is-active" : ""}`} aria-label={`Open ${lessonTitle(lesson)}`} onClick={() => onSelect(lesson.id)}><span className={`m-lesson-state${lesson.completed ? " is-done" : ""}`}>{lesson.completed ? <Check /> : <Circle />}</span><div><strong>{lessonTitle(lesson)}</strong><span><FileVideo2 /> Video <Clock3 /> {lesson.duration}</span></div>{lesson.bookmarked ? <Bookmark className="is-bookmarked" fill="currentColor" /> : <ChevronRight />}</button>;
}
