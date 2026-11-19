import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  descargarCompradores,
  enlaceDeWhatsApp,
  ESTADO_DE_LA_COMPRA,
  listarCompradores,
  NOMBRE_DEL_MAIL,
  textoDelEnvio,
  ubicacionDe,
  type CompraDelComprador,
  type CompradorDelPanel,
} from "@/lib/api/compradores";
import { NOMBRE_DEL_MEDIO } from "@/lib/api/pagos";
import { formatearPesos } from "@/lib/tienda/dinero";
import { cn } from "@/lib/utils";

/**
 * Compradores: quién compró en la tienda, qué pagó y cómo ubicarlo. Se arma con las compras (un comprador es cada
 * email distinto), así que no hace falta que tenga cuenta. Reemplaza en la tienda a la ficha mayorista de clientes.
 */

type Filtro = "todos" | "pagas" | "esperando" | "reintegro" | "nunca";

const FILTROS: Array<{ id: Filtro; nombre: string; cumple: (c: CompradorDelPanel) => boolean }> = [
  { id: "todos", nombre: "Todos", cumple: () => true },
  { id: "pagas", nombre: "Con compras pagas", cumple: (c) => c.compras_pagas > 0 },
  { id: "esperando", nombre: "Esperando el pago", cumple: (c) => c.esperando_pago },
  { id: "reintegro", nombre: "Con reintegro", cumple: (c) => c.con_reintegro },
  { id: "nunca", nombre: "Nunca pagaron", cumple: (c) => c.compras_pagas === 0 && !c.esperando_pago && !c.con_reintegro },
];

const COLUMNAS = "grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.5fr)] gap-4";

const formatoNumero = new Intl.NumberFormat("es-AR");
const formatoFecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatoDiaYMes = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });
const formatoFechaYHora = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** En la lista, el día y el mes alcanzan si la compra es de este año. */
function fechaCorta(fecha: string): string {
  const dia = new Date(fecha);
  return dia.getFullYear() === new Date().getFullYear() ? formatoDiaYMes.format(dia) : formatoFecha.format(dia);
}

const sinAcentos = (texto: string): string => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function coincide(comprador: CompradorDelPanel, busqueda: string): boolean {
  const texto = sinAcentos(busqueda.trim());
  if (!texto) return true;
  const digitos = texto.replace(/\D/g, "");
  const enTexto = [comprador.nombre, comprador.email].some((valor) => sinAcentos(valor ?? "").includes(texto));
  const enNumeros = digitos.length >= 3 && [comprador.telefono, comprador.documento].some((valor) => (valor ?? "").replace(/\D/g, "").includes(digitos));
  return enTexto || enNumeros;
}

function tonoDe(estado: string): "success" | "destructive" | "muted" | "outline" {
  if (estado === "entregado") return "success";
  if (estado === "reintegrado") return "destructive";
  if (estado === "cancelado" || estado === "vencido") return "muted";
  return "outline";
}

function EstadoDeLaCompra({ estado }: { estado: string }) {
  return (
    <Badge variant={tonoDe(estado)} className={cn(estado === "pendiente_pago" && "border-foreground font-medium")}>
      {ESTADO_DE_LA_COMPRA[estado] ?? estado}
    </Badge>
  );
}

function textoDePuntos(puntos: CompradorDelPanel["puntos"]): string {
  if (!puntos || (puntos.disponibles === 0 && puntos.pendientes === 0)) return "Sin puntos";
  if (puntos.pendientes === 0) return "Disponibles";
  const desde = puntos.proxima_liberacion ? ` desde el ${formatoFecha.format(new Date(puntos.proxima_liberacion))}` : "";
  if (puntos.disponibles === 0) return desde ? `Disponibles${desde}` : "Por acreditarse";
  return `${formatoNumero.format(puntos.disponibles)} disponibles; el resto${desde || ", por acreditarse"}`;
}

function textoDelEnvioDeLaCompra(compra: CompraDelComprador): string | null {
  if (compra.envio_costo === null) return null;
  return compra.envio_costo > 0 ? `Envío ${formatearPesos(compra.envio_costo)}` : "Envío sin cargo";
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-secondary p-3.5">
      <p className="text-[13px] text-muted-foreground">{titulo}</p>
      <p className="text-lg font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-[13px] text-muted-foreground">{detalle}</p>}
    </div>
  );
}

function FichaDelComprador({ comprador, onVerCompra }: { comprador: CompradorDelPanel; onVerCompra: (idDeLaCompra: number) => void }) {
  const whatsapp = enlaceDeWhatsApp(comprador.telefono);
  const envio = textoDelEnvio(comprador.ultimo_envio);
  const puntos = comprador.puntos ? comprador.puntos.disponibles + comprador.puntos.pendientes : 0;

  async function copiarEmail() {
    try {
      await navigator.clipboard.writeText(comprador.email);
      toast.success("Email copiado");
    } catch {
      toast.error("No se pudo copiar el email. Copialo a mano.");
    }
  }

  return (
    <SurfaceCard padding="md" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">{comprador.nombre ?? "Sin nombre"}</h3>
          <p className="text-[13px] text-muted-foreground">
            Compra desde el {formatoFecha.format(new Date(comprador.primera_compra))} · {comprador.con_cuenta ? "con cuenta en la tienda" : "sin cuenta en la tienda"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copiarEmail}>
            Copiar el email
          </Button>
          {whatsapp && (
            <Button asChild>
              <a href={whatsapp} target="_blank" rel="noreferrer">
                Escribirle por WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-words">{comprador.email}</dd>
        <dt className="text-muted-foreground">Teléfono</dt>
        <dd className="tabular-nums">{comprador.telefono ?? "Sin dato"}</dd>
        <dt className="text-muted-foreground">DNI</dt>
        <dd className="tabular-nums">{comprador.documento ?? "Sin dato"}</dd>
        <dt className="text-muted-foreground">Último envío</dt>
        <dd>{envio || "Sin dato"}</dd>
      </dl>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Dato titulo="Compras pagas" valor={formatoNumero.format(comprador.compras_pagas)} />
        <Dato titulo="Total pagado" valor={formatearPesos(comprador.total_pagado)} />
        <Dato titulo="Puntos" valor={formatoNumero.format(puntos)} detalle={textoDePuntos(comprador.puntos)} />
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className="text-[15px] font-bold">Sus compras</h4>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {comprador.compras.map((compra) => (
            <li key={compra.id} className="flex flex-col gap-1.5 px-4 py-3.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {compra.numero} · <span className="tabular-nums">{formatearPesos(compra.total)}</span>
                </p>
                <EstadoDeLaCompra estado={compra.estado} />
              </div>
              <p className="text-[13px] text-muted-foreground">
                {[formatoFecha.format(new Date(compra.fecha)), NOMBRE_DEL_MEDIO[compra.medio ?? ""] ?? compra.medio, textoDelEnvioDeLaCompra(compra)].filter(Boolean).join(" · ")}
              </p>
              {compra.productos.length > 0 && <p>{compra.productos.join(", ")}</p>}
              <div>
                <Button type="button" variant="link" className="h-auto p-0 font-bold" onClick={() => onVerCompra(compra.id)}>
                  Ver la compra en Pedidos
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className="text-[15px] font-bold">Mails que le mandamos</h4>
        {comprador.mails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no le mandamos mails de sus compras.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {comprador.mails.map((mail) => (
              <li key={`${mail.numero}-${mail.tipo}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <span>
                  {NOMBRE_DEL_MAIL[mail.tipo] ?? mail.tipo} · {mail.numero}
                </span>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {formatoFechaYHora.format(new Date(mail.anotado_en))} · {mail.confirmado_en ? "salió" : "sin confirmar"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[13px] text-muted-foreground">Los datos salen de sus compras: son los de la última que hizo.</p>
    </SurfaceCard>
  );
}

export function CompradoresTab({ onVerCompra }: { onVerCompra: (idDeLaCompra: number) => void }) {
  const [compradores, setCompradores] = useState<CompradorDelPanel[]>([]);
  const [hayMasCompras, setHayMasCompras] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [elegido, setElegido] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarCompradores();
      setCompradores(lista.compradores);
      setHayMasCompras(lista.hay_mas_compras);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los compradores.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const cumpleElFiltro = FILTROS.find((f) => f.id === filtro)?.cumple ?? (() => true);
  const visibles = useMemo(
    () => compradores.filter((c) => cumpleElFiltro(c) && coincide(c, busqueda)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compradores, filtro, busqueda],
  );
  const actual = visibles.find((c) => c.email === elegido) ?? visibles[0] ?? null;
  const cobrado = compradores.reduce((suma, c) => suma + c.total_pagado, 0);

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando los compradores</p>;
  if (error)
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm text-danger">{error}</p>
        <Button type="button" variant="outline" onClick={() => void cargar()}>
          Probar de nuevo
        </Button>
      </div>
    );

  return (
    <div className="flex max-w-[1360px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[28px] font-bold leading-[34px] tracking-[-0.4px]">Compradores</h2>
        <p className="max-w-[720px] text-sm text-muted-foreground">
          Cada persona que compró en la tienda, con lo que pagó y cómo ubicarla. Se arma con las compras: no hace falta que tenga cuenta.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {[
          { titulo: "Compradores", valor: formatoNumero.format(compradores.length) },
          { titulo: "Con una compra paga", valor: formatoNumero.format(compradores.filter((c) => c.compras_pagas > 0).length) },
          { titulo: "Cobrado", valor: formatearPesos(cobrado) },
          { titulo: "Esperando el pago", valor: formatoNumero.format(compradores.filter((c) => c.esperando_pago).length) },
        ].map((dato) => (
          <SurfaceCard key={dato.titulo} padding="sm" className="flex flex-col gap-1">
            <p className="text-[13px] text-muted-foreground">{dato.titulo}</p>
            <p className="text-[26px] font-bold leading-8 tabular-nums">{dato.valor}</p>
          </SurfaceCard>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] max-w-[380px] flex-1 flex-col gap-1.5">
          <label htmlFor="buscar-comprador" className="text-[13px] text-muted-foreground">
            Buscar por nombre, email, teléfono o DNI
          </label>
          <Input id="buscar-comprador" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Por ejemplo, Méndez" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "h-11 rounded-full border px-4 text-sm font-medium transition",
                filtro === f.id ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {f.nombre} · {formatoNumero.format(compradores.filter(f.cumple).length)}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button type="button" variant="outline" disabled={visibles.length === 0} onClick={() => descargarCompradores(visibles)}>
            Descargar la lista
          </Button>
        </div>
      </div>

      {hayMasCompras && <p className="text-[13px] text-muted-foreground">La lista se arma con las últimas 1.000 compras: los compradores más viejos pueden no estar.</p>}

      {compradores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay compras en la tienda.</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay compradores con esa búsqueda o ese filtro.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[999_1_620px] overflow-x-auto rounded-2xl border border-border bg-card">
            <div className="min-w-[760px]">
              <div className={cn(COLUMNAS, "bg-secondary px-5 py-3 text-[13px] text-muted-foreground")}>
                <span>Comprador</span>
                <span>Ubicación</span>
                <span>Compras</span>
                <span className="text-right">Total pagado</span>
                <span>Última compra</span>
              </div>
              {visibles.map((c) => {
                const ultima = c.compras[0];
                const marcado = actual?.email === c.email;
                return (
                  <button
                    key={c.email}
                    type="button"
                    aria-current={marcado ? "true" : undefined}
                    onClick={() => setElegido(c.email)}
                    className={cn(
                      COLUMNAS,
                      "w-full items-center border-l-[3px] border-t border-t-border px-5 py-3.5 text-left text-sm transition",
                      marcado ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-secondary",
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-bold">{c.nombre ?? "Sin nombre"}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{c.email}</span>
                    </span>
                    <span>{ubicacionDe(c.ultimo_envio) || "Sin dato"}</span>
                    <span className="tabular-nums">
                      {formatoNumero.format(c.compras_pagas)} de {formatoNumero.format(c.compras.length)} {c.compras.length === 1 ? "paga" : "pagas"}
                    </span>
                    <span className={cn("text-right tabular-nums", c.total_pagado > 0 ? "font-bold" : "text-muted-foreground")}>{formatearPesos(c.total_pagado)}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {ultima && (
                        <>
                          <span className="tabular-nums">{fechaCorta(ultima.fecha)}</span>
                          <EstadoDeLaCompra estado={ultima.estado} />
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 flex-[1_1_420px]">{actual && <FichaDelComprador comprador={actual} onVerCompra={onVerCompra} />}</div>
        </div>
      )}
    </div>
  );
}
