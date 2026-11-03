import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { MAXIMO_A_COMPARAR, quitarDeComparacion, useComparador, vaciarComparacion } from "@/lib/tienda/comparador";

const SIN_BANDEJA = ["/comparar", "/checkout", "/compra"];

/** La bandeja fija abajo con los productos marcados para comparar, en todas las páginas de la tienda. */
export function BandejaComparador() {
  const lista = useComparador();
  const { pathname } = useLocation();
  if (lista.length === 0 || SIN_BANDEJA.some((ruta) => pathname.startsWith(ruta))) return null;

  const ranuras = Array.from({ length: MAXIMO_A_COMPARAR }, (_, i) => lista[i] ?? null);

  return (
    <aside aria-label="Comparador" className="sticky bottom-0 z-30 border-t border-input bg-card shadow-[0_-16px_40px_rgba(0,0,0,0.45)]">
      <div className="container mx-auto flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <p className="font-display text-[15px] font-bold uppercase tracking-[0.06em]">Comparar</p>
        <ul className="flex min-w-0 flex-[1_1_420px] flex-wrap gap-2.5">
          {ranuras.map((p, i) =>
            p ? (
              <li key={p.id} className="flex h-14 min-w-0 flex-[1_1_180px] items-center gap-2.5 rounded-xl border border-input bg-background px-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-placa-foto">
                  {p.imagen && <img src={p.imagen} alt="" className="h-[34px] w-[34px] object-contain mix-blend-multiply" />}
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{p.nombre}</span>
                <button
                  type="button"
                  onClick={() => quitarDeComparacion(p.id)}
                  aria-label={`Quitar ${p.nombre} de la comparación`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ) : (
              <li key={`vacia-${i}`} className="flex h-14 flex-[1_1_180px] items-center rounded-xl border border-dashed border-input px-3 text-[13px] text-muted-foreground">
                Sumá otro producto
              </li>
            ),
          )}
        </ul>
        <button type="button" onClick={vaciarComparacion} className="h-11 rounded-xl border border-input px-4 text-sm font-bold hover:bg-secondary">
          Limpiar
        </button>
        <Link
          to="/comparar"
          aria-disabled={lista.length < 2}
          className={
            lista.length < 2
              ? "pointer-events-none flex h-11 items-center rounded-xl bg-secondary px-5 text-sm font-bold text-muted-foreground"
              : "flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          }
        >
          Comparar {lista.length} de {MAXIMO_A_COMPARAR}
        </Link>
      </div>
    </aside>
  );
}
