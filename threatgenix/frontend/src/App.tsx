import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ThreatModelPage from "./pages/ThreatModelPage";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>ThreatGenix</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/threat-models/:id" element={<ThreatModelPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
