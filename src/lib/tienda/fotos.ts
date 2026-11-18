/**
 * Las fotos de los productos vienen de los servidores de los mayoristas a tamaño completo: hasta 440 KB para
 * mostrarlas a 140 píxeles. Para los listados, el carrito y la ficha se pide una versión liviana:
 * - ELIT publica cada foto en tres tamaños (_l de 1500 px, _m de 500 y _s de 100): las miniaturas usan la mediana.
 * - New Bytes publica un PNG de 800 × 800: lo achica y lo pasa a WebP el servicio de imágenes del hosting
 *   (/_vercel/image, configurado en vercel.json). Ese servicio existe solo en el sitio desplegado.
 * Lo que no es de un mayorista conocido queda como está. Si la versión liviana no carga, FotoDeProducto vuelve
 * sola a la original.
 *
 * scripts/prerender.mjs repite esta cuenta para adelantar la carga de la foto de cada ficha: si cambia acá,
 * tiene que cambiar allá.
 */
export type UsoDeFoto = "miniatura" | "ficha";

/** Los anchos tienen que estar en `images.sizes` de vercel.json, y la calidad en `images.qualities`. */
const ANCHO: Record<UsoDeFoto, number> = { miniatura: 384, ficha: 828 };
const CALIDAD = 75;
const DE_ELIT = /^https:\/\/images\.elit\.com\.ar\/.+_l\.webp$/;
const DE_NEW_BYTES = /^https:\/\/static\.nb\.com\.ar\/i\//;

export function fotoLiviana(url: string, uso: UsoDeFoto = "miniatura"): string {
  if (!url) return url;
  if (DE_ELIT.test(url)) return uso === "miniatura" ? url.replace(/_l\.webp$/, "_m.webp") : url;
  if (DE_NEW_BYTES.test(url) && import.meta.env.PROD) return `/_vercel/image?url=${encodeURIComponent(url)}&w=${ANCHO[uso]}&q=${CALIDAD}`;
  return url;
}
