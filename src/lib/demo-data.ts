export type Lesson = {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  bookmarked?: boolean;
};

export type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  name: string;
  teacher: string;
  tag: string;
  lastOpened: string;
  modules: Module[];
};

export const courses: Course[] = [
  {
    id: "talmud-foundations",
    name: "Talmud Foundations",
    teacher: "R. Eliyahu Baron",
    tag: "Gemara",
    lastOpened: "Opened today",
    modules: [
      {
        id: "m1",
        title: "Orientation",
        lessons: [
          { id: "l1", title: "How a sugya is built", duration: "18:42", completed: true },
          { id: "l2", title: "Reading the page layout", duration: "24:05", completed: true, bookmarked: true },
          { id: "l3", title: "Rashi and Tosafot in dialogue", duration: "31:10", completed: true },
        ],
      },
      {
        id: "m2",
        title: "Berakhot 2a",
        lessons: [
          { id: "l4", title: "The opening question", duration: "27:33", completed: true },
          { id: "l5", title: "Mishnah and Gemara tension", duration: "22:18", completed: false, bookmarked: true },
          { id: "l6", title: "Working through the answer", duration: "35:47", completed: false },
        ],
      },
      {
        id: "m3",
        title: "Practice",
        lessons: [
          { id: "l7", title: "Guided chavruta drill", duration: "41:02", completed: false },
          { id: "l8", title: "Review and summary", duration: "16:24", completed: false },
        ],
      },
    ],
  },
  {
    id: "hebrew-grammar",
    name: "Hebrew Grammar Intensive",
    teacher: "Dr. Noa Shani",
    tag: "Language",
    lastOpened: "Opened yesterday",
    modules: [
      {
        id: "m1",
        title: "Roots and patterns",
        lessons: [
          { id: "l1", title: "Three-letter roots", duration: "19:11", completed: true },
          { id: "l2", title: "Binyanim overview", duration: "28:56", completed: true, bookmarked: true },
          { id: "l3", title: "Pa'al in practice", duration: "23:40", completed: false },
        ],
      },
      {
        id: "m2",
        title: "Verb tenses",
        lessons: [
          { id: "l4", title: "Past and future forms", duration: "30:02", completed: false },
          { id: "l5", title: "Participles", duration: "21:35", completed: false },
        ],
      },
    ],
  },
  {
    id: "chumash-bereshit",
    name: "Chumash: Bereshit",
    teacher: "R. Miriam Halevi",
    tag: "Tanakh",
    lastOpened: "Opened 4 days ago",
    modules: [
      {
        id: "m1",
        title: "Creation narratives",
        lessons: [
          { id: "l1", title: "Day one", duration: "26:14", completed: true },
          { id: "l2", title: "The garden", duration: "33:08", completed: false, bookmarked: true },
          { id: "l3", title: "Cain and Hevel", duration: "29:47", completed: false },
        ],
      },
    ],
  },
  {
    id: "jewish-thought",
    name: "Foundations of Jewish Thought",
    teacher: "Prof. Dov Aronson",
    tag: "Machshava",
    lastOpened: "Opened 2 weeks ago",
    modules: [
      {
        id: "m1",
        title: "Medieval voices",
        lessons: [
          { id: "l1", title: "Rambam on knowledge", duration: "38:22", completed: false },
          { id: "l2", title: "Kuzari's argument", duration: "34:51", completed: false },
        ],
      },
    ],
  },
];

export function allLessons(course: Course) {
  return course.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
}

export function courseProgress(course: Course) {
  const lessons = allLessons(course);
  const completed = lessons.filter((entry) => entry.lesson.completed).length;
  return {
    total: lessons.length,
    completed,
    percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
  };
}

export function findCourse(id: string) {
  return courses.find((course) => course.id === id);
}
