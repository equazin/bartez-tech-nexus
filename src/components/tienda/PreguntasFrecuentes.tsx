import { Link } from "react-router-dom";

const PREGUNTAS = [
  {
    pregunta: "¿El envío cuesta lo mismo en todo el país?",
    respuesta: "Sí. La tarifa es nacional: el mismo precio y el mismo plazo en cualquier provincia. Lo ves en el carrito antes de pagar.",
  },
  {
    pregunta: "¿Puedo pagar en cuotas?",
    respuesta: "Sí, con Mercado Pago. Las cuotas disponibles para cada producto figuran debajo del precio. También podés pagar por transferencia bancaria.",
  },
  {
    pregunta: "¿Y si me arrepiento de la compra?",
    respuesta: "Tenés 10 días corridos desde que lo recibís para revocar la compra, sin registrarte, desde el botón de arrepentimiento.",
  },
];

/** Tres preguntas al pie de los listados, con el detalle en la página de ayuda. */
export function PreguntasFrecuentes() {
  return (
    <section aria-label="Preguntas frecuentes" className="container mx-auto flex flex-wrap gap-6 px-4 pt-6">
      <div className="flex flex-[1_1_300px] flex-col gap-2.5">
        <h2 className="font-display text-[26px] font-bold uppercase">Antes de comprar</h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Lo que más nos preguntan. El detalle de envíos, pagos y garantías está en{" "}
          <Link to="/ayuda" className="text-foreground underline">
            la ayuda
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-[2_1_560px] flex-col gap-2">
        {PREGUNTAS.map((p) => (
          <details key={p.pregunta} className="rounded-xl border border-border bg-card px-[18px]">
            <summary className="flex min-h-[52px] cursor-pointer items-center text-[15px] font-bold">{p.pregunta}</summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{p.respuesta}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
