import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { chipsDeArmada } from "@/components/tienda/ArmadorPartes";
import { PASOS, type Seleccion } from "@/lib/tienda/armador";
import { imagenPrincipal, listarProductosPorIds, type PrecioPorMedio, type ProductoPublico } from "@/lib/tienda/catalogo";
import { seleccionDe } from "@/lib/tienda/componentes";
import { formatearPesos } from "@/lib/tienda/dinero";
import { listarPcArmadas, type PcArmadaPublica } from "@/lib/tienda/pcArmadas";
import { esImagenSubida, listarPortadasVigentes, type PortadaPublica } from "@/lib/tienda/portadas";
import { nombreCortoDeMedio, precioConMedio, preciosDe } from "@/lib/tienda/precios";
import { useServicios } from "@/lib/tienda/servicios";
import { cn } from "@/lib/utils";

/**
 * La portada del inicio: un banner con texto o una PC armada (panel › Marketing › Portada del inicio).
 * Sin portada vigente, la primera PC armada; sin PC armadas, el lema de la marca.
 */

type DatosDeBanner = Pick<PortadaPublica, "etiqueta" | "titulo" | "texto" | "boton" | "enlace" | "imagen_url" | "fondo">;

const ESTILOS = {
  gris: { tema: undefined, fondo: "bg-placa-foto text-texto-placa", placa: "bg-placa-foto-2", etiqueta: "text-primary", boton: "bg-primary text-primary-foreground hover:bg-primary/90" },
  grafito: { tema: "nocturno", fondo: "bg-background text-foreground", placa: "bg-placa-foto", etiqueta: "text-muted-foreground", boton: "bg-primary text-primary-foreground hover:bg-primary/90" },
  rojo: { tema: undefined, fondo: "bg-primary text-primary-foreground", placa: "bg-card", etiqueta: "opacity-85", boton: "bg-card text-foreground hover:bg-secondary" },
} as const;

function Contenedor({ fondo, children }: { fondo: DatosDeBanner["fondo"]; children: ReactNode }) {
  const estilo = ESTILOS[fondo] ?? ESTILOS.gris;
  return (
    <div data-tema={estilo.tema} className={cn("grid min-h-[460px] min-w-0 flex-[2_1_560px] overflow-hidden rounded-2xl md:grid-cols-[1.05fr_1fr]", estilo.fondo)}>
      {children}
    </div>
  );
}

export function BannerDePortada({ banner, enlazar = true }: { banner: DatosDeBanner; enlazar?: boolean }) {
  const estilo = ESTILOS[banner.fondo] ?? ESTILOS.gris;
  const subida = esImagenSubida(banner.imagen_url);
  const claseBoton = cn("flex h-12 items-center rounded-xl px-6 font-bold", estilo.boton);
  return (
    <Contenedor fondo={banner.fondo}>
      <div className="flex flex-col justify-center gap-4 p-7 md:p-11">
        {banner.etiqueta && <p className={cn("text-[13px] font-bold uppercase tracking-[0.12em]", estilo.etiqueta)}>{banner.etiqueta}</p>}
        <h1 className="font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[58px]">{banner.titulo}</h1>
        {banner.texto && <p className="text-base leading-relaxed opacity-85">{banner.texto}</p>}
        {banner.boton && (
          <div className="pt-1">
            {enlazar ? (
              <Link to={banner.enlace} className={cn(claseBoton, "inline-flex")}>
                {banner.boton}
              </Link>
            ) : (
              <span className={cn(claseBoton, "inline-flex")}>{banner.boton}</span>
            )}
          </div>
        )}
      </div>
      <div className={cn("relative flex min-h-[300px] items-center justify-center overflow-hidden", estilo.placa)}>
        {banner.imagen_url &&
          (subida ? (
            <img src={banner.imagen_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <img src={banner.imagen_url} alt="" className="max-h-[340px] max-w-[66%] object-contain mix-blend-multiply" />
          ))}
      </div>
    </Contenedor>
  );
}

interface PcLista {
  armada: PcArmadaPublica;
  seleccion: Seleccion;
  chips: string[];
  totales: Array<{ medio: PrecioPorMedio; total: number }>;
}

async function cargarPc(armadaId: string | null): Promise<PcLista | null> {
  const armadas = await listarPcArmadas();
  const armada = (armadaId ? armadas.find((a) => a.id === armadaId) : null) ?? armadas[0];
  if (!armada) return null;
  const ids = PASOS.map((p) => armada.piezas[p.id]?.id).filter((id): id is number => typeof id === "number");
  const productos = await listarProductosPorIds(ids);
  const seleccion = seleccionDe(armada.piezas, new Map(productos.map((p) => [p.id, p])));
  const conPiezas = PASOS.filter((p) => seleccion[p.id]);
  if (conPiezas.length === 0) return null;
  const totales = preciosDe(seleccion[conPiezas[0].id] as ProductoPublico).map((medio) => ({
    medio,
    total: conPiezas.reduce((suma, p) => suma + (precioConMedio(seleccion[p.id] as ProductoPublico, medio.id) ?? 0) * (armada.piezas[p.id]?.cantidad ?? 1), 0),
  }));
  return { armada, seleccion, chips: chipsDeArmada(seleccion, armada.piezas), totales };
}

function Lema() {
  return (
    <div className="flex min-h-[460px] min-w-0 flex-[2_1_560px] flex-col justify-center gap-4 rounded-2xl bg-placa-foto p-7 text-texto-placa md:p-12">
      <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">Notebooks · Gaming · Monitores · Componentes</p>
      <h1 className="font-display text-[48px] font-extrabold uppercase leading-[0.95] md:text-[68px]">Subí tu mundo.</h1>
      <p className="max-w-[520px] text-lg leading-relaxed">Equipos de fábrica, elegidos y explicados, con el precio final a la vista y envío al mismo precio en todo el país.</p>
    </div>
  );
}

export function PcDePortada({ armadaId = null, enlazar = true }: { armadaId?: string | null; enlazar?: boolean }) {
  const [pc, setPc] = useState<PcLista | null | undefined>(undefined);
  const servicios = useServicios();
  const conArmado = servicios.some((s) => /armado/i.test(s.nombre));

  useEffect(() => {
    let cancelado = false;
    setPc(undefined);
    cargarPc(armadaId)
      .then((resultado) => {
        if (!cancelado) setPc(resultado);
      })
      .catch(() => {
        if (!cancelado) setPc(null);
      });
    return () => {
      cancelado = true;
    };
  }, [armadaId]);

  if (pc === undefined) return <div className="min-h-[460px] min-w-0 flex-[2_1_560px] animate-pulse rounded-2xl bg-placa-foto" aria-hidden />;
  if (pc === null) return <Lema />;

  const { armada, seleccion, chips, totales } = pc;
  const gabinete = seleccion.gabinete ? imagenPrincipal(seleccion.gabinete) : null;
  const miniaturas = [seleccion.video, seleccion.procesador]
    .filter((p): p is ProductoPublico => Boolean(p))
    .map(imagenPrincipal)
    .filter((f): f is string => Boolean(f));
  const claseVer = "flex h-12 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90";
  const claseArmar = "flex h-12 items-center rounded-xl border border-texto-placa px-6 font-bold hover:bg-white/40";
  return (
    <Contenedor fondo="gris">
      <div className="flex flex-col justify-center gap-4 p-7 md:p-11">
        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">PC armadas</p>
        <h1 className="font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[58px]">{armada.nombre}, compatible pieza por pieza</h1>
        <p className="text-base leading-relaxed opacity-80">
          {chips.join(" · ")}.{conArmado ? " La armamos, la probamos y te llega lista para enchufar." : " Todas las piezas compatibles entre sí."}
        </p>
        {totales[0] && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[34px] font-extrabold tabular-nums tracking-[-0.02em]">
              {formatearPesos(totales[0].total)}{" "}
              <span className="text-[15px] font-medium tracking-normal opacity-80">con {nombreCortoDeMedio(totales[0].medio).toLowerCase()}</span>
            </span>
            {totales[1] && (
              <span className="text-sm tabular-nums opacity-80">
                {formatearPesos(totales[1].total)} con {nombreCortoDeMedio(totales[1].medio)}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {enlazar ? (
            <>
              <Link to={`/arma-tu-pc?armada=${armada.id}`} className={claseVer}>
                Ver la PC
              </Link>
              <Link to="/arma-tu-pc" className={claseArmar}>
                Armá la tuya
              </Link>
            </>
          ) : (
            <>
              <span className={claseVer}>Ver la PC</span>
              <span className={claseArmar}>Armá la tuya</span>
            </>
          )}
        </div>
      </div>
      <div className="relative flex min-h-[300px] items-center justify-center bg-placa-foto-2">
        {gabinete && <img src={gabinete} alt="" className="max-h-[340px] max-w-[62%] object-contain mix-blend-multiply" />}
        {miniaturas.length > 0 && (
          <span className="absolute bottom-6 left-6 flex gap-2.5">
            {miniaturas.map((foto) => (
              <span key={foto} className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl bg-white shadow-[0_6px_20px_-12px_rgba(0,0,0,0.4)]">
                <img src={foto} alt="" className="max-h-[66px] max-w-[66px] object-contain" />
              </span>
            ))}
          </span>
        )}
      </div>
    </Contenedor>
  );
}

/** La portada vigente del inicio. */
export function PortadaDelInicio() {
  const [portada, setPortada] = useState<PortadaPublica | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    listarPortadasVigentes()
      .then((lista) => {
        if (!cancelado) setPortada(lista[0] ?? null);
      })
      .catch(() => {
        if (!cancelado) setPortada(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (portada === undefined) return <div className="min-h-[460px] min-w-0 flex-[2_1_560px] animate-pulse rounded-2xl bg-placa-foto" aria-hidden />;
  if (portada?.tipo === "banner") return <BannerDePortada banner={portada} />;
  return <PcDePortada armadaId={portada?.pc_armada_id ?? null} />;
}
