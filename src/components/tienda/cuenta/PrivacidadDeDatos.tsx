import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { pedirPorMisDatos } from "@/lib/tienda/cuenta";

type Pedido = "copia" | "rectificacion" | "borrado";

const OPCIONES: Array<{ id: Pedido; titulo: string; detalle: string; boton: string }> = [
  { id: "copia", titulo: "Una copia de tus datos", detalle: "Te mandamos por email los datos personales que guardamos de vos.", boton: "Pedir una copia" },
  { id: "rectificacion", titulo: "Corregir un dato", detalle: "Contanos qué dato está mal y cuál es el correcto.", boton: "Pedir la corrección" },
  {
    id: "borrado",
    titulo: "Borrar tus datos",
    detalle:
      "Borramos tu cuenta y tus datos personales. Las facturas y los registros de las compras se conservan el tiempo que exige la ley, sin usarlos para otra cosa.",
    boton: "Pedir el borrado",
  },
];

/** Derechos de acceso, rectificación y supresión (Ley 25.326): el pedido llega al equipo por email. */
export function PrivacidadDeDatos() {
  const [elegido, setElegido] = useState<Pedido | null>(null);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!elegido) return;
    if (elegido === "rectificacion" && detalle.trim().length < 5) {
      setError("Contanos qué dato hay que corregir.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await pedirPorMisDatos(elegido, detalle);
      setListo(elegido);
      setElegido(null);
      setDetalle("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo mandar el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Podés pedir una copia de tus datos, corregirlos o borrarlos cuando quieras. Te respondemos por email dentro de los plazos de la Ley 25.326.
        Más detalle en la <Link to="/privacidad" className="underline">política de privacidad</Link>.
      </p>
      {listo && (
        <p className="rounded-xl bg-secondary p-3 text-sm">
          Recibimos tu pedido{listo === "borrado" ? " de borrado" : listo === "copia" ? " de copia" : " de corrección"}. Te escribimos por email.
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-3">
        {OPCIONES.map((o) => (
          <li key={o.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <p className="font-bold">{o.titulo}</p>
            <p className="flex-1 text-sm text-muted-foreground">{o.detalle}</p>
            <Button variant={elegido === o.id ? "default" : "outline"} size="sm" onClick={() => setElegido(o.id)}>
              {o.boton}
            </Button>
          </li>
        ))}
      </ul>
      {elegido && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{elegido === "rectificacion" ? "Qué dato hay que corregir" : "Algo más que quieras contarnos (opcional)"}</span>
            <Textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={2000} rows={3} />
          </label>
          {elegido === "borrado" && <p className="text-sm text-muted-foreground">Si tenés una compra en curso, la terminamos antes de borrar la cuenta.</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void enviar()} disabled={enviando}>
              {enviando ? "Mandando" : "Mandar el pedido"}
            </Button>
            <Button variant="ghost" onClick={() => setElegido(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {error && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
