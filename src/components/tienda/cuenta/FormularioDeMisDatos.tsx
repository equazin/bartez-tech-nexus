import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAXIMO_DE_DIRECCIONES,
  conDireccionPrincipal,
  guardarMisDatos,
  leerMisDatos,
  textoDeDireccion,
  type DireccionGuardada,
  type MisDatos,
} from "@/lib/tienda/cuenta";
import { PROVINCIAS } from "@/lib/tienda/envios";

const CLASE_SELECT =
  "flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VACIOS: MisDatos = { nombre: "", telefono: "", documento: "", direcciones: [] };
const DIRECCION_VACIA: DireccionGuardada = { calle: "", numero: "", piso: "", codigo_postal: "", localidad: "", provincia: "" };

function direccionCompleta(d: DireccionGuardada): string | null {
  if (d.calle.trim().length < 2) return "Falta la calle.";
  if (!d.numero.trim()) return "Falta el número.";
  if (!/^\d{4}$/.test(d.codigo_postal.trim())) return "El código postal tiene cuatro números.";
  if (d.localidad.trim().length < 2) return "Falta la localidad.";
  if (!PROVINCIAS.includes(d.provincia as (typeof PROVINCIAS)[number])) return "Elegí la provincia.";
  return null;
}

/** Datos para completar el checkout solo: nombre, teléfono, DNI o CUIT y hasta cinco direcciones. */
export function FormularioDeMisDatos({ userId }: { userId: string }) {
  const [datos, setDatos] = useState<MisDatos | null>(null);
  const [nueva, setNueva] = useState<DireccionGuardada>(DIRECCION_VACIA);
  const [sumando, setSumando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    leerMisDatos()
      .then((d) => setDatos(d ?? VACIOS))
      .catch(() => setDatos(VACIOS));
  }, []);

  async function guardar(siguiente: MisDatos, aviso = "Guardamos tus datos."): Promise<boolean> {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardarMisDatos(userId, siguiente);
      setDatos(siguiente);
      setMensaje({ tipo: "ok", texto: aviso });
      return true;
    } catch (e: unknown) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No pudimos guardar tus datos." });
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function guardarDatos(evento: FormEvent) {
    evento.preventDefault();
    if (!datos) return;
    const documento = datos.documento.replace(/[.\- ]/g, "");
    if (documento && !/^\d{7,11}$/.test(documento)) {
      setMensaje({ tipo: "error", texto: "Escribí tu DNI o CUIT, sin puntos." });
      return;
    }
    void guardar({ ...datos, documento });
  }

  function sumarDireccion(evento: FormEvent) {
    evento.preventDefault();
    if (!datos) return;
    const falta = direccionCompleta(nueva);
    if (falta) {
      setMensaje({ tipo: "error", texto: falta });
      return;
    }
    const limpia = { ...nueva, piso: nueva.piso?.trim() || undefined };
    void guardar({ ...datos, direcciones: conDireccionPrincipal(datos.direcciones, limpia) }, "Sumamos la dirección como principal.").then((guardada) => {
      if (!guardada) return;
      setNueva(DIRECCION_VACIA);
      setSumando(false);
    });
  }

  if (!datos) return <p className="text-sm text-muted-foreground">Cargando tus datos</p>;

  return (
    <div className="space-y-8">
      <form onSubmit={guardarDatos} className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-[20px] font-bold leading-[26px]">Tus datos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nombre y apellido</span>
            <Input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} autoComplete="name" maxLength={120} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Teléfono</span>
            <Input type="tel" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} autoComplete="tel" maxLength={40} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">DNI o CUIT</span>
            <Input value={datos.documento} onChange={(e) => setDatos({ ...datos, documento: e.target.value })} inputMode="numeric" maxLength={15} />
          </label>
        </div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando" : "Guardar mis datos"}
        </Button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold leading-[26px]">Direcciones</h2>
          {!sumando && datos.direcciones.length < MAXIMO_DE_DIRECCIONES && (
            <Button variant="outline" size="sm" onClick={() => setSumando(true)}>
              Sumar una dirección
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">La principal se completa sola al finalizar la compra. Podés guardar hasta {MAXIMO_DE_DIRECCIONES}.</p>
        {datos.direcciones.length === 0 && !sumando && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Todavía no guardaste direcciones.</p>
        )}
        <ul className="space-y-2">
          {datos.direcciones.map((d, i) => (
            <li key={`${textoDeDireccion(d)}-${i}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
              <span className="min-w-[200px] flex-1">{textoDeDireccion(d)}</span>
              {i === 0 ? (
                <Badge variant="success">Principal</Badge>
              ) : (
                <Button size="sm" variant="ghost" disabled={guardando} onClick={() => void guardar({ ...datos, direcciones: conDireccionPrincipal(datos.direcciones, d) }, "Cambiamos la dirección principal.")}>
                  Hacer principal
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={guardando}
                onClick={() => void guardar({ ...datos, direcciones: datos.direcciones.filter((_, j) => j !== i) }, "Quitamos la dirección.")}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>

        {sumando && (
          <form onSubmit={sumarDireccion} className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-6">
            <label className="block space-y-1 text-sm sm:col-span-4">
              <span className="font-medium">Calle</span>
              <Input value={nueva.calle} onChange={(e) => setNueva({ ...nueva, calle: e.target.value })} autoComplete="address-line1" />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Número</span>
              <Input value={nueva.numero} onChange={(e) => setNueva({ ...nueva, numero: e.target.value })} />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-3">
              <span className="font-medium">Piso y departamento (opcional)</span>
              <Input value={nueva.piso ?? ""} onChange={(e) => setNueva({ ...nueva, piso: e.target.value })} autoComplete="address-line2" />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-3">
              <span className="font-medium">Código postal</span>
              <Input value={nueva.codigo_postal} onChange={(e) => setNueva({ ...nueva, codigo_postal: e.target.value })} inputMode="numeric" maxLength={4} autoComplete="postal-code" />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-3">
              <span className="font-medium">Localidad</span>
              <Input value={nueva.localidad} onChange={(e) => setNueva({ ...nueva, localidad: e.target.value })} autoComplete="address-level2" />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-3">
              <span className="font-medium">Provincia</span>
              <select value={nueva.provincia} onChange={(e) => setNueva({ ...nueva, provincia: e.target.value })} className={CLASE_SELECT} autoComplete="address-level1">
                <option value="">Elegí la provincia</option>
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-6">
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando" : "Guardar la dirección"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSumando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </section>
      {mensaje && <p className={mensaje.tipo === "ok" ? "rounded-xl bg-secondary p-3 text-sm" : "rounded-xl bg-error-fondo p-3 text-sm text-danger"}>{mensaje.texto}</p>}
    </div>
  );
}
