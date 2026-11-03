import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { guardarTextosLegales, leerTextosLegales } from "@/lib/api/legal";
import type { ContenidoLegal, DatosLegales } from "@/lib/tienda/legal";

const CAMPOS: Array<{ clave: keyof DatosLegales; etiqueta: string }> = [
  { clave: "razon_social", etiqueta: "Razón social o nombre" },
  { clave: "cuit", etiqueta: "CUIT" },
  { clave: "domicilio", etiqueta: "Domicilio legal" },
  { clave: "email", etiqueta: "Email de contacto" },
  { clave: "telefono", etiqueta: "Teléfono (opcional)" },
  { clave: "data_fiscal_url", etiqueta: "Enlace del Data Fiscal de ARCA" },
];

const TEXTOS: Array<{ clave: "texto_terminos" | "texto_privacidad" | "texto_garantias"; etiqueta: string }> = [
  { clave: "texto_terminos", etiqueta: "Términos y condiciones" },
  { clave: "texto_privacidad", etiqueta: "Política de privacidad" },
  { clave: "texto_garantias", etiqueta: "Garantías y cambios" },
];

const CLASE_TEXTAREA = "flex min-h-[220px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Legal › Textos y datos: lo que va en el pie y en las páginas legales. Los textos los redacta un profesional. */
export function TextosLegalesTab() {
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function tomar(c: Partial<ContenidoLegal>) {
    const d = c.datos_legales ?? ({} as Partial<DatosLegales>);
    setDatos(Object.fromEntries(CAMPOS.map(({ clave }) => [clave, d[clave] ?? ""])));
    setTextos(Object.fromEntries(TEXTOS.map(({ clave }) => [clave, typeof c[clave] === "string" ? (c[clave] as string) : ""])));
  }

  useEffect(() => {
    leerTextosLegales()
      .then(tomar)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los textos."))
      .finally(() => setCargando(false));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    try {
      tomar(
        await guardarTextosLegales({
          datos_legales: Object.fromEntries(CAMPOS.map(({ clave }) => [clave, datos[clave]?.trim() || null])) as Partial<DatosLegales>,
          texto_terminos: textos.texto_terminos?.trim() || null,
          texto_privacidad: textos.texto_privacidad?.trim() || null,
          texto_garantias: textos.texto_garantias?.trim() || null,
        }),
      );
      toast.success("Textos y datos guardados");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando los textos</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <form onSubmit={guardar} className="grid max-w-5xl gap-4">
      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Datos del vendedor</h2>
          <p className="mt-1 text-sm text-muted-foreground">Van en el pie de todas las páginas. Mientras falten, la tienda muestra marcadores entre corchetes.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map(({ clave, etiqueta }) => (
            <label key={clave} className="block space-y-1 text-sm">
              <span className="font-medium">{etiqueta}</span>
              <Input value={datos[clave] ?? ""} onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })} />
            </label>
          ))}
        </div>
      </SurfaceCard>

      {TEXTOS.map(({ clave, etiqueta }) => (
        <SurfaceCard key={clave} className="space-y-3">
          <h2 className="text-lg font-bold">{etiqueta}</h2>
          <p className="text-sm text-muted-foreground">Texto plano; un renglón vacío separa párrafos. Lo redacta un profesional.</p>
          <textarea value={textos[clave] ?? ""} onChange={(e) => setTextos({ ...textos, [clave]: e.target.value })} className={CLASE_TEXTAREA} />
        </SurfaceCard>
      ))}

      <div>
        <Button type="submit" disabled={guardando}>
          Guardar textos y datos
        </Button>
      </div>
    </form>
  );
}
