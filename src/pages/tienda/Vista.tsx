import { useEffect, useState } from "react";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { ListadoFiltrable } from "@/components/tienda/ListadoFiltrable";
import { PreguntasFrecuentes } from "@/components/tienda/PreguntasFrecuentes";
import { listarProductos, type ProductoPublico } from "@/lib/tienda/catalogo";
import { usarSeo } from "@/lib/tienda/seo";

type TipoDeVista = "ofertas" | "nuevos";

const TEXTOS: Record<TipoDeVista, { titulo: string; bajada: string; vacio: string }> = {
  ofertas: {
    titulo: "Ofertas",
    bajada: "Productos con precio rebajado: ves el precio anterior tachado y el precio final con IVA.",
    vacio: "Hoy no hay productos en oferta. Mirá los destacados o los nuevos ingresos.",
  },
  nuevos: {
    titulo: "Nuevos ingresos",
    bajada: "Lo último que entró al catálogo.",
    vacio: "Todavía no hay productos nuevos para mostrar.",
  },
};

/** Vistas sin categoría propia: ofertas y nuevos ingresos, con los mismos filtros que una categoría. */
export default function Vista({ tipo }: { tipo: TipoDeVista }) {
  const textos = TEXTOS[tipo];
  usarSeo(textos.titulo, textos.bajada);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    const pedido =
      tipo === "ofertas" ? listarProductos({ soloOfertas: true, porPagina: 1000 }) : listarProductos({ orden: "nuevos", porPagina: 48, soloConStock: true });
    pedido
      .then((r) => {
        if (!cancelado) setProductos(r.productos);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tipo]);

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-5 px-4 pb-6 pt-5">
        <MigasDePan migas={[{ nombre: textos.titulo }]} />
        <div className="flex max-w-[720px] flex-col gap-2">
          <h1 className="font-display text-[36px] font-bold uppercase leading-none md:text-[44px]">{textos.titulo}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{textos.bajada}</p>
        </div>
        <ListadoFiltrable productos={productos} cargando={cargando} error={error} textoVacio={textos.vacio} ordenInicial={tipo === "nuevos" ? "nuevos" : "destacados"} />
      </div>
      <PreguntasFrecuentes />
    </Tienda>
  );
}
