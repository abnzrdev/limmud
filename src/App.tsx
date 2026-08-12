import { lazy, Suspense } from "react";
import { isAndroidRuntime } from "./lib/platform";

const DesktopAppShell = lazy(() => import("./components/layout/DesktopAppShell").then((module) => ({ default: module.DesktopAppShell })));
const MobileAppShell = lazy(() => import("./components/mobile/MobileAppShell").then((module) => ({ default: module.MobileAppShell })));

function App() {
  if (isAndroidRuntime()) {
    return <Suspense fallback={<div className="app-loading" role="status">Limmud</div>}><MobileAppShell /></Suspense>;
  }
  return <Suspense fallback={<div className="app-loading" role="status">Limmud</div>}><DesktopAppShell /></Suspense>;
}

export default App;
