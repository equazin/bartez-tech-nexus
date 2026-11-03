import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Miga {
  nombre: string;
  ruta?: string;
}

export function MigasDePan({ migas }: { migas: Miga[] }) {
  return (
    <nav aria-label="Estás en" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="hover:underline">
            Inicio
          </Link>
        </li>
        {migas.map((miga, i) => (
          <li key={`${miga.nombre}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            {miga.ruta ? (
              <Link to={miga.ruta} className="hover:underline">
                {miga.nombre}
              </Link>
            ) : (
              <span className="text-foreground" aria-current="page">
                {miga.nombre}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
