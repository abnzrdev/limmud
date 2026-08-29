import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Focus,
  ListTodo,
  Minimize2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Play,
  Terminal,
} from "lucide-react";
import { allLessons, courseProgress, findCourse } from "@/lib/demo-data";


export const Route = createFileRoute("/course/$courseId")({
  loader: ({ params }) => {
    const course = findCourse(params.courseId);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Course unavailable — Limmud" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.course.name} — Limmud workspace`;
    const description = `Study ${loaderData.course.name} with ${loaderData.course.teacher}: lessons, notes, bookmarks and focus tools side by side.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: Workspace,
});

type Tab = "notes" | "transcript" | "terminal";

function Workspace() {
  const { course } = Route.useLoaderData();
  const entries = allLessons(course);
  const progress = courseProgress(course);
  const [activeId, setActiveId] = useState(
    (entries.find((entry) => !entry.lesson.completed) ?? entries[0]!).lesson.id,
  );
  const [tab, setTab] = useState<Tab>("notes");
  const [note, setNote] = useState(
    "Key move: the Gemara re-reads the Mishnah's timing so both opinions can stand.\n\n— follow up on Tosafot's objection",
  );
  const active = entries.find((entry) => entry.lesson.id === activeId) ?? entries[0]!;

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zen, setZen] = useState(false);

  const enterZen = () => {
    setZen(true);
    setLeftOpen(false);
    setRightOpen(false);
    setTab("notes");
  };
  const exitZen = () => {
    setZen(false);
    setLeftOpen(true);
    setRightOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) {
        if (event.key === "Escape" && zen) exitZen();
        return;
      }
      if (event.key === "Escape" && zen) exitZen();
      if (event.key.toLowerCase() === "z") (zen ? exitZen : enterZen)();
      if (event.key === "[") setLeftOpen((open) => !open);
      if (event.key === "]") setRightOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zen]);

  const columns = zen
    ? "lg:grid-cols-[minmax(0,1fr)]"
    : leftOpen && rightOpen
      ? "lg:grid-cols-[300px_minmax(0,1fr)_300px]"
      : leftOpen
        ? "lg:grid-cols-[300px_minmax(0,1fr)]"
        : rightOpen
          ? "lg:grid-cols-[minmax(0,1fr)_300px]"
          : "lg:grid-cols-[minmax(0,1fr)]";

  return (
    <div className={`grid min-h-screen grid-cols-1 ${columns}`}>
      {/* Lesson tree */}
      <aside className={`flex flex-col border-r border-border bg-sidebar ${zen || !leftOpen ? "hidden" : ""}`}>

        <div className="border-b border-border px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Library
          </Link>
          <h1 className="mt-3 text-lg font-semibold leading-tight">{course.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{course.teacher}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {progress.completed} of {progress.total} lessons · {progress.percent}%
          </p>
        </div>

        <div className="flex-1 overflow-auto px-2 py-3">
          {course.modules.map((module) => (
            <details key={module.id} open className="mb-1 group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-surface-strong">
                <ChevronDown className="size-4 transition-transform group-open:rotate-0 [details:not([open])_&]:-rotate-90" />
                {module.title}
              </summary>
              <div className="grid gap-0.5 py-1">
                {module.lessons.map((lesson) => {
                  const isActive = lesson.id === active.lesson.id && module.id === active.module.id;
                  return (
                    <button
                      key={`${module.id}-${lesson.id}`}
                      type="button"
                      onClick={() => setActiveId(lesson.id)}
                      className={`relative flex w-full min-w-0 items-center gap-2 rounded-lg py-2 pl-3.5 pr-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-primary/12 text-foreground"
                          : "text-muted-foreground hover:bg-surface-strong hover:text-foreground"
                      }`}
                    >
                      {isActive ? (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
                      ) : null}
                      {lesson.completed ? (
                        <CircleCheck className="size-4 shrink-0 text-primary" />
                      ) : (
                        <Play className="size-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {lesson.bookmarked ? (
                        <Bookmark className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {lesson.duration}
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </aside>

      {/* Player + tabs */}
      <main className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-sidebar/60 px-3 py-2">
          <button
            type="button"
            onClick={() => setLeftOpen((open) => !open)}
            aria-pressed={leftOpen && !zen}
            title="Toggle lesson list ([)"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {leftOpen && !zen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
            <span className="sr-only">Toggle lesson list</span>
          </button>
          {zen ? (
            <Link
              to="/"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Library
            </Link>
          ) : null}
          <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {zen ? "Zen mode · Esc to exit" : "[ ] toggle rails · Z for zen"}
          </span>
          <button
            type="button"
            onClick={() => (zen ? exitZen() : enterZen())}
            className={`flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors ${
              zen
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {zen ? <Minimize2 className="size-3.5" /> : <Focus className="size-3.5" />}
            {zen ? "Exit zen" : "Zen mode"}
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((open) => !open)}
            aria-pressed={rightOpen && !zen}
            title="Toggle study tools (])"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {rightOpen && !zen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
            <span className="sr-only">Toggle study tools</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-black/40">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden border-b border-border bg-surface">
            <button
              type="button"
              aria-label={`Play ${active.lesson.title}`}
              className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-panel)] transition-transform hover:scale-105"
            >
              <Play className="size-8" fill="currentColor" />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/80 to-transparent px-6 pb-5 pt-14">
              <span className="text-xs tabular-nums text-foreground/80">04:12</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/20">
                <span className="block h-full w-1/4 rounded-full bg-primary" />
              </div>
              <span className="text-xs tabular-nums text-foreground/80">{active.lesson.duration}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-sidebar/60 px-5 py-4">
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {active.module.title}
              </span>
              <h2 className="mt-1 text-2xl font-semibold">{active.lesson.title}</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Bookmark className="size-4" />
                Bookmark
              </button>
              <button
                type="button"
                className="flex min-h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Check className="size-4" />
                Mark complete
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className={`flex gap-1 border-b border-border px-5 ${zen ? "hidden" : ""}`}>
              {(
                [
                  ["notes", "Notes", NotebookPen],
                  ["transcript", "Transcript", Clock],
                  ["terminal", "Terminal", Terminal],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    tab === key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-64 flex-1 p-5">
              {tab === "notes" ? (
                <textarea
                  aria-label="Lesson notes"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="h-full min-h-56 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary/60 focus:ring-[3px] focus:ring-primary/25"
                />
              ) : tab === "transcript" ? (
                <div className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
                  {[
                    ["00:12", "We open with the question the Mishnah leaves unresolved."],
                    ["01:48", "Notice how the language shifts once the second opinion appears."],
                    ["04:12", "Here is the move that lets both readings stand together."],
                    ["07:35", "Rashi narrows the case; Tosafot pushes back."],
                  ].map(([time, line]) => (
                    <p key={time} className="flex gap-4 rounded-xl px-2 py-1.5 hover:bg-surface">
                      <span className="shrink-0 tabular-nums text-primary">{time}</span>
                      <span>{line}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <pre className="h-full min-h-56 overflow-auto rounded-2xl border border-border bg-black/60 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                  {`limmud ~ ${course.id}\n$ limmud lessons --status\n  ✓ ${progress.completed} complete\n  · ${progress.total - progress.completed} remaining\n$ _`}
                </pre>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Tools rail */}
      <aside
        className={`flex flex-col gap-4 border-l border-border bg-sidebar p-4 ${
          zen || !rightOpen ? "hidden" : ""
        }`}
      >
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-primary" />
            Focus timer
          </h3>
          <p className="mt-3 text-center font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums">
            25:00
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start
            </button>
            <button
              type="button"
              className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ListTodo className="size-4 text-primary" />
            Study tasks
          </h3>
          <ul className="mt-3 grid gap-2 text-sm">
            {[
              ["Review yesterday's sugya", true],
              ["Summarise Tosafot's objection", false],
              ["Prepare chavruta questions", false],
            ].map(([label, done]) => (
              <li key={label as string} className="flex items-center gap-2.5">
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border ${
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {done ? <Check className="size-3" /> : null}
                </span>
                <span className={done ? "text-muted-foreground line-through" : ""}>
                  {label as string}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="size-4 text-primary" />
            Attachments
          </h3>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {["source-sheet.pdf", "berakhot-2a.png", "glossary.md"].map((file) => (
              <li
                key={file}
                className="truncate rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {file}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
