import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  imagenes: string[];
  nombre: string;
}

/** Foto grande sobre la placa gris y, si hay más de una, miniaturas debajo. */
export function Galeria({ imagenes, nombre }: Props) {
  const [activa, setActiva] = useState(0);
  const actual = imagenes[activa] ?? imagenes[0];

  if (!actual) {
    return <div className="flex h-[clamp(320px,42vw,540px)] items-center justify-center rounded-2xl bg-placa-foto text-sm text-texto-placa">Sin foto</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <a
        href={actual}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver la foto en tamaño completo"
        className="flex h-[clamp(320px,42vw,540px)] items-center justify-center rounded-2xl bg-placa-foto p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foco-placa))]"
      >
        <img src={actual} alt={nombre} className="max-h-full max-w-[86%] object-contain mix-blend-multiply" />
      </a>
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
    </div>
  );
}
