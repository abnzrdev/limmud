import limmudAppIcon from "../../assets/brand/limmud/app-icon-source.png";
import {
  BarChart3,
  Bookmark,
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock3,
  Focus,
  GripHorizontal,
  GripVertical,
  ListTodo,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Search,
  Sun,
  SquareTerminal,
  Flame,
  House,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  usePanelRef,
  type Layout,
} from "react-resizable-panels";
import type { AppModel } from "../../hooks/useAppModel";
import { useStudyActivityTracker } from "../../hooks/useStudyActivityTracker";
import { courseEntryDisplayName, visibleCourseEntries } from "../../lib/courseTree";
import { collectCourseMaterials } from "../../lib/courseMaterials";
import type { ToolPanelKey, WorkspaceLayout } from "../../lib/persistence";
import { isTauriRuntime } from "../../lib/tauri";
import type { CourseEntry } from "../../types/course";
import { AttachmentsPanel } from "../right/AttachmentsPanel";
import { DictionaryDrawer } from "../dictionary/DictionaryDrawer";
import { FocusTimer } from "../right/FocusTimer";
import { TodoPanel } from "../right/TodoPanel";
import { CourseSidebar } from "../sidebar/CourseSidebar";
import { CourseTerminal } from "../workspace/CourseTerminal";
import { LessonWorkspace } from "../workspace/LessonWorkspace";

interface AppShellProps {
  model: AppModel;
  onDashboard?: () => void;
}

type RightWorkspaceMode = "terminal-tools" | "dictionary";

const toolKeys: ToolPanelKey[] = ["stats", "resources", "bookmarks", "timer", "todos"];

export function AppShell({ model, onDashboard }: AppShellProps) {
  const [isZenMode, setIsZenMode] = useState(false);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isCourseCollapsed, setIsCourseCollapsed] = useState(model.workspaceLayout.courseCollapsed);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(model.workspaceLayout.rightCollapsed);
  const [searchQuery, setSearchQuery] = useState("");
  const [videoStudyActive, setVideoStudyActive] = useState(false);
  const [isNarrowWindow, setIsNarrowWindow] = useState(() => window.innerWidth <= 1100);
  const [rightWorkspaceMode, setRightWorkspaceMode] = useState<RightWorkspaceMode>("terminal-tools");
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [openPanels, setOpenPanels] = useState<Record<ToolPanelKey, boolean>>(() =>
    Object.fromEntries(
      toolKeys.map((key) => [key, model.workspaceLayout.openTools.includes(key)]),
    ) as Record<ToolPanelKey, boolean>,
  );
  const workspaceGroupRef = useGroupRef();
  const terminalToolsGroupRef = useGroupRef();
  const coursePanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const layoutRef = useRef(model.workspaceLayout);
  const dictionaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousDictionaryOpenRef = useRef(false);
  const previousNarrowWindowRef = useRef(isNarrowWindow);
  const dictionaryOpen = rightWorkspaceMode === "dictionary";
  const searchResults = searchQuery.trim()
    ? collectSearchMatches(model.entries, searchQuery.trim())
    : [];
  const courseMaterials = collectCourseMaterials(model.entries);
  const materialTypeCount = new Set(courseMaterials.map((item) => item.group)).size;
  const terminalVisible = !isZenMode && !isToolsCollapsed && !dictionaryOpen;
  const studyActivity = useStudyActivityTracker({
    courseRoot: model.currentCourseRoot,
    lessonId: model.selectedEntry?.relativePath ?? null,
    videoActive: videoStudyActive,
    terminalVisible,
    onRecord: (courseRoot, source, seconds) =>
      model.recordStudySeconds(source, seconds, courseRoot),
  });

  useEffect(() => {
    const isLocalSave = JSON.stringify(model.workspaceLayout) === JSON.stringify(layoutRef.current);
    layoutRef.current = model.workspaceLayout;
    if (isLocalSave) return;
    setIsCourseCollapsed(model.workspaceLayout.courseCollapsed);
    setIsToolsCollapsed(model.workspaceLayout.rightCollapsed);
    setOpenPanels(
      Object.fromEntries(
        toolKeys.map((key) => [key, model.workspaceLayout.openTools.includes(key)]),
      ) as Record<ToolPanelKey, boolean>,
    );
    workspaceGroupRef.current?.setLayout({
      "course-workspace": model.workspaceLayout.courseSize,
      "center-workspace": 100 - model.workspaceLayout.courseSize - model.workspaceLayout.rightSize,
      "right-workspace": model.workspaceLayout.rightSize,
    });
    terminalToolsGroupRef.current?.setLayout({
      terminal: model.workspaceLayout.verticalSplit,
      tools: 100 - model.workspaceLayout.verticalSplit,
    });
  }, [model.workspaceLayout]);

  useEffect(() => {
    const updateNarrowWindow = () => setIsNarrowWindow(window.innerWidth <= 1100);
    window.addEventListener("resize", updateNarrowWindow);
    return () => window.removeEventListener("resize", updateNarrowWindow);
  }, []);

  useEffect(() => {
    if (
      previousDictionaryOpenRef.current === dictionaryOpen &&
      previousNarrowWindowRef.current === isNarrowWindow
    ) return;
    previousDictionaryOpenRef.current = dictionaryOpen;
    previousNarrowWindowRef.current = isNarrowWindow;
    const courseSize = layoutRef.current.courseSize;
    if (dictionaryOpen && !isNarrowWindow) {
      const availableWidth = Math.max(window.innerWidth, 1);
      const rightSize = Math.min(55, Math.max(20, model.dictionaryLayout.width / availableWidth * 100));
      workspaceGroupRef.current?.setLayout({
        "course-workspace": courseSize,
        "center-workspace": 100 - courseSize - rightSize,
        "right-workspace": rightSize,
      });
    } else {
      workspaceGroupRef.current?.setLayout({
        "course-workspace": layoutRef.current.courseSize,
        "center-workspace": 100 - layoutRef.current.courseSize - layoutRef.current.rightSize,
        "right-workspace": layoutRef.current.rightSize,
      });
    }
  }, [dictionaryOpen, isNarrowWindow, model.dictionaryLayout.width, workspaceGroupRef]);

  const closeDictionary = useCallback(() => {
    setRightWorkspaceMode("terminal-tools");
    window.setTimeout(() => dictionaryButtonRef.current?.focus(), 0);
  }, []);

  const saveLayout = useCallback(
    (patch: Partial<WorkspaceLayout>) => {
      const next = { ...layoutRef.current, ...patch };
      layoutRef.current = next;
      model.setWorkspaceLayout(next);
    },
    [model],
  );

  useEffect(() => {
    if (isCourseCollapsed) {
      coursePanelRef.current?.collapse();
    } else {
      coursePanelRef.current?.expand();
    }
  }, [coursePanelRef, isCourseCollapsed]);

  useEffect(() => {
    void setWindowFullscreen(isZenMode);
    return () => {
      if (isZenMode) {
        void setWindowFullscreen(false);
      }
    };
  }, [isZenMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (dictionaryOpen) closeDictionary();
        else setRightWorkspaceMode("dictionary");
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      if (isZenMode) {
        setIsZenMode(false);
      } else if (dictionaryOpen) {
        closeDictionary();
      } else if (isTerminalMaximized) {
        setIsTerminalMaximized(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDictionary, dictionaryOpen, isTerminalMaximized, isZenMode]);

  useEffect(() => {
    if (isToolsCollapsed && !dictionaryOpen) {
      rightPanelRef.current?.collapse();
    } else {
      rightPanelRef.current?.expand();
    }
  }, [dictionaryOpen, isToolsCollapsed, rightPanelRef]);

  const setRightCollapsed = (collapsed: boolean) => {
    setIsToolsCollapsed(collapsed);
    saveLayout({ rightCollapsed: collapsed });
  };

  const setCourseCollapsed = (collapsed: boolean) => {
    setIsCourseCollapsed(collapsed);
    saveLayout({ courseCollapsed: collapsed });
  };

  const openTool = (key: ToolPanelKey) => {
    setRightCollapsed(false);
    setOpenPanels((current) => {
      const alreadyOpen = current[key];
      const open = toolKeys.filter((item) => current[item] && item !== key);
      const nextOpen = alreadyOpen ? open : [...open.slice(-1), key];
      const next = Object.fromEntries(
        toolKeys.map((item) => [item, nextOpen.includes(item)]),
      ) as Record<ToolPanelKey, boolean>;
      saveLayout({ openTools: nextOpen });
      return next;
    });
  };

  const toggleTerminalMaximized = () => {
    setIsTerminalMaximized((current) => {
      if (!current && isToolsCollapsed) {
        setRightCollapsed(false);
      }
      return !current;
    });
  };

  const handleWorkspaceLayout = (layout: Layout, meta: { isUserInteraction: boolean }) => {
    const courseSize = layout["course-workspace"];
    const rightSize = layout["right-workspace"];
    if (!meta.isUserInteraction) return;
    if (dictionaryOpen) {
      if (Number.isFinite(rightSize)) {
        model.setDictionaryLayout({
          width: Math.min(620, Math.max(360, window.innerWidth * rightSize / 100)),
        });
      }
      return;
    }
    const patch: Partial<WorkspaceLayout> = {};
    if (Number.isFinite(courseSize)) {
      const collapsed = courseSize <= 8;
      patch.courseCollapsed = collapsed;
      setIsCourseCollapsed(collapsed);
      if (!collapsed && courseSize >= 10 && courseSize <= 24) patch.courseSize = courseSize;
    }
    if (Number.isFinite(rightSize)) {
      const collapsed = rightSize <= 10;
      patch.rightCollapsed = collapsed;
      setIsToolsCollapsed(collapsed);
      if (!collapsed && rightSize >= 20 && rightSize <= 55) patch.rightSize = rightSize;
    }
    if (Object.keys(patch).length) saveLayout(patch);
  };

  const handleTerminalToolsLayout = (layout: Layout, meta: { isUserInteraction: boolean }) => {
    const verticalSplit = layout.terminal;
    if (
      meta.isUserInteraction &&
      Number.isFinite(verticalSplit) &&
      verticalSplit >= 30 &&
      verticalSplit <= 75
    ) {
      saveLayout({ verticalSplit });
    }
  };

  return (
    <div
      className={`app-shell${isZenMode ? " app-shell--zen" : ""}${isTerminalMaximized ? " app-shell--terminal-maximized" : ""}${dictionaryOpen ? " app-shell--dictionary" : ""}${isCourseCollapsed ? " app-shell-course-collapsed" : ""}${isToolsCollapsed ? " app-shell-tools-collapsed" : ""}`}
    >
      <div className={`app-toolbar${isZenMode ? " app-toolbar-zen" : ""}`}>
        {isZenMode ? (
          <div className="zen-status">
            <span className="focus-status">{zenStatusLabel(model)}</span>
            <button type="button" className="button-secondary" onClick={() => setIsZenMode(false)}>
              <Focus aria-hidden="true" />
              Exit Zen
            </button>
          </div>
        ) : (
          <>
            <div className="app-brand">
              <span className="app-mark" aria-hidden="true">
                <img
                  className="app-mark-image"
                  src={limmudAppIcon}
                  alt=""
                />
              </span>
              <div>
                <h1 className="app-title">Limmud</h1>
                <span className="app-subtitle">Local study desk</span>
              </div>
            </div>
            <div className="app-search-wrap">
              <label className="app-search" aria-label="Search lessons">
                <Search aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search lessons..."
                />
              </label>
              {searchQuery.trim() ? (
                <div className="app-search-results" role="listbox">
                  {searchResults.length ? (
                    searchResults.map((entry) => (
                      <button
                        key={entry.id}
                        className="app-search-result"
                        type="button"
                        title={entry.relativePath}
                        onClick={() => {
                          model.selectEntry(entry);
                          setSearchQuery("");
                        }}
                      >
                        <span>{courseEntryDisplayName(entry)}</span>
                        <small>{entry.relativePath}</small>
                      </button>
                    ))
                  ) : (
                    <div className="app-search-empty">No lessons found</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="app-toolbar-actions">
              {onDashboard ? <button type="button" className="button-secondary" aria-label="Dashboard Home" onClick={onDashboard}><House aria-hidden="true" /> Home</button> : null}
              <button ref={dictionaryButtonRef} type="button" className="button-secondary" aria-label="Dictionary" title="Dictionary · Ctrl+Shift+D" onClick={() => setRightWorkspaceMode("dictionary")}>
                <BookOpen aria-hidden="true" /> Dictionary
              </button>
              <button
                type="button"
                className="button-secondary"
                aria-label={`Use ${model.theme === "dark" ? "light" : "dark"} theme`}
                onClick={model.toggleTheme}
              >
                {model.theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                {model.theme === "dark" ? "Light" : "Dark"}
              </button>
              <button
                type="button"
                className="button-secondary"
                aria-label="Zen Mode"
                onClick={() => setIsZenMode(true)}
              >
                <Focus aria-hidden="true" />
                Zen
              </button>
            </div>
          </>
        )}
      </div>

      <Group
        key="workspace-layout"
        id="workspace-layout"
        groupRef={workspaceGroupRef}
        className="workspace-resizable"
        orientation="horizontal"
        defaultLayout={{
          "course-workspace": model.workspaceLayout.courseSize,
          "center-workspace": 100 - model.workspaceLayout.courseSize - model.workspaceLayout.rightSize,
          "right-workspace": model.workspaceLayout.rightSize,
        }}
        resizeTargetMinimumSize={{ fine: 16, coarse: 32 }}
        onLayoutChanged={handleWorkspaceLayout}
      >
        <Panel
          id="course-workspace"
          className="course-workspace-panel"
          panelRef={coursePanelRef}
          defaultSize={`${model.workspaceLayout.courseSize}%`}
          minSize="190px"
          maxSize="360px"
          collapsible
          collapsedSize="48px"
        >
          {!isZenMode && !isTerminalMaximized ? (
            <CourseSidebar
              entries={model.entries}
              onOpenCourse={model.openCourse}
              onRefreshCourse={model.refreshCourse}
              isRefreshing={model.isRefreshingCourse}
              onSelectEntry={model.selectEntry}
              selectedEntry={model.selectedEntry}
              status={model.status}
              completedLessonPaths={model.completedLessons}
              bookmarkedLessonPaths={model.bookmarkedLessons}
              progressPercent={model.progressPercent}
              collapsed={isCourseCollapsed}
              onToggleCollapsed={() => setCourseCollapsed(!isCourseCollapsed)}
            />
          ) : null}
        </Panel>

        <Separator
          id="course-workspace-separator"
          className="resize-separator resize-separator-vertical"
          aria-label="Resize course outline and workspace"
        >
          <GripVertical aria-hidden="true" />
        </Separator>

        <Panel id="center-workspace" className="center-workspace-panel"
          minSize="420px">
          <div className="center-workspace" hidden={isTerminalMaximized}>
            <LessonWorkspace
              currentCourseRoot={model.currentCourseRoot}
              selectedEntry={model.selectedEntry}
              selectedSubtitle={model.selectedSubtitle}
              lessonEntries={model.lessonEntries}
              resumeTime={model.resumeTime}
              shouldAutoPlaySelectedEntry={model.shouldAutoPlaySelectedEntry}
              noteBody={model.noteBody}
              noteSaveStatus={model.noteSaveStatus}
              noteSaveError={model.noteSaveError}
              recoveredUnsavedDraft={model.recoveredUnsavedDraft}
              onNoteChange={model.setNoteBody}
              onSaveNote={model.saveNote}
              onLoadTextFile={model.loadTextFile}
              onSaveTextFile={model.saveTextFile}
              onLookupSelection={(text) => { setDictionaryQuery(text); setRightWorkspaceMode("dictionary"); }}
              onRefreshCourse={model.refreshCourse}
              isRefreshingCourse={model.isRefreshingCourse}
              onOpenLessonFolder={model.openLessonFolder}
              onVideoProgress={model.updateVideoProgress}
              onVideoEnded={(seconds) => {
                void model.advanceToNextLesson(seconds).then(model.flushCourseState);
              }}
              onPlaybackFlush={model.flushCourseState}
              onVideoStudyActivityChange={setVideoStudyActive}
              isLessonDone={
                Boolean(model.selectedEntry?.relativePath) &&
                model.completedLessons.includes(model.selectedEntry?.relativePath ?? "")
              }
              isLessonBookmarked={
                Boolean(model.selectedEntry?.relativePath) &&
                model.bookmarkedLessons.includes(model.selectedEntry?.relativePath ?? "")
              }
              onToggleLessonDone={model.toggleLessonDone}
              onToggleLessonBookmark={model.toggleLessonBookmark}
              isFocusMode={isZenMode}
            />
          </div>
        </Panel>

        <Separator
          id="workspace-terminal-separator"
          className="resize-separator resize-separator-vertical"
          aria-label="Resize terminal and workspace"
          hidden={dictionaryOpen && isNarrowWindow}
        >
          <GripVertical aria-hidden="true" />
        </Separator>

        <Panel
          id="right-workspace"
          className="right-workspace-panel"
          panelRef={rightPanelRef}
          defaultSize={`${model.workspaceLayout.rightSize}%`}
          minSize={dictionaryOpen && !isNarrowWindow ? "360px" : "300px"}
          maxSize={dictionaryOpen && !isNarrowWindow ? "620px" : "55%"}
          collapsible
          collapsedSize="48px"
        >
          <aside className={`right-workspace${isToolsCollapsed ? " right-workspace--collapsed" : ""}`} data-mode={rightWorkspaceMode}>
            <div
              className={`right-workspace-terminal${dictionaryOpen ? " right-workspace-terminal--covered" : ""}`}
              aria-hidden={dictionaryOpen || undefined}
              inert={dictionaryOpen || undefined}
            >
            <div className="right-panel-rail" hidden={!isToolsCollapsed || isZenMode || isTerminalMaximized}>
              <button
                type="button"
                className="icon-button"
                aria-label="Expand terminal and tools panel"
                title="Expand terminal and tools panel"
                onClick={() => setRightCollapsed(false)}
              >
                <PanelRightOpen aria-hidden="true" />
              </button>
              <button type="button" aria-label="Course Materials" title="Course Materials" onClick={() => openTool("resources")}>
                <BookMarked aria-hidden="true" />
              </button>
              <button type="button" aria-label="Stats" title="Stats" onClick={() => openTool("stats")}>
                <BarChart3 aria-hidden="true" />
              </button>
              <button type="button" aria-label="Bookmarks" title="Bookmarks" onClick={() => openTool("bookmarks")}>
                <Bookmark aria-hidden="true" />
              </button>
              <button type="button" aria-label="Timer" title="Timer" onClick={() => openTool("timer")}>
                <Clock3 aria-hidden="true" />
              </button>
              <button type="button" aria-label="Todos" title="Todos" onClick={() => openTool("todos")}>
                <ListTodo aria-hidden="true" />
              </button>
            </div>

            <div className="right-panel-content" hidden={isToolsCollapsed || isZenMode}>
              <Group
                id="terminal-tools-layout"
                groupRef={terminalToolsGroupRef}
                className="terminal-tools-resizable"
                orientation="vertical"
                defaultLayout={{
                  terminal: model.workspaceLayout.verticalSplit,
                  tools: 100 - model.workspaceLayout.verticalSplit,
                }}
                resizeTargetMinimumSize={{ fine: 16, coarse: 32 }}
                onLayoutChanged={handleTerminalToolsLayout}
              >
                <Panel id="terminal" className="terminal-panel-content" minSize="180px">
                  <CourseTerminal
                    courseRoot={model.currentCourseRoot}
                    visible={!isZenMode && !isToolsCollapsed && !dictionaryOpen}
                    maximized={isTerminalMaximized}
                    onToggleMaximized={toggleTerminalMaximized}
                    onUserActivity={studyActivity.reportTerminalActivity}
                    onActivityStopped={studyActivity.stopTerminalActivity}
                  />
                </Panel>
                <Separator
                  id="terminal-tools-separator"
                  className="resize-separator resize-separator-horizontal"
                  aria-label="Resize terminal and tools"
                >
                  <GripHorizontal aria-hidden="true" />
                </Separator>
                <Panel id="tools" className="tools-panel-content" minSize="180px">
                  <div className="tools-pane">
                    <div className="pane-header">
                      <div>
                        <p className="pane-label">Tools</p>
                        <h2 className="pane-title">Session panels</h2>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Collapse terminal and tools panel"
                        title="Collapse terminal and tools panel"
                        onClick={() => setRightCollapsed(true)}
                      >
                        <PanelRightClose aria-hidden="true" />
                      </button>
                    </div>
                    <div className="tools-scroll">
                      <CollapsiblePanel
                        title={<><Clock3 aria-hidden="true" />Timer</>}
                        summary={isZenMode ? "" : `${String(model.timerPreset).padStart(2, "0")}:00`}
                        open={openPanels.timer}
                        onToggle={() => openTool("timer")}
                      >
                        <FocusTimer
                          timerMode={model.timerMode}
                          timerPreset={model.timerPreset}
                          timerPresets={model.timerPresets}
                          onPickPreset={model.pickTimerPreset}
                          onToggleMode={model.toggleTimerMode}
                        />
                      </CollapsiblePanel>
                      <CollapsiblePanel
                        title={<><BarChart3 aria-hidden="true" />Stats</>}
                        summary={`Today ${formatStudyDuration(model.studyStats.todaySeconds)} · Streak ${model.studyStats.streakDays}d`}
                        open={openPanels.stats}
                        onToggle={() => openTool("stats")}
                      >
                        <StudyStatsPanel stats={model.studyStats} activeSource={studyActivity.activeSource} />
                      </CollapsiblePanel>
                      <CollapsiblePanel
                        title={<><BookMarked aria-hidden="true" />Course Materials</>}
                        summary={`${courseMaterials.length + model.resources.length} files · ${materialTypeCount} types`}
                        open={openPanels.resources}
                        onToggle={() => openTool("resources")}
                      >
                        <AttachmentsPanel
                          entries={model.entries}
                          selectedEntry={model.selectedEntry}
                          resources={model.resources}
                          onAddMaterial={model.importLessonResources}
                          onRefresh={model.refreshCourse}
                          refreshing={model.isRefreshingCourse}
                          onOpenMaterial={model.openCourseMaterial}
                          onOpenResource={model.openResource}
                        />
                      </CollapsiblePanel>
                      <CollapsiblePanel
                        title={<><Bookmark aria-hidden="true" />Bookmarks</>}
                        summary={`${model.bookmarkedEntries.length} ${model.bookmarkedEntries.length === 1 ? "lesson" : "lessons"}`}
                        open={openPanels.bookmarks}
                        onToggle={() => openTool("bookmarks")}
                      >
                        <section className="panel-section">
                          <ul className="detail-list bookmark-list">
                            {model.bookmarkedEntries.length ? (
                              model.bookmarkedEntries.map((entry) => (
                                <li key={entry.id}>
                                  <button className="bookmark-entry" type="button" title={entry.relativePath} onClick={() => model.selectEntry(entry)}>
                                    {entry.name.replace(/\.[^.]+$/, "")}
                                  </button>
                                </li>
                              ))
                            ) : <li>No bookmarks yet</li>}
                          </ul>
                        </section>
                      </CollapsiblePanel>
                      <CollapsiblePanel
                        title={<><ListTodo aria-hidden="true" />Todos</>}
                        summary={`${model.todos.filter((todo) => !todo.done).length} remaining`}
                        open={openPanels.todos}
                        onToggle={() => openTool("todos")}
                      >
                        <TodoPanel items={model.todos} onAddTodo={model.addTodo} onToggleTodo={model.toggleTodo} />
                      </CollapsiblePanel>
                    </div>
                  </div>
                </Panel>
              </Group>
            </div>
            </div>
            <DictionaryDrawer open={dictionaryOpen && !isZenMode} onClose={closeDictionary} courseRoot={model.currentCourseRoot} initialQuery={dictionaryQuery} />
          </aside>
        </Panel>
      </Group>
      <button
        type="button"
        className="dictionary-backdrop"
        aria-label="Close Dictionary"
        hidden={!dictionaryOpen || isZenMode}
        onClick={closeDictionary}
      />
    </div>
  );
}

interface CollapsiblePanelProps {
  title: ReactNode;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsiblePanel({ title, summary, open, onToggle, children }: CollapsiblePanelProps) {
  return (
    <section className="collapsible-panel">
      <button className="collapsible-header" type="button" aria-expanded={open} onClick={onToggle}>
        <span className="collapsible-heading">
          <span className="collapsible-title">{title}</span>
          <small aria-hidden="true">{summary}</small>
        </span>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
      </button>
      {open ? <div className="collapsible-body">{children}</div> : null}
    </section>
  );
}

function StudyStatsPanel({
  stats,
  activeSource,
}: {
  stats: AppModel["studyStats"];
  activeSource: "video" | "terminal" | null;
}) {
  return (
    <section className="panel-section study-stats">
      <div><span><Clock3 aria-hidden="true" />Today</span><strong>{formatStudyDuration(stats.todaySeconds)}</strong></div>
      <div><span><Clock3 aria-hidden="true" />Total</span><strong>{formatStudyDuration(stats.totalSeconds)}</strong></div>
      <div><span><Flame aria-hidden="true" />Streak</span><strong>{stats.streakDays} {stats.streakDays === 1 ? "day" : "days"}</strong></div>
      <div><span><Play aria-hidden="true" />Video today</span><strong>{formatStudyDuration(stats.todayBySource.videoSeconds)}</strong></div>
      <div><span><SquareTerminal aria-hidden="true" />Terminal today</span><strong>{formatStudyDuration(stats.todayBySource.terminalSeconds)}</strong></div>
      <p className="study-stats-live">{activeSource ? `Studying · ${activeSource === "terminal" ? "Terminal" : "Video"}` : "Idle"}</p>
      <p className="study-stats-note">Active study · Video + Terminal</p>
      <p className="study-stats-note">Focus Timer is user-controlled; Study Time is automatic.</p>
    </section>
  );
}

function formatStudyDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function zenStatusLabel(model: AppModel): string {
  return model.timerMode === "focus" ? `${String(model.timerPreset).padStart(2, "0")}:00` : "Focus";
}

async function setWindowFullscreen(fullscreen: boolean) {
  if (!isTauriRuntime()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(fullscreen);
  } catch (error) {
    console.warn("Zen Mode fullscreen failed", error);
  }
}

function collectSearchMatches(entries: CourseEntry[], query: string): CourseEntry[] {
  const normalizedQuery = query.toLocaleLowerCase();
  const matches: CourseEntry[] = [];
  for (const entry of visibleCourseEntries(entries)) {
    const label = courseEntryDisplayName(entry).toLocaleLowerCase();
    const path = entry.relativePath.toLocaleLowerCase();
    if (entry.kind === "video" && (label.includes(normalizedQuery) || path.includes(normalizedQuery))) {
      matches.push(entry);
    }
    if (entry.children?.length) matches.push(...collectSearchMatches(entry.children, query));
  }
  return matches;
}
