import { useState } from "react";
import { useAppModel } from "../../hooks/useAppModel";
import { DictionaryDrawer } from "../dictionary/DictionaryDrawer";
import { Library } from "../dashboard/Library";
import { AppShell } from "./AppShell";
import "../../styles-legacy.css";

export function DesktopAppShell() {
  const model = useAppModel();
  const [view, setView] = useState<"dashboard" | "workspace">("dashboard");
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [isOpeningCourse, setIsOpeningCourse] = useState(false);

  const openKnownCourse = async (root: string) => {
    setIsOpeningCourse(true);
    try {
      if (await model.openKnownCourse(root)) setView("workspace");
    } finally {
      setIsOpeningCourse(false);
    }
  };
  const openFolder = async () => {
    setIsOpeningCourse(true);
    try {
      if (await model.openCourse()) setView("workspace");
    } finally {
      setIsOpeningCourse(false);
    }
  };

  if (view === "workspace") return <AppShell model={model} onDashboard={() => setView("dashboard")} />;
  return <>
    <Library model={model} isOpeningCourse={isOpeningCourse} onOpenCourse={(root) => void openKnownCourse(root)} onOpenFolder={() => void openFolder()} onDictionary={() => setDictionaryOpen(true)} />
    <DictionaryDrawer open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} courseRoot={model.currentCourseRoot} />
  </>;
}
