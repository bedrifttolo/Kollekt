import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "../i18n";
import "../styles/globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { queryClient } from "../lib/queryClient";
import ProfilePage from "../pages/ProfilePage";

window.addEventListener("error", (event) => {
  document.title = "HARNESS_ERROR: " + (event.error?.stack || event.message);
  console.error("[harness] window error", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  document.title = "HARNESS_REJECTION: " + (event.reason?.stack || String(event.reason));
  console.error("[harness] unhandled rejection", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/profile"]}>
          <div style={{ width: 390, maxWidth: 390, padding: 12 }}>
            <ProfilePage />
          </div>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

window.setTimeout(() => {
  if (document.title.indexOf("HARNESS_ERROR") === -1 && document.title.indexOf("HARNESS_REJECTION") === -1) {
    document.title = "HARNESS_OK root-children=" + (document.getElementById("root")?.childElementCount ?? -1);
  }
}, 4000);
