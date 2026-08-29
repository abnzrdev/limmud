import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { lazy, Suspense } from "react";
import {
  Bookmark,
  BookOpen,
  FolderOpen,
  House,
  NotebookPen,
  Play,
  Search,
} from "lucide-react";
import { courses, courseProgress, allLessons } from "@/lib/demo-data";

// The real Limmud desktop application (Tauri): Dashboard + workspace AppShell,
// fully wired to useAppModel (Tauri folder dialogs, course scanning, notes,
// persistence). Lazy-loaded and mounted client-side only — the legacy shell
// reads `window` during mount (responsive breakpoints, Tauri detection), so it
// must never execute during SSR.
const DesktopAppShell = lazy(() =>
  import("@/components/layout/DesktopAppShell").then((module) => ({
    default: module.DesktopAppShell,
  })),
);

function LimmudApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="app-loading" role="status">Limmud</div>;
  }
  return (
    <Suspense fallback={<div className="app-loading" role="status">Limmud</div>}>
      <DesktopAppShell />
    </Suspense>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Limmud — Your course library" },
      {
        name: "description",
        content:
          "Limmud keeps your local Torah courses, lessons, bookmarks and notes in one calm study library.",
      },
      { property: "og:title", content: "Limmud — Your course library" },
      {
        property: "og:description",
        content: "A calm study library for local video courses, notes and bookmarks.",
      },
    ],
  }),
  component: LimmudApp,
});

// The Lovable design mockup for the library UI (demo data, static buttons).
// Retained as the design reference; the routed index component is the real,
// fully interactive Tauri app above.

type Section = "dashboard" | "courses" | "bookmarks" | "notes";

const nav: { key: Section; label: string; icon: typeof House }[] = [
  { key: "dashboard", label: "Dashboard", icon: House },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "notes", label: "Notes", icon: NotebookPen },
];

function Library() {
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

  const normalized = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      courses.filter(
        (course) =>
          !normalized ||
          [course.name, course.teacher, ...allLessons(course).map((e) => e.lesson.title)].some((v) =>
            v.toLowerCase().includes(normalized),
          ),
      ),
    [normalized],
  );

  const resume = courses[0]!;
  const resumeLesson = allLessons(resume).find((entry) => !entry.lesson.completed);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1 border-r border-border bg-sidebar px-3.5 py-5">
        <div className="flex items-center gap-3 px-2 pb-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary font-[family-name:var(--font-display)] text-lg font-bold text-primary-foreground">
            ל
          </div>
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
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary/30 bg-primary/15 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-surface-strong hover:text-foreground"
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
          className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/15 text-sm font-semibold transition-colors hover:bg-primary/25"
        >
          <FolderOpen className="size-[18px]" />
          Open Course Folder
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
              {courses.length} remembered
            </span>
          </div>

          {section === "dashboard" && !normalized ? (
            <section className="mb-10 flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Play className="size-8" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Continue learning · {resume.name}
                </span>
                <h2 className="mt-1.5 truncate text-xl font-semibold">
                  {resumeLesson?.lesson.title ?? "Resume course"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {courseProgress(resume).completed} of {courseProgress(resume).total} lessons
                  complete
                </p>
                <Link
                  to="/course/$courseId"
                  params={{ courseId: resume.id }}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Play className="size-4" fill="currentColor" />
                  Continue learning
                </Link>
              </div>
            </section>
          ) : null}

          {section === "bookmarks" || section === "notes" ? (
            <section className="grid gap-2">
              {visible.flatMap((course) =>
                allLessons(course)
                  .filter((entry) => (section === "bookmarks" ? entry.lesson.bookmarked : true))
                  .slice(0, section === "notes" ? 2 : undefined)
                  .map((entry) => (
                    <Link
                      key={`${course.id}-${entry.lesson.id}`}
                      to="/course/$courseId"
                      params={{ courseId: course.id }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
                    >
                      {section === "bookmarks" ? (
                        <Bookmark className="size-[18px] text-primary" />
                      ) : (
                        <NotebookPen className="size-[18px] text-primary" />
                      )}
                      <span className="grid min-w-0">
                        <strong className="truncate text-sm">{entry.lesson.title}</strong>
                        <small className="text-xs text-muted-foreground">{course.name}</small>
                      </span>
                    </Link>
                  )),
              )}
            </section>
          ) : (
            <section
              aria-label="Course library"
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {visible.map((course) => {
                const progress = courseProgress(course);
                return (
                  <Link
                    key={course.id}
                    to="/course/$courseId"
                    params={{ courseId: course.id }}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-panel)]"
                  >
                    <div className="relative flex h-40 items-center justify-center bg-surface-strong">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
                        <BookOpen className="size-8" />
                        <span className="text-xs uppercase tracking-[0.2em]">{course.tag}</span>
                      </div>
                      <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-primary">
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="grid gap-2 p-4">
                      <h2 className="truncate text-base font-semibold">{course.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {course.teacher} · {progress.completed} of {progress.total} lessons
                      </p>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
                        aria-label={`${progress.percent}% complete`}
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <small className="text-xs text-muted-foreground">{course.lastOpened}</small>
                    </div>
                  </Link>
                );
              })}
              {visible.length === 0 ? (
                <div className="col-span-full grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
                  <BookOpen className="size-7 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">No matches</h2>
                  <p className="text-sm text-muted-foreground">Try a course or lesson name.</p>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
