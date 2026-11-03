import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  imagenes: string[];
  nombre: string;
}

/**
 * Foto grande sobre la placa gris y, si hay más de una, miniaturas debajo. Al tocar la foto se amplía
 * en la misma página: un enlace directo a la imagen la descarga, porque el mayorista la sirve así.
 */
export function Galeria({ imagenes, nombre }: Props) {
  const [activa, setActiva] = useState(0);
  const [ampliada, setAmpliada] = useState(false);
  const actual = imagenes[activa] ?? imagenes[0];

  if (!actual) {
    return <div className="flex h-[clamp(320px,42vw,540px)] items-center justify-center rounded-2xl bg-placa-foto text-sm text-texto-placa">Sin foto</div>;
  }

  const mover = (paso: number) => setActiva((i) => (i + paso + imagenes.length) % imagenes.length);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label="Ver la foto más grande"
        className="flex h-[clamp(320px,42vw,540px)] cursor-zoom-in items-center justify-center rounded-2xl bg-placa-foto p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foco-placa))]"
      >
        <img src={actual} alt={nombre} className="max-h-full max-w-[86%] object-contain mix-blend-multiply" />
      </button>
      {imagenes.length > 1 && (
        <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-5" aria-label="Más fotos">
          {imagenes.map((url, i) => (
            <li key={url + i}>
              <button
                type="button"
                onClick={() => setActiva(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === activa}
                className={cn(
                  "flex h-[92px] w-full items-center justify-center rounded-xl border-2 bg-placa-foto p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === activa ? "border-foreground" : "border-transparent hover:border-input",
                )}
              >
                <img src={url} alt="" className="max-h-full max-w-[80%] object-contain mix-blend-multiply" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className="max-w-[min(1100px,94vw)] border-0 bg-placa-foto p-4 sm:p-8">
          <DialogTitle className="sr-only">{nombre}</DialogTitle>
          <div className="relative flex h-[min(78vh,760px)] items-center justify-center">
            <img src={actual} alt={nombre} className="max-h-full max-w-full object-contain mix-blend-multiply" />
            {imagenes.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Foto anterior"
                  className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-md hover:bg-secondary"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Foto siguiente"
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-md hover:bg-secondary"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            )}
          </div>
          {imagenes.length > 1 && (
            <p className="text-center text-sm text-texto-placa">
              {activa + 1} de {imagenes.length}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
