import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Página de muestra del sistema de diseño (Prisma × Central, tema nocturno).
 * Sirve para revisar colores, tipografía, botones, campos, etiquetas y radios
 * con los tokens reales de src/tema. No se enlaza desde la tienda.
 */

const COLORES: Array<{ nombre: string; clase: string; texto?: string }> = [
  { nombre: "fondo", clase: "bg-background" },
  { nombre: "superficie", clase: "bg-card" },
  { nombre: "superficie-2", clase: "bg-secondary" },
  { nombre: "superficie-3", clase: "bg-accent" },
  { nombre: "borde", clase: "bg-border" },
  { nombre: "borde-control", clase: "bg-input" },
  { nombre: "texto", clase: "bg-foreground", texto: "text-background" },
  { nombre: "texto-secundario", clase: "bg-muted-foreground", texto: "text-background" },
  { nombre: "acento", clase: "bg-primary" },
  { nombre: "acento-hover", clase: "bg-[hsl(var(--primary-hover))]" },
  { nombre: "éxito", clase: "bg-success", texto: "text-success-foreground" },
  { nombre: "error", clase: "bg-danger", texto: "text-danger-foreground" },
  { nombre: "placa-foto", clase: "bg-placa-foto", texto: "text-texto-placa" },
];

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">{titulo}</h2>
      {children}
    </section>
  );
}

export default function SistemaDeDiseno() {
  return (
    <Layout>
      <div className="container mx-auto max-w-5xl space-y-16 px-4 py-12">
        <header className="space-y-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Sistema de diseño</p>
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Nocturno × Prisma</h1>
          <p className="text-muted-foreground">Los colores, las fuentes y los radios de esta página salen de src/tema, generado desde tokens.json.</p>
        </header>

        <Seccion titulo="Colores">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {COLORES.map((c) => (
              <div key={c.nombre} className={`flex h-20 items-end rounded-xl border border-border p-3 ${c.clase}`}>
                <span className={`text-xs font-bold ${c.texto ?? "text-foreground"}`}>{c.nombre}</span>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Tipografía">
          <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
            <p className="font-display text-[64px] font-bold uppercase leading-[62px] tracking-[0.5px]">Subí tu mundo.</p>
            <p className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Tu próxima notebook</p>
            <p className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Notebooks gamer</p>
            <p className="text-[20px] font-bold leading-[26px]">Ficha técnica</p>
            <p className="text-[18px] leading-[28px]">Tecnología para trabajar, crear y jugar.</p>
            <p className="text-base leading-6">Envío a todo el país, al mismo precio en cualquier provincia.</p>
            <p className="text-sm leading-5 text-muted-foreground">Precio final con IVA incluido.</p>
            <p className="text-xs font-bold uppercase leading-4 tracking-[1px]">Nuevo ingreso</p>
            <p className="text-[28px] font-bold leading-8 tabular-nums">$ 1.299.999</p>
          </div>
        </Seccion>

        <Seccion titulo="Botones">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Comprar ahora</Button>
            <Button variant="outline">Agregar al carrito</Button>
            <Button variant="soft">Secundario destacado</Button>
            <Button variant="toolbar">Filtros</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="destructive">Cancelar pedido</Button>
            <Button variant="link">Ver más</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Chico</Button>
            <Button>Normal</Button>
            <Button size="lg">Grande</Button>
            <Button disabled>Sin stock</Button>
          </div>
        </Seccion>

        <Seccion titulo="Campos">
          <div className="grid max-w-md gap-3">
            <Input placeholder="Buscar notebooks, monitores, periféricos" />
            <Input placeholder="Código postal" inputMode="numeric" />
            <Input placeholder="Con error" aria-invalid className="border-danger" />
            <p className="text-sm text-danger">Revisá el código postal: tiene que tener cuatro números.</p>
          </div>
        </Seccion>

        <Seccion titulo="Etiquetas y chips">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Oferta</Badge>
            <Badge variant="success">En stock</Badge>
            <Badge variant="warning">Pocas unidades</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="secondary">Nuevo ingreso</Badge>
            <Badge variant="outline">Gaming</Badge>
            <Badge variant="muted">Sin stock</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {["16 GB", "512 GB SSD", "RTX 4060", "15,6 pulgadas"].map((chip) => (
              <span key={chip} className="rounded-chip bg-secondary px-3 py-1 text-sm font-medium text-foreground">
                {chip}
              </span>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Radios y superficies">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tarjeta, 16 px</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Tarjetas de producto, paneles y cajas de compra.</CardContent>
            </Card>
            <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-card p-6">
              <p className="font-bold">Botones y campos, 12 px</p>
              <p className="text-sm text-muted-foreground">Bloques internos y placas de foto en la tarjeta.</p>
            </div>
            <div className="flex h-full flex-col justify-between rounded-xl bg-placa-foto p-6 text-texto-placa">
              <p className="font-bold">Placa de foto</p>
              <p className="text-sm">Gris Prisma debajo de las fotos de producto.</p>
            </div>
          </div>
        </Seccion>
      </div>
    </Layout>
  );
}
