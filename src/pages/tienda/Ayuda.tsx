import { Link } from "react-router-dom";
import { Tienda } from "@/components/tienda/Tienda";
import { parrafosDe, useContenidoLegal } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-[20px] font-bold leading-[26px]">{titulo}</h2>
      <div className="space-y-2 text-base leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Ayuda() {
  usarSeo("Ayuda", "Envíos, pagos, garantías, cambios y devoluciones en Teqo.");
  const { datos_legales: datos, texto_garantias } = useContenidoLegal();
  const garantias = parrafosDe(texto_garantias);

  return (
    <Tienda>
      <div className="container mx-auto grid gap-10 px-4 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Temas" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 text-sm lg:flex-col">
            {[
              ["envios", "Envíos"],
              ["pagos", "Pagos y cuotas"],
              ["garantias", "Garantías"],
              ["cambios", "Cambios y devoluciones"],
              ["seguimiento", "Seguir mi compra"],
              ["contacto", "Contacto"],
            ].map(([id, nombre]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex h-9 items-center rounded-chip bg-secondary px-3 font-medium hover:bg-accent">
                  {nombre}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Ayuda</h1>

          <Seccion id="envios" titulo="Envíos">
            <p>Mandamos a todo el país, a tu domicilio, al mismo precio en cualquier provincia. El costo depende del peso del pedido y lo ves en el carrito antes de comprar.</p>
            <p>El plazo de entrega se cuenta en días hábiles desde que se acredita el pago. Cuando despachamos te mandamos el número de seguimiento por email.</p>
            <p>No hacemos entregas en el día ni retiro en sucursal.</p>
          </Seccion>

          <Seccion id="pagos" titulo="Pagos y cuotas">
            <p>Todos los precios son finales, con IVA incluido. Pagás con Mercado Pago (tarjeta de crédito en cuotas, débito o dinero en cuenta) o por transferencia bancaria.</p>
            <p>Las cuotas que mostramos salen de Mercado Pago para cada monto, con su costo financiero total efectivo anual (CFTEA) y su tasa efectiva anual (TEA).</p>
            <p>Nunca vemos ni guardamos los datos de tu tarjeta: el pago se hace en Mercado Pago.</p>
          </Seccion>

          <Seccion id="garantias" titulo="Garantías">
            {garantias.length > 0 ? (
              garantias.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <>
                <p>Todos los productos son nuevos, con configuración de fábrica y la garantía legal mínima de 6 meses.</p>
                <p>[PLAZO Y RESPONSABLE DE LA GARANTÍA POR MARCA: A DEFINIR]</p>
              </>
            )}
            <p>
              El texto completo está en <Link to="/garantias" className="underline">Garantías y cambios</Link>.
            </p>
          </Seccion>

          <Seccion id="cambios" titulo="Cambios y devoluciones">
            <p>Podés arrepentirte de la compra dentro de los 10 días corridos desde que la recibiste, sin dar motivos y sin costo para vos, con el botón de arrepentimiento. Te damos un código al instante y te respondemos dentro de las 24 horas.</p>
            <p>
              <Link to="/arrepentimiento" className="underline">Ir al botón de arrepentimiento</Link>
            </p>
          </Seccion>

          <Seccion id="seguimiento" titulo="Seguir mi compra">
            <p>No hace falta cuenta: con el email que usaste y el número de pedido ves el estado, el envío y el seguimiento.</p>
            <p>
              <Link to="/seguimiento" className="underline">Buscar mi compra</Link>
            </p>
          </Seccion>

          <Seccion id="contacto" titulo="Contacto">
            <p>Respondé cualquier email que te mandamos, o escribinos a {datos.email ?? "[EMAIL A CONFIRMAR]"}.</p>
            {datos.telefono && <p>Teléfono: {datos.telefono}</p>}
            <p>
              {datos.razon_social ?? "[RAZÓN SOCIAL]"} · CUIT {datos.cuit ?? "[CUIT]"} · {datos.domicilio ?? "[DOMICILIO LEGAL]"}
            </p>
          </Seccion>
        </div>
      </div>
    </Tienda>
  );
}
