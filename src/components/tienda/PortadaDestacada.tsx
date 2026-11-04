import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { chipsDeArmada } from "@/components/tienda/ArmadorPartes";
import { PASOS, type Seleccion } from "@/lib/tienda/armador";
import { imagenPrincipal, listarProductosPorIds, type PrecioPorMedio, type ProductoPublico } from "@/lib/tienda/catalogo";
import { seleccionDe } from "@/lib/tienda/componentes";
import { formatearPesos } from "@/lib/tienda/dinero";
import { listarPcArmadas, type PcArmadaPublica } from "@/lib/tienda/pcArmadas";
import { esFondoDeImagen, esImagenSubida, listarPortadasVigentes, type PortadaPublica } from "@/lib/tienda/portadas";
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

// Portadas diseñadas: la imagen ocupa todo el fondo (en el celular va arriba) y el texto va encima, a la izquierda.
const MODOS_DE_IMAGEN = {
  "imagen-oscura": { tema: "nocturno", fondo: "bg-background text-foreground", etiqueta: "text-muted-foreground", boton: "bg-primary text-primary-foreground hover:bg-primary/90" },
  "imagen-clara": { tema: undefined, fondo: "bg-placa-foto text-texto-placa", etiqueta: "text-primary", boton: "bg-primary text-primary-foreground hover:bg-primary/90" },
  "imagen-roja": { tema: undefined, fondo: "bg-primary text-primary-foreground", etiqueta: "opacity-85", boton: "bg-card text-foreground hover:bg-secondary" },
} as const;

function BannerConImagen({ banner, enlazar }: { banner: DatosDeBanner; enlazar: boolean }) {
  const modo = MODOS_DE_IMAGEN[banner.fondo as keyof typeof MODOS_DE_IMAGEN] ?? MODOS_DE_IMAGEN["imagen-oscura"];
  const claseBoton = cn("inline-flex h-12 items-center rounded-xl px-6 font-bold", modo.boton);
  return (
    <div data-tema={modo.tema} className={cn("relative flex min-h-[460px] min-w-0 flex-[2_1_560px] flex-col overflow-hidden rounded-2xl", modo.fondo)}>
      {banner.imagen_url && (
        <img src={banner.imagen_url} alt="" className="aspect-[16/10] w-full object-cover object-right md:absolute md:inset-0 md:aspect-auto md:h-full" />
      )}
      <div className="relative flex flex-1 flex-col justify-center gap-4 p-7 md:max-w-[50%] md:p-11">
        {banner.etiqueta && <p className={cn("text-[13px] font-bold uppercase tracking-[0.12em]", modo.etiqueta)}>{banner.etiqueta}</p>}
        <h1 className="font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[56px]">{banner.titulo}</h1>
        {banner.texto && <p className="text-base leading-relaxed opacity-85">{banner.texto}</p>}
        {banner.boton && (
          <div className="pt-1">
            {enlazar ? (
              <Link to={banner.enlace} className={claseBoton}>
                {banner.boton}
              </Link>
            ) : (
              <span className={claseBoton}>{banner.boton}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Contenedor({ fondo, children }: { fondo: DatosDeBanner["fondo"]; children: ReactNode }) {
  const estilo = ESTILOS[fondo as keyof typeof ESTILOS] ?? ESTILOS.gris;
  return (
    <div data-tema={estilo.tema} className={cn("grid min-h-[460px] min-w-0 flex-[2_1_560px] overflow-hidden rounded-2xl md:grid-cols-[1.05fr_1fr]", estilo.fondo)}>
      {children}
    </div>
  );
}

export function BannerDePortada({ banner, enlazar = true }: { banner: DatosDeBanner; enlazar?: boolean }) {
  if (esFondoDeImagen(banner.fondo)) return <BannerConImagen banner={banner} enlazar={enlazar} />;
  const estilo = ESTILOS[banner.fondo as keyof typeof ESTILOS] ?? ESTILOS.gris;
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

/** Un banner diseñado completo: la imagen ya trae el texto. En el celular usa su versión cuadrada. */
export function BannerSoloImagen({ portada, enlazar = true }: { portada: Pick<PortadaPublica, "titulo" | "enlace" | "imagen_url" | "imagen_movil_url">; enlazar?: boolean }) {
  if (!portada.imagen_url) return null;
  const imagen = (
    <picture>
      <source media="(min-width: 768px)" srcSet={portada.imagen_url} />
      <img src={portada.imagen_movil_url ?? portada.imagen_url} alt={portada.titulo} className="block h-auto w-full" />
    </picture>
  );
  return enlazar ? (
    <Link to={portada.enlace} className="block overflow-hidden rounded-2xl">
      {imagen}
    </Link>
  ) : (
    <div className="overflow-hidden rounded-2xl">{imagen}</div>
  );
}

export function DiapositivaDePortada({ portada, enlazar = true }: { portada: PortadaPublica; enlazar?: boolean }) {
  if (portada.tipo === "imagen") return <BannerSoloImagen portada={portada} enlazar={enlazar} />;
  if (portada.tipo === "banner") return <BannerDePortada banner={portada} enlazar={enlazar} />;
  return <PcDePortada armadaId={portada.pc_armada_id} enlazar={enlazar} />;
}

const SEGUNDOS_POR_PORTADA = 7;

/**
 * Las portadas vigentes del inicio en carrusel, en el orden del panel. Se vuelven a leer cuando la
 * pestaña recupera el foco, así un cambio del panel se ve sin recargar la tienda.
 */
export function PortadaDelInicio() {
  const [portadas, setPortadas] = useState<PortadaPublica[] | undefined>(undefined);
  const [indice, setIndice] = useState(0);
  const [pausa, setPausa] = useState(false);

  const cargar = useCallback(() => {
    listarPortadasVigentes()
      .then((lista) => setPortadas(lista))
      .catch(() => setPortadas((actual) => actual ?? []));
  }, []);

  useEffect(() => {
    cargar();
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    window.addEventListener("focus", cargar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("focus", cargar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  const total = portadas?.length ?? 0;
  useEffect(() => {
    if (indice >= total && total > 0) setIndice(0);
  }, [indice, total]);

  useEffect(() => {
    if (total < 2 || pausa) return;
    const reloj = window.setInterval(() => setIndice((i) => (i + 1) % total), SEGUNDOS_POR_PORTADA * 1000);
    return () => window.clearInterval(reloj);
  }, [total, pausa]);

  // En el celular se pasa de portada deslizando el dedo; las flechas quedan abajo, junto a los puntos.
  const inicioDelToque = useRef<number | null>(null);

  if (portadas === undefined) return <div className="min-h-[420px] w-full animate-pulse rounded-2xl bg-placa-foto" aria-hidden />;
  if (total === 0) return <PcDePortada />;

  const actual = portadas[Math.min(indice, total - 1)];
  const mover = (paso: number) => setIndice((i) => (i + paso + total) % total);
  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Portadas"
      className="relative flex w-full"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)}
      onBlur={() => setPausa(false)}
      onTouchStart={(e) => {
        inicioDelToque.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const inicio = inicioDelToque.current;
        inicioDelToque.current = null;
        const fin = e.changedTouches[0]?.clientX;
        if (inicio === null || fin === undefined || total < 2) return;
        const distancia = fin - inicio;
        if (Math.abs(distancia) > 40) mover(distancia < 0 ? 1 : -1);
      }}
    >
      <div key={actual.id} className="flex w-full animate-in fade-in duration-500">
        <DiapositivaDePortada portada={actual} />
      </div>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Portada anterior"
            className="absolute bottom-1.5 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-md hover:bg-card sm:bottom-auto sm:top-1/2 sm:h-11 sm:w-11 sm:-translate-y-1/2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Portada siguiente"
            className="absolute bottom-1.5 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-md hover:bg-card sm:bottom-auto sm:top-1/2 sm:h-11 sm:w-11 sm:-translate-y-1/2"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-chip bg-card/80 px-2.5 py-1.5">
            {portadas.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver la portada ${i + 1} de ${total}`}
                aria-current={i === indice}
                className={cn("h-2 rounded-full transition-all", i === indice ? "w-6 bg-primary" : "w-2 bg-input")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
