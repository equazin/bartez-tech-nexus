import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  imagenes: string[];
  nombre: string;
}

/** Fotos del producto sobre la placa gris Prisma, con miniaturas si hay más de una. */
export function Galeria({ imagenes, nombre }: Props) {
  const [activa, setActiva] = useState(0);
  const actual = imagenes[activa] ?? imagenes[0];

  if (!actual) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-placa-foto text-sm text-texto-placa">Sin foto</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-2xl bg-placa-foto p-6">
        <img src={actual} alt={nombre} className="h-full w-full object-contain mix-blend-multiply" />
      </div>
      {imagenes.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Más fotos">
          {imagenes.map((url, i) => (
            <li key={url + i} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiva(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === activa}
                className={cn(
                  "h-16 w-16 overflow-hidden rounded-xl border-2 bg-placa-foto p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === activa ? "border-foreground" : "border-transparent hover:border-input",
                )}
              >
                <img src={url} alt="" className="h-full w-full object-contain mix-blend-multiply" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
