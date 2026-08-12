import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import type { MobileCourseService } from "../../../lib/mobileCourseService";
import type { ProviderCourseEntry } from "../mobileCourseModel";
import { lessonTitle, type MobileLesson, type MobileSection } from "../mobileModel";
import { MobilePlayer } from "./MobilePlayer";

interface MobileStudyProps {
  service: MobileCourseService;
  courseId: string;
  entries: ProviderCourseEntry[];
  lesson: MobileLesson;
  section: MobileSection;
  index: number;
  count: number;
  zen: boolean;
  onZen: (value: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onBookmark: () => void;
  onCompleted: () => void;
  resumeTime: number;
  onProgress: (seconds: number) => void;
  onEnded: (seconds: number) => void;
  onStudySeconds: (seconds: number) => void;
}

export function MobileStudy({ service, courseId, entries, lesson, section, index, count, zen, onZen, onPrevious, onNext, onBookmark, onCompleted, resumeTime, onProgress, onEnded, onStudySeconds }: MobileStudyProps) {
  return <div className={`m-screen m-study${zen ? " is-zen" : ""}`}>
    <div className="m-media">
      <MobilePlayer service={service} courseId={courseId} lesson={lesson} entries={entries} initialTime={resumeTime} onProgress={onProgress} onEnded={onEnded} onStudySeconds={onStudySeconds} onPrevious={onPrevious} onNext={onNext} canPrevious={index > 0} canNext={index < count - 1} />
      {zen ? <button className="m-zen-exit" type="button" aria-label="Exit Zen mode" onClick={() => onZen(false)}><Expand /> Exit Zen</button> : null}
    </div>
    <div className="m-study__layout">
      <main className="m-study__details">
        <span className="m-eyebrow">{section.name} · Lesson {index + 1} of {count}</span>
        <h2>{lessonTitle(lesson)}</h2>
        <div className="m-study-actions">
          <button type="button" aria-label="Bookmark" className={lesson.bookmarked ? "is-active" : ""} onClick={onBookmark}><Bookmark fill={lesson.bookmarked ? "currentColor" : "none"} /> Bookmark</button>
          <button type="button" aria-label={lesson.completed ? "Mark incomplete" : "Mark complete"} className={lesson.completed ? "is-active" : ""} onClick={onCompleted}><CheckCircle2 /> {lesson.completed ? "Completed" : "Mark complete"}</button>
          <button type="button" aria-label="Enter Zen mode" onClick={() => onZen(true)}><Expand /> Zen</button>
        </div>
        <div className="m-lesson-context"><h3>Lesson focus</h3><p>Notice the main idea, capture it in your own words, and leave a clear next step before moving on.</p></div>
        <div className="m-lesson-nav">
          <button type="button" aria-label="Previous lesson" disabled={index === 0} onClick={onPrevious}><ChevronLeft /><span>Previous</span></button>
          <span>{index + 1} / {count}</span>
          <button type="button" aria-label="Next lesson" disabled={index === count - 1} onClick={onNext}><span>Next</span><ChevronRight /></button>
        </div>
      </main>
      <aside className="m-study__aside"><span className="m-eyebrow">In this lesson</span><h3>Study deliberately</h3><p>Your course outline and notes become supporting surfaces at wider sizes instead of stretching the phone layout.</p><div className="m-progress"><span style={{ width: "38%" }} /></div></aside>
    </div>
  </div>;
}
