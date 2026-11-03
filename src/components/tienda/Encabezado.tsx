import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCarrito } from "@/lib/tienda/carrito";

function Buscador({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("q") ?? "");

  useEffect(() => {
    setTexto(parametros.get("q") ?? "");
  }, [parametros]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    if (q.length < 2) return;
    navigate(`/buscar?q=${encodeURIComponent(q)}`);
  }

  return (
    <form role="search" onSubmit={enviar} className={className}>
      <label htmlFor="buscador" className="sr-only">
        Buscar productos
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="buscador"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar notebooks, monitores, periféricos"
          className="h-11 pl-9"
          autoComplete="off"
        />
      </div>
    </form>
  );
}

export function Encabezado() {
  const { unidades } = useCarrito();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Teqo, inicio">
          <img src="/marca/teqo-logo-blanco.svg" alt="teqo." className="h-7 w-auto" />
        </Link>

        <Buscador className="hidden flex-1 md:block md:max-w-xl" />

        <nav className="ml-auto flex items-center gap-1" aria-label="Principal">
          <Link
            to="/carrito"
            className="relative inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Carrito</span>
            {unidades > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-chip bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
                {unidades}
              </span>
            )}
          </Link>
        </nav>
      </div>
      <div className="container mx-auto px-4 pb-3 md:hidden">
        <Buscador />
      </div>
    </header>
  );
}
