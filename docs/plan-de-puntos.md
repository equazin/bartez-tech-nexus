# Plan: Puntos Teqo

Programa de puntos por compras y por eventos, visible en Mi cuenta y administrado desde el panel.
Estado (5/11/2026): programado y prendido con 1 punto cada $ 1.000 y $ 10 por punto (vuelve el 1 %), 10 días de
espera, 12 meses de vencimiento, canje desde 100 puntos, cupón de hasta el 30 % de la compra y 60 días para usarlo.
Bonos en 0. Todo se cambia en Panel › Marketing › Puntos. Base: supabase/migrations/140_programa_de_puntos.sql.
Falta: bases y condiciones, canje por envío gratis y por armado de PC, y aviso por email antes de que venzan.

## Qué hay hoy y se reutiliza

- Cuenta de cliente con ingreso por código al email (sin contraseña) y `tienda_clientes` con los datos de checkout.
- Compras de invitado: los pedidos guardan `comprador_email`, así que los puntos se pueden acreditar al email
  aunque la persona todavía no tenga cuenta (igual que los cupones con `email_destino`).
- Cupones personales: `coupons` con `email_destino`, activación en Mi cuenta, validación en el servidor al
  pagar, devolución del cupón si el pedido se cancela (`devolver_cupon_del_pedido`). El canje de puntos se
  apoya en esto: no hace falta otro camino de descuento en el checkout.
- Estados del pedido: pendiente_pago → pagado → preparando → enviado → entregado, más cancelado, reintegrado y
  vencido. Arrepentimientos en su propia tabla.
- Configuración en `tienda_configuracion` (como `cupon_segunda_compra`) y crons de Vercel para tareas diarias.

## Cómo funciona para el cliente

1. Compra (con cuenta o como invitado). En la ficha, el carrito y el checkout ve "Sumás N puntos con esta compra".
2. Cuando el pedido se entrega, los puntos aparecen como **pendientes**. Se liberan pasado el plazo de
   arrepentimiento (10 días corridos desde la entrega), así una devolución no deja puntos sueltos.
3. En Mi cuenta › Puntos ve: disponibles, pendientes (con la fecha en que se liberan), por vencer y el historial.
4. Canjea: elige cuántos puntos usar y se genera un cupón personal de monto fijo, ya activado en su cuenta,
   que se aplica en el checkout. Si el pedido con ese cupón se cancela, el cupón vuelve y los puntos con él.
5. Recibe por email "Sumaste N puntos" al entregar y un aviso antes de que venzan.

## Reglas (valores en el panel)

| Regla | Propuesta | Valor |
|---|---|---|
| Acumulación | Puntos por cada $ pagado en productos (sin envío, después de descuentos) | [A DEFINIR] |
| Valor del punto al canjear | $ por punto | [A DEFINIR] |
| Espera | Días desde la entrega hasta liberar | 10 (plazo de arrepentimiento) |
| Vencimiento | Meses desde que se liberan | [A DEFINIR], sugerido 12 |
| Mínimo para canjear | Puntos | [A DEFINIR] |
| Tope por compra | % del subtotal que se puede pagar con puntos | [A DEFINIR] |
| Medios de pago | Suman igual con todos | A confirmar |

Referencia para decidir: hoy la ganancia neta ronda el 7 % con transferencia y el 7,5 % con Mercado Pago. Lo
que vuelve en puntos sale de ahí: devolver el 1 % deja la transferencia cerca del 6 %.

## Eventos

Fase 1:
- **Campañas con multiplicador**: "puntos x2" por fechas, y opcionalmente solo en categorías o marcas.
- **Bonos por acciones verificables**: crear la cuenta y completar los datos, primera compra.

Fase 2 (más adelante, necesitan piezas que no existen):
- Referidos (amigo que compra con tu código): hace falta controlar abusos.
- Reseñas de productos: no hay reseñas en la tienda todavía.
- Cumpleaños: haría falta pedir la fecha de nacimiento.

## Datos

- `puntos_movimientos` (libro contable, solo se agrega, nunca se edita): email, tipo (compra, evento, canje,
  reverso, vencimiento, ajuste), puntos (+/−), pedido, evento, cupón, `disponible_desde`, `vence_en`, motivo,
  quién lo hizo (ajustes), fecha. Índice único por (pedido, tipo) y (evento, email) para que nada se acredite
  dos veces.
- `puntos_eventos`: nombre, tipo (multiplicador o bono), valor, desde, hasta, categorías o marcas, activo.
- Configuración `programa_de_puntos` en `tienda_configuracion`. Arranca apagado.
- El saldo sale de sumar los movimientos (vista), nunca de un número guardado aparte.

## Funciones y rutas

- `tienda_acreditar_puntos_de_pedido(order_id)`: la llama el servidor al pasar a entregado. Idempotente.
- `tienda_revertir_puntos_de_pedido(order_id)`: al cancelar, reintegrar o aceptar un arrepentimiento.
- `tienda_canjear_puntos(puntos)`: con la sesión del email confirmado; bloquea el saldo mientras canjea para
  que dos pestañas no gasten los mismos puntos; crea el cupón personal.
- `tienda_mis_puntos()`: saldo e historial de la cuenta.
- Cron diario: libera los pendientes, vence los que corresponden y manda los avisos de vencimiento.
- Panel: `/admin/teqo/puntos` para configuración, eventos, consulta por email y ajustes manuales con motivo.
- Todo se calcula en la base y en el servidor; el navegador solo muestra.

## Pantallas

- **Mi cuenta › Puntos** (pestaña nueva junto a Cupones): saldo grande, pendientes y por vencer, canje e historial.
- **Ficha, carrito y checkout**: la línea "Sumás N puntos".
- **Panel › Marketing › Puntos**: reglas, eventos, buscador de clientes con su historial y ajuste manual.
- **Pedido en el panel**: puntos generados y canjeados en esa compra.
- Antes de programar: maqueta en el lienzo con datos reales para aprobar Mi cuenta › Puntos y el panel.

## Legal y cuentas

- Bases y condiciones del programa: [BASES Y CONDICIONES: A REDACTAR POR UN PROFESIONAL]. Van en Términos y
  en un enlace desde la pestaña de puntos.
- El canje es un descuento en la factura, como los cupones de hoy.
- El tablero estima cuánto hay en puntos sin canjear (deuda con clientes), separado de las ventas.

## Etapas

1. Maqueta y decisiones de la tabla de reglas.
2. Base: tablas, vista de saldo, funciones de acreditar, revertir y canjear, configuración apagada.
3. Servidor: acreditación al entregar, reverso al cancelar o arrepentirse, cron diario, emails.
4. Tienda: pestaña Puntos, línea "Sumás N puntos", canje que crea el cupón.
5. Panel: reglas, eventos, consulta y ajustes.
6. Eventos de la fase 1 y encendido.
