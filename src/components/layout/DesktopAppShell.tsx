import { useState } from "react";
import { useAppModel } from "../../hooks/useAppModel";
import { Dashboard } from "../dashboard/Dashboard";
import { DictionaryDrawer } from "../dictionary/DictionaryDrawer";
import { AppShell } from "./AppShell";
import "../dashboard/dashboard.css";

export function DesktopAppShell() {
  const model = useAppModel();
  const [view, setView] = useState<"dashboard" | "workspace">("dashboard");
  const [dictionaryOpen, setDictionaryOpen] = useState(false);

  const openKnownCourse = async (root: string) => {
    if (await model.openKnownCourse(root)) setView("workspace");
  };
  const openFolder = async () => {
    if (await model.openCourse()) setView("workspace");
  };

  if (view === "workspace") return <AppShell model={model} onDashboard={() => setView("dashboard")} />;
  return <>
    <Dashboard model={model} onOpenCourse={(root) => void openKnownCourse(root)} onOpenFolder={() => void openFolder()} onDictionary={() => setDictionaryOpen(true)} />
    <DictionaryDrawer open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} courseRoot={model.currentCourseRoot} />
  </>;
}
