import { BookOpen, Clock3, FolderPlus, Link2, Play, ShieldCheck } from "lucide-react";
import type { MobileCourseRecord } from "../mobileCourseModel";
import { mobileLessons, mobileSections } from "../mobileCourseModel";
import { MobileHeader } from "../common/MobileHeader";

interface MobileHomeProps {
  status: "restoring" | "empty" | "ready" | "error";
  course: MobileCourseRecord | null;
  lessonName: string | null;
  completedCount: number;
  safeError: string | null;
  onResume: () => void;
  onCourse: () => void;
  onAddCourse: () => void;
  onRelink: () => void;
}

export function MobileHome({ status, course, lessonName, completedCount, safeError, onResume, onCourse, onAddCourse, onRelink }: MobileHomeProps) {
  const available = course?.access === "available";
  const lessons = course ? mobileLessons(course) : [];
  const sections = course ? mobileSections(course) : [];
  return <div className="m-home m-screen"><MobileHeader /><main className="m-home__main">
    <div className="m-welcome"><span className="m-eyebrow">Continue learning</span><h2>Study with intention.</h2><p>Your private, offline workspace—adapted for the moments you learn away from your desk.</p></div>
    {status === "restoring" ? <section className="m-library-state" aria-live="polite"><strong>Restoring course access…</strong><span>Checking the folders you selected on this device.</span></section> : null}
    {available && lessonName ? <><section className="m-resume" aria-labelledby="resume-heading"><div className="m-resume__art"><BookOpen /><span>{String(sections.length).padStart(2, "0")}</span></div><div className="m-resume__body"><span className="m-kicker">Current course · {lessons.length ? Math.round(completedCount / lessons.length * 100) : 0}% complete</span><h3 id="resume-heading">Resume studying</h3><p>{lessonName.replace(/\.[^.]+$/, "")}</p><div className="m-progress"><span style={{ width: `${lessons.length ? completedCount / lessons.length * 100 : 0}%` }} /></div><button className="m-primary" type="button" aria-label="Resume lesson" onClick={onResume}><Play fill="currentColor" /> Resume lesson</button></div></section><div className="m-summary"><div><Clock3 /><span><strong>Persistent</strong> study tools</span></div><div><ShieldCheck /><span><strong>On device</strong> private by design</span></div></div></> : null}
    <section className="m-courses" aria-labelledby="courses-heading"><div className="m-section-heading"><div><span className="m-eyebrow">Library</span><h3 id="courses-heading">Courses</h3></div><button type="button" onClick={onAddCourse}><FolderPlus /> Add course</button></div>
      {status === "empty" ? <div className="m-library-state"><strong>No course folder selected</strong><span>Choose an existing local folder. Limmud will not copy or change it.</span></div> : null}
      {status === "error" ? <div className="m-library-state is-error"><strong>Course access unavailable</strong><span>{safeError}</span></div> : null}
      {course?.access === "accessRequired" ? <div className="m-library-state is-error"><strong>Access required</strong><span>This saved course folder is unavailable. Relink it without deleting the saved course.</span><button className="m-primary" type="button" aria-label="Relink folder" onClick={onRelink}><Link2 /> Relink folder</button></div> : null}
      {available ? <button className="m-course-row" type="button" aria-label="View course outline" onClick={onCourse}><div className="m-course-glyph">L</div><div><strong>{course.displayName}</strong><span>{sections.length} sections · {lessons.length} lessons</span></div><span>{course.warningCount ? `${course.warningCount} skipped` : "Ready"}</span></button> : null}
      <p className="m-gated-note">{available
        ? "Course files stay in the selected folder. Media playback is available; notes change only when you explicitly save."
        : "Choose a course folder to study local material without copying it into Limmud."}</p>
    </section>
  </main></div>;
}
