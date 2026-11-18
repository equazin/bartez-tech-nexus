/* Genera las piezas de Instagram de Teqo.

   Cada archivo .html de esta carpeta tiene una o más piezas: elementos con la clase "pieza", un id (el nombre
   del archivo final) y data-carpeta (la subcarpeta de listas/). Este script abre cada página en Chromium y
   guarda una imagen por pieza, al tamaño exacto del lienzo.

   Uso, desde la raíz del repositorio:
     node marca/instagram/fuente/generar.cjs               todas las piezas
     node marca/instagram/fuente/generar.cjs feed          solo fuente/feed.html
     node marca/instagram/fuente/generar.cjs feed guias    varias páginas

   Necesita Playwright con Chromium (npx playwright install chromium). */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const FUENTE = __dirname;
const LISTAS = path.join(FUENTE, "..", "listas");
const MEDIDAS = { post: [1080, 1350], historia: [1080, 1920], reel: [1080, 1920], cuadrada: [1080, 1080] };

(async () => {
  const pedidas = process.argv.slice(2);
  const paginas = fs.readdirSync(FUENTE).filter((f) => f.endsWith(".html")).filter((f) => pedidas.length === 0 || pedidas.includes(path.basename(f, ".html"))).sort();
  if (paginas.length === 0) throw new Error("No hay páginas con ese nombre en " + FUENTE);

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 2400, height: 2200 }, deviceScaleFactor: 1 });
  const problemas = [];
  pagina.on("requestfailed", (r) => problemas.push(`No cargó ${r.url()}`));
  let total = 0;

  for (const archivo of paginas) {
    await pagina.goto(pathToFileURL(path.join(FUENTE, archivo)).href);
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.waitForLoadState("networkidle");
    const piezas = pagina.locator(".pieza");
    const cantidad = await piezas.count();
    for (let i = 0; i < cantidad; i++) {
      const pieza = piezas.nth(i);
      const { id, carpeta, tipo, ancho, alto, desborde } = await pieza.evaluate((el) => {
        const caja = el.getBoundingClientRect();
        // Texto que se sale del lienzo o de la zona de resguardo lateral.
        const desborde = [...el.querySelectorAll(".contenido *, .pie *")].filter((n) => {
          if (!n.textContent.trim() || n.children.length > 0 && !["H1", "H2", "P", "LI"].includes(n.tagName)) return false;
          const c = n.getBoundingClientRect();
          return c.width > 0 && (c.left < caja.left + 40 || c.right > caja.right - 40 || c.top < caja.top + 40 || c.bottom > caja.bottom - 40);
        }).map((n) => n.textContent.trim().slice(0, 40));
        const tipo = ["post", "historia", "reel", "cuadrada"].find((t) => el.classList.contains(t));
        return { id: el.id, carpeta: el.dataset.carpeta || "", tipo, ancho: Math.round(caja.width), alto: Math.round(caja.height), desborde };
      });
      if (!id) { problemas.push(`${archivo}: pieza ${i + 1} sin id`); continue; }
      const medida = MEDIDAS[tipo];
      if (!medida || medida[0] !== ancho || medida[1] !== alto) problemas.push(`${archivo} #${id}: mide ${ancho} × ${alto} y debería medir ${medida ? medida.join(" × ") : "un formato conocido"}`);
      if (desborde.length) problemas.push(`${archivo} #${id}: texto pegado al borde o fuera del lienzo: ${desborde.join(" | ")}`);
      const destino = path.join(LISTAS, carpeta);
      fs.mkdirSync(destino, { recursive: true });
      const png = el => el.classList.contains("png");
      const esPng = await pieza.evaluate(png);
      await pieza.screenshot(esPng ? { path: path.join(destino, `${id}.png`), type: "png" } : { path: path.join(destino, `${id}.jpg`), type: "jpeg", quality: 95 });
      total++;
    }
    console.log(`${archivo}: ${cantidad} piezas`);
  }
  await navegador.close();
  console.log(`${total} piezas en ${path.relative(process.cwd(), LISTAS)}`);
  if (problemas.length) { console.error("\nPara revisar:\n- " + [...new Set(problemas)].join("\n- ")); process.exitCode = 1; }
})();
