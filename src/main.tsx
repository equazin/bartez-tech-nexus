import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Analytics } from "@vercel/analytics/react";
import { escucharVersionNueva } from "./lib/versionNueva";
import { guardarTokenDeLaDireccion } from "./lib/tienda/tokenDeCompra";

// Una pestaña con la versión anterior recarga sola en vez de mostrar el error de módulo.
escucharVersionNueva();
// Antes que nada: el token de una compra no se queda en la dirección que ven las etiquetas de medición.
guardarTokenDeLaDireccion();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
