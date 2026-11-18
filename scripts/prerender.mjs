// Prerender de la tienda para los rastreadores (fase 10, la alternativa sin render en servidor).
// Después de `vite build`, escribe en dist/:
//   - aplicacion.html: la base de la aplicación, sin nada de una página puntual. Es lo que recibe cualquier
//     dirección que no tiene página propia (carrito, checkout, mi cuenta, direcciones que no existen): la
//     reescritura general de vercel.json apunta ahí.
//   - index.html: el inicio, con las categorías y los destacados.
//   - un index.html por categoría, por producto y por página fija, con el título, la descripción, el canonical,
//     Open Graph y los datos estructurados, más un resumen dentro de #root que la aplicación reemplaza al cargar.
//   - sitemap.xml, desde la base.
// Los productos con la etiqueta "prueba" no se prerenderizan ni entran al sitemap.
// Los precios se refrescan con cada despliegue (el recálculo diario dispara uno si hay VERCEL_DEPLOY_HOOK_URL), y la
// aplicación reescribe los datos estructurados de la ficha con el precio del momento. Sin credenciales de Supabase,
// deja solo la base y el build sigue.
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
const PRODUCTOS_POR_CATEGORIA = 60;
const DESTACADOS_DEL_INICIO = 12;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const SEGMENTO_SIN_CATEGORIA = "productos";
const ETIQUETA_DE_PRUEBA = "prueba";
/** La base de la aplicación; con cleanUrls se sirve en /aplicacion. */
const RESPALDO = "aplicacion.html";
/** La imagen que acompaña a un enlace compartido cuando la página no tiene una propia: la foto de portada. */
const IMAGEN_DEL_SITIO = { ruta: "/portada/portada.jpg", ancho: 1600, alto: 1067 };
// Direcciones de la aplicación que una categoría nunca puede pisar.
const RESERVADOS = new Set([
  "api", "assets", "fonts", "marca", "portada", "email", "admin", "login", "reset-password", "registrarse", "buscar", "carrito",
  "checkout", "compra", "seguimiento", "arrepentimiento", "ayuda", "terminos", "privacidad", "garantias", "sistema-de-diseno",
  "clientes", "portal", "cart", "sitemap.xml", "robots.txt", "favicon.ico", "favicon.svg", "site.webmanifest",
  "aplicacion", "ofertas", "nuevos-ingresos", "arma-tu-pc", "comparar", "cuenta",
]);
// Páginas fijas con contenido público: los mismos títulos y descripciones que pone la aplicación.
const PAGINAS_FIJAS = [
  { ruta: "/ofertas", titulo: "Ofertas", descripcion: "Productos con precio rebajado: ves el precio anterior tachado y el precio final con IVA." },
  { ruta: "/nuevos-ingresos", titulo: "Nuevos ingresos", descripcion: "Lo último que entró al catálogo." },
  {
    ruta: "/arma-tu-pc",
    titulo: "Armá tu PC",
    descripcion: "Arrancá de una PC armada o elegí pieza por pieza: te mostramos solo lo compatible, con el precio de cada medio de pago.",
  },
  { ruta: "/ayuda", titulo: "Ayuda", descripcion: "Envíos, pagos, garantías, cambios y devoluciones en Teqo." },
  { ruta: "/terminos", titulo: "Términos y condiciones", descripcion: "Términos y condiciones de compra en Teqo." },
  { ruta: "/privacidad", titulo: "Política de privacidad", descripcion: "Cómo trata Teqo los datos personales de quienes compran en la tienda." },
  { ruta: "/garantias", titulo: "Garantías y cambios", descripcion: "Garantías, cambios y devoluciones de los productos comprados en Teqo." },
];

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * Codifica el camino de la dirección de una foto: un «?» o un «%» suelto en el nombre del archivo la rompe.
 * Copia de src/lib/direccionDeImagen.ts (este script no puede importar TypeScript): si cambia una, cambiar la otra.
 */
function codificarDireccionDeImagen(url) {
  const partes = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url);
  if (!partes) return url;
  const origen = partes[1];
  const resto = partes[2] ?? "";
  const corte = resto.indexOf("?");
  const consulta = corte >= 0 && /^[^=&]+=/.test(resto.slice(corte + 1)) ? resto.slice(corte) : "";
  const camino = consulta ? resto.slice(0, corte) : resto;
  const codificado = camino
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .split(/(%[0-9A-Fa-f]{2})/)
    .map((parte, i) => (i % 2 === 1 ? parte : encodeURI(parte).replace(/\?/g, "%3F").replace(/#/g, "%23")))
    .join("");
  return origen + codificado + consulta;
}

function imagenDe(p) {
  const lista = Array.isArray(p.imagenes) ? p.imagenes.filter((x) => typeof x === "string" && x) : [];
  const primera = lista[0] ?? p.imagen ?? null;
  if (!primera) return null;
  return codificarDireccionDeImagen(primera.replace("/storage/v1/object/products/", "/storage/v1/object/public/products/"));
}

/** Cambia el contenido de un <meta> de la plantilla o, si no está, lo agrega antes de </head>. `nombre` va sin caracteres de expresión regular. */
function conMeta(html, atributo, nombre, contenido) {
  const etiqueta = `<meta ${atributo}="${nombre}" content="${escapar(contenido)}" />`;
  const patron = new RegExp(`<meta ${atributo}="${nombre}" content="[^"]*" ?/?>`);
  // Con función: un "$" del texto (los precios lo traen) no se toma como referencia del reemplazo.
  return patron.test(html) ? html.replace(patron, () => etiqueta) : html.replace("</head>", () => `    ${etiqueta}\n  </head>`);
}

/** La base de todas las páginas: la plantilla de Vite más lo que comparte todo el sitio al compartir un enlace. */
function armarBase(original) {
  if (original.includes('property="og:image"')) return original;
  const compartir =
    `    <meta property="og:site_name" content="${NOMBRE}" />\n` +
    `    <meta property="og:locale" content="es_AR" />\n` +
    `    <meta property="og:image" content="${escapar(sitio + IMAGEN_DEL_SITIO.ruta)}" />\n` +
    `    <meta property="og:image:width" content="${IMAGEN_DEL_SITIO.ancho}" />\n` +
    `    <meta property="og:image:height" content="${IMAGEN_DEL_SITIO.alto}" />\n`;
  return original.replace("</head>", () => `${compartir}  </head>`);
}

/**
 * Una página a partir de la base. Sin `titulo` conserva el título y la descripción de la base (el inicio).
 * `imagen` reemplaza a la del sitio y `tipo` al og:type.
 */
function armarPagina(base, { titulo = null, descripcion = null, ruta, extraHead = "", cuerpo, imagen = null, tipo = null }) {
  let html = base;
  if (titulo) {
    const completo = `${titulo} | ${NOMBRE}`;
    html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapar(completo)}</title>`);
    html = conMeta(html, "property", "og:title", completo);
  }
  if (descripcion) {
    html = conMeta(html, "name", "description", descripcion);
    html = conMeta(html, "property", "og:description", descripcion);
  }
  if (tipo) html = conMeta(html, "property", "og:type", tipo);
  if (imagen) {
    html = html.replace(/\s*<meta property="og:image:(?:width|height)" content="[^"]*" \/>/g, "");
    html = conMeta(html, "property", "og:image", imagen);
  }
  const cabeza = `    <link rel="canonical" href="${escapar(sitio + ruta)}" />\n    <meta property="og:url" content="${escapar(sitio + ruta)}" />\n${extraHead}`;
  html = html.replace("</head>", () => `${cabeza}  </head>`);
  return html.replace('<div id="root"></div>', () => `<div id="root">${cuerpo}</div>`);
}

/** `marca` deja ubicar el bloque desde la aplicación, que lo reemplaza o lo saca (ver src/lib/tienda/seo.ts). */
function jsonLd(objeto, marca) {
  return `    <script type="application/ld+json" data-prerender="${marca}">${JSON.stringify(objeto).replace(/</g, "\\u003c")}</script>\n`;
}

function escribirPagina(rutaRelativa, html) {
  const carpeta = join(dist, ...rutaRelativa.split("/").filter(Boolean));
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, "index.html"), html);
}

const organizacion = () => ({ "@type": "Organization", "@id": `${sitio}/#organization`, name: NOMBRE, url: sitio, logo: `${sitio}/android-chrome-512x512.png` });
const sitioWeb = () => ({ "@type": "WebSite", "@id": `${sitio}/#website`, name: NOMBRE, url: sitio });

/** Adelanta la carga de una imagen que la aplicación va a mostrar apenas arranque. `medio` la limita a un ancho de pantalla. */
function precargaDeImagen(direccion, medio = null) {
  return `<link rel="preload" as="image" href="${escapar(direccion)}"${medio ? ` media="${medio}"` : ""} fetchpriority="high" />`;
}

/**
 * La foto grande de una ficha, en la misma dirección que pide la aplicación (src/lib/tienda/fotos.ts): si no
 * coinciden, la precarga baja una imagen que después no se usa.
 */
function fotoDeLaFicha(direccion) {
  if (/^https:\/\/static\.nb\.com\.ar\/i\//.test(direccion)) return `/_vercel/image?url=${encodeURIComponent(direccion)}&w=828&q=75`;
  return direccion;
}

/**
 * La precarga de la primera portada del inicio, que es lo primero que se ve al entrar. Las portadas con la imagen
 * completa usan una versión cuadrada en el celular; las de tipo banner, una sola imagen. Si el inicio no empieza
 * con la portada, o no se puede leer, no se precarga nada.
 */
async function precargaDeLaPrimeraPortada(supabase) {
  try {
    const [{ data: secciones }, { data: portadas }] = await Promise.all([
      supabase.from("tienda_secciones_inicio").select("tipo").order("orden").limit(1),
      supabase.from("tienda_portadas").select("tipo, imagen_url, imagen_movil_url").order("orden").limit(1),
    ]);
    const primera = (portadas ?? [])[0];
    if (!primera?.imagen_url) return "";
    if ((secciones ?? []).length > 0 && secciones[0].tipo !== "portada") return "";
    if (primera.tipo !== "imagen" || !primera.imagen_movil_url) return precargaDeImagen(primera.imagen_url);
    return precargaDeImagen(primera.imagen_movil_url, "(max-width: 767px)") + precargaDeImagen(primera.imagen_url, "(min-width: 768px)");
  } catch {
    return "";
  }
}

async function main() {
  const indice = join(dist, "index.html");
  if (!existsSync(indice)) {
    console.log("[prerender] No existe dist/index.html: corré vite build antes.");
    return;
  }
  // La base queda aparte antes de tocar el index: así el inicio tiene contenido propio sin que lo hereden las
  // demás direcciones. Si ya existe (segunda corrida sobre el mismo dist), se parte de ella.
  const respaldo = join(dist, RESPALDO);
  if (!existsSync(respaldo)) writeFileSync(respaldo, armarBase(readFileSync(indice, "utf8")));
  const base = readFileSync(respaldo, "utf8");

  if (!url || !clave) {
    console.log("[prerender] Sin VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY: queda solo la base de la aplicación.");
    return;
  }
  const supabase = createClient(url, clave, { auth: { persistSession: false } });

  const { data: categoriasCrudas, error: errorCategorias } = await supabase.rpc("tienda_categorias");
  if (errorCategorias) throw new Error(`No se pudieron leer las categorías: ${errorCategorias.message}`);
  const categorias = (categoriasCrudas ?? []).filter((c) => c.cantidad > 0 && SLUG.test(c.slug ?? "") && !RESERVADOS.has(c.slug));
  const categoriaPorId = new Map(categorias.map((c) => [Number(c.id), c]));
  const categoriaPorSlug = new Map(categorias.map((c) => [c.slug, c]));
  const padreDe = (c) => (c.padre_id === null || c.padre_id === undefined ? null : (categoriaPorId.get(Number(c.padre_id)) ?? null));
  const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), "es");
  const hijasDe = (c) => categorias.filter((h) => padreDe(h) === c).sort(porOrden);
  const raices = categorias.filter((c) => padreDe(c) === null).sort(porOrden);
  /** De la raíz a la categoría. */
  const cadenaDe = (categoria) => {
    const cadena = [];
    for (let actual = categoria; actual && !cadena.includes(actual); actual = padreDe(actual)) cadena.unshift(actual);
    return cadena;
  };
  /** Los ids de la categoría y de todo lo que cuelga de ella. */
  const idsDe = (categoria) => {
    const ids = new Set([Number(categoria.id)]);
    for (const pendientes = [categoria]; pendientes.length > 0; ) {
      for (const hija of hijasDe(pendientes.pop())) {
        if (ids.has(Number(hija.id))) continue;
        ids.add(Number(hija.id));
        pendientes.push(hija);
      }
    }
    return ids;
  };

  const productos = [];
  for (let desde = 0; desde < MAXIMO_DE_PRODUCTOS; desde += 1000) {
    const { data, error } = await supabase
      .from("tienda_productos")
      .select("id, slug, nombre, descripcion_corta, imagenes, imagen, categoria_id, categoria_slug, categoria_nombre, marca, hay_stock, precio_final_ars, precio_lista_ars, sku, specs, tags, destacado")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
    productos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const publicables = productos.filter(
    (p) =>
      SLUG.test(p.slug ?? "") &&
      (!p.categoria_slug || SLUG.test(p.categoria_slug)) &&
      !RESERVADOS.has(p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA) &&
      !(Array.isArray(p.tags) && p.tags.includes(ETIQUETA_DE_PRUEBA)),
  );
  // El orden por defecto de la tienda: destacados primero y después por nombre.
  const ordenados = [...publicables].sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)) || String(a.nombre).localeCompare(String(b.nombre), "es"));
  const rutaDe = (p) => `/${p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA}/${p.slug}`;
  const enlaceA = (ruta, texto) => `<a href="${escapar(ruta)}">${escapar(texto)}</a>`;
  const itemDeProducto = (p) => `<li>${enlaceA(rutaDe(p), p.nombre)}${p.precio_final_ars !== null ? ` · ${escapar(formatoPesos.format(p.precio_final_ars))}` : ""}</li>`;
  const migasEnlazadas = (cadena) => `<nav>${[enlaceA("/", "Inicio"), ...cadena.map((c) => enlaceA(`/${c.slug}`, c.nombre))].join(" › ")}</nav>`;
  const migasDe = (cadena, ultimo = null) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${sitio}/` },
      ...cadena.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: c.nombre, item: `${sitio}/${c.slug}` })),
      ...(ultimo ? [{ "@type": "ListItem", position: cadena.length + 2, name: ultimo.nombre, item: ultimo.item }] : []),
    ],
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [`${sitio}/`];

  // Inicio: las categorías con sus subcategorías, los destacados y las páginas fijas.
  const destacados = ordenados.filter((p) => p.destacado).slice(0, DESTACADOS_DEL_INICIO);
  const cuerpoDelInicio =
    `<main><h1>${escapar(NOMBRE)}: notebooks, gaming, monitores, periféricos y componentes</h1><p>${escapar(DESCRIPCION)}</p>` +
    `<nav><ul>${raices
      .map((c) => {
        const hijas = hijasDe(c);
        return `<li>${enlaceA(`/${c.slug}`, c.nombre)}${hijas.length > 0 ? `<ul>${hijas.map((h) => `<li>${enlaceA(`/${h.slug}`, h.nombre)}</li>`).join("")}</ul>` : ""}</li>`;
      })
      .join("")}</ul></nav>` +
    (destacados.length > 0 ? `<h2>Destacados</h2><ul>${destacados.map(itemDeProducto).join("")}</ul>` : "") +
    `<ul>${PAGINAS_FIJAS.map((f) => `<li>${enlaceA(f.ruta, f.titulo)}</li>`).join("")}</ul>` +
    `<p>Envío a todo el país, al mismo precio en cualquier provincia. Precios finales con IVA incluido.</p></main>`;
  const cabezaDelInicio = jsonLd(
    {
      "@context": "https://schema.org",
      "@graph": [organizacion(), { ...sitioWeb(), potentialAction: { "@type": "SearchAction", target: `${sitio}/buscar?q={q}`, "query-input": "required name=q" } }],
    },
    "sitio",
  );
  const precargaDeLaPortada = await precargaDeLaPrimeraPortada(supabase);
  writeFileSync(indice, armarPagina(base, { ruta: "/", extraHead: cabezaDelInicio + precargaDeLaPortada, cuerpo: cuerpoDelInicio }));

  // Categorías: una categoría principal lista también lo de sus subcategorías.
  for (const categoria of categorias) {
    const ids = idsDe(categoria);
    const suyos = ordenados.filter((p) => p.categoria_id !== null && p.categoria_id !== undefined && ids.has(Number(p.categoria_id))).slice(0, PRODUCTOS_POR_CATEGORIA);
    const hijas = hijasDe(categoria);
    const cadena = cadenaDe(categoria);
    const ruta = `/${categoria.slug}`;
    const propia = typeof categoria.descripcion === "string" ? categoria.descripcion.trim() : "";
    const descripcion = propia || `${categoria.nombre} con envío a todo el país y precios finales con IVA incluido.`;
    const cuerpo =
      `<main>${migasEnlazadas(cadena.slice(0, -1))}<h1>${escapar(categoria.nombre)}</h1>` +
      `<p>${escapar(categoria.cantidad)} productos con envío a todo el país y precio final con IVA incluido.</p>` +
      (propia ? `<p>${escapar(propia)}</p>` : "") +
      (hijas.length > 0 ? `<ul>${hijas.map((h) => `<li>${enlaceA(`/${h.slug}`, h.nombre)}</li>`).join("")}</ul>` : "") +
      `<ul>${suyos.map(itemDeProducto).join("")}</ul></main>`;
    const coleccion = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: categoria.nombre,
      url: sitio + ruta,
      description: descripcion,
      isPartOf: sitioWeb(),
      ...(suyos.length > 0
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: suyos.length,
              itemListElement: suyos.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: sitio + rutaDe(p), name: p.nombre })),
            },
          }
        : {}),
    };
    const extraHead = jsonLd(coleccion, "categoria") + jsonLd(migasDe(cadena), "migas");
    escribirPagina(ruta, armarPagina(base, { titulo: categoria.nombre, descripcion, ruta, extraHead, cuerpo }));
    urls.push(sitio + ruta);
  }

  // Páginas fijas: el título, la descripción y el canonical propios.
  for (const fija of PAGINAS_FIJAS) {
    const cuerpo = `<main>${migasEnlazadas([])}<h1>${escapar(fija.titulo)}</h1><p>${escapar(fija.descripcion)}</p></main>`;
    escribirPagina(fija.ruta, armarPagina(base, { titulo: fija.titulo, descripcion: fija.descripcion, ruta: fija.ruta, cuerpo }));
    urls.push(sitio + fija.ruta);
  }

  // Productos
  let fichas = 0;
  for (const p of publicables) {
    const ruta = rutaDe(p);
    const imagen = imagenDe(p);
    const categoria = p.categoria_slug ? (categoriaPorSlug.get(p.categoria_slug) ?? null) : null;
    const cadena = categoria ? cadenaDe(categoria) : [];
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
              seller: { "@type": "Organization", "@id": `${sitio}/#organization`, name: NOMBRE, url: sitio },
            },
          }
        : {}),
    };
    const extraHead =
      jsonLd(producto, "producto") +
      jsonLd(migasDe(cadena, { nombre: p.nombre, item: sitio + ruta }), "migas") +
      (imagen ? precargaDeImagen(fotoDeLaFicha(imagen)) : "");
    const cuerpo = `<main>${migasEnlazadas(cadena)}<h1>${escapar(p.nombre)}</h1>${p.marca ? `<p>${escapar(p.marca)}</p>` : ""}<p>${
      p.precio_final_ars !== null ? `${escapar(formatoPesos.format(p.precio_final_ars))} · precio final con IVA incluido` : "Precio a confirmar"
    } · ${p.hay_stock ? "En stock" : "Sin stock"}</p><p>${escapar(descripcion)}</p>${
      specs.length > 0 ? `<table>${specs.map(([k, v]) => `<tr><th>${escapar(k)}</th><td>${escapar(v)}</td></tr>`).join("")}</table>` : ""
    }<p>Envío a todo el país, al mismo precio en cualquier provincia. Configuración de fábrica.</p></main>`;
    escribirPagina(ruta, armarPagina(base, { titulo: p.nombre, descripcion, ruta, extraHead, cuerpo, imagen, tipo: "product" }));
    urls.push(sitio + ruta);
    fichas += 1;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escapar(u)}</loc><lastmod>${hoy}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  writeFileSync(join(dist, "sitemap.xml"), sitemap);
  console.log(`[prerender] El inicio, ${categorias.length} categorías, ${PAGINAS_FIJAS.length} páginas fijas, ${fichas} fichas y el sitemap (${urls.length} direcciones).`);
}

main().catch((e) => {
  console.error("[prerender] Falló:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
