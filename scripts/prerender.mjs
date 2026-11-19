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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
/** El id del <script> con los datos del inicio. Lo lee src/lib/tienda/datosDelInicio.ts: si cambia uno, cambiar el otro. */
const ID_DE_LOS_DATOS_DEL_INICIO = "datos-del-inicio";
/** El id del <script> con las categorías. Lo lee src/lib/tienda/catalogo.ts: si cambia uno, cambiar el otro. */
const ID_DE_LAS_CATEGORIAS = "datos-de-categorias";
/** El id del <script> con los datos del vendedor y los textos legales. Lo lee src/lib/tienda/legal.ts: si cambia uno, cambiar el otro. */
const ID_DEL_CONTENIDO_LEGAL = "datos-legales";
/** Las páginas que dibujan ese contenido apenas cargan: lo llevan escrito para no esperar a la base. */
const PAGINAS_CON_CONTENIDO_LEGAL = new Set(["/ayuda", "/terminos", "/privacidad", "/garantias"]);
/** Los textos de Ayuda y los de garantías por defecto: los mismos que usa la aplicación. */
const ARCHIVO_DE_LA_AYUDA = join("src", "lib", "tienda", "ayuda.json");
/** Los textos de Quiénes somos: los mismos que usa la aplicación. */
const ARCHIVO_DE_QUIENES_SOMOS = join("src", "lib", "tienda", "quienesSomos.json");
const RUTA_DE_QUIENES_SOMOS = "/quienes-somos";
/** El id del <script> con los datos de la tienda, en todas las páginas. Lo lee src/lib/tienda/legal.ts: si cambia uno, cambiar el otro. */
const ID_DE_LOS_DATOS_DE_LA_TIENDA = "datos-de-la-tienda";
/** Tope de módulos que se precargan en el inicio, por si el trozo del inicio importara medio sitio. */
const MAXIMO_DE_MODULOS_PRECARGADOS = 30;
/** La imagen que acompaña a un enlace compartido cuando la página no tiene una propia: la foto de portada. */
const IMAGEN_DEL_SITIO = { ruta: "/portada/portada.jpg", ancho: 1600, alto: 1067 };
// Direcciones de la aplicación que una categoría nunca puede pisar.
const RESERVADOS = new Set([
  "api", "assets", "fonts", "marca", "portada", "email", "admin", "login", "reset-password", "registrarse", "buscar", "carrito",
  "checkout", "compra", "seguimiento", "arrepentimiento", "ayuda", "terminos", "privacidad", "garantias", "sistema-de-diseno",
  "quienes-somos", "nosotros", "contacto",
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
  const cabeza = `    <link rel="canonical" href="${escapar(sitio + ruta)}" />\n    <meta property="og:url" content="${escapar(sitio + ruta)}" />\n${extraHead}${enTodasLasPaginas.cabeza}`;
  html = html.replace("</head>", () => `${cabeza}  </head>`);
  return html.replace('<div id="root"></div>', () => `<div id="root">${cuerpo}${enTodasLasPaginas.pie}</div>`);
}

/**
 * Lo que llevan todas las páginas con contenido propio, además de lo suyo: los datos de la tienda como datos (para que
 * el pie de la aplicación los dibuje sin esperar a la base) y el pie del resumen. Se completa al leer el panel.
 */
const enTodasLasPaginas = { cabeza: "", pie: "" };

/** `marca` deja ubicar el bloque desde la aplicación, que lo reemplaza o lo saca (ver src/lib/tienda/seo.ts). */
function jsonLd(objeto, marca) {
  return `    <script type="application/ld+json" data-prerender="${marca}">${JSON.stringify(objeto).replace(/</g, "\\u003c")}</script>\n`;
}

function escribirPagina(rutaRelativa, html) {
  const carpeta = join(dist, ...rutaRelativa.split("/").filter(Boolean));
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, "index.html"), html);
}

/**
 * La organización para los datos estructurados. Con los datos de la tienda suma lo mismo que se ve en el pie: el
 * email, el CUIT, el domicilio y el contacto de atención. Sin la razón social, que no se muestra fuera de los Términos.
 */
function organizacion(tienda = null) {
  const numero = numeroDeWhatsApp(tienda);
  return {
    "@type": "Organization",
    "@id": `${sitio}/#organization`,
    name: NOMBRE,
    url: sitio,
    // El logo cuadrado de la marca (1000 × 1000, el mismo símbolo del favicon). Es el mismo que declara RouteSeo.tsx.
    logo: `${sitio}/logo-teqo-cuadrado.png`,
    ...(tienda?.email ? { email: tienda.email } : {}),
    ...(tienda?.cuit ? { taxID: tienda.cuit } : {}),
    ...(tienda?.domicilio ? { address: direccionPostal(tienda.domicilio) } : {}),
    ...(tienda?.email || numero
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            ...(tienda?.email ? { email: tienda.email } : {}),
            ...(numero ? { telephone: `+${numero}` } : {}),
            areaServed: "AR",
            availableLanguage: "es",
          },
        }
      : {}),
  };
}
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
  if (/^https:\/\/static\.nb\.com\.ar\/i\//.test(direccion) || /^https:\/\/images\.elit\.com\.ar\/.+_l\.webp$/.test(direccion)) return `/_vercel/image?url=${encodeURIComponent(direccion)}&w=828&q=75`;
  return direccion;
}

/**
 * Las secciones y las portadas del inicio, con las mismas columnas y el mismo orden que pide la aplicación
 * (src/lib/tienda/seccionesInicio.ts y portadas.ts). Van escritas en el HTML del inicio para que la aplicación
 * dibuje la portada apenas arranca, sin esperar a esas dos consultas (las lee src/lib/tienda/datosDelInicio.ts).
 * Si no se pueden leer, no devuelve nada y la aplicación las pide como siempre.
 */
async function datosDelInicio(supabase) {
  try {
    const [secciones, portadas] = await Promise.all([
      supabase.from("tienda_secciones_inicio").select("id, tipo, titulo, bajada, config").order("orden"),
      supabase.from("tienda_portadas").select("id, tipo, etiqueta, titulo, texto, boton, enlace, imagen_url, fondo, pc_armada_id, imagen_movil_url").order("orden"),
    ]);
    if (secciones.error || portadas.error) return null;
    return { secciones: secciones.data ?? [], portadas: portadas.data ?? [] };
  } catch {
    return null;
  }
}

/** El <script> con los datos del inicio. No se ejecuta: la aplicación lo lee como texto. */
function datosEscritos(datos, id = ID_DE_LOS_DATOS_DEL_INICIO) {
  if (!datos) return "";
  return `    <script type="application/json" id="${id}">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>\n`;
}

/**
 * Los datos del vendedor y los textos legales, tal como los devuelve la base a cualquier visitante. Si no se pueden
 * leer, las páginas legales quedan con el título y la descripción, como antes, y el build sigue.
 */
async function contenidoLegal(supabase) {
  try {
    const { data, error } = await supabase.rpc("tienda_contenido_legal");
    if (error) throw new Error(error.message);
    return data && typeof data === "object" ? data : null;
  } catch (e) {
    console.warn(`[prerender] No se pudo leer el contenido legal: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Un archivo de textos de la aplicación, o null si no se puede leer o le falta algo (la página queda con su descripción). */
function leerTextos(archivo, completo, queLeFalta) {
  try {
    const textos = JSON.parse(readFileSync(join(raiz, archivo), "utf8"));
    if (!completo(textos)) throw new Error(`le faltan ${queLeFalta}`);
    return textos;
  } catch (e) {
    console.warn(`[prerender] No se pudo leer ${archivo}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Los textos de Ayuda y los de garantías por defecto. */
const textosDeLaAyuda = () =>
  leerTextos(
    ARCHIVO_DE_LA_AYUDA,
    (a) => Array.isArray(a?.secciones) && Array.isArray(a?.garantias) && Array.isArray(a?.cambios) && typeof a?.contacto?.texto === "string",
    "secciones, garantías, cambios o contacto",
  );

/** Los textos de Quiénes somos. */
const textosDeQuienesSomos = () =>
  leerTextos(
    ARCHIVO_DE_QUIENES_SOMOS,
    (q) =>
      typeof q?.titulo === "string" &&
      typeof q?.descripcion === "string" &&
      typeof q?.bajada === "string" &&
      Array.isArray(q?.comoTrabajamos?.tarjetas) &&
      Array.isArray(q?.pedido?.parrafos) &&
      Array.isArray(q?.pasos?.lista) &&
      typeof q?.contacto?.titulo === "string",
    "el título, la bajada o alguna sección",
  );

/** "Lunes a viernes, de 9 a 18" pasa a "lunes a viernes, de 9 a 18", para seguir una frase (igual que en legal.ts). */
const enMinuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

/**
 * Los datos de la tienda que se muestran en todas las páginas, tal como están cargados en el panel: CUIT, domicilio,
 * contacto y Data Fiscal. La razón social no va: figura en los Términos, no en el pie (decisión de Nico, 19/11/2026).
 * Lo que no está cargado queda nulo y no se escribe.
 */
function datosDeLaTienda(legal) {
  const crudos = legal?.datos_legales && typeof legal.datos_legales === "object" ? legal.datos_legales : {};
  const texto = (valor) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
  const tienda = {
    cuit: texto(crudos.cuit),
    domicilio: texto(crudos.domicilio),
    email: texto(crudos.email),
    telefono: texto(crudos.telefono),
    horario: texto(crudos.horario),
    data_fiscal_url: texto(crudos.data_fiscal_url),
  };
  return Object.values(tienda).some(Boolean) ? tienda : null;
}

/**
 * El número del teléfono de la tienda como lo pide WhatsApp para la Argentina (549 + código de área + número, sin 0
 * ni 15), o "" si no hay teléfono o no se puede armar con seguridad. La misma cuenta que enlaceDeWhatsApp, en
 * src/lib/tienda/legal.ts.
 */
function numeroDeWhatsApp(tienda) {
  const digitos = (tienda?.telefono ?? "").replace(/\D/g, "");
  const sinCero = digitos.startsWith("0") ? digitos.slice(1) : digitos;
  if (sinCero.length === 10) return `549${sinCero}`;
  if (sinCero.startsWith("549") && sinCero.length === 13) return sinCero;
  if (sinCero.startsWith("54") && sinCero.length === 12) return `549${sinCero.slice(2)}`;
  return "";
}

/** Los datos de la tienda en una línea, para el pie de cada página y para Quiénes somos. */
function datosEnLinea(tienda) {
  if (!tienda) return "";
  const numero = numeroDeWhatsApp(tienda);
  return [
    tienda.cuit ? `CUIT ${escapar(tienda.cuit)}` : "",
    tienda.domicilio ? escapar(tienda.domicilio) : "",
    tienda.email ? `<a href="mailto:${escapar(tienda.email)}">${escapar(tienda.email)}</a>` : "",
    numero ? `<a href="https://wa.me/${numero}">WhatsApp ${escapar(tienda.telefono)}</a>` : "",
    tienda.horario ? `Atención: ${escapar(enMinuscula(tienda.horario))}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * El pie del resumen de cada página: los enlaces a quién es Teqo, a cómo contactarla y a los textos legales, y los
 * datos de la tienda. Es lo mismo que dibuja src/components/tienda/Pie.tsx, en el HTML que entrega el servidor.
 */
function pieEscrito(tienda) {
  const enlaces = [
    ["/quienes-somos", "Quiénes somos"],
    ["/ayuda#contacto", "Contacto"],
    ["/ayuda", "Ayuda"],
    ["/terminos", "Términos y condiciones"],
    ["/privacidad", "Política de privacidad"],
    ["/garantias", "Garantías y cambios"],
  ];
  const datos = datosEnLinea(tienda);
  return `<footer><p>${enlaces.map(([ruta, texto]) => `<a href="${ruta}">${escapar(texto)}</a>`).join(" · ")}</p>${datos ? `<p>${escapar(NOMBRE)} · ${datos}</p>` : ""}</footer>`;
}

/** El domicilio como dirección postal. "Calle 123, Localidad, Provincia" se separa en sus tres partes; si no, va entero. */
function direccionPostal(domicilio) {
  const partes = domicilio.split(",").map((p) => p.trim()).filter(Boolean);
  return partes.length === 3
    ? { "@type": "PostalAddress", streetAddress: partes[0], addressLocality: partes[1], addressRegion: partes[2], addressCountry: "AR" }
    : { "@type": "PostalAddress", streetAddress: domicilio, addressCountry: "AR" };
}

/** Un texto del panel en párrafos, igual que src/lib/tienda/legal.ts (parrafosDe). */
const parrafosDe = (texto) =>
  String(texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const enParrafos = (lista) => lista.map((p) => `<p>${escapar(p)}</p>`).join("");

/** La sección Contacto de la ayuda: cómo escribirnos y los datos fiscales, con lo cargado en el panel. */
function contactoDeLaAyuda(ayuda, tienda) {
  const textos = ayuda.contacto;
  const horario = tienda?.horario && typeof textos.horario === "string" ? ` ${textos.horario.replace("{horario}", enMinuscula(tienda.horario))}` : "";
  const numero = numeroDeWhatsApp(tienda);
  const fiscales = [tienda?.cuit ? `CUIT ${tienda.cuit}` : "", tienda?.domicilio ? `Domicilio: ${tienda.domicilio}` : ""].filter(Boolean);
  return (
    `<p>${escapar(textos.texto + horario)}</p>` +
    (tienda?.email ? `<p>${escapar(textos.email ?? "Email")}: <a href="mailto:${escapar(tienda.email)}">${escapar(tienda.email)}</a></p>` : "") +
    (numero ? `<p>${escapar(textos.whatsapp ?? "WhatsApp")}: <a href="https://wa.me/${numero}">${escapar(tienda.telefono)}</a></p>` : "") +
    (fiscales.length > 0 ? `<p>${escapar(textos.datosFiscales ?? "Datos fiscales")}: ${escapar(fiscales.join(" · "))}</p>` : "") +
    `<p><a href="/quienes-somos">${escapar(textos.quienesSomos ?? "Quiénes somos")}</a></p>`
  );
}

/** La página de ayuda, con las mismas secciones y textos que dibuja src/pages/tienda/Ayuda.tsx. */
function cuerpoDeLaAyuda(ayuda, tienda) {
  return ayuda.secciones
    .map((s) => {
      const parrafos = s.contenido === "garantias" ? ayuda.garantias : (s.parrafos ?? []);
      const lista = Array.isArray(s.lista) ? `<ul>${s.lista.map((item) => `<li>${escapar(item)}</li>`).join("")}</ul>` : "";
      const contacto = s.contenido === "contacto" ? contactoDeLaAyuda(ayuda, tienda) : "";
      const enlace = s.enlace ? `<p>${escapar(s.enlace.antes ?? "")}<a href="${escapar(s.enlace.a)}">${escapar(s.enlace.texto)}</a>${escapar(s.enlace.despues ?? "")}</p>` : "";
      return `<section id="${escapar(s.id)}"><h2>${escapar(s.titulo)}</h2>${enParrafos(parrafos)}${lista}${enParrafos(s.cierre ?? [])}${contacto}${enlace}</section>`;
    })
    .join("");
}

/** Quiénes somos, con los mismos textos que dibuja src/pages/tienda/QuienesSomos.tsx. */
function cuerpoDeQuienesSomos(quienes, tienda) {
  const tarjetas = quienes.comoTrabajamos.tarjetas.map((t) => `<h3>${escapar(t.titulo)}</h3><p>${escapar(t.texto)}</p>`).join("");
  const pasos = `<ol>${quienes.pasos.lista.map((p) => `<li><strong>${escapar(p.titulo)}</strong> ${escapar(p.texto)}</li>`).join("")}</ol>`;
  const datos = datosEnLinea(tienda);
  return (
    `<p>${escapar(quienes.bajada)}</p>` +
    `<h2>${escapar(quienes.comoTrabajamos.titulo)}</h2>${tarjetas}` +
    `<h2>${escapar(quienes.pedido.titulo)}</h2>${enParrafos(quienes.pedido.parrafos)}` +
    `<h2>${escapar(quienes.pasos.titulo)}</h2>${pasos}` +
    (datos ? `<h2>${escapar(quienes.contacto.titulo)}</h2><p>${datos}</p>` : "")
  );
}

/**
 * El contenido propio de una página fija, o "" si no tiene (queda con su descripción). Términos, Privacidad y
 * Garantías llevan el texto cargado en el panel; Ayuda y Quiénes somos, sus secciones. Así el texto está en el HTML
 * que entrega el servidor y no depende de que quien lo lee ejecute la aplicación.
 */
function contenidoDeLaPaginaFija(ruta, { legal, ayuda, quienes, tienda }) {
  if (ruta === "/ayuda") return ayuda ? cuerpoDeLaAyuda(ayuda, tienda) : "";
  if (ruta === RUTA_DE_QUIENES_SOMOS) return quienes ? cuerpoDeQuienesSomos(quienes, tienda) : "";
  if (ruta === "/terminos") return enParrafos(parrafosDe(legal?.texto_terminos));
  if (ruta === "/privacidad") return enParrafos(parrafosDe(legal?.texto_privacidad));
  if (ruta === "/garantias") {
    const cargados = parrafosDe(legal?.texto_garantias);
    return enParrafos(cargados.length > 0 ? cargados : ayuda ? [...ayuda.garantias, ...ayuda.cambios] : []);
  }
  return "";
}

/**
 * La primera portada del inicio, que es lo primero que se ve al entrar: su precarga para el <head> y la imagen
 * para el contenido inicial, así se ve antes de que arranque la aplicación. Las portadas con la imagen completa
 * usan una versión cuadrada en el celular; las de tipo banner, una sola imagen. Si el inicio no empieza con la
 * portada, o no se pudo leer, no devuelve nada.
 */
function primeraPortadaDelInicio(datos) {
  const nada = { cabeza: "", cuerpo: "" };
  const primera = datos?.portadas[0];
  if (!primera?.imagen_url) return nada;
  if (datos.secciones.length > 0 && datos.secciones[0].tipo !== "portada") return nada;
  const estilo = 'style="display:block;width:100%;height:auto"';
  const alt = escapar(primera.titulo ?? "");
  if (primera.tipo !== "imagen" || !primera.imagen_movil_url) {
    return {
      cabeza: precargaDeImagen(primera.imagen_url),
      cuerpo: `<img src="${escapar(primera.imagen_url)}" alt="${alt}" fetchpriority="high" ${estilo} />`,
    };
  }
  return {
    cabeza: precargaDeImagen(primera.imagen_movil_url, "(max-width: 767px)") + precargaDeImagen(primera.imagen_url, "(min-width: 768px)"),
    cuerpo:
      `<picture><source media="(min-width: 768px)" srcset="${escapar(primera.imagen_url)}" width="2400" height="830" />` +
      `<img src="${escapar(primera.imagen_movil_url)}" alt="${alt}" width="1080" height="1080" fetchpriority="high" ${estilo} /></picture>`,
  };
}

/**
 * Los módulos que el inicio necesita además del arranque: su propio trozo (cada página se carga aparte) y lo que
 * ese trozo importa. Con la precarga bajan junto con el arranque, en vez de pedirse recién cuando la aplicación ya
 * corrió. Los nombres llevan la huella del build, así que se buscan en dist/assets; lo que la base ya trae no se
 * repite. Si no encuentra el trozo, no agrega nada.
 */
function modulosDelInicio(base) {
  try {
    const carpeta = join(dist, "assets");
    const archivos = new Set(readdirSync(carpeta));
    const inicio = [...archivos].find((archivo) => /^Inicio-[\w-]+\.js$/.test(archivo));
    if (!inicio) return "";
    const vistos = new Set();
    const cola = [inicio];
    while (cola.length > 0 && vistos.size < MAXIMO_DE_MODULOS_PRECARGADOS) {
      const actual = cola.shift();
      // Lo que la base ya precarga (el arranque y sus librerías) no se repite ni cuenta para el tope.
      if (vistos.has(actual) || !archivos.has(actual) || base.includes(`/assets/${actual}`)) continue;
      vistos.add(actual);
      const codigo = readFileSync(join(carpeta, actual), "utf8");
      // Solo los import fijos (import … from "./x.js" o import "./x.js"); los import("…") se cargan cuando hacen falta.
      for (const [, nombre] of codigo.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([\w.-]+\.js)["']/g)) cola.push(nombre);
    }
    return [...vistos].map((nombre) => `    <link rel="modulepreload" crossorigin href="/assets/${nombre}" />\n`).join("");
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

  // Lo que se carga en el panel (Legal › Textos y datos) y los textos de las páginas fijas. Los datos de la tienda van
  // en todas las páginas: como datos para la aplicación y en el pie del resumen.
  const legal = await contenidoLegal(supabase);
  const tienda = datosDeLaTienda(legal);
  const ayuda = textosDeLaAyuda();
  const quienes = textosDeQuienesSomos();
  enTodasLasPaginas.cabeza = datosEscritos(tienda, ID_DE_LOS_DATOS_DE_LA_TIENDA);
  enTodasLasPaginas.pie = pieEscrito(tienda);
  const fijas = [...PAGINAS_FIJAS, ...(quienes ? [{ ruta: RUTA_DE_QUIENES_SOMOS, titulo: quienes.titulo, descripcion: quienes.descripcion }] : [])];

  // Inicio: las categorías con sus subcategorías, los destacados y las páginas fijas.
  const destacados = ordenados.filter((p) => p.destacado).slice(0, DESTACADOS_DEL_INICIO);
  const datosParaElInicio = await datosDelInicio(supabase);
  const portadaDelInicio = primeraPortadaDelInicio(datosParaElInicio);
  const cuerpoDelInicio =
    `<main>${portadaDelInicio.cuerpo}<h1>${escapar(NOMBRE)}: notebooks, gaming, monitores, periféricos y componentes</h1><p>${escapar(DESCRIPCION)}</p>` +
    `<nav><ul>${raices
      .map((c) => {
        const hijas = hijasDe(c);
        return `<li>${enlaceA(`/${c.slug}`, c.nombre)}${hijas.length > 0 ? `<ul>${hijas.map((h) => `<li>${enlaceA(`/${h.slug}`, h.nombre)}</li>`).join("")}</ul>` : ""}</li>`;
      })
      .join("")}</ul></nav>` +
    (destacados.length > 0 ? `<h2>Destacados</h2><ul>${destacados.map(itemDeProducto).join("")}</ul>` : "") +
    `<ul>${fijas.map((f) => `<li>${enlaceA(f.ruta, f.titulo)}</li>`).join("")}</ul>` +
    `<p>Envío a domicilio a todo el país. Precios finales con IVA incluido.</p></main>`;
  const cabezaDelInicio = jsonLd(
    {
      "@context": "https://schema.org",
      "@graph": [organizacion(tienda), { ...sitioWeb(), potentialAction: { "@type": "SearchAction", target: `${sitio}/buscar?q={q}`, "query-input": "required name=q" } }],
    },
    "sitio",
  );
  const extraDelInicio = cabezaDelInicio + portadaDelInicio.cabeza + "\n" + datosEscritos(datosParaElInicio) + modulosDelInicio(base);
  writeFileSync(indice, armarPagina(base, { ruta: "/", extraHead: extraDelInicio, cuerpo: cuerpoDelInicio }));

  // Categorías: una categoría principal lista también lo de sus subcategorías.
  // Cada página de categoría lleva escritas las categorías tal como las devuelve la base (las mismas filas que pide la
  // aplicación): así el título, la descripción y las subcategorías se dibujan de entrada y el listado no se corre
  // cuando responde la base. Las lee src/lib/tienda/catalogo.ts (categoriasConocidas).
  const categoriasEscritas = `    <script type="application/json" id="${ID_DE_LAS_CATEGORIAS}">${JSON.stringify(categoriasCrudas ?? []).replace(/</g, "\\u003c")}</script>\n`;
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
    const extraHead = jsonLd(coleccion, "categoria") + jsonLd(migasDe(cadena), "migas") + categoriasEscritas;
    escribirPagina(ruta, armarPagina(base, { titulo: categoria.nombre, descripcion, ruta, extraHead, cuerpo }));
    urls.push(sitio + ruta);
  }

  // Páginas fijas: el título, la descripción y el canonical propios. Las que tienen texto (Ayuda y las legales) lo
  // llevan escrito, y además como datos, para que la aplicación lo dibuje sin esperar a la base.
  const legalEscrito = datosEscritos(legal, ID_DEL_CONTENIDO_LEGAL);
  let conTexto = 0;
  for (const fija of fijas) {
    const contenido = contenidoDeLaPaginaFija(fija.ruta, { legal, ayuda, quienes, tienda });
    if (contenido) conTexto += 1;
    const cuerpo = `<main>${migasEnlazadas([])}<h1>${escapar(fija.titulo)}</h1>${contenido || `<p>${escapar(fija.descripcion)}</p>`}</main>`;
    const extraHead = PAGINAS_CON_CONTENIDO_LEGAL.has(fija.ruta) ? legalEscrito : "";
    escribirPagina(fija.ruta, armarPagina(base, { titulo: fija.titulo, descripcion: fija.descripcion, ruta: fija.ruta, extraHead, cuerpo }));
    urls.push(sitio + fija.ruta);
  }
  console.log(`[prerender] Páginas fijas con su texto escrito: ${conTexto} de ${fijas.length} (Ayuda, Quiénes somos y las legales).`);

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
    // La foto va en el contenido inicial: se ve antes de que arranque la aplicación, que después dibuja la ficha.
    const foto = imagen
      ? `<img src="${escapar(fotoDeLaFicha(imagen))}" alt="${escapar(p.nombre)}" width="828" height="828" fetchpriority="high" style="display:block;max-width:min(100%,560px);height:auto" />`
      : "";
    const cuerpo = `<main>${migasEnlazadas(cadena)}<h1>${escapar(p.nombre)}</h1>${foto}${p.marca ? `<p>${escapar(p.marca)}</p>` : ""}<p>${
      p.precio_final_ars !== null ? `${escapar(formatoPesos.format(p.precio_final_ars))} · precio final con IVA incluido` : "Precio a confirmar"
    } · ${p.hay_stock ? "En stock" : "Sin stock"}</p><p>${escapar(descripcion)}</p>${
      specs.length > 0 ? `<table>${specs.map(([k, v]) => `<tr><th>${escapar(k)}</th><td>${escapar(v)}</td></tr>`).join("")}</table>` : ""
    }<p>Envío a domicilio a todo el país. Configuración de fábrica.</p></main>`;
    escribirPagina(ruta, armarPagina(base, { titulo: p.nombre, descripcion, ruta, extraHead, cuerpo, imagen, tipo: "product" }));
    urls.push(sitio + ruta);
    fichas += 1;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escapar(u)}</loc><lastmod>${hoy}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  writeFileSync(join(dist, "sitemap.xml"), sitemap);
  console.log(`[prerender] El inicio, ${categorias.length} categorías, ${fijas.length} páginas fijas, ${fichas} fichas y el sitemap (${urls.length} direcciones).`);
}

main().catch((e) => {
  console.error("[prerender] Falló:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
