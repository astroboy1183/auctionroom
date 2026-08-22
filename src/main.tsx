import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./App";
import DebugAuction from "./screens/DebugAuction";
import "./index.css";

// Dev-only introspection: lets headless UI checks fast-forward to a finished
// auction (never shipped — guarded by import.meta.env.DEV).
if (import.meta.env.DEV) {
  import("./store/gameStore").then(({ useGameStore }) => {
    import("./engine/simulate").then(({ simulateBotAuction }) => {
      import("./data/players.json").then((players) => {
        (window as unknown as Record<string, unknown>).__store = () => useGameStore.getState();
        (window as unknown as Record<string, unknown>).__ff = () => {
          const { state } = simulateBotAuction(players.default as never, 42);
          useGameStore.setState({ auction: state });
        };
      });
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/debug" element={<DebugAuction />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
