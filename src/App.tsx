import { AppShell } from "./components/layout/AppShell";
import { useAppModel } from "./hooks/useAppModel";

function App() {
  const model = useAppModel();
  return <AppShell model={model} />;
}

export default App;
