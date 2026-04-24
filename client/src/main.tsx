import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { convex } from "./lib/convex";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <div dir="rtl" className="rtl">
      <App />
    </div>
  </ConvexProvider>,
);
