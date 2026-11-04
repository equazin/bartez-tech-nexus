import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activarCupon, cuponUsable, describirCupon, fechaDeVencimiento, misCupones, type CuponDeLaCuenta } from "@/lib/tienda/cuenta";

function estadoDe(c: CuponDeLaCuenta): { texto: string; variante: "success" | "outline" | "muted" } {
  if (c.usado) return { texto: "Usado", variante: "muted" };
  if (c.vencido) return { texto: "Vencido", variante: "muted" };
  if (c.activado) return { texto: "Activo", variante: "success" };
  return { texto: "Para activar", variante: "outline" };
}

/** Cupones personales: llegan en el email de entrega y se activan acá, con la cuenta del email de la compra. */
export function MisCupones({ cuponInicial }: { cuponInicial: string | null }) {
  const [cupones, setCupones] = useState<CuponDeLaCuenta[] | null>(null);
  const [codigo, setCodigo] = useState(cuponInicial ?? "");
  const [activando, setActivando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function cargar() {
    try {
      setCupones(await misCupones());
    } catch (e: unknown) {
      setCupones([]);
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No pudimos cargar tus cupones." });
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function activar(valor: string, evento?: FormEvent) {
    evento?.preventDefault();
    const limpio = valor.trim().toUpperCase();
    if (!limpio) return;
    setActivando(limpio);
    setMensaje(null);
    try {
      const r = await activarCupon(limpio);
      setMensaje({ tipo: "ok", texto: r.ya_estaba ? `El cupón ${r.codigo} ya estaba activo en tu cuenta.` : `Listo, el cupón ${r.codigo} quedó activo en tu cuenta.` });
      setCodigo("");
      await cargar();
    } catch (e: unknown) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo activar el cupón." });
    } finally {
      setActivando(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => void activar(codigo, e)} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="min-w-[200px] flex-1 space-y-1 text-sm">
          <span className="font-medium">Activar un cupón</span>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="El código del email" className="font-mono" autoComplete="off" />
        </label>
        <Button type="submit" disabled={!codigo.trim() || activando !== null}>
          {activando ? "Activando" : "Activar"}
        </Button>
      </form>
      {mensaje && <p className={mensaje.tipo === "ok" ? "rounded-xl bg-secondary p-3 text-sm" : "rounded-xl bg-error-fondo p-3 text-sm text-danger"}>{mensaje.texto}</p>}

      {!cupones ? (
        <p className="text-sm text-muted-foreground">Cargando tus cupones</p>
      ) : cupones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Todavía no tenés cupones. Cuando te llegue uno en el email de una compra, lo activás acá.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cupones.map((c) => {
            const estado = estadoDe(c);
            const vence = fechaDeVencimiento(c.vence_en);
            return (
              <li key={c.codigo} className="space-y-2 rounded-2xl border border-dashed border-foreground/40 bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xl font-bold tracking-[0.12em]">{c.codigo}</span>
                  <Badge variant={estado.variante}>{estado.texto}</Badge>
                </div>
                <p className="text-sm">{describirCupon(c)}.</p>
                {c.categorias.length > 0 && <p className="text-sm text-muted-foreground">Vale para {c.categorias.join(", ")}.</p>}
                <p className="text-xs text-muted-foreground">
                  {vence ? `Vence el ${vence}.` : ""}
                  {c.compra ? ` Llegó con la compra ${c.compra}.` : ""}
                </p>
                {!c.activado && !c.vencido && (
                  <Button size="sm" variant="outline" onClick={() => void activar(c.codigo)} disabled={activando !== null}>
                    {activando === c.codigo ? "Activando" : "Activar"}
                  </Button>
                )}
                {cuponUsable(c) && (
                  <p className="text-xs text-muted-foreground">
                    Cargalo al <Link to="/carrito" className="underline">finalizar la compra</Link>, con la sesión abierta. Es de un solo uso.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
