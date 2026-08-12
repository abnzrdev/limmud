import { mobileCourseService, type MobileCourseService } from "../../lib/mobileCourseService";
import { mobileDictionaryService, type MobileDictionaryService } from "../../lib/mobileDictionaryService";
import { MobileCourse } from "./course/MobileCourse";
import { MobileHome } from "./home/MobileHome";
import { MobileNavigation } from "./navigation/MobileNavigation";
import { MobileNotes } from "./notes/MobileNotes";
import { MobileStudy } from "./study/MobileStudy";
import { MobileTools } from "./tools/MobileTools";
import { useMobileAppModel } from "./useMobileAppModel";
import "./mobile.css";

export function MobileAppShell({ service = mobileCourseService, dictionaryService = mobileDictionaryService }: { service?: MobileCourseService; dictionaryService?: MobileDictionaryService }) {
  const model = useMobileAppModel(service);
  if (model.destination === "home" || !model.course || !model.lesson || !model.section) return <div className="mobile-app-shell"><MobileHome status={model.status} course={model.course} lessonName={model.lesson?.name ?? null} completedCount={model.completedCount} safeError={model.safeError} onResume={() => model.navigate("study")} onCourse={() => model.navigate("course")} onAddCourse={model.pickCourse} onRelink={model.relinkCourse} /></div>;
  return <div className={`mobile-app-shell${model.zen ? " is-zen" : ""}`}>
    {!model.zen ? <MobileNavigation current={model.destination} onNavigate={model.navigate} /> : null}
    {model.safeError && !model.zen ? <div className="m-error-banner" role="alert">{model.safeError}</div> : null}
    <div className="m-destination">
      {model.destination === "course" ? <MobileCourse courseName={model.course.displayName} sections={model.sections} selectedId={model.lesson.id} completedCount={model.completedCount} lessonCount={model.lessonCount} expanded={model.expandedSections} onToggle={model.toggleSection} onSelect={model.selectLesson} /> : null}
      {model.destination === "study" ? <MobileStudy service={service} courseId={model.course.courseId} entries={model.course.entries} lesson={model.lesson} section={model.section} index={model.selectedIndex} count={model.lessonCount} zen={model.zen} onZen={model.setZen} onPrevious={model.previousLesson} onNext={model.nextLesson} onBookmark={model.toggleBookmark} onCompleted={model.toggleCompleted} resumeTime={model.resumeTime} onProgress={model.updatePlaybackProgress} onEnded={model.completePlayback} onStudySeconds={model.recordVideoStudySeconds} /> : null}
      {model.destination === "notes" ? <MobileNotes lesson={model.lesson} section={model.section} note={model.note} editing={model.noteEditing} dirty={model.noteDirty} status={model.noteStatus} capability={model.noteCapability} onEdit={model.editNote} onChange={model.updateNote} onSave={model.saveNote} onEnableEditing={model.enableNoteEditing} /> : null}
      {model.destination === "tools" ? <MobileTools active={model.tool} onActive={model.setTool} timer={model.timer} timerMode={model.timerMode} timerPreset={model.timerPreset} onTimer={model.toggleTimer} onTimerReset={model.resetTimer} todos={model.todos} onTodo={model.toggleTodo} onAddTodo={model.addTodo} bookmarks={model.bookmarkedLessons} onBookmark={model.selectLesson} storage={model.stateStorage} onEnableCourseSaving={model.enableCourseSaving} dictionaryService={dictionaryService} vocabulary={model.vocabulary} onAddVocabulary={model.addVocabulary} onRemoveVocabulary={model.removeVocabulary} /> : null}
    </div>
  </div>;
}
