import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tienda } from "@/components/tienda/Tienda";
import { crearArrepentimiento } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Arrepentimiento() {
  usarSeo("Botón de arrepentimiento", "Revocá tu compra dentro de los 10 días corridos de recibirla, sin registro y con un código al instante.");
  // Desde la compra o el email de entrega llegan el número y el email ya cargados.
  const [parametros] = useSearchParams();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState(() => (parametros.get("email") ?? "").slice(0, 320));
  const [numero, setNumero] = useState(() => (parametros.get("compra") ?? "").slice(0, 40));
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ codigo: string; numero: string | null } | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError("Revisá el email: ahí te mandamos el código.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      setResultado(await crearArrepentimiento({ email: email.trim(), numero: numero.trim() || undefined, motivo: motivo.trim() || undefined, nombre: nombre.trim() || undefined }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el arrepentimiento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tienda>
      <div className="container mx-auto grid gap-10 px-4 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-4">
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Botón de arrepentimiento</h1>
          <p className="text-muted-foreground">
            Si compraste y te arrepentiste, podés revocar la compra dentro de los 10 días corridos desde que la recibiste, sin dar motivos y sin costo
            para vos. No hace falta tener cuenta.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Al enviar el formulario te damos un código de identificación al instante y te lo mandamos por email.</li>
            <li>Dentro de las 24 horas te escribimos con los pasos para la devolución y el reintegro.</li>
            <li>El reintegro se hace por el mismo medio con el que pagaste.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Si solo querés ver el estado de una compra, usá <Link to="/seguimiento" className="underline">Seguir mi compra</Link>.
          </p>
        </section>

        <section>
          {resultado ? (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
              <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Tu código de arrepentimiento</p>
              <p className="font-display text-5xl font-bold tracking-[1px]">{resultado.codigo}</p>
              <p className="text-muted-foreground">
                Guardalo. Te lo mandamos a {email.trim()} {resultado.numero ? `junto con el número de tu compra ${resultado.numero}` : ""}. Dentro de las 24 horas te
                escribimos con los pasos a seguir.
              </p>
              <Button asChild variant="outline">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Nombre y apellido (opcional)</span>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Email con el que compraste</span>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Número de pedido (opcional)</span>
                <Input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="ORD-0001" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Motivo (opcional)</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  className="flex w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              {error && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" disabled={enviando}>
                {enviando ? "Enviando" : "Quiero arrepentirme de la compra"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </Tienda>
  );
}
