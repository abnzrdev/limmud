import limmudAppIcon from "../../assets/brand/limmud/app-icon-source.png";
import { Bookmark, BookOpen, FolderOpen, Gauge, House, Moon, MoreHorizontal, NotebookPen, Play, Search, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppModel, DashboardCourse } from "../../hooks/useAppModel";

type Section = "dashboard" | "courses" | "bookmarks" | "notes";

export function Dashboard({ model, onOpenCourse, onOpenFolder, onDictionary }: { model: AppModel; onOpenCourse: (root: string) => void; onOpenFolder: () => void; onDictionary: () => void }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const courses = useMemo(() => model.knownCourses.filter((course) => !normalized || [course.name, ...course.lessonNames, ...course.bookmarkedLessonNames, ...course.noteNames].some((value) => value.toLocaleLowerCase().includes(normalized))), [model.knownCourses, normalized]);
  const resumable = model.knownCourses.find((course) => course.available && course.selectedEntryId);

  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand"><img src={limmudAppIcon} alt="" /><div><strong>Limmud</strong><span>Course library</span></div></div>
      <nav aria-label="Dashboard">
        <NavButton active={section === "dashboard"} icon={<House />} label="Dashboard" onClick={() => setSection("dashboard")} />
        <NavButton active={section === "courses"} icon={<BookOpen />} label="Courses" onClick={() => setSection("courses")} />
        <NavButton active={section === "bookmarks"} icon={<Bookmark />} label="Bookmarks" onClick={() => setSection("bookmarks")} />
        <NavButton active={section === "notes"} icon={<NotebookPen />} label="Notes" onClick={() => setSection("notes")} />
      </nav>
      <button className="dashboard-open-folder" type="button" onClick={onOpenFolder}><FolderOpen />Open Course Folder</button>
      <p className="dashboard-private">Local files stay on this device.</p>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-toolbar">
        <label><Search /><input aria-label="Search dashboard" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses and lessons…" /></label>
        <div><button type="button" onClick={onDictionary}><BookOpen />Dictionary</button><button type="button" aria-label={`Use ${model.theme === "dark" ? "light" : "dark"} theme`} onClick={model.toggleTheme}>{model.theme === "dark" ? <Sun /> : <Moon />}{model.theme === "dark" ? "Light" : "Dark"}</button></div>
      </header>
      <div className="dashboard-content">
        <div className="dashboard-heading"><div><span className="dashboard-eyebrow">{section}</span><h1>{section === "dashboard" ? "Your courses" : section[0].toUpperCase() + section.slice(1)}</h1><p>{section === "dashboard" ? "Pick up where you left off or open a local course folder." : section === "courses" ? "Every course folder you explicitly opened." : `Saved ${section} from remembered courses.`}</p></div><span>{model.knownCourses.length} remembered</span></div>
        {section === "dashboard" && resumable && !normalized ? <section className="continue-card" aria-labelledby="continue-title"><div className="continue-art"><Play fill="currentColor" /></div><div><span>Continue learning · {resumable.name}</span><h2 id="continue-title">{resumable.selectedLessonName ?? "Resume course"}</h2><p>{progressText(resumable)}</p><button type="button" aria-label={`Continue ${resumable.selectedLessonName ?? resumable.name}`} onClick={() => onOpenCourse(resumable.root)}><Play fill="currentColor" />Continue learning</button></div></section> : null}
        {section === "bookmarks" ? <MetadataList courses={courses} kind="bookmarks" onOpen={onOpenCourse} /> : section === "notes" ? <MetadataList courses={courses} kind="notes" onOpen={onOpenCourse} /> : <section className="course-library" aria-label="Course library">{courses.length ? courses.map((course) => <CourseCard key={course.root} course={course} model={model} onOpen={() => onOpenCourse(course.root)} />) : <EmptyLibrary hasQuery={Boolean(normalized)} onOpen={onOpenFolder} />}</section>}
      </div>
    </main>
  </div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button type="button" className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}{label}</button>; }

function CourseCard({ course, model, onOpen }: { course: DashboardCourse; model: AppModel; onOpen: () => void }) {
  const percent = course.totalLessons ? Math.round(course.completedLessons / course.totalLessons * 100) : 0;
  return <article className={`course-card${course.available ? "" : " is-unavailable"}`}>
    <button className="course-card-open" type="button" onClick={onOpen} disabled={!course.available} aria-label={`Open ${course.name}`}>
      <div className="course-cover">{course.coverUrl ? <img src={course.coverUrl} alt="" /> : <div><BookOpen /><span>Limmud</span></div>}<span className="course-state">{course.available ? `${percent}%` : "Unavailable"}</span></div>
      <div className="course-card-body"><h2>{course.name}</h2><p>{course.available ? progressText(course) : "Folder could not be reached"}</p><div className="course-progress" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div><small>{relativeTime(course.lastOpenedAt)}</small></div>
    </button>
    <details className="course-menu"><summary aria-label={`Course actions for ${course.name}`}><MoreHorizontal /></summary><div><button type="button" onClick={() => void model.changeCourseCover(course.root)}>{course.coverPath ? "Change Cover" : "Choose Cover"}</button>{course.coverPath ? <button type="button" onClick={() => void model.clearCourseCover(course.root)}>Remove Cover</button> : null}{!course.available ? <button type="button" onClick={() => void model.locateCourse(course.root)}>Locate Folder</button> : null}<button type="button" onClick={() => void model.forgetCourse(course.root)}>Remove from Dashboard</button></div></details>
  </article>;
}

function MetadataList({ courses, kind, onOpen }: { courses: DashboardCourse[]; kind: "bookmarks" | "notes"; onOpen: (root: string) => void }) { const rows = courses.flatMap((course) => (kind === "bookmarks" ? course.bookmarkedLessonNames : course.noteNames).map((name) => ({ course, name }))); return rows.length ? <section className="dashboard-list">{rows.map(({ course, name }, index) => <button key={`${course.root}-${name}-${index}`} type="button" disabled={!course.available} onClick={() => onOpen(course.root)}>{kind === "bookmarks" ? <Bookmark /> : <NotebookPen />}<span><strong>{name}</strong><small>{course.name}</small></span></button>)}</section> : <div className="dashboard-empty"><Gauge /><h2>No {kind} found</h2><p>Items saved in remembered courses will appear here.</p></div>; }
function EmptyLibrary({ hasQuery, onOpen }: { hasQuery: boolean; onOpen: () => void }) { return <div className="dashboard-empty"><BookOpen /><h2>{hasQuery ? "No matches" : "No courses yet"}</h2><p>{hasQuery ? "Try a course or lesson name." : "Open a course folder to add it to this dashboard."}</p>{!hasQuery ? <button type="button" onClick={onOpen}><FolderOpen />Open Course Folder</button> : null}</div>; }
function progressText(course: DashboardCourse) { return course.totalLessons ? `${course.completedLessons} of ${course.totalLessons} lessons complete` : "No video lessons found"; }
function relativeTime(value: string) { const time = Date.parse(value); if (!Number.isFinite(time) || time === 0) return "Previously opened"; const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000)); return days === 0 ? "Opened today" : days === 1 ? "Opened yesterday" : `Opened ${days} days ago`; }
