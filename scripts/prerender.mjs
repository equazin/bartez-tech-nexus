// Prerender de la tienda para los rastreadores (fase 10, la alternativa sin render en servidor).
// Después de `vite build`, escribe en dist/ un index.html por categoría y por producto con el título, la
// descripción, el canonical, Open Graph y los datos estructurados (Product y Offer), más un resumen dentro de
// #root que la aplicación reemplaza al cargar. También genera dist/sitemap.xml desde la base.
// Vercel sirve estos archivos antes de la reescritura al index: una ficha ya trae nombre, precio y specs en el
// HTML inicial. Los precios se refrescan con cada despliegue (el recálculo diario dispara uno si hay
// VERCEL_DEPLOY_HOOK_URL). Sin credenciales de Supabase, no hace nada y el build sigue.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(raiz, "dist");
const url = process.env.VITE_SUPABASE_URL?.trim();
const clave = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const sitio = (process.env.VITE_SITE_URL?.trim() || "https://DOMINIO-DE-TEQO-A-CONFIRMAR").replace(/\/$/, "");
const NOMBRE = "Teqo";
const DESCRIPCION = "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.";
const MAXIMO_DE_PRODUCTOS = 20_000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const SEGMENTO_SIN_CATEGORIA = "productos";
// Direcciones de la aplicación que una categoría nunca puede pisar.
const RESERVADOS = new Set([
  "api", "assets", "fonts", "marca", "portada", "email", "admin", "login", "reset-password", "registrarse", "buscar", "carrito",
  "checkout", "compra", "seguimiento", "arrepentimiento", "ayuda", "terminos", "privacidad", "garantias", "sistema-de-diseno",
  "clientes", "portal", "cart", "sitemap.xml", "robots.txt", "favicon.ico", "favicon.svg", "site.webmanifest",
  "ofertas", "nuevos-ingresos", "marcas",
]);

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function imagenDe(p) {
  const lista = Array.isArray(p.imagenes) ? p.imagenes.filter((x) => typeof x === "string" && x) : [];
  const primera = lista[0] ?? p.imagen ?? null;
  if (!primera) return null;
  return primera.replace("/storage/v1/object/products/", "/storage/v1/object/public/products/");
}

/** Reemplaza el título y la descripción del index y agrega lo demás antes de </head>. */
function armarPagina(plantilla, { titulo, descripcion, ruta, extraHead, cuerpo }) {
  const completo = `${titulo} | ${NOMBRE}`;
  let html = plantilla
    .replace(/<title>[^<]*<\/title>/, `<title>${escapar(completo)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapar(descripcion)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapar(completo)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapar(descripcion)}" />`);
  const cabeza = `    <link rel="canonical" href="${escapar(sitio + ruta)}" />\n    <meta property="og:url" content="${escapar(sitio + ruta)}" />\n${extraHead}`;
  html = html.replace("</head>", `${cabeza}  </head>`);
  return html.replace('<div id="root"></div>', `<div id="root">${cuerpo}</div>`);
}

function jsonLd(objeto) {
  return `    <script type="application/ld+json">${JSON.stringify(objeto).replace(/</g, "\\u003c")}</script>\n`;
}

function escribirPagina(rutaRelativa, html) {
  const carpeta = join(dist, ...rutaRelativa.split("/").filter(Boolean));
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, "index.html"), html);
}

async function main() {
  if (!url || !clave) {
    console.log("[prerender] Sin VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY: no se prerenderiza nada.");
    return;
  }
  const indice = join(dist, "index.html");
  if (!existsSync(indice)) {
    console.log("[prerender] No existe dist/index.html: corré vite build antes.");
    return;
  }
  const plantilla = readFileSync(indice, "utf8");
  const supabase = createClient(url, clave, { auth: { persistSession: false } });

  const { data: categoriasCrudas, error: errorCategorias } = await supabase.rpc("tienda_categorias");
  if (errorCategorias) throw new Error(`No se pudieron leer las categorías: ${errorCategorias.message}`);
  const categorias = (categoriasCrudas ?? []).filter((c) => c.cantidad > 0 && SLUG.test(c.slug ?? "") && !RESERVADOS.has(c.slug));

  const productos = [];
  for (let desde = 0; desde < MAXIMO_DE_PRODUCTOS; desde += 1000) {
    const { data, error } = await supabase
      .from("tienda_productos")
      .select("id, slug, nombre, descripcion_corta, imagenes, imagen, categoria_id, categoria_slug, categoria_nombre, marca_id, marca, hay_stock, precio_final_ars, precio_lista_ars, sku, specs, etiquetas, oferta, ahorro_pct, creado_en")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
    productos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const publicables = productos.filter((p) => SLUG.test(p.slug ?? "") && (!p.categoria_slug || SLUG.test(p.categoria_slug)));

  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [`${sitio}/`];

  // Inicio: datos estructurados del sitio, sin tocar el resto del index (es también el respaldo de la aplicación).
  const inicio = plantilla.replace(
    "</head>",
    jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": `${sitio}/#organization`, name: NOMBRE, url: sitio, logo: `${sitio}/android-chrome-512x512.png` },
        { "@type": "WebSite", "@id": `${sitio}/#website`, name: NOMBRE, url: sitio, potentialAction: { "@type": "SearchAction", target: `${sitio}/buscar?q={q}`, "query-input": "required name=q" } },
      ],
    }) + "  </head>",
  );
  writeFileSync(indice, inicio);

  // Categorías: los productos de su rama y, en una vista transversal (Gaming), los de su etiqueta.
  const hijasDe = new Map();
  for (const c of categoriasCrudas ?? []) {
    if (c.padre_id === null) continue;
    hijasDe.set(c.padre_id, [...(hijasDe.get(c.padre_id) ?? []), c.id]);
  }
  const rama = (id) => [id, ...(hijasDe.get(id) ?? []).flatMap(rama)];
  const porId = new Map((categoriasCrudas ?? []).map((c) => [c.id, c]));
  for (const categoria of categorias) {
    const ids = new Set(rama(categoria.id));
    const etiqueta = categoria.incluye_etiqueta ?? null;
    const suyos = publicables
      .filter((p) => ids.has(p.categoria_id) || (etiqueta && Array.isArray(p.etiquetas) && p.etiquetas.includes(etiqueta)))
      .slice(0, 60);
    const ruta = `/${categoria.slug}`;
    const cuerpo = `<main><h1>${escapar(categoria.nombre)}</h1><p>${escapar(categoria.cantidad)} productos con envío a todo el país y precio final con IVA incluido.</p><ul>${suyos
      .map((p) => `<li><a href="${escapar(`/${p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA}/${p.slug}`)}">${escapar(p.nombre)}</a>${p.precio_final_ars !== null ? ` · ${escapar(formatoPesos.format(p.precio_final_ars))}` : ""}</li>`)
      .join("")}</ul></main>`;
    const extraHead = jsonLd({ "@context": "https://schema.org", "@type": "CollectionPage", name: categoria.nombre, url: sitio + ruta, isPartOf: { "@id": `${sitio}/#website` } });
    escribirPagina(ruta, armarPagina(plantilla, { titulo: categoria.nombre, descripcion: `${categoria.nombre} con envío a todo el país y precios finales con IVA incluido.`, ruta, extraHead, cuerpo }));
    urls.push(sitio + ruta);
  }

  // Ofertas, nuevos ingresos y marcas: listados sin categoría propia.
  const listado = (titulo, ruta, descripcion, lista) => {
    const cuerpo = `<main><h1>${escapar(titulo)}</h1><p>${escapar(descripcion)}</p><ul>${lista
      .slice(0, 60)
      .map((p) => `<li><a href="${escapar(`/${p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA}/${p.slug}`)}">${escapar(p.nombre)}</a>${p.precio_final_ars !== null ? ` · ${escapar(formatoPesos.format(p.precio_final_ars))}` : ""}</li>`)
      .join("")}</ul></main>`;
    const extraHead = jsonLd({ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: sitio + ruta, isPartOf: { "@id": `${sitio}/#website` } });
    escribirPagina(ruta, armarPagina(plantilla, { titulo, descripcion, ruta, extraHead, cuerpo }));
    urls.push(sitio + ruta);
  };
  const ofertas = publicables.filter((p) => p.oferta && p.hay_stock).sort((a, b) => (b.ahorro_pct ?? 0) - (a.ahorro_pct ?? 0));
  if (ofertas.length > 0) listado("Ofertas", "/ofertas", "Precio final rebajado sobre el de lista, con IVA incluido.", ofertas);
  const nuevos = publicables
    .filter((p) => p.precio_final_ars !== null && p.creado_en)
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
  if (nuevos.length > 0) listado("Nuevos ingresos", "/nuevos-ingresos", "Lo último que entró al catálogo.", nuevos);

  // Sin las marcas (por ejemplo, antes de aplicar la migración 118) el build sigue sin esas páginas.
  const { data: marcasCrudas, error: errorMarcas } = await supabase.rpc("tienda_marcas");
  if (errorMarcas) console.log(`[prerender] Sin marcas: ${errorMarcas.message}`);
  const marcas = (errorMarcas ? [] : (marcasCrudas ?? [])).filter((m) => SLUG.test(m.slug ?? ""));
  if (marcas.length > 0) {
    const cuerpo = `<main><h1>Marcas</h1><ul>${marcas.map((m) => `<li><a href="${escapar(`/marcas/${m.slug}`)}">${escapar(m.nombre)}</a></li>`).join("")}</ul></main>`;
    escribirPagina("/marcas", armarPagina(plantilla, { titulo: "Marcas", descripcion: "Las marcas de notebooks, gaming, monitores y periféricos que vendemos, con envío a todo el país.", ruta: "/marcas", extraHead: "", cuerpo }));
    urls.push(`${sitio}/marcas`);
    for (const m of marcas) {
      listado(m.nombre, `/marcas/${m.slug}`, `${m.nombre} con envío a todo el país y precios finales con IVA incluido.`, publicables.filter((p) => p.marca_id === m.id));
    }
  }

  // Productos
  let fichas = 0;
  for (const p of publicables) {
    const segmento = p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA;
    if (RESERVADOS.has(segmento)) continue;
    const ruta = `/${segmento}/${p.slug}`;
    const imagen = imagenDe(p);
    const descripcion = p.descripcion_corta?.trim() || `${p.nombre} con envío a todo el país y precio final con IVA incluido.`;
    const specs = Object.entries(p.specs ?? {}).filter(([, v]) => typeof v === "string" || typeof v === "number");
    const producto = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.nombre,
      ...(imagen ? { image: [imagen] } : {}),
      description: descripcion,
      ...(p.sku ? { sku: p.sku } : {}),
      ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
      ...(p.precio_final_ars !== null
        ? {
            offers: {
              "@type": "Offer",
              url: sitio + ruta,
              priceCurrency: "ARS",
              price: Number(p.precio_final_ars),
              availability: p.hay_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition",
              seller: { "@id": `${sitio}/#organization` },
            },
          }
        : {}),
    };
    const cadena = [];
    for (let c = porId.get(p.categoria_id); c && cadena.length < 10; c = c.padre_id === null ? undefined : porId.get(c.padre_id)) cadena.unshift(c);
    const pasos = [
      { name: "Inicio", item: `${sitio}/` },
      ...cadena.map((c) => ({ name: c.nombre, item: `${sitio}/${c.slug}` })),
      { name: p.nombre, item: sitio + ruta },
    ];
    const migas = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: pasos.map((paso, i) => ({ "@type": "ListItem", position: i + 1, ...paso })),
    };
    const extraHead = (imagen ? `    <meta property="og:image" content="${escapar(imagen)}" />\n` : "") + `    <meta property="og:type" content="product" />\n` + jsonLd(producto) + jsonLd(migas);
    const cuerpo = `<main><h1>${escapar(p.nombre)}</h1>${p.marca ? `<p>${escapar(p.marca)}</p>` : ""}<p>${
      p.precio_final_ars !== null ? `${escapar(formatoPesos.format(p.precio_final_ars))} · precio final con IVA incluido` : "Precio a confirmar"
    } · ${p.hay_stock ? "En stock" : "Sin stock"}</p><p>${escapar(descripcion)}</p>${
      specs.length > 0 ? `<table>${specs.map(([k, v]) => `<tr><th>${escapar(k)}</th><td>${escapar(v)}</td></tr>`).join("")}</table>` : ""
    }<p>Envío a todo el país, al mismo precio en cualquier provincia. Configuración de fábrica.</p></main>`;
    escribirPagina(ruta, armarPagina(plantilla, { titulo: p.nombre, descripcion, ruta, extraHead, cuerpo }));
    urls.push(sitio + ruta);
    fichas += 1;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escapar(u)}</loc><lastmod>${hoy}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  writeFileSync(join(dist, "sitemap.xml"), sitemap);
  console.log(`[prerender] ${categorias.length} categorías, ${fichas} fichas y el sitemap (${urls.length} direcciones).`);
}

main().catch((e) => {
  console.error("[prerender] Falló:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
