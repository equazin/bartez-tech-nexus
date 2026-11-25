import type { LineaDetallada } from "./carritoDetallado";
import type { ProductoPublico } from "./catalogo";
import type { PedidoPublico } from "./pedidos";

/**
 * Medición y publicidad: Google Analytics (por la etiqueta de Tag Manager), Google Ads y el píxel de Meta.
 * Nada se carga hasta que la persona acepta en el aviso de cookies. Nunca se mandan datos personales: ni nombre, ni
 * email, ni teléfono. Las páginas vistas las cuenta Analytics solo, con la medición mejorada del flujo de datos.
 * Estos identificadores son públicos: cualquiera los ve en el código de la página.
 */
const CUENTAS: {
  etiquetaDeGoogle: string;
  analytics: string;
  googleAds: { id: string; compra: string } | null;
  pixelDeMeta: string | null;
} = {
  etiquetaDeGoogle: "GTM-T8QHTQQ9",
  analytics: "G-7NED1ZZ7HY",
  googleAds: { id: "AW-18558961251", compra: "2YTPCOmKgLMdEOOMzZFF" },
  pixelDeMeta: "1942363966741671",
};

const MONEDA = "ARS";
const CLAVE_DEL_PERMISO = "teqo:cookies";
const EVENTO_DE_ABRIR_AVISO = "teqo:aviso-de-cookies";
const ESTADOS_PAGADOS = ["pagado", "preparando", "enviado", "entregado"];
const ESTADO_SIN_PAGAR = "pendiente_pago";
const MEDIO_QUE_SE_PAGA_DESPUES = "transferencia";
/** Lo que un anuncio o una campaña le agregan a la dirección de llegada para saber de qué clic vino la visita. */
const PARAMETROS_DE_ANUNCIO = [
  "gclid",
  "gbraid",
  "wbraid",
  "gclsrc",
  "gad_source",
  "gad_campaignid",
  "dclid",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

type Permiso = "si" | "no";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let permisoEnMemoria: Permiso | null = null;
let activada = false;
let llegadaDesdeAnuncio: ReadonlyArray<readonly [string, string]> = [];
let compraEnEspera: PedidoPublico | null = null;

/**
 * Se llama una vez, al cargar la página: recuerda solo en memoria (ni cookie ni almacenamiento) los parámetros de anuncio
 * con los que llegó la visita. Quien acepta las cookies después de pasar a otra página ya no los tiene en la dirección,
 * y sin ellos Google no puede saber que la compra vino de ese clic.
 */
export function recordarLlegadaDesdeAnuncio(): void {
  const parametros = new URLSearchParams(window.location.search);
  llegadaDesdeAnuncio = PARAMETROS_DE_ANUNCIO.flatMap((nombre) => {
    const valor = parametros.get(nombre);
    return valor ? [[nombre, valor] as const] : [];
  });
}

/** Al activarse la medición en otra página que la de llegada, les devuelve esos parámetros a la dirección: de ahí los leen las etiquetas. */
function reponerLlegadaDesdeAnuncio(): void {
  if (llegadaDesdeAnuncio.length === 0) return;
  const actuales = new URLSearchParams(window.location.search);
  if (!PARAMETROS_DE_ANUNCIO.some((nombre) => actuales.has(nombre))) {
    const conAnuncio = new URLSearchParams([...actuales.entries(), ...llegadaDesdeAnuncio.map(([nombre, valor]) => [nombre, valor])]);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${conAnuncio.toString()}${window.location.hash}`);
  }
  llegadaDesdeAnuncio = [];
}

export function permisoDeCookies(): Permiso | null {
  if (permisoEnMemoria) return permisoEnMemoria;
  try {
    const guardado = window.localStorage.getItem(CLAVE_DEL_PERMISO);
    return guardado === "si" || guardado === "no" ? guardado : null;
  } catch {
    return null;
  }
}

/** Una dirección con tokens o datos personales no se le muestra a nadie: la medición espera a que se limpie. */
function direccionConDatosPrivados(): boolean {
  const { hash, search } = window.location;
  return /access_token|refresh_token/.test(hash) || /[?&](t|email|code)=/.test(search);
}

function cargarScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function iniciarPixel(id: string): void {
  if (window.fbq) return;
  // El código base de Meta, escrito con nombres: la cola guarda los llamados hasta que carga su script.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  cargarScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", id);
  fbq("track", "PageView");
}

function activar(intentos = 0): void {
  if (activada || permisoDeCookies() !== "si") return;
  if (direccionConDatosPrivados()) {
    if (intentos < 20) window.setTimeout(() => activar(intentos + 1), 1000);
    return;
  }
  activada = true;
  reponerLlegadaDesdeAnuncio();
  window.dataLayer = window.dataLayer ?? [];
  // Tiene que empujar el objeto `arguments`: es lo que entienden las etiquetas de Google.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
  window.gtag("js", new Date());
  cargarScript(`https://www.googletagmanager.com/gtm.js?id=${CUENTAS.etiquetaDeGoogle}`);
  if (CUENTAS.googleAds) {
    window.gtag("config", CUENTAS.googleAds.id);
    cargarScript(`https://www.googletagmanager.com/gtag/js?id=${CUENTAS.googleAds.id}`);
  }
  if (CUENTAS.pixelDeMeta) iniciarPixel(CUENTAS.pixelDeMeta);
  medirCompraEnEspera();
}

/** Se llama al montar cada página de la tienda: activa la medición si ya hay permiso. */
export function iniciarMedicion(): void {
  activar();
}

function borrarCookies(): void {
  const dominio = window.location.hostname.replace(/^www\./, "");
  for (const cookie of document.cookie.split(";")) {
    const nombre = cookie.split("=")[0]?.trim() ?? "";
    if (!/^(_ga|_gid|_gat|_gcl|_fbp|_fbc)/.test(nombre)) continue;
    document.cookie = `${nombre}=; Max-Age=0; path=/`;
    document.cookie = `${nombre}=; Max-Age=0; path=/; domain=.${dominio}`;
  }
}

export function decidirCookies(acepta: boolean): void {
  permisoEnMemoria = acepta ? "si" : "no";
  try {
    window.localStorage.setItem(CLAVE_DEL_PERMISO, permisoEnMemoria);
  } catch {
    // Sin almacenamiento la decisión vale para esta visita.
  }
  if (acepta) {
    activar();
    return;
  }
  borrarCookies();
  // Si ya estaban cargadas, la única forma de sacarlas de la página es recargarla.
  if (activada) window.location.reload();
}

/** El enlace "Cookies" del pie vuelve a mostrar el aviso, para cambiar la decisión. */
export function abrirAvisoDeCookies(): void {
  window.dispatchEvent(new Event(EVENTO_DE_ABRIR_AVISO));
}

export function escucharAvisoDeCookies(alAbrir: () => void): () => void {
  window.addEventListener(EVENTO_DE_ABRIR_AVISO, alAbrir);
  return () => window.removeEventListener(EVENTO_DE_ABRIR_AVISO, alAbrir);
}

type ProductoMedido = Pick<ProductoPublico, "id" | "nombre"> & Partial<Pick<ProductoPublico, "sku" | "marca" | "categoria_nombre" | "precio_final_ars">>;

const idDe = (p: { id: number; sku?: string | null }) => p.sku || String(p.id);

const itemDe = (p: ProductoMedido, cantidad: number) => ({
  item_id: idDe(p),
  item_name: p.nombre,
  item_brand: p.marca ?? undefined,
  item_category: p.categoria_nombre ?? undefined,
  price: p.precio_final_ars ?? undefined,
  quantity: cantidad,
});

function enviar(evento: string, parametros: Record<string, unknown>, eventoDeMeta: string, parametrosDeMeta: Record<string, unknown>, idDeMeta?: string): void {
  if (!activada) return;
  window.gtag("event", evento, { ...parametros, send_to: CUENTAS.analytics });
  if (CUENTAS.pixelDeMeta) window.fbq?.("track", eventoDeMeta, parametrosDeMeta, idDeMeta ? { eventID: idDeMeta } : undefined);
}

export function medirProductoVisto(p: ProductoMedido): void {
  const valor = p.precio_final_ars ?? 0;
  enviar("view_item", { currency: MONEDA, value: valor, items: [itemDe(p, 1)] }, "ViewContent", {
    content_ids: [idDe(p)],
    content_name: p.nombre,
    content_type: "product",
    value: valor,
    currency: MONEDA,
  });
}

export function medirAgregadoAlCarrito(p: ProductoMedido, cantidad: number): void {
  const valor = (p.precio_final_ars ?? 0) * cantidad;
  enviar("add_to_cart", { currency: MONEDA, value: valor, items: [itemDe(p, cantidad)] }, "AddToCart", {
    content_ids: [idDe(p)],
    content_name: p.nombre,
    content_type: "product",
    value: valor,
    currency: MONEDA,
  });
}

export function medirInicioDeCheckout(lineas: LineaDetallada[], valor: number): void {
  const conProducto = lineas.filter((l) => l.producto);
  enviar(
    "begin_checkout",
    { currency: MONEDA, value: valor, items: conProducto.map((l) => itemDe(l.producto as ProductoPublico, l.linea.cantidad)) },
    "InitiateCheckout",
    { content_ids: conProducto.map((l) => idDe(l.producto as ProductoPublico)), content_type: "product", num_items: conProducto.length, value: valor, currency: MONEDA },
  );
}

/**
 * Cuándo una compra ya se cuenta. Con Mercado Pago, cuando el pago está acreditado: el comprador vuelve a la página de
 * la compra y la ve pagada. Por transferencia, desde que hace el pedido: el pago se confirma después, sin el comprador
 * en la página, y esperar a verla pagada era no contarla casi nunca. Si esa transferencia no llega, queda contada igual:
 * lo que se cobró de verdad está en el panel.
 */
function seCuenta(pedido: PedidoPublico): boolean {
  if (ESTADOS_PAGADOS.includes(pedido.estado)) return true;
  return pedido.estado === ESTADO_SIN_PAGAR && pedido.medio_pago === MEDIO_QUE_SE_PAGA_DESPUES;
}

/** Si la persona acepta las cookies con la compra en pantalla, se cuenta en ese momento. */
function medirCompraEnEspera(): void {
  if (!compraEnEspera) return;
  const pedido = compraEnEspera;
  compraEnEspera = null;
  medirCompra(pedido);
}

/**
 * La compra se cuenta una sola vez por pedido en este navegador, cuando la página de la compra la muestra en un estado
 * que ya cuenta (ver `seCuenta`). El número de pedido va como id: Google y Meta no cuentan dos veces el mismo. El valor
 * no incluye el envío.
 */
export function medirCompra(pedido: PedidoPublico): void {
  if (!seCuenta(pedido)) return;
  if (!activada) {
    compraEnEspera = pedido;
    return;
  }
  const clave = `teqo:compra-medida:${pedido.numero}`;
  try {
    if (window.localStorage.getItem(clave)) return;
    window.localStorage.setItem(clave, "1");
  } catch {
    // Sin almacenamiento se manda igual: el número de pedido evita que se cuente dos veces.
  }
  const valor = pedido.total - (pedido.envio_costo ?? 0);
  const conProducto = pedido.items.filter((i) => i.producto_id);
  const idsDeItems = (i: (typeof conProducto)[number]) => i.sku || String(i.producto_id);
  enviar(
    "purchase",
    {
      transaction_id: pedido.numero,
      currency: MONEDA,
      value: valor,
      shipping: pedido.envio_costo ?? 0,
      items: conProducto.map((i) => ({ item_id: idsDeItems(i), item_name: i.nombre, price: i.precio_final ?? undefined, quantity: i.cantidad })),
    },
    "Purchase",
    { content_ids: conProducto.map(idsDeItems), content_type: "product", num_items: conProducto.length, value: valor, currency: MONEDA },
    pedido.numero,
  );
  if (CUENTAS.googleAds) {
    window.gtag("event", "conversion", { send_to: `${CUENTAS.googleAds.id}/${CUENTAS.googleAds.compra}`, value: valor, currency: MONEDA, transaction_id: pedido.numero });
  }
}
