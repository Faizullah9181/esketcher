import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App, { loadStudio } from "./App";
import { routeOf } from "./lib/router";
import "./styles/index.css";

// Start the studio chunk now when that's where we're headed, so it downloads
// while React boots instead of after. From the home page, warm it once idle so
// "Open studio" is instant.
if (routeOf(window.location.pathname) === "studio") void loadStudio();
else (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2500)))(() => void loadStudio());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
