import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { imagenesDe, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";

const NOMBRE = "Teqo";

/** La dirección pública del sitio, sin barra final. */
export const SITIO = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin).replace(/\/$/, "");

/** Los productos con esta etiqueta son de prueba: no se indexan ni entran al sitemap (ver scripts/prerender.mjs). */
export const ETIQUETA_DE_PRUEBA = "prueba";

function fijarMeta(selector: string, atributo: "name" | "property", valor: string, contenido: string) {
  let elemento = document.head.querySelector<HTMLMetaElement>(selector);
  if (!elemento) {
    elemento = document.createElement("meta");
    elemento.setAttribute(atributo, valor);
    document.head.appendChild(elemento);
  }
  elemento.setAttribute("content", contenido);
}

/**
 * Título y descripción de una página de la tienda. Corre después de que la página
 * tiene sus datos, así que pisa los valores genéricos de RouteSeo.
 */
export function usarSeo(titulo: string | null | undefined, descripcion?: string | null) {
  useEffect(() => {
    if (!titulo) return;
    const completo = `${titulo} | ${NOMBRE}`;
    document.title = completo;
    fijarMeta('meta[property="og:title"]', "property", "og:title", completo);
    fijarMeta('meta[name="twitter:title"]', "name", "twitter:title", completo);
    if (descripcion) {
      fijarMeta('meta[name="description"]', "name", "description", descripcion);
      fijarMeta('meta[property="og:description"]', "property", "og:description", descripcion);
      fijarMeta('meta[name="twitter:description"]', "name", "twitter:description", descripcion);
    }
  }, [titulo, descripcion]);
}

/**
 * Saca la página de los buscadores mientras está en pantalla: direcciones que no existen y productos de prueba.
 * RouteSeo vuelve a poner "index,follow" en cada cambio de dirección y este efecto corre después, así que
 * depende de la dirección para volver a marcarla.
 */
export function usarNoIndexar(activo = true) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!activo) return;
    fijarMeta('meta[name="robots"]', "name", "robots", "noindex,nofollow");
    return () => {
      fijarMeta('meta[name="robots"]', "name", "robots", "index,follow");
    };
  }, [activo, pathname]);
}

/**
 * Datos estructurados (JSON-LD) de la página con lo que la aplicación tiene en este momento. Reemplaza a los
 * que dejó el prerender con la misma marca, que pueden traer el precio del último despliegue.
 */
export function usarDatosEstructurados(marca: string, datos: Record<string, unknown> | null) {
  const texto = datos ? JSON.stringify(datos).replace(/</g, "\\u003c") : null;
  useEffect(() => {
    if (!texto) return;
    document.head.querySelectorAll(`script[type="application/ld+json"][data-prerender="${marca}"]`).forEach((viejo) => viejo.remove());
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = `teqo-datos-${marca}`;
    script.textContent = texto;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [marca, texto]);
}

const absoluta = (url: string): string => (/^https?:\/\//i.test(url) ? url : `${SITIO}${url.startsWith("/") ? "" : "/"}${url}`);

/** El producto como lo lee Google: nombre, fotos, marca y la oferta con el precio más bajo (transferencia) y el stock. */
export function datosDelProducto(p: ProductoPublico): Record<string, unknown> {
  const direccion = `${SITIO}${rutaDelProducto(p)}`;
  const imagenes = imagenesDe(p)
    .filter((url) => /^(https?:)?\//i.test(url))
    .slice(0, 6)
    .map(absoluta);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nombre,
    ...(imagenes.length > 0 ? { image: imagenes } : {}),
    description: p.descripcion_corta?.trim() || `${p.nombre} con envío a domicilio y precio final con IVA incluido.`,
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
    ...(p.precio_final_ars !== null
      ? {
          offers: {
            "@type": "Offer",
            url: direccion,
            priceCurrency: "ARS",
            price: Number(p.precio_final_ars),
            availability: p.hay_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", "@id": `${SITIO}/#organization`, name: NOMBRE, url: SITIO },
          },
        }
      : {}),
  };
}
