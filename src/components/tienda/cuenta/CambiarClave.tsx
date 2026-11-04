import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLAVE_MINIMA, cambiarClave } from "@/lib/tienda/cuenta";

/**
 * Elegir o cambiar la contraseña con la sesión abierta. Se llega acá desde el enlace de "Olvidé mi contraseña"
 * (recuperando) o desde la pestaña Contraseña; también sirve para que quien entra con Google sume una contraseña.
 */
export function CambiarClave({ recuperando }: { recuperando: boolean }) {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (clave.length < CLAVE_MINIMA) {
      setError(`La contraseña tiene que tener al menos ${CLAVE_MINIMA} caracteres.`);
      return;
    }
    if (clave !== repetida) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setTrabajando(true);
    try {
      await cambiarClave(clave);
      setLista(true);
      setClave("");
      setRepetida("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la contraseña.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{recuperando ? "Elegí tu contraseña nueva" : "Contraseña"}</h2>
        <p className="text-sm text-muted-foreground">
          {recuperando
            ? "Ya entraste con el enlace del email. Elegí la contraseña para las próximas veces."
            : "Cambiá tu contraseña, o creá una si entrás con Google y querés poder entrar también con tu email."}
        </p>
      </div>
      <form onSubmit={guardar} noValidate className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Contraseña nueva</span>
          <Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />
          <span className="block text-xs text-muted-foreground">Al menos {CLAVE_MINIMA} caracteres.</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Repetila</span>
          <Input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" />
        </label>
        <Button type="submit" disabled={trabajando}>
          {trabajando ? "Guardando" : "Guardar contraseña"}
        </Button>
      </form>
      {lista && <p className="rounded-xl bg-exito-fondo p-3 text-sm">Listo, la contraseña quedó guardada.</p>}
      {error && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
