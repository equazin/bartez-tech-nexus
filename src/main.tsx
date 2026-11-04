import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Analytics } from "@vercel/analytics/react";
import { escucharVersionNueva } from "./lib/versionNueva";

// Una pestaña con la versión anterior recarga sola en vez de mostrar el error de módulo.
escucharVersionNueva();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
