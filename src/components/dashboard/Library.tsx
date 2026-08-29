import limmudAppIcon from "../../assets/brand/limmud/app-icon-source.png";
import {
  Bookmark,
  BookOpen,
  CircleCheck,
  FolderOpen,
  House,
  MoreHorizontal,
  NotebookPen,
  Play,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppModel, DashboardCourse } from "../../hooks/useAppModel";

type Section = "dashboard" | "courses" | "bookmarks" | "notes";

const nav: { key: Section; label: string; icon: typeof House }[] = [
  { key: "dashboard", label: "Dashboard", icon: House },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "notes", label: "Notes", icon: NotebookPen },
];

interface LibraryProps {
  model: AppModel;
  /** True while a course folder is being opened/scanned (after dialog dismissal). */
  isOpeningCourse?: boolean;
  onOpenCourse: (root: string) => void;
  onOpenFolder: () => void;
  onDictionary: () => void;
}

/**
 * Library — the Lovable-designed study library UI, wired to the real app model
 * (useAppModel): remembered course folders, covers, progress, bookmarks and
 * notes. Replaces the demo-data mockup and the legacy Dashboard visuals.
 */
export function Library({
  model,
  isOpeningCourse = false,
  onOpenCourse,
  onOpenFolder,
  onDictionary,
}: LibraryProps) {
  const [section, setSection] = useState<Section>("dashboard");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalized = query.trim().toLocaleLowerCase();
  const visible = useMemo(
    () =>
      model.knownCourses.filter(
        (course) =>
          !normalized ||
          [
            course.name,
            ...course.lessonNames,
            ...course.bookmarkedLessonNames,
            ...course.noteNames,
          ].some((value) => value.toLocaleLowerCase().includes(normalized)),
      ),
    [model.knownCourses, normalized],
  );

  const resume = model.knownCourses.find((course) => course.available && course.selectedEntryId);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1 border-r border-border bg-sidebar px-3.5 py-5">
        <div className="flex items-center gap-3 px-1.5 pb-6">
          <img
            src={limmudAppIcon}
            alt=""
            className="size-10 rounded-xl border border-border object-cover"
          />
          <div className="grid">
            <strong className="font-[family-name:var(--font-display)] text-[1.05rem] tracking-tight">
              Limmud
            </strong>
            <span className="text-xs text-muted-foreground">Course library</span>
          </div>
        </div>

        <nav aria-label="Library" className="grid gap-1">
          {nav.map(({ key, label, icon: Icon }) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSection(key)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/15 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/4%)]"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-surface-strong hover:text-foreground"
                }`}
              >
                <Icon className={`size-[18px] ${active ? "text-primary" : ""}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          disabled={isOpeningCourse}
          aria-busy={isOpeningCourse}
          onClick={onOpenFolder}
          className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/15 text-sm font-semibold transition-colors hover:bg-primary/25 disabled:opacity-60"
        >
          <FolderOpen className="size-[18px]" />
          {isOpeningCourse ? "Opening…" : "Open Course Folder"}
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Local files stay on this device.
        </p>
      </aside>

      <main className="min-w-0 bg-[radial-gradient(circle_at_78%_-14%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_42%)]">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2.5 focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-primary/25">
            <Search className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              aria-label="Search courses and lessons"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search courses and lessons…  ( / )"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDictionary}
              className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="size-[18px]" />
              Dictionary
            </button>
          </div>
        </header>

        <div className="px-6 pb-16 pt-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {section}
              </span>
              <h1 className="mt-2 text-3xl font-semibold">
                {section === "dashboard"
                  ? "Your courses"
                  : section[0]!.toUpperCase() + section.slice(1)}
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                {section === "dashboard"
                  ? "Pick up where you left off, or open a local course folder."
                  : section === "courses"
                    ? "Every course folder you have opened."
                    : `Saved ${section} across your courses.`}
              </p>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              {model.knownCourses.length} remembered
            </span>
          </div>

          {section === "bookmarks" || section === "notes" ? (
            <LibraryList
              courses={visible}
              kind={section}
              isOpeningCourse={isOpeningCourse}
              onOpenCourse={onOpenCourse}
            />
          ) : (
            <section
              aria-label="Course library"
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {section === "dashboard" && resume && !normalized ? (
                <div className="col-span-full">
                  <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Play className="size-8" fill="currentColor" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Continue learning · {resume.name}
                      </span>
                      <h2 className="mt-1.5 truncate text-xl font-semibold">
                        {resume.selectedLessonName ?? "Resume course"}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{progressText(resume)}</p>
                      <button
                        type="button"
                        disabled={isOpeningCourse}
                        aria-busy={isOpeningCourse}
                        aria-label={`Continue ${resume.selectedLessonName ?? resume.name}`}
                        onClick={() => onOpenCourse(resume.root)}
                        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Play className="size-4" fill="currentColor" />
                        Continue learning
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {visible.map((course) => (
                <CourseCard
                  key={course.root}
                  course={course}
                  model={model}
                  isOpeningCourse={isOpeningCourse}
                  onOpen={() => onOpenCourse(course.root)}
                />
              ))}

              {visible.length === 0 ? (
                <div className="col-span-full grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
                  <BookOpen className="size-7 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    {normalized ? "No matches" : "No courses yet"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {normalized
                      ? "Try a course or lesson name."
                      : "Open a course folder to add it to this library."}
                  </p>
                  {!normalized ? (
                    <button
                      type="button"
                      disabled={isOpeningCourse}
                      onClick={onOpenFolder}
                      className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/35 bg-primary/15 px-5 text-sm font-semibold transition-colors hover:bg-primary/25 disabled:opacity-60"
                    >
                      <FolderOpen className="size-4" />
                      Open Course Folder
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function CourseCard({
  course,
  model,
  isOpeningCourse,
  onOpen,
}: {
  course: DashboardCourse;
  model: AppModel;
  isOpeningCourse: boolean;
  onOpen: () => void;
}) {
  const percent = course.totalLessons
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-panel)] ${
        course.available ? "" : "opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!course.available || isOpeningCourse}
        aria-busy={isOpeningCourse}
        aria-label={`Open ${course.name}`}
        className="block w-full text-left disabled:cursor-not-allowed"
      >
        <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-primary/12 via-surface-strong to-background">
          {course.coverUrl ? (
            <img src={course.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
              <BookOpen className="size-9 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-xs uppercase tracking-[0.25em]">Limmud</span>
            </div>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-primary">
            {course.available ? `${percent}%` : "Unavailable"}
          </span>
        </div>
        <div className="grid gap-2.5 p-4">
          <div className="grid gap-1">
            <h2 className="truncate text-base font-semibold">{course.name}</h2>
            {course.available && course.selectedLessonName ? (
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary">
                <Play className="size-3 shrink-0" fill="currentColor" />
                <span className="truncate">Next: {course.selectedLessonName}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {course.available ? progressText(course) : "Folder could not be reached"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
              <CircleCheck className="size-3 text-primary" />
              {course.completedLessons}/{course.totalLessons} lessons
            </span>
            {course.bookmarkedLessonNames.length ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
                <Bookmark className="size-3 text-primary" />
                {course.bookmarkedLessonNames.length}
              </span>
            ) : null}
            {course.noteNames.length ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
                <NotebookPen className="size-3 text-primary" />
                {course.noteNames.length}
              </span>
            ) : null}
            <span className="ml-auto">{relativeTime(course.lastOpenedAt)}</span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
            aria-label={`${percent}% complete`}
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </button>
      {menuOpen ? (
        <div
          className="fixed inset-0 z-30 cursor-default"
          aria-hidden="true"
          onClick={closeMenu}
        />
      ) : null}
      <button
        type="button"
        aria-label={`Course actions for ${course.name}`}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className={`absolute right-3 top-[8.5rem] z-40 grid size-8 place-items-center rounded-full border bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:text-foreground ${
          menuOpen ? "border-primary/50 text-foreground" : "border-border"
        }`}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menuOpen ? (
        <div className="absolute right-2 top-[10.5rem] z-40 grid w-52 gap-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-[var(--shadow-panel)]">
          <MenuButton
            onClick={() => {
              closeMenu();
              void model.changeCourseCover(course.root);
            }}
          >
            {course.coverPath ? "Change Cover" : "Choose Cover"}
          </MenuButton>
          {course.coverPath ? (
            <MenuButton
              onClick={() => {
                closeMenu();
                void model.clearCourseCover(course.root);
              }}
            >
              Remove Cover
            </MenuButton>
          ) : null}
          {!course.available ? (
            <MenuButton
              onClick={() => {
                closeMenu();
                void model.locateCourse(course.root);
              }}
            >
              Locate Folder
            </MenuButton>
          ) : null}
          <MenuButton
            onClick={() => {
              closeMenu();
              void model.forgetCourse(course.root);
            }}
          >
            Remove from Library
          </MenuButton>
        </div>
      ) : null}
    </article>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-surface-strong hover:text-foreground"
    >
      {children}
    </button>
  );
}

function LibraryList({
  courses,
  kind,
  isOpeningCourse,
  onOpenCourse,
}: {
  courses: DashboardCourse[];
  kind: "bookmarks" | "notes";
  isOpeningCourse: boolean;
  onOpenCourse: (root: string) => void;
}) {
  const rows = courses.flatMap((course) =>
    (kind === "bookmarks" ? course.bookmarkedLessonNames : course.noteNames).map((name) => ({
      course,
      name,
    })),
  );
  if (!rows.length) {
    return (
      <div className="col-span-full grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <BookOpen className="size-7 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No {kind} found</h2>
        <p className="text-sm text-muted-foreground">
          Items saved in remembered courses will appear here.
        </p>
      </div>
    );
  }
  return (
    <section className="grid gap-2">
      {rows.map(({ course, name }, index) => (
        <button
          key={`${course.root}-${name}-${index}`}
          type="button"
          disabled={!course.available || isOpeningCourse}
          aria-busy={isOpeningCourse}
          onClick={() => onOpenCourse(course.root)}
          className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          {kind === "bookmarks" ? (
            <Bookmark className="size-[18px] text-primary" />
          ) : (
            <NotebookPen className="size-[18px] text-primary" />
          )}
          <span className="grid min-w-0">
            <strong className="truncate text-sm">{name}</strong>
            <small className="text-xs text-muted-foreground">{course.name}</small>
          </span>
        </button>
      ))}
    </section>
  );
}

function progressText(course: DashboardCourse) {
  return course.totalLessons
    ? `${course.completedLessons} of ${course.totalLessons} lessons complete`
    : "No video lessons found";
}

function relativeTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time === 0) return "Previously opened";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  return days === 0
    ? "Opened today"
    : days === 1
      ? "Opened yesterday"
      : `Opened ${days} days ago`;
}
