import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, LayoutGrid, Package, Search, ShoppingCart } from "lucide-react";
import { useCarritoDetallado } from "@/lib/tienda/carritoDetallado";
import { encontrarCategoria, listarCategorias, rutaDeCategoria, type CategoriaPublica } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { cn } from "@/lib/utils";

function useCategoriasConProductos(): CategoriaPublica[] {
  const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setCategorias(lista.filter((c) => c.cantidad > 0));
      })
      .catch(() => {
        if (!cancelado) setCategorias([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return categorias;
}

function FranjaDeServicio() {
  return (
    <div className="border-b border-border bg-background">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-1.5 text-[13px]">
        <p className="flex flex-wrap gap-x-5 gap-y-0.5 text-muted-foreground">
          <span>Envío a todo el país, al mismo precio en cualquier provincia</span>
          <span className="hidden sm:inline">Precio final con IVA incluido</span>
        </p>
        <nav aria-label="Ayuda" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/ayuda" className="hover:underline">
            Ayuda
          </Link>
          <Link to="/seguimiento" className="hover:underline">
            Seguí tu compra
          </Link>
          <Link to="/arrepentimiento" className="rounded-chip border border-input px-3 py-0.5 font-bold hover:bg-secondary">
            Botón de arrepentimiento
          </Link>
        </nav>
      </div>
    </div>
  );
}

function Buscador({ categorias, className }: { categorias: CategoriaPublica[]; className?: string }) {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("q") ?? "");
  const [donde, setDonde] = useState(parametros.get("en") ?? "");

  useEffect(() => {
    setTexto(parametros.get("q") ?? "");
    setDonde(parametros.get("en") ?? "");
  }, [parametros]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    if (q.length >= 2) {
      navigate(`/buscar?q=${encodeURIComponent(q)}${donde ? `&en=${encodeURIComponent(donde)}` : ""}`);
    } else if (donde) {
      navigate(`/${donde}`);
    }
  }

  return (
    <form role="search" onSubmit={enviar} className={cn("flex h-12 items-stretch overflow-hidden rounded-xl border border-input bg-background", className)}>
      <label htmlFor="buscar-en" className="sr-only">
        Buscar en
      </label>
      <select
        id="buscar-en"
        value={donde}
        onChange={(e) => setDonde(e.target.value)}
        className="hidden max-w-[11rem] shrink-0 border-r border-border bg-secondary px-3 text-sm text-foreground focus-visible:outline-none sm:block"
      >
        <option value="">Todo</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.nombre}
          </option>
        ))}
      </select>
      <label htmlFor="buscador" className="sr-only">
        Buscar productos
      </label>
      <input
        id="buscador"
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscá por modelo, marca o lo que necesitás"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />
      <button type="submit" aria-label="Buscar" className="flex w-14 shrink-0 items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90">
        <Search className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}

function MenuDeCategorias({ categorias }: { categorias: CategoriaPublica[] }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const alClic = (evento: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) setAbierto(false);
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="static">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="menu-de-categorias"
        className={cn(
          "flex h-12 items-center gap-2.5 rounded-xl border border-border px-4 text-[15px] font-bold transition-colors",
          abierto ? "bg-accent" : "bg-secondary hover:bg-accent",
        )}
      >
        <LayoutGrid className="h-[18px] w-[18px]" aria-hidden />
        <span className="hidden sm:inline">Categorías</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>
      {abierto && (
        <div id="menu-de-categorias" className="absolute inset-x-0 top-full z-50 border-b border-border bg-card shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
          <div className="container mx-auto grid gap-7 px-4 py-7 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {categorias.map((raiz) => {
              const hijas = raiz.hijas.filter((h) => h.cantidad > 0);
              return (
                <div key={raiz.id} className="flex flex-col gap-1">
                  <Link to={`/${raiz.slug}`} className="pb-2 font-display text-[15px] font-bold uppercase tracking-[0.06em] hover:underline">
                    {raiz.nombre}
                  </Link>
                  {hijas.map((hija) => (
                    <Link key={hija.id} to={`/${hija.slug}`} className="flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>{hija.nombre}</span>
                      <span className="tabular-nums text-input">{hija.cantidad}</span>
                    </Link>
                  ))}
                  {hijas.length === 0 && (
                    <Link to={`/${raiz.slug}`} className="flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>Ver todo</span>
                      <span className="tabular-nums text-input">{raiz.cantidad}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AccesoAlCarrito() {
  const { unidades, subtotal } = useCarritoDetallado();
  return (
    <Link
      to="/carrito"
      className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl border border-border bg-background px-3.5 transition-colors hover:bg-secondary"
    >
      <span className="relative flex">
        <ShoppingCart className="h-6 w-6" aria-hidden />
        {unidades > 0 && (
          <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-chip bg-primary px-1 text-xs font-bold tabular-nums text-primary-foreground">
            {unidades}
          </span>
        )}
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-xs text-muted-foreground">Carrito</span>
        <span className="text-sm font-bold tabular-nums">{unidades > 0 && subtotal > 0 ? formatearPesos(subtotal) : "Vacío"}</span>
      </span>
      <span className="sr-only">{unidades === 1 ? "1 producto en el carrito" : `${unidades} productos en el carrito`}</span>
    </Link>
  );
}

function NavegacionPorCategoria({ categorias }: { categorias: CategoriaPublica[] }) {
  const { pathname } = useLocation();
  const raizActual = useMemo(() => {
    const segmento = pathname.split("/").filter(Boolean)[0];
    if (!segmento) return null;
    const nodo = encontrarCategoria(categorias, segmento);
    return nodo ? (rutaDeCategoria(categorias, nodo.id)[0] ?? null) : null;
  }, [categorias, pathname]);

  return (
    <div className="border-t border-border">
      <nav aria-label="Categorías" className="container mx-auto flex items-center justify-between gap-6 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex shrink-0 gap-1">
          {categorias.map((c) => {
            const activa = raizActual?.id === c.id;
            return (
              <li key={c.id}>
                <Link
                  to={`/${c.slug}`}
                  aria-current={activa ? "page" : undefined}
                  className={cn(
                    "flex h-[46px] items-center whitespace-nowrap border-b-[3px] px-3.5 text-[15px] transition-colors",
                    activa ? "border-foreground font-bold" : "border-transparent font-medium hover:border-input",
                  )}
                >
                  {c.nombre}
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="flex shrink-0 gap-1">
          <li>
            <NavLink to="/ofertas" className="flex h-[46px] items-center gap-2 whitespace-nowrap px-3 text-[15px] font-bold">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              Ofertas
            </NavLink>
          </li>
          <li>
            <NavLink to="/nuevos-ingresos" className="flex h-[46px] items-center whitespace-nowrap px-3 text-[15px]">
              Nuevos ingresos
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function Encabezado() {
  const categorias = useCategoriasConProductos();

  return (
    <header className="relative z-40 bg-card">
      <FranjaDeServicio />
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
        <Link to="/" className="flex h-11 shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Teqo, inicio">
          <img src="/marca/teqo-logo-blanco.svg" alt="teqo." className="h-[34px] w-auto" />
        </Link>
        <MenuDeCategorias categorias={categorias} />
        <Buscador categorias={categorias} className="order-last w-full md:order-none md:w-auto md:flex-1" />
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link to="/seguimiento" className="hidden min-h-11 items-center gap-2.5 lg:flex">
            <Package className="h-6 w-6" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span className="text-xs text-muted-foreground">Tu compra</span>
              <span className="text-sm font-bold">Seguila</span>
            </span>
          </Link>
          <AccesoAlCarrito />
        </div>
      </div>
      <NavegacionPorCategoria categorias={categorias} />
      <div className="h-[3px] bg-primary" aria-hidden />
    </header>
  );
}
