import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type RouteSeoConfig = {
  title: string;
  description: string;
  canonicalPath?: string;
  noindex?: boolean;
  schema?: "website" | "service" | "catalog" | "contact";
};

const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://DOMINIO-DE-TEQO-A-CONFIRMAR").replace(//$/, "");
const DEFAULT_SEO: RouteSeoConfig = {
  title: "Teqo | Notebooks, gaming, monitores y periféricos",
  description: "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.",
  canonicalPath: "/",
};

const PUBLIC_ROUTE_SEO: Record<string, RouteSeoConfig> = {
  "/": {
    title: "Teqo | Notebooks, gaming, monitores y periféricos",
    description: "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.",
    canonicalPath: "/",
    schema: "website",
  },
  "/tecnologia": {
    title: "Catálogo | Teqo",
    description: "Notebooks, gaming, monitores y periféricos con envío a todo el país.",
    canonicalPath: "/tecnologia",
    schema: "catalog",
  },
  "/productos": {
    title: "Catálogo | Teqo",
    description: "Notebooks, gaming, monitores y periféricos con envío a todo el país.",
    canonicalPath: "/tecnologia",
    schema: "catalog",
  },
  "/soluciones-corporativas": {
    title: "Soluciones Corporativas IT | Teqo",
    description: "Infraestructura, redes, hardware y servicios para empresas que necesitan tecnologia confiable.",
    canonicalPath: "/soluciones-corporativas",
    schema: "service",
  },
  "/servicios-it": {
    title: "Servicios IT para Empresas | Teqo",
    description: "Soporte, consultoria, redes, seguridad e infraestructura IT para operaciones empresariales.",
    canonicalPath: "/servicios-it",
    schema: "service",
  },
  "/partnership": {
    title: "Partnership B2B para Integradores | Teqo",
    description: "Provision mayorista, soporte comercial y catalogo B2B para integradores y partners tecnologicos.",
    canonicalPath: "/partnership",
    schema: "service",
  },
  "/empresas": {
    title: "Soluciones B2B para Empresas | Teqo",
    description: "Compra corporativa de tecnologia, precios B2B y asistencia para proyectos de equipamiento IT.",
    canonicalPath: "/empresas",
    schema: "service",
  },
  "/soluciones-por-industria": {
    title: "Soluciones IT por Industria | Teqo",
    description: "Tecnologia y equipamiento adaptado a comercios, oficinas, industrias y organizaciones.",
    canonicalPath: "/soluciones-por-industria",
    schema: "service",
  },
  "/puntos-de-venta": {
    title: "Puntos de Venta y Kits POS | Teqo",
    description: "Kits POS, impresoras, lectores, perifericos y equipamiento para comercios.",
    canonicalPath: "/puntos-de-venta",
    schema: "catalog",
  },
  "/nosotros": {
    title: "Nosotros | Teqo",
    description: "Conoce el equipo y la experiencia de Teqo en soluciones IT para empresas.",
    canonicalPath: "/nosotros",
  },
  "/contacto": {
    title: "Contacto | Teqo",
    description: "Contacta a Teqo para compras corporativas, soporte IT y proyectos de tecnologia.",
    canonicalPath: "/contacto",
    schema: "contact",
  },
  "/evaluacion-tecnologica": {
    title: "Evaluacion Tecnologica para Empresas | Teqo",
    description: "Solicita una evaluacion para definir infraestructura, equipamiento y prioridades IT.",
    canonicalPath: "/evaluacion-tecnologica",
    schema: "service",
  },
  "/cotizacion": {
    title: "Cotizacion de Tecnologia para Empresas | Teqo",
    description: "Solicita una cotizacion de equipamiento, infraestructura o servicios IT para tu empresa.",
    canonicalPath: "/evaluacion-tecnologica",
    schema: "service",
  },
};

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertNamedMeta(name: string, content: string) {
  upsertMeta(
    `meta[name="${name}"]`,
    () => {
      const element = document.createElement("meta");
      element.setAttribute("name", name);
      return element;
    },
    content,
  );
}

function upsertPropertyMeta(property: string, content: string) {
  upsertMeta(
    `meta[property="${property}"]`,
    () => {
      const element = document.createElement("meta");
      element.setAttribute("property", property);
      return element;
    },
    content,
  );
}

function upsertCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
}

function upsertJsonLd(id: string, payload: unknown) {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function buildRouteSchema(seo: RouteSeoConfig, canonicalUrl: string) {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Teqo",
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "AR",
      availableLanguage: "es",
    },
  };

  const graph: Array<Record<string, unknown>> = [
    organization,
    {
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: seo.title,
      description: seo.description,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Teqo",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      about: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  const base = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  if (seo.schema === "service") {
    base["@graph"].push({
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: seo.title,
      description: seo.description,
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: "Argentina",
    });
  }

  if (seo.schema === "catalog") {
    base["@graph"].push({
      "@type": "OfferCatalog",
      "@id": `${canonicalUrl}#catalog`,
      name: seo.title,
      description: seo.description,
      provider: { "@id": `${SITE_URL}/#organization` },
    });
  }

  if (seo.schema === "contact") {
    base["@graph"].push({
      "@type": "ContactPage",
      "@id": `${canonicalUrl}#contact`,
      url: canonicalUrl,
      name: seo.title,
      description: seo.description,
    });
  }

  return base;
}

function getRouteSeo(pathname: string): RouteSeoConfig {
  if (pathname.startsWith("/portal") || pathname.startsWith("/admin") || pathname.startsWith("/clientes")) {
    return {
      title: "Portal Clientes | Teqo",
      description: "Acceso privado para clientes Teqo.",
      canonicalPath: pathname,
      noindex: true,
    };
  }

  if (pathname === "/login" || pathname === "/registrarse" || pathname === "/reset-password" || pathname === "/cart") {
    return {
      title: "Acceso Clientes | Teqo",
      description: "Ingreso y gestion de acceso al portal de clientes Teqo.",
      canonicalPath: pathname,
      noindex: true,
    };
  }

  return PUBLIC_ROUTE_SEO[pathname] ?? DEFAULT_SEO;
}

export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const seo = getRouteSeo(location.pathname);
    const canonicalUrl = `${SITE_URL}${seo.canonicalPath ?? location.pathname}`;

    document.title = seo.title;
    upsertCanonical(canonicalUrl);
    upsertNamedMeta("description", seo.description);
    upsertNamedMeta("robots", seo.noindex ? "noindex,nofollow" : "index,follow");
    upsertPropertyMeta("og:title", seo.title);
    upsertPropertyMeta("og:description", seo.description);
    upsertPropertyMeta("og:url", canonicalUrl);
    upsertNamedMeta("twitter:title", seo.title);
    upsertNamedMeta("twitter:description", seo.description);
    upsertJsonLd("teqo-route-schema", buildRouteSchema(seo, canonicalUrl));
  }, [location.pathname]);

  return null;
}
