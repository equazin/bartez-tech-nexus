# Plan de redes sociales, contenido y pauta

Fecha: 4 de noviembre de 2026. Estado: propuesta para aprobar. Lo ejecuta una sola persona con herramientas de IA,
sin cara en cámara (manos, producto y voz). Los montos están en pesos, sin IVA, con el dólar BNA de referencia en
$1.570 (cierre del 3/11/2026). Todo lo que falta definir va entre [CORCHETES] y no se publica hasta completarlo.

Este plan sale de mirar la tienda publicada en teqo.com.ar y el código de esta rama. No reemplaza a
`docs/plan-teqo-desde-bartez.md` ni a `docs/plan-pagina-y-contenido.md`: los completa con la parte de afuera de la
tienda (redes, contenido, anuncios, creadores, medición y presupuesto).

---

## 0. Resumen

**La apuesta.** Contenido orgánico frecuente hecho con IA como motor principal, anuncios de remarketing y de
Shopping donde la intención de compra ya existe, y escalar la pauta solo cuando los números lo justifiquen. Teqo
tiene tres cosas que la competencia no comunica bien y que se cuentan muy bien en video corto: el precio final a la
vista, el mismo envío a cualquier provincia y "te decimos cuál comprar y por qué".

**Tres escenarios de presupuesto mensual** (detalle en la sección 7):

| | Arranque | Crecimiento | Escala |
| --- | --- | --- | --- |
| Total por mes | ≈ $1,4 M (USD 890) | ≈ $4 M (USD 2.500) | ≈ $10,5 M (USD 6.700) |
| Pauta | $1,1 M | $3,3 M | $8,5 M |
| Para qué sirve | Aprender, armar públicos, primeras ventas | Prospección rentable en categorías con margen | Volumen, creadores y TikTok en serio |
| Cuándo | Meses 1 a 3 | Cuando se cumplan las reglas de la sección 7 | Idem |

**Antes de gastar un peso en anuncios** (primeros 14 días):

1. Completar los datos legales que hoy se ven como `[RAZÓN SOCIAL] · CUIT [CUIT] · [DOMICILIO LEGAL]` y el email de
   contacto. Sin eso Meta y Google frenan o rechazan cuentas de anunciante, y Defensa del Consumidor lo exige.
2. Definir el plazo de entrega (la ficha dice "A confirmar") y la garantía por marca ("[A DEFINIR]").
3. Instalar la medición: Meta Pixel y Conversions API, GA4 y la etiqueta de Google Ads, con la compra enviada desde
   el webhook firmado de Mercado Pago.
4. Publicar el feed de catálogo para Google Merchant Center y Meta.
5. Abrir las cuentas con el mismo usuario en todas las redes y tener 20 piezas listas antes de la primera
   publicación.

**La decisión más importante: el margen.** Hoy el margen es 5 % sobre el costo con transferencia y 15 % con Mercado
Pago (`supabase/migrations/124_margen_por_medio_de_pago.sql`). Después de la comisión de Mercado Pago y de Ingresos
Brutos, un pedido típico deja entre 1 % y 2 % de la venta. Para que un anuncio se pague solo haría falta vender entre
50 y 100 pesos por cada peso invertido, algo que ninguna cuenta nueva consigue. La sección 8 lo explica con números y
propone subir el margen por categoría (las reglas de precio ya lo permiten) en periféricos, accesorios, sim racing y
redes, que es donde conviene pautar.

---

## 1. Punto de partida

### Lo que ya juega a favor

| Qué | Dónde se ve | Cómo lo usa el marketing |
| --- | --- | --- |
| Precio final con IVA, contado y Mercado Pago lado a lado | Todas las tarjetas y fichas | Mensaje central: "el precio que ves es el que pagás" |
| Transferencia más barata que Mercado Pago (≈ 9 %) | Tarjetas; banner "Con transferencia pagás menos" ya diseñado | Gancho para ofertas sin tocar el precio de lista |
| Envío al mismo precio en cualquier provincia | Franja superior, Ayuda, ficha | Diferencia frente a tiendas que dependen de retiro en sucursal |
| 10 días para arrepentirte, sin registro, con código al instante | Pie, `/arrepentimiento` | Baja el miedo a comprar en una tienda nueva |
| Comparador de hasta tres productos | `/comparar`, bloque en la home | Formato de contenido listo: "tres monitores, lado a lado" |
| Armá tu PC con compatibilidad verificada | `/arma-tu-pc` | Serie de contenido "Armá tu PC con $X" grabando la pantalla |
| Catálogo publicado: 29 notebooks, 393 productos de PC y componentes, 209 periféricos, 17 de sim racing | Home y categorías | Hay producto de sobra para publicar todos los días |
| 26 banners diseñados: Cyber Monday, Hot Sale, Vuelta a clases, Fiestas, Día del Padre y marcas | `public/banners/`, panel › Portadas | Cada campaña ya tiene su portada en la web |
| Cupones con mínimo, tope, vencimiento y límite de usos | `038_coupons_system.sql`, panel › Marketing › Cupones | Un cupón por creador para medir sus ventas |
| Fichas prerenderizadas con og:image y datos estructurados de producto | `scripts/prerender.mjs` | Los links de productos se ven bien en WhatsApp y Google entiende el precio |
| Tracker propio con UTM y gclid | `src/lib/marketingTracker.ts`, tabla `marketing_events` | Base para atribuir ventas a cada canal |

### Lo que hoy frena la pauta

| Brecha | Qué se ve hoy | Impacto | Qué hacer |
| --- | --- | --- | --- |
| Datos legales vacíos | `[RAZÓN SOCIAL] · CUIT [CUIT] · [DOMICILIO LEGAL]`, `[EMAIL A CONFIRMAR]` | Rechazo o revisión de cuentas publicitarias; desconfianza | Completar `datos_legales` desde el panel |
| Plazo de entrega | "Plazo a confirmar" en la ficha | No se puede prometer cuándo llega | Definir plazo por proveedor |
| Garantía por marca | "[PLAZO Y RESPONSABLE DE LA GARANTÍA POR MARCA: A DEFINIR]" | No se puede usar como argumento | Completar la página de garantías |
| Sin medición publicitaria | No hay Pixel, Conversions API, GA4 ni etiqueta de Google Ads; el checkout no manda eventos | La pauta optimiza a ciegas y no se sabe qué vende | Ver sección 11, M2 |
| Sin feed de catálogo | No existe | Sin Shopping ni anuncios dinámicos de catálogo | Ver sección 11, M3 |
| Home sin imagen para compartir | Sin og:image en la portada | El link de teqo.com.ar sale sin imagen en WhatsApp e Instagram | Ver sección 11, M1 |
| Sin redes en el pie, WhatsApp sin número | `src/components/tienda/Pie.tsx` | Quien llega desde redes no puede volver ni consultar | Ver sección 11, M1 y M6 |
| Sin captura de emails ni carrito abandonado | Solo emails de pedido | Se pierde a quien estuvo cerca de comprar | Ver sección 11, M5 |
| `/ofertas` vacía | "Hoy no hay productos en oferta" | El tráfico de eventos (Black Friday) cae en una página vacía | Cargar ofertas antes de cada evento |

---

## 2. Posicionamiento y mensajes

### La promesa

Tecnología elegida, con el precio final a la vista y el mismo envío a cualquier provincia. Firma: **Subí tu mundo.**

### Cinco audiencias

| # | Audiencia | Qué le importa | Categorías | Momento fuerte | Mensaje |
| --- | --- | --- | --- | --- | --- |
| 1 | Gamer de PC que arma o mejora (18 a 34) | Rendimiento por peso, compatibilidad, stock real | Placas de video, procesadores, memorias, monitores para jugar, Armá tu PC | Lanzamientos, Black Friday, Hot Sale | "Más FPS. Menos excusas." |
| 2 | Estudiante y su familia (padres de 35 a 55, estudiantes de 17 a 25) | Que sirva para la carrera, que no falle, saber cuánto sale de verdad | Notebooks para estudiar y trabajar | Vuelta a clases (febrero y marzo) | "La notebook para la facultad, con el precio final a la vista." |
| 3 | Trabajo remoto y creadores (25 a 45) | Comodidad, productividad, buena imagen en las llamadas | Monitores para trabajar, periféricos, webcams, notebooks para crear | Todo el año, Día del Padre | "Tu escritorio, mejor." |
| 4 | Sim racing (25 a 45, ticket alto) | Compatibilidad PC y consola, que alguien entienda del tema | Volantes, pedaleras, cockpits, accesorios | Temporadas de F1 y de juegos de carreras | "Tu cockpit, al mismo precio en cualquier provincia." |
| 5 | Quien vive lejos de las grandes ciudades | No pagar de más por el envío, no depender de un retiro | Todo el catálogo | Todo el año | "El mismo precio y el mismo envío, vivas donde vivas." |

La audiencia 5 no se nombra por lugar: se cuenta el beneficio sin mencionar ninguna ciudad ni provincia.

### Contra quién y en qué nos diferenciamos

Compragamer, FullH4rd, Mexx y las cadenas grandes comunican con cuotas sin interés por banco, carruseles de
promociones y "precio especial". Teqo no compite en eso. Compite en:

- **Claridad:** un precio final con IVA, contado y Mercado Pago a la vista, sin letra chica.
- **Curaduría:** "te decimos cuál comprar y por qué", con el comparador y las guías.
- **Igualdad:** el mismo envío en todo el país.
- **Tranquilidad:** 10 días para arrepentirte sin registrarte; nunca vemos los datos de tu tarjeta.

### Reglas que también valen en redes y anuncios

- Voseo rioplatense. Sin emojis. Sin signos de exclamación en títulos ni en ganchos.
- Nada de "el mejor", "el más barato", "número 1" ni comparaciones que no se puedan probar.
- Precio siempre final con IVA. Si aparece un precio en una pieza, aparece el de transferencia y el de Mercado Pago.
- Ninguna ciudad destacada; nada de entrega en el día, moto ni retiro.
- Nunca ofrecer ampliar memoria o disco: solo configuraciones de fábrica.
- No prometer plazos ni garantías que no estén definidos en la web.
- La falta de emojis es parte de la marca: en un feed lleno de fuegos y cohetes, Teqo se distingue por la tipografía,
  el grafito y el rojo. Los ganchos tienen que ser fuertes con palabras.

---

## 3. Canales

### Rol de cada canal

| Canal | Rol | Formatos | Ritmo para una persona | Prioridad |
| --- | --- | --- | --- | --- |
| Instagram | Vidriera principal y comunidad | Reels, carruseles, historias, canal de difusión | 4 Reels + 2 carruseles por semana; historias todos los días | Alta |
| TikTok | Alcance y descubrimiento | Videos de 15 a 45 s | 5 por semana (los mismos videos con otro gancho y texto) | Alta |
| YouTube Shorts | Alcance y búsqueda dentro de YouTube | Shorts | 5 por semana, reutilizados | Media |
| Facebook | Página necesaria para pautar; público de notebooks de 35 en adelante | Publicación cruzada desde Instagram | Automática | Media (para pauta, alta) |
| WhatsApp Business + Canal | Consulta antes de comprar y avisos a quien se suscribe | Catálogo, respuestas rápidas, canal | Respuestas todos los días; canal 2 veces por semana | Alta |
| Google (Búsqueda, Shopping, YouTube) | Captar a quien ya está buscando | Anuncios | Pauta | Alta |
| Email | Recompra, carrito abandonado, avisos de precio | Automatizaciones | Cuando exista la captura (M5) | Media |
| X | Reservar el usuario; noticias de hardware | Texto | Opcional | Baja |

YouTube con videos largos (comparativas de 8 a 12 minutos), Discord propio y Mercado Libre quedan para después de los
primeros 90 días: cada uno pide más tiempo del que tiene una sola persona al arrancar.

### Alta de cuentas (checklist en el anexo F)

- **Usuario:** el mismo en todas las redes. Propuesta: `@teqo.ar` o `@teqoar` `[USUARIO A CONFIRMAR SEGÚN DISPONIBILIDAD]`.
- **Biografía de Instagram y TikTok** (150 caracteres):
  "Notebooks, gaming, monitores y periféricos. Precio final con IVA. Mismo envío a cualquier provincia. Subí tu mundo."
- **Enlace de la biografía:** `https://teqo.com.ar/?utm_source=instagram&utm_medium=bio` (uno por red).
- **Historias destacadas:** Envíos · Pagos · Arrepentimiento · Armá tu PC · Setups · Novedades.
- **Foto de perfil:** el isotipo de `public/marca/` sobre grafito, sin texto.
- **Meta Business Portfolio** con la página de Facebook, la cuenta de Instagram, la cuenta publicitaria, el píxel,
  el catálogo y WhatsApp Business conectados; dominio teqo.com.ar verificado.

---

## 4. Estrategia de contenido

### Seis pilares

| Pilar | Peso | Qué es | Ejemplos |
| --- | --- | --- | --- |
| Te decimos cuál | 30 % | Ayudar a decidir: comparaciones, presupuestos, qué mirar | "Tres monitores de menos de [PRECIO], lado a lado"; "Qué notebook para cada carrera" |
| Producto en acción | 25 % | El producto en manos, sin cara: unboxing, sonido, detalles | "Así suena el ASUS ROG Falchion Ace 75 HE"; unboxing cenital de los Logitech A30 |
| Armá tu PC | 15 % | Armados por presupuesto y uso, compatibilidad explicada | "Armá tu PC para jugar en 1080p con [PRESUPUESTO]" grabando la pantalla del armador |
| Comunidad y cultura | 15 % | Sim racing, setups de clientes, encuestas, novedades del mundo gamer | "Tu setup en Teqo"; "¿Volante con pedalera o con cambios aparte?" |
| Precio claro y confianza | 10 % | Cómo funciona comprar en Teqo | "Cómo leer un precio en Teqo"; "Qué pasa si te arrepentís"; empaque de un pedido |
| Novedades y ofertas | 5 % | Nuevos ingresos, elegido de la semana, últimas unidades | "Llegó la PowerColor Reaper RX 9070 XT"; "Elegido de la semana" |

En anuncios el peso de ofertas y novedades sube; en orgánico se mantiene bajo para que la cuenta no sea un catálogo.

### Series fijas

Las series crean hábito en quien sigue la cuenta y simplifican la producción: el formato ya está resuelto, solo cambia
el producto.

| Día | Serie | Formato | Duración |
| --- | --- | --- | --- |
| Lunes | ¿Cuál me compro con $X? | Reel o carrusel con tres opciones por presupuesto | 20 a 30 s / 6 a 8 placas |
| Martes | Spec en 30 segundos | Reel con voz: qué es VRAM, Hz, panel IPS o VA, NPU, switches | 25 a 35 s |
| Miércoles | Así suena / Así se ve | Reel ASMR cenital: teclado, mouse, auriculares, cockpit | 10 a 20 s |
| Jueves | Setup por presupuesto | Carrusel con escritorio armado y suma total | 8 placas |
| Viernes | Armá tu PC con $X | Reel con grabación de pantalla del armador y voz | 30 a 45 s |
| Sábado | Comunidad | Encuesta en historias, setup de cliente, sim racing | – |
| Domingo | Elegido de la semana | Historia + publicación conectada con la sección de la home | – |

### Cómo se escribe una pieza

**Gancho** (primer segundo y primera línea): una pregunta concreta o un dato que sorprende, sin signos de
exclamación.
**Desarrollo:** tres datos que importan, en lenguaje simple.
**Precio:** "Con transferencia [PRECIO]. Con Mercado Pago [PRECIO]. Final, con IVA."
**Cierre:** una acción: "Está en teqo.com.ar, link en el perfil" o "Guardalo para cuando armes la tuya".
**Hashtags:** de 3 a 5, específicos (#armatupc #simracing #setupgamer #notebook #placadevideo), nunca listas de 30.

### Banco de ganchos

1. "Con [PRESUPUESTO], esta es la PC que armaríamos para jugar en 1080p."
2. "Tres monitores, mismo precio, una diferencia que se nota."
3. "Si vas a estudiar diseño, mirá esto antes de comprar la notebook."
4. "Esto es lo que significa 144 Hz, en 20 segundos."
5. "IPS o VA: cuál conviene para lo que hacés."
6. "8 GB o 16 GB de memoria en una notebook: depende de esto."
7. "Así suena un teclado de 75 %."
8. "La placa de video que miraríamos con [PRESUPUESTO]."
9. "Lo que nadie te dice de las pedaleras."
10. "El precio que ves es el que pagás. Te mostramos cómo."
11. "Tu escritorio en tres compras."
12. "Antes de comprar una placa de video, revisá la fuente."
13. "Qué mirar en una notebook para la facultad."
14. "Un setup para trabajar desde casa con [PRESUPUESTO]."
15. "Si te arrepentís, esto es lo que pasa."

### Calendario de las primeras cuatro semanas

Antes de empezar (5 al 8 de noviembre): alta de cuentas, 9 publicaciones de grilla para que el perfil no se vea
vacío, 3 de ellas fijadas: "Qué es Teqo", "Cómo comprar en Teqo" y "Armá tu PC".

| Semana | Lunes | Martes | Miércoles | Jueves | Viernes | Sábado / Domingo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (9 al 15/11) | Reel: Qué es Teqo en 20 s | – | Reel: Así suena el Falchion Ace 75 HE | Carrusel: Cómo leer un precio en Teqo | Reel: Armá tu PC con [PRESUPUESTO] | Historias: encuesta "¿Qué armarías?"; Elegido de la semana |
| 2 (16 al 22/11) | Reel: Tres monitores lado a lado (ASUS VA249HG, Cooler Master GA241, AOC 22B2HM2) | Reel: Spec en 30 s, Hz | Reel: Unboxing Logitech A30 | Carrusel: Setup gamer por presupuesto | Reel: RTX 5060 Ti o RX 9070 GRE | Historias: preguntas; Elegido de la semana |
| 3 (23 al 29/11) Black Friday | Reel: Qué mirar antes de comprar en Black Friday | Carrusel: Ofertas de Black Friday por categoría | Reel: Así suena (teclado en oferta) | Historias: cuenta regresiva | Black Friday: Reel + historias cada 4 h + canal de WhatsApp | Recordatorio de cierre; "últimas horas" solo si es cierto |
| 4 (30/11 al 6/12) | Reel: Regalos tech por presupuesto | Reel: Spec en 30 s, IPS o VA | Reel: Volante de la semana (sim racing) | Carrusel: Guía de regalos | Reel: Armá tu PC para regalar | Historias: Elegido de la semana; fecha límite para Fiestas `[FECHA SEGÚN PLAZO DE ENTREGA]` |

Cada Reel sale también en TikTok y YouTube Shorts el mismo día, con el gancho reescrito para cada plataforma.

### 30 ideas listas para producir

Están en el anexo A, con pilar, formato, gancho y qué mostrar.

---

## 5. Producción con IA, sin cara

### Herramientas y costo mensual

Los precios son de referencia (octubre y noviembre de 2026) y cambian seguido: verificalos en la página oficial de
cada una antes de pagar.

| Uso | Herramienta | Plan | USD por mes | Escenario |
| --- | --- | --- | --- | --- |
| Estrategia, calendario, guiones, textos, variantes de anuncios, respuestas | Claude | Pro (Max en Escala) | 20 (100) | Todos |
| Plantillas con kit de marca, quitar fondos, redimensionar | Canva Pro o Adobe Express Premium | Individual | ≈ 10 a 15 | Todos |
| Edición de video, subtítulos automáticos | CapCut Pro (o Descript) | Pro | ≈ 10 a 20 | Todos |
| Voz en off rioplatense fija o clon de la propia voz | ElevenLabs | Starter (Creator desde Crecimiento) | 5 (22) | Todos |
| Animar fotos de producto (imagen a video) | Kling, o Veo dentro de Google AI Pro | Standard o Pro | ≈ 10 a 26 | Todos |
| Escenas e imágenes generadas | Incluido en Canva/Adobe o Google AI Pro | – | 0 a 20 | Crecimiento |
| Programar publicaciones | Meta Business Suite y programador de TikTok | Gratis (Metricool desde Crecimiento) | 0 (≈ 20) | Todos |
| **Total aproximado** | | | **≈ 60 / 140 / 250** | Arranque / Crecimiento / Escala |

### Flujo semanal (10 a 12 horas)

| Día | Tarea | Tiempo | Cómo ayuda la IA |
| --- | --- | --- | --- |
| Lunes | Elegir productos de la semana (nuevos ingresos, stock, margen) y armar el calendario | 1 h | Claude propone el calendario con el prompt maestro (anexo C) |
| Lunes | Guiones y textos de las 6 piezas | 2 h | Claude escribe guiones de 20 s y textos; vos corregís |
| Martes | Grabación: manos y producto en cenital, pantallas del armador y del comparador | 3 h | – |
| Miércoles | Edición, voz, subtítulos, placas | 3 h | ElevenLabs para la voz, CapCut para subtítulos, Canva para placas |
| Miércoles | Programar en las cuatro plataformas | 30 min | – |
| Todos los días | Responder comentarios y mensajes, historias | 20 a 30 min | Claude sugiere respuestas con el tono de marca |
| Viernes | Revisar números de la semana (sección 10) | 45 min | Claude resume y propone qué repetir |

### Cómo se hace cada tipo de pieza

**Placa de producto o carrusel**
1. Foto del producto que manda el mayorista (la misma de la ficha).
2. Quitar el fondo (Canva o Adobe Express).
3. Ponerla sobre una plantilla Teqo: grafito #17191D o gris #E3E4E6, rojo #E80B2A solo en el titular o el precio,
   Chakra Petch en títulos y Space Grotesk en texto.
4. Precio con transferencia y con Mercado Pago, con la leyenda "Precio final con IVA".
5. Cuando exista M4 (sección 11), la tienda genera estas placas sola con el precio del día.

**Reel de producto sin cara**
1. Celular en trípode cenital, fondo grafito, dos luces LED, una luz roja de acento.
2. Tomas cortas: manos que abren la caja, detalle de puertos, el producto funcionando.
3. Voz en off con guion de Claude (propia o de ElevenLabs), subtítulos grandes.
4. Si no hay producto físico: foto del producto animada con Kling o Veo (giro lento de cámara, el producto sin
   cambios) más texto en pantalla.

**Reel de Armá tu PC o del comparador**
1. Grabación de pantalla del armador en el celular o la computadora.
2. Voz en off explicando cada elección y la compatibilidad.
3. Cierre con el total en pantalla (transferencia y Mercado Pago).

### Reglas de uso de IA

- Nunca alterar el producto: ni color, ni puertos, ni luces, ni accesorios que no trae.
- Nunca mostrar funciones, rendimiento o specs que no estén en la ficha del fabricante.
- Nada de reseñas, testimonios, clientes ni avatares que se hagan pasar por personas reales.
- Etiquetar el contenido generado o muy editado con IA cuando la plataforma lo pida (Meta e Instagram muestran
  "Info de IA"; TikTok tiene su etiqueta de contenido generado).
- La voz clonada, solo de quien dio su consentimiento por escrito.

### Equipo para grabar (gasto único)

| Ítem | Costo estimado |
| --- | --- |
| Trípode con brazo cenital | $[PRECIO A COTIZAR] |
| Dos luces LED con difusor y una luz RGB | $[PRECIO A COTIZAR] |
| Micrófono corbatero o de escritorio | $[PRECIO A COTIZAR] |
| Fondo grafito (vinilo o papel) y mousepad grande | $[PRECIO A COTIZAR] |
| **Total orientativo** | **$350.000 a $500.000** |
| Productos para grabar (teclado, mouse, auriculares, mousepad y uno de sim racing) | $800.000 a $1.500.000 al costo; se recupera vendiéndolos `[DECIDIR: OUTLET CON POLÍTICA DE GARANTÍA O USO INTERNO]` |

New Bytes despacha directo al cliente, así que muchos productos nunca pasan por las manos de Teqo: por eso conviene
tener unos pocos productos propios para grabar y usar la animación con IA para el resto.

### Rutina automática con Claude (opcional)

Una tarea programada semanal de Claude Code puede leer el catálogo público (nuevos ingresos, stock, productos con
etiqueta de margen alto) y dejar los lunes a primera hora un borrador del calendario con guiones y textos, listo
para corregir. Ahorra la primera hora del lunes. Se arma cuando el resto del plan esté andando.

---

## 6. Pauta

### Principios

- La creatividad es la segmentación: con públicos amplios, el video correcto encuentra a su comprador. Se prueban
  3 a 5 creatividades nuevas por semana.
- Pocas campañas y bien alimentadas: con poco presupuesto, repartir en muchas campañas impide que aprendan.
- Los precios en anuncios salen del catálogo (anuncios dinámicos), porque cambian con el dólar dos veces por día. Una
  pieza fija con precio dura como máximo el día en que se publica.
- Cuotas: si un anuncio menciona cuotas tiene que informar precio de contado, cantidad y monto de cuotas, TEA y
  CFTEA según la normativa vigente `[NORMATIVA A CONFIRMAR CON ASESOR]`. Lo más simple es que el anuncio diga "Pagá
  con transferencia o con Mercado Pago" y que las cuotas se vean en la web.
- Todo el país como zona: ningún anuncio nombra una ciudad.
- Se pauta en las categorías con margen suficiente (sección 8). Las de margen bajo se mueven con orgánico.

### Meta (Instagram y Facebook)

| Etapa | Campaña | Objetivo y optimización | Público | Creatividades | Reparto en Arranque |
| --- | --- | --- | --- | --- | --- |
| Desde el día 1 | Remarketing de catálogo | Ventas; anuncios dinámicos del catálogo | Visitas de 30 días, carrito de 14 días, sin compradores de 30 días | Catálogo con marco Teqo + 2 videos de confianza (precio claro, arrepentimiento) | $250.000 |
| Desde el día 1 | Ventas, prospección | Ventas optimizadas a "agregar al carrito" o "iniciar pago" hasta tener datos; pasa a "compra" con 25 a 50 compras por semana | Advantage+, todo el país, 18 a 65 | Los mejores Reels orgánicos y 3 a 5 nuevos por semana | $350.000 |
| Desde la semana 2 | Impulso de orgánicos | Interacción o reproducciones | Amplio | El Reel ganador de la semana | $100.000 |
| Escenario Crecimiento | Advantage+ de ventas | Compra | Amplio, con exclusión de compradores recientes | Catálogo + videos + carruseles | Según escenario |

**Reglas de corte:** se apaga un anuncio si gastó dos veces el costo por compra máximo sin vender, o si tiene CTR menor
a 0,8 % después de 3.000 impresiones.
**Reglas de escala:** el conjunto que cumple la meta durante 3 días sube el presupuesto un 20 %, como máximo cada
72 horas, para no reiniciar el aprendizaje.

### Google

| Campaña | Qué busca | Palabras o productos | Reparto en Arranque |
| --- | --- | --- | --- |
| Búsqueda de marca | Que nadie le gane a Teqo su propio nombre | teqo, teqo tienda, teqo.com.ar | $50.000 |
| Búsqueda de intención | Gente que está por comprar | "notebook para la facultad", "notebook para estudiar", "monitor 144hz", "rtx 5060 ti precio", "volante para pc" | $150.000 |
| Performance Max con feed (Shopping) | Mostrar el producto con precio en Google | Productos con etiqueta de margen "a" y "b" | $200.000 |

**Negativas de entrada:** usado, usada, reparación, service, driver, manual, mercadolibre, segunda mano, alquiler,
gratis, pdf.

**Etiquetas del feed:** `custom_label_0` con la letra de margen (a, b, c) sin mostrar costo ni porcentaje,
`custom_label_1` con la categoría madre. Así cada campaña puja solo por lo que le conviene.

YouTube (anuncios de video) entra en Escala, con los mismos videos verticales y versiones horizontales.

### TikTok

Desde el escenario Crecimiento. Se usan Spark Ads: se pauta el video orgánico que ya funcionó, con su cuenta y sus
comentarios. Objetivo de tráfico o de ventas según el volumen del píxel de TikTok (instalarlo en M2).

### Creadores de contenido

| Tipo | Quiénes | Qué hacen | Cómo se paga | Escenario |
| --- | --- | --- | --- | --- |
| Nano (2 a 10 mil seguidores) | Gaming, setups, sim racing, estudiantes de sistemas o diseño | 1 video con el producto | Canje del producto | Arranque |
| Micro (10 a 100 mil) | Tecnología y gaming en Argentina | 1 Reel/TikTok + 3 historias | Canje + fee `[A COTIZAR CON CADA CREADOR]` | Crecimiento |
| Afiliados | Los que mejor funcionaron | Contenido continuo | Comisión por venta con su cupón `[PORCENTAJE A DEFINIR SEGÚN MARGEN]` | Escala |

- Cada creador tiene su cupón (por ejemplo `NOMBRE5`) creado en panel › Marketing › Cupones: así se mide cuánto vende.
- El contenido tiene que decir que es publicidad ("#publicidad" o la etiqueta de colaboración paga de la plataforma).
- Se pide permiso por escrito para usar el video en anuncios durante `[PLAZO A ACORDAR]`.
- Se elige por interacción y por público argentino, no por cantidad de seguidores.
- Brief en el anexo E.

### Calendario comercial

| Fecha | Evento | Qué empujar | Banner listo |
| --- | --- | --- | --- |
| 27 al 30/11/2026 | Black Friday | Periféricos, monitores, sim racing con margen; "Con transferencia pagás menos" | Usar diseño de Cyber Monday adaptado `[DISEÑO A CREAR]` |
| 1 al 24/12/2026 | Fiestas | Regalos por presupuesto; fecha límite de pedido `[FECHA SEGÚN PLAZO]` | Fiestas |
| Hasta el 6/1/2027 | Reyes | Regalos para chicos y adolescentes: auriculares, joysticks, teclados | Fiestas |
| 1/2 al 15/3/2027 | Vuelta a clases | Notebooks por carrera y presupuesto; monitores para estudiar | Vuelta a clases |
| Mayo de 2027 | Hot Sale | Todo el catálogo con margen; placas y procesadores si el margen lo permite | Hot Sale |
| 20/6/2027 | Día del Padre | Monitores, periféricos, sim racing | Día del Padre |
| 15/8/2027 | Día del Niño | Joysticks, consolas, auriculares | `[DISEÑO A CREAR]` |
| 17/10/2027 | Día de la Madre | Notebooks livianas, periféricos para trabajar | `[DISEÑO A CREAR]` |
| Noviembre de 2027 | CyberMonday | Todo el catálogo | Cyber Monday |

Las fechas de Hot Sale y CyberMonday las fija la Cámara Argentina de Comercio Electrónico cada año `[CONFIRMAR]`.
Sumar los lanzamientos de placas y procesadores cuando lleguen al catálogo.

---

## 7. Presupuesto

### Mensual, en pesos, sin IVA

| Concepto | Arranque | Crecimiento | Escala |
| --- | --- | --- | --- |
| Meta Ads | $700.000 | $2.000.000 | $5.000.000 |
| Google Ads | $400.000 | $1.000.000 | $2.500.000 |
| TikTok Ads | – | $300.000 | $1.000.000 |
| Creadores | Canje + $150.000 | $450.000 | $1.000.000 |
| Herramientas de IA | ≈ $100.000 (USD 60) | ≈ $220.000 (USD 140) | ≈ $400.000 (USD 250) |
| Editor de video freelance, medio tiempo | – | – | `[A COTIZAR]`, orientativo $500.000 a $800.000 |
| Pruebas e imprevistos | $50.000 | – | – |
| **Total** | **≈ $1.400.000 (USD 890)** | **≈ $3.970.000 (USD 2.530)** | **≈ $10.400.000 a $10.700.000 (USD 6.600 a 6.800)** |

Además:

- **Gasto único de arranque:** equipo para grabar ($350.000 a $500.000) y productos para grabar ($800.000 a
  $1.500.000, recuperables).
- **Impuestos sobre la pauta:** Meta y Google facturan con IVA del 21 %; si se paga con tarjeta en dólares puede haber
  percepciones adicionales. Conviene pagar en pesos con factura local cuando la plataforma lo permita
  `[CONFIRMAR CON CONTADOR]`.

### Qué se puede esperar (estimación, no promesa)

Supuestos de referencia, a reemplazar con los datos propios en la semana 3:

- CPM de Meta en Argentina: USD 2 a 5 (≈ $3.000 a $8.000).
- CTR de enlace: 0,8 % a 1,5 %. Costo por clic en Google para tecnología: $150 a $600.
- Conversión de una tienda nueva: 0,5 % a 1,2 % de las visitas.
- Ticket promedio: `[A MEDIR]`; para el ejemplo, $450.000.

| | Arranque | Crecimiento | Escala |
| --- | --- | --- | --- |
| Pauta | $1,1 M | $3,3 M | $8,5 M |
| Clics pagos por mes | 2.000 a 4.000 | 6.000 a 11.000 | 15.000 a 26.000 |
| Pedidos atribuidos a la pauta | 15 a 35 | 45 a 100 | 110 a 250 |
| Ventas atribuidas (con ticket de $450.000) | $7 M a $16 M | $20 M a $45 M | $50 M a $112 M |
| ROAS (ventas / pauta) | 6 a 14 | 6 a 14 | 6 a 13 |

Con más presupuesto el rendimiento por peso baja: los primeros compradores son los más fáciles.

### Cuándo pasar de un escenario al siguiente

Se sube de escenario cuando se cumplen las tres durante 4 semanas seguidas:

1. Costo por compra por debajo del máximo de la sección 8 en las categorías pautadas.
2. Conversión de la web de 0,8 % o más.
3. La operación acompaña: stock, despacho dentro del plazo publicado y mensajes respondidos en el día.

Se baja de escenario, o se pausa, si dos semanas seguidas el costo por compra supera el máximo en más de un 30 %.

---

## 8. Economía de la pauta

### Las cuentas

- **Contribución por pedido** = venta sin IVA − costo − comisión de Mercado Pago − Ingresos Brutos − embalaje y otros
  costos del pedido.
- **Costo por compra máximo (CPA máximo)** = contribución por pedido. Si un anuncio cuesta más que eso por venta,
  cada venta hace perder plata.
- **ROAS de equilibrio** = precio final / contribución por pedido.

### Ejemplo con el margen actual

Supuestos ilustrativos: comisión de Mercado Pago 6 % más IVA del precio final `[TARIFA VIGENTE A CONFIRMAR]`;
Ingresos Brutos 3,5 % de la venta sin IVA `[ALÍCUOTA A CONFIRMAR CON CONTADOR]`; envío cobrado aparte a costo.

| | Transferencia (margen 5 %) | Mercado Pago (margen 15 %) | Transferencia con regla de categoría (margen 20 %) |
| --- | --- | --- | --- |
| Precio final | $450.000 | $492.860 (mismo producto) | $450.000 |
| Costo sin IVA | $354.190 | $354.190 | $309.920 |
| Margen bruto | $17.710 | $53.130 | $61.980 |
| Comisión de Mercado Pago | – | −$29.570 | – |
| Ingresos Brutos | −$13.020 | −$14.260 | −$13.020 |
| **Contribución** | **≈ $4.700 (1,0 %)** | **≈ $9.300 (1,9 %)** | **≈ $48.960 (10,9 %)** |
| CPA máximo | $4.700 | $9.300 | $48.960 |
| ROAS de equilibrio | ≈ 96 | ≈ 53 | ≈ 9 |

Con los supuestos de la sección 7 una compra por pauta cuesta entre $30.000 y $75.000. Con el margen actual cada
venta por anuncio pierde plata; con un 20 % en la categoría, la pauta queda cerca del equilibrio en los meses buenos
y el remarketing, que consigue compras más baratas, deja ganancia.

### Qué proponemos

1. **Margen por categoría** con las reglas de precio que ya existen (`pricing_rules`, condición por categoría, se suma
   al margen del medio de pago). Orientativo:
   - Periféricos, accesorios, cables, mousepads, sillas, redes y sim racing: +10 a +20 puntos. Son productos donde la
     gente compara menos y el precio de la competencia suele tener más margen.
   - Monitores y notebooks: +3 a +8 puntos, revisando el precio de la competencia producto por producto.
   - Placas de video y procesadores: quedan competitivos. Se mueven con orgánico, Armá tu PC y Shopping solo si cierran.
   La decisión es de Nico y conviene validarla con 10 productos de cada categoría contra la competencia.
2. **Subir el ticket**: "Completá el setup" ya está en la ficha; sumar envío gratis desde `[MONTO A DEFINIR]`
   (`envio_gratis_desde` en Configuración › Envíos) y empujar el servicio de armado de PC (migración 126), que es casi
   todo margen.
3. **Pautar por categoría**: el feed marca cada producto con a, b o c según su contribución, y la pauta solo puja por a
   y b.
4. **Medir la contribución real**: cada línea de pedido guarda costo y cotización, así que la contribución por
   campaña se puede calcular sin estimar. Revisarla todas las semanas.

---

## 9. Motores de crecimiento

El crecimiento rápido no viene de un anuncio: viene de ciclos que se alimentan solos. Cada venta y cada video tienen
que traer al próximo.

| Ciclo | Cómo gira | Qué hace falta | Cuándo |
| --- | --- | --- | --- |
| Contenido → audiencia → remarketing | Cada Reel suma gente que vio el producto; el remarketing le muestra ese producto con precio; la compra agranda el público parecido | Pixel, catálogo, ritmo de publicación | Desde el día 1 |
| Avisos de precio y recompra | "Avisame si baja" junta emails de gente con intención; los precios se mueven con el dólar, así que siempre hay motivo para volver | M5 | Mes 2 |
| Contenido de clientes | A los 10 días de la entrega se pide la foto del setup con cupón para la próxima compra; las fotos se publican con permiso (serie "Tu setup en Teqo") | M5 + cupones | Mes 2 |
| Referidos | Un cliente comparte su código; el amigo obtiene un beneficio y el cliente también | Desarrollo nuevo (después de M5) | Mes 4 en adelante |
| SEO | Guías "¿Cuál me compro?", comparador y fichas traen tráfico gratis que crece mes a mes | M7 | Mes 2 en adelante |
| Creadores por resultado | Los creadores que venden pasan a comisión con su cupón: se paga solo por lo que se vende | Cupones + margen | Mes 3 en adelante |

**Sorteos:** como máximo uno de nicho en el segundo mes (por ejemplo, un teclado o un mousepad grande), con
participación por comentario sobre su setup, sin pedir etiquetar amigos ni comprar. Lleva bases y condiciones
`[BASES A REDACTAR Y REVISAR CON ASESOR]`. Los sorteos masivos traen seguidores que no compran y empeoran el alcance.

**El límite real:** el alcance puede crecer muy rápido; las ventas las limitan el margen, el stock de los mayoristas,
la caja y la capacidad de atender. El plan sube un escalón por vez para que la operación no se rompa.

---

## 10. Medición

### Métrica norte

**Pedidos pagados por semana y contribución después de pauta.** Todo lo demás sirve para explicar por qué subió o bajó.

### KPIs por etapa

| Etapa | KPI | Meta orientativa a 90 días |
| --- | --- | --- |
| Ritmo | Piezas publicadas / planificadas | 90 % o más |
| Atención | Retención a 3 segundos en Reels | 30 % o más |
| Interés | Guardados + compartidos por cada 1.000 vistas | Subir mes a mes |
| Audiencia | Seguidores en Instagram / TikTok | 2.000 a 6.000 / 3.000 a 15.000 |
| Tráfico | CTR de anuncios / costo por clic | 1 % o más / dentro de la sección 7 |
| Intención | Costo por agregar al carrito | Bajar mes a mes |
| Venta | Conversión de la web, ticket, CPA por categoría | 0,8 % o más; CPA debajo del máximo |
| Retención | Lista de emails y WhatsApp, recompra a 90 días | 500 a 1.500 contactos |

Las metas de audiencia son para medir el ritmo, no son una promesa; se recalibran en la semana 6.

### Revisión semanal (viernes, 45 minutos)

1. Pedidos, ventas y contribución de la semana (panel de la tienda).
2. Por canal: Meta, Google, TikTok, orgánico, creadores (UTM y cupones).
3. Las 3 piezas orgánicas con más guardados y compartidos: se repiten y se pautan.
4. Los anuncios que se apagan y los que suben (reglas de la sección 6).
5. Qué se produce la semana que viene.

### Convención de UTM

```
utm_source   = instagram | tiktok | youtube | facebook | google | whatsapp | email | creador
utm_medium   = organico | pago | bio | historia | canal | cupon
utm_campaign = <evento o serie>-<aaaamm>   (blackfriday-202611, cualmecompro-202611)
utm_content  = <pieza>                      (reel-monitores-3, carrusel-setup-500)
```

El tracker de la tienda (`src/lib/marketingTracker.ts`) ya guarda la primera y la última fuente de cada visita.

---

## 11. Lo que hay que programar en la tienda

Backlog para hacer en orden, una tarea por commit. Respeta las reglas del repositorio: la compra se informa solo desde
el webhook firmado, costo y margen nunca salen por la API pública, secretos solo en variables de entorno.

| # | Qué | Archivos | Para qué |
| --- | --- | --- | --- |
| M1 | Datos legales completos, plazo de entrega, redes sociales en el pie, og:image por defecto (1200×630 con la marca), og:site_name y og:locale | `datos_legales` desde el panel, `src/components/tienda/Pie.tsx`, `index.html`, `scripts/prerender.mjs` | Poder pautar; que los links se vean bien al compartir |
| M2 | Medición: GA4, Meta Pixel, etiqueta de Google Ads y píxel de TikTok cargados por configuración (ids en variables de entorno documentadas en `.env.example`); eventos `view_item`, `add_to_cart`, `begin_checkout`; **la compra se envía desde el webhook firmado de Mercado Pago** (y desde la validación manual de transferencias) por Conversions API de Meta y Measurement Protocol de GA4, con el id del pedido como `event_id` para que el mismo aviso no cuente dos veces | `src/lib/marketingTracker.ts`, `api/_tienda/pagos.ts`, `index.html` (el lugar ya está reservado en la línea 22) | Que la pauta aprenda quién compra |
| M3 | Feed de catálogo para Google Merchant Center y Meta: id, título, descripción, link, imagen, precio final, disponibilidad, marca, código del fabricante, estado nuevo, categoría y etiqueta de margen a, b o c. Sale de la vista pública, sin costo ni porcentaje de margen | Nueva ruta en `api/`, `vercel.json` | Shopping, anuncios dinámicos, catálogo de Instagram y WhatsApp |
| M4 | Placas automáticas para redes (1080×1350 y 1080×1920) con foto, nombre, precio con transferencia y con Mercado Pago y la marca, generadas en el servidor con el precio del día | Nueva ruta en `api/` | Ahorra horas por semana y nunca publica un precio viejo |
| M5 | Captura de email con consentimiento ("Avisame si baja", "Avisame cuando llegue"), email de carrito abandonado y pedido de foto del setup a los 10 días de la entrega | `api/_shared/plantillas.ts`, cron en `vercel.json` | Recompra y contenido de clientes |
| M6 | WhatsApp: número en los datos legales, botón flotante y corregir la variable (`WHATSAPP_API_TOKEN` en el código, `WHATSAPP_TOKEN` en `.env.example`) | `src/components/tienda/SeccionesDelInicio.tsx`, `api/_shared/notifications.ts`, `.env.example` | Consulta antes de comprar |
| M7 | Guías `/guias/<tema>` ("¿Cuál me compro?"), ya previstas en `docs/plan-pagina-y-contenido.md` | `src/pages/tienda` | SEO y material para redes |
| M8 | Decidir qué hacer con las funciones heredadas de Bartez para Google Ads y textos con IA (decisión abierta #10 del plan de Teqo) y con los eventos B2B del tracker | `supabase/functions/*`, `src/components/admin/MarketingTab.tsx` | Que el panel de Marketing sirva para la tienda |

M1, M2 y M3 son necesarios antes de Black Friday si se quiere pautar ese fin de semana. Si no llegan, Black Friday se
hace solo con orgánico, canal de WhatsApp y remarketing por interacción, y la pauta de ventas arranca en Fiestas.

---

## 12. Hoja de ruta

### Fases de los primeros cuatro meses

| Fase | Fechas | Objetivo | Entregables |
| --- | --- | --- | --- |
| 0. Cimientos | 5 al 18/11/2026 | Poder vender, medir y publicar | Datos legales, plazo y garantía; M1, M2, M3; cuentas abiertas y verificadas; 20 piezas listas; 3 publicaciones por semana desde el 9/11 |
| 1. Lanzamiento y Black Friday | 19/11 al 6/12 | Primera prueba real de pauta | Campaña "Abrimos Teqo"; ofertas cargadas en `/ofertas` con margen; Black Friday del 27 al 30/11; primera lectura de costos |
| 2. Fiestas y Reyes | 7/12/2026 al 6/1/2027 | Ventas de regalos | Guía de regalos por presupuesto; fecha límite de pedido; remarketing; primeros 3 creadores con canje |
| 3. Aprendizaje | 7 al 31/1/2027 | Ordenar lo que funcionó | Pruebas de creatividades; M5 y M7; reglas de margen por categoría; decidir escenario |
| 4. Vuelta a clases | 1/2 al 15/3/2027 | El momento más fuerte de notebooks | "Notebook por carrera"; padres en Facebook; búsqueda "notebook para la facultad"; comparativas de notebooks |

### Semana a semana, primeros 90 días

| Semana | Fechas | Orgánico | Pauta | Tienda |
| --- | --- | --- | --- | --- |
| 1 | 5 al 8/11 | Alta de cuentas, 9 publicaciones de grilla | – | Datos legales, plazo, garantía |
| 2 | 9 al 15/11 | 3 Reels + 1 carrusel; series arrancan | Cuentas publicitarias, píxel instalado | M1, M2 |
| 3 | 16 al 22/11 | Ritmo completo (sección 3) | Remarketing por interacción; búsqueda de marca | M3; feed aprobado en Merchant Center |
| 4 | 23 al 29/11 | Black Friday | Remarketing de catálogo, PMax, ventas a "agregar al carrito" | Ofertas cargadas |
| 5 | 30/11 al 6/12 | Regalos por presupuesto | Lectura de datos; apagar lo que no funciona | – |
| 6 | 7 al 13/12 | Guía de regalos | Escalar lo que funcionó un 20 % | Recalibrar metas |
| 7 | 14 al 20/12 | Fecha límite de Fiestas | Recordatorio de fecha límite | – |
| 8 | 21 al 27/12 | Historias de fin de año | Bajar pauta después del 24/12 | – |
| 9 | 28/12 al 3/1 | Reyes | Reyes con remarketing | – |
| 10 | 4 al 10/1 | Retrospectiva del año en historias | Pruebas de 5 creatividades nuevas | M5 |
| 11 | 11 al 17/1 | Contenido de clientes | Pruebas | Reglas de margen por categoría |
| 12 | 18 al 24/1 | Preparar Vuelta a clases: guiones de notebooks | Decidir escenario | M7: primera guía, notebooks para estudiar |
| 13 | 25 al 31/1 | Primeras piezas de notebooks | Públicos de padres y estudiantes listos | Banner Vuelta a clases programado |

### Los siguientes 12 meses

- **Trimestre 1 de 2027:** Vuelta a clases, primeros creadores a comisión, guías SEO.
- **Trimestre 2:** Hot Sale, Día del Padre; referidos; YouTube con comparativas largas si hay tiempo o editor.
- **Trimestre 3:** Día del Niño; afiliados; evaluar Mercado Libre como canal adicional.
- **Trimestre 4:** Día de la Madre, CyberMonday, Black Friday y Fiestas con un año de datos.

---

## 13. Riesgos y cumplimiento

| Riesgo | Qué hacer |
| --- | --- |
| Cuenta publicitaria rechazada o limitada | Datos legales completos, dominio verificado, políticas de envío y devolución visibles antes de pautar |
| Precio desactualizado en una pieza | Anuncios dinámicos de catálogo; las piezas fijas no muestran precio o duran un día |
| Publicidad de cuotas sin la información obligatoria | No mencionar cuotas en anuncios o incluir contado, cantidad, monto, TEA y CFTEA `[NORMATIVA A CONFIRMAR]` |
| Datos personales | Consentimiento explícito para la lista de emails y WhatsApp; baja en un clic; política de privacidad actualizada |
| Creadores sin aviso de publicidad | Cláusula en el acuerdo y control antes de pagar |
| Contenido de IA engañoso | Reglas de la sección 5; etiquetas de cada plataforma |
| "Últimas unidades" o "oferta" que no son ciertas | Solo con el stock y el precio anterior reales que muestra la tienda |
| Dólar que se mueve dos veces por día | Precios desde el catálogo; revisar el feed después de cada sincronización |
| Atender más pedidos de los que se pueden despachar | Subir de escenario solo con las reglas de la sección 7 |
| Que el plan dependa de una sola persona | Calendario y guiones escritos con una semana de anticipación; prompts guardados (anexo C) |

---

## 14. Decisiones para Nico

1. **Margen por categoría** para poder pautar (sección 8). Es la decisión más importante del plan.
2. Usuario en redes y número de WhatsApp Business.
3. Plazo de entrega por proveedor y garantía por marca.
4. Envío gratis desde qué monto, o no.
5. Escenario de arranque y fecha de revisión (propuesta: Arranque hasta el 31/1/2027).
6. Productos para grabar: cuáles comprar y qué hacer con ellos después.
7. Si Black Friday se hace con pauta (requiere M1 a M3 antes del 23/11) o solo con orgánico.

---

## Anexo A. 30 publicaciones listas para producir

Los productos son del catálogo publicado el 4/11/2026. Antes de publicar, revisar stock y poner el precio del día.

| # | Pilar | Formato | Gancho | Qué mostrar |
| --- | --- | --- | --- | --- |
| 1 | Confianza | Reel | "Qué es Teqo, en 20 segundos." | Precio final, envío igual en todo el país, arrepentimiento, transferencia más barata |
| 2 | Confianza | Carrusel | "Cómo leer un precio en Teqo." | Tarjeta de producto con cada parte señalada: transferencia, Mercado Pago, IVA incluido |
| 3 | Producto | Reel ASMR | "Así suena un teclado de 75 %." | ASUS ROG Falchion Ace 75 HE en cenital |
| 4 | Te decimos cuál | Reel | "Tres monitores, mismo rango de precio, una diferencia que se nota." | ASUS VA249HG (IPS, 120 Hz), Cooler Master GA241 (VA, 100 Hz), AOC 22B2HM2 (VA, 100 Hz) en el comparador |
| 5 | Spec en 30 s | Reel | "Esto es lo que significa 144 Hz." | Animación simple de cuadros por segundo; cierre con monitores para jugar |
| 6 | Armá tu PC | Reel | "Con [PRESUPUESTO], esta es la PC que armaríamos para jugar en 1080p." | Grabación de pantalla del armador |
| 7 | Te decimos cuál | Reel | "RTX 5060 Ti o RX 9070 GRE: depende de esto." | ASUS Dual RTX 5060 Ti 8 GB y ASUS Prime RX 9070 GRE 12 GB: memoria, para qué juegos, precio |
| 8 | Producto | Reel | "Unboxing sin palabras." | Auriculares Logitech A30 blancos |
| 9 | Te decimos cuál | Carrusel | "Setup gamer en tres compras." | Monitor para jugar + teclado + auriculares, con suma total |
| 10 | Spec en 30 s | Reel | "IPS o VA: cuál conviene para lo que hacés." | Ángulos de visión y contraste, con los monitores del comparador |
| 11 | Te decimos cuál | Reel | "Qué mirar en una notebook para la facultad." | Procesador, memoria, disco, pantalla; ASUS ExpertBook B1 como ejemplo |
| 12 | Te decimos cuál | Carrusel | "Notebook por carrera." | Sistemas, diseño, administración, ingeniería: qué pide cada una y una opción del catálogo |
| 13 | Spec en 30 s | Reel | "Qué es una NPU y si te sirve." | ASUS ExpertBook P3 con Ryzen AI 5 330 (NPU de 50 TOPS, según ficha) |
| 14 | Armá tu PC | Reel | "Antes de comprar una placa de video, revisá la fuente." | El armador avisando potencia; categoría Fuentes |
| 15 | Producto | Reel | "La PowerColor Reaper RX 9070 XT, de cerca." | Foto animada con IA, sin alterar el producto; 16 GB GDDR6 |
| 16 | Comunidad | Historias | "¿Volante con pedalera o con cambios aparte?" | Encuesta; después, Reel con la respuesta |
| 17 | Producto | Reel | "Lo que nadie te dice de los cockpits." | Accesorios Thermaltake de sim racing: base, mejora de pedales |
| 18 | Te decimos cuál | Reel | "Auriculares inalámbricos para jugar, en tres precios." | Razer BlackShark V3 X, Corsair HS65, Logitech G735 |
| 19 | Confianza | Reel | "Si te arrepentís, esto es lo que pasa." | Botón de arrepentimiento en pantalla, código al instante, 10 días |
| 20 | Confianza | Reel | "El mismo precio y el mismo envío, vivas donde vivas." | Mapa del país sin ninguna ciudad marcada; costo por peso en el carrito |
| 21 | Te decimos cuál | Carrusel | "Monitor para trabajar desde casa: qué mirar." | Tamaño, resolución, soporte; monitores para trabajar y estudiar |
| 22 | Producto | Reel ASMR | "Así se carga un mouse sin cables." | Razer Mouse Dock Pro |
| 23 | Armá tu PC | Carrusel | "Tres PCs por presupuesto." | Tres armados del armador, con total de cada uno |
| 24 | Novedades | Reel | "Llegó a Teqo." | Nuevos ingresos de la semana |
| 25 | Comunidad | Carrusel | "Tu setup en Teqo." | Fotos de clientes con permiso (desde el mes 2) |
| 26 | Te decimos cuál | Reel | "Notebook gamer o PC: qué conviene con el mismo presupuesto." | Lenovo LOQ con RTX 3050 frente a un armado del armador |
| 27 | Spec en 30 s | Reel | "8 GB o 16 GB en una notebook: depende de esto." | Uso real; recordatorio: configuraciones de fábrica |
| 28 | Producto | Reel | "Escritorio antes y después." | Setup armado con productos del catálogo, en cenital |
| 29 | Ofertas | Historias + Reel | "Con transferencia pagás menos." | Mismo producto, dos precios, por qué |
| 30 | Comunidad | Reel | "Elegido de la semana." | El producto de la sección de la home y por qué lo elegimos |

## Anexo B. Calendario de cuatro semanas

Está en la sección 4. Se repite el esquema de series fijas y se cambian los productos según stock, novedades y
margen.

## Anexo C. Prompts de IA

Guardar el prompt 1 como instrucciones de un Proyecto de Claude; los demás se usan dentro de ese proyecto.

**1. Voz de marca (instrucciones del proyecto)**

```
Sos el equipo de contenido de Teqo, tienda online de notebooks, gaming, monitores, periféricos,
componentes y sim racing para toda la Argentina. Firma: "Subí tu mundo."
Escribís en español rioplatense con voseo. Reglas que no se rompen:
- Sin emojis. Sin signos de exclamación en títulos ni ganchos.
- Sin superlativos que no se puedan probar ("el mejor", "el más barato", "número 1").
- Precio siempre final con IVA; si das un precio, das el de transferencia y el de Mercado Pago.
  Si no te paso el precio, escribí [PRECIO].
- No nombrás ninguna ciudad ni provincia. El envío es el mismo en todo el país.
- No prometés plazos de entrega ni garantías que no te pase.
- No ofrecés ampliar memoria o disco: solo configuraciones de fábrica.
- No inventás especificaciones: usás solo los datos de la ficha que te paso.
Tono: claro, cercano, de alguien que sabe y te ayuda a decidir. Frases cortas.
Promesa: te decimos cuál comprar y por qué, con el precio final a la vista.
```

**2. Calendario de la semana**

```
Con estos productos de la semana [PEGAR NOMBRE, FICHA, PRECIOS Y STOCK], armá el calendario de
lunes a domingo siguiendo las series fijas: ¿Cuál me compro con $X?, Spec en 30 segundos, Así suena,
Setup por presupuesto, Armá tu PC con $X, Comunidad, Elegido de la semana. Para cada día: formato,
gancho, guion o placas, texto de la publicación con 3 a 5 hashtags y llamado a la acción.
```

**3. Guion de Reel de 20 segundos sin cara**

```
Escribí el guion de un Reel de 20 segundos sobre [PRODUCTO] con esta ficha [FICHA].
Formato: tabla con segundos, toma (manos, producto, pantalla), texto en pantalla y voz en off.
Primer segundo: gancho sin signos de exclamación. Tres datos que importan. Cierre con precio
(transferencia y Mercado Pago, final con IVA) y "link en el perfil". Máximo 55 palabras de voz.
```

**4. Carrusel de comparación**

```
Armá un carrusel de 7 placas que compare [PRODUCTO A], [PRODUCTO B] y [PRODUCTO C] con estas fichas
[FICHAS]. Placa 1: gancho. Placas 2 a 5: una diferencia por placa, explicada simple. Placa 6: para
quién es cada uno. Placa 7: precios y dónde verlos. Máximo 25 palabras por placa.
```

**5. Variantes de anuncios**

```
Escribí 10 variantes de anuncio para Meta sobre [CATEGORÍA O PRODUCTO] para la audiencia
[AUDIENCIA]. Cada una: texto principal (máximo 125 caracteres), título (máximo 40) y descripción
(máximo 30). Ángulos: precio claro, envío igual en todo el país, te decimos cuál, transferencia más
barata, arrepentimiento. Respetá todas las reglas de marca.
Además, 15 títulos de 30 caracteres y 4 descripciones de 90 para un anuncio de búsqueda de Google.
```

**6. Respuestas a comentarios y mensajes**

```
Respondé este comentario o mensaje [PEGAR] con el tono de Teqo. Si pregunta precio, mandalo a la ficha
con el link. Si pregunta plazo o garantía, usá solo esto [DATOS DE AYUDA]. Si es una queja, pedí el
número de pedido por mensaje privado. Máximo 2 frases.
```

**7. Escena para foto de producto (Canva, Adobe o Gemini)**

```
Escritorio de madera oscura, fondo grafito liso, luz suave lateral y un acento de luz roja detrás,
estilo fotografía de producto, sin texto, sin logos, sin personas, espacio libre al centro para
ubicar el producto.
```

**8. Animación de foto de producto (Kling o Veo)**

```
Giro lento de cámara alrededor del producto, el producto no cambia de forma, color ni detalles, fondo
grafito liso, luz de borde roja sutil, sin texto, sin personas, 5 segundos.
```

## Anexo D. Textos de anuncio de ejemplo

| # | Audiencia | Título | Texto principal |
| --- | --- | --- | --- |
| 1 | Estudiantes | Notebooks para estudiar | Configuraciones de fábrica con el precio final a la vista. Mismo envío a cualquier provincia y 10 días para arrepentirte. |
| 2 | Padres | La notebook para la facultad | Te decimos cuál conviene para cada carrera. Precio final con IVA, sin letra chica. |
| 3 | Gamers | Más FPS. Menos excusas. | Placas de video RTX y Radeon con precio final. Con transferencia pagás menos. |
| 4 | Gamers | Armá tu PC compatible | Elegí pieza por pieza y te mostramos solo lo que es compatible: socket, memoria, formato y potencia. |
| 5 | Sim racing | Tu cockpit, a cualquier provincia | Volantes, pedaleras y cockpits con precio final y el mismo envío en todo el país. |
| 6 | Remarketing | Lo que estabas mirando | Sigue en Teqo, con precio final e IVA incluido. Pagá con transferencia o con Mercado Pago. |
| 7 | Todo el país | Vivas donde vivas | El mismo precio y el mismo envío en cualquier provincia. Notebooks, monitores, periféricos y componentes. |
| 8 | Ofertas | Con transferencia pagás menos | Mismo producto, mismo envío y un precio final más bajo si pagás por transferencia. |
| 9 | Regalos | Regalos tech por presupuesto | Auriculares, teclados, mouse y joysticks con precio final. Pedí antes del [FECHA] para que llegue a tiempo. |
| 10 | Trabajo remoto | Tu escritorio, mejor | Monitores para trabajar y estudiar con el precio final a la vista. |

**Títulos para Google (30 caracteres):** Notebooks con precio final · Envío igual a todo el país · Con transferencia pagás menos ·
10 días para arrepentirte · Armá tu PC compatible · Placas de video RTX y Radeon · Monitores para jugar · Precio final con IVA ·
Notebooks para estudiar · Pagá con Mercado Pago.

**Descripciones para Google (90 caracteres):**
- Precio final con IVA y el mismo envío a cualquier provincia. Elegí por uso y presupuesto.
- Configuraciones de fábrica. Pagá con transferencia o Mercado Pago. 10 días para arrepentirte.

## Anexo E. Brief para creadores

```
Marca: Teqo, tienda online de tecnología para toda la Argentina. Subí tu mundo.
Producto: [PRODUCTO], te lo enviamos [CANJE / PRÉSTAMO].
Qué buscamos: un video vertical de 20 a 45 segundos mostrando el producto en tu setup y para qué lo
usás de verdad. Tu opinión es tuya: no pedimos que digas que es el mejor.
Tiene que aparecer: que lo compraste o lo recibiste de Teqo, el precio final con IVA del día o
"precio final en teqo.com.ar", y tu cupón [CUPÓN].
No puede aparecer: emojis en el texto del video, nombres de ciudades como diferencial, promesas de
plazos de entrega, comparaciones con otras tiendas.
Aviso obligatorio: #publicidad o la etiqueta de colaboración paga.
Uso en anuncios: Teqo puede usar el video en anuncios durante [PLAZO].
Entrega: borrador para revisar antes de publicar, hasta el [FECHA].
Pago: [CANJE / FEE / COMISIÓN DEL X % SOBRE VENTAS CON TU CUPÓN].
```

## Anexo F. Checklist de cuentas y verificaciones

- [ ] Usuario disponible en Instagram, TikTok, YouTube, Facebook y X.
- [ ] Instagram como cuenta de empresa, conectada a la página de Facebook.
- [ ] Meta Business Portfolio con dos administradores (cuenta de respaldo).
- [ ] Dominio teqo.com.ar verificado en Meta.
- [ ] Cuenta publicitaria de Meta en pesos, con datos fiscales y método de pago.
- [ ] Pixel y Conversions API funcionando, probados con el administrador de eventos.
- [ ] Catálogo en Commerce Manager conectado al feed.
- [ ] WhatsApp Business con catálogo, respuestas rápidas, mensaje de ausencia y canal.
- [ ] Google Merchant Center con el feed aprobado, envíos y devoluciones configurados.
- [ ] Google Ads vinculado a Merchant Center y a GA4, con conversión de compra importada.
- [ ] GA4 con eventos de comercio electrónico y la tienda como flujo web.
- [ ] TikTok Business con píxel (desde Crecimiento).
- [ ] Doble factor activado en todas las cuentas.
- [ ] Enlaces de biografía con UTM.

## Anexo G. Fuentes consultadas

Cotización y calendario:
- [Dólar oficial BNA, 3/11/2026 (El Destape)](https://www.eldestapeweb.com/economia/precio-del-dolar-hoy-y-dolar-blue-hoy-en-vivo-cual-es-su-cotizacion-este-martes-3-de-noviembre-20261133010)
- [Dólar oficial BNA, 3/11/2026 (Diario Río Negro)](https://www.rionegro.com.ar/economia/dolar-oficial-hoy-a-cuanto-cerro-en-banco-nacion-este-martes-3-de-noviembre-2026-y-que-proyecta-el-mercado-4783389/)
- [CyberMonday 2026: del 2 al 4 de noviembre (Noticias NQN)](https://www.noticiasnqn.com.ar/noticias/2026/10/28/358518-cybermonday-2026-en-argentina-tres-dias-de-ofertas-cuotas-y-descuentos-desde-el-2-de-noviembre)
- [CyberMonday 2026 (iProfesional)](https://www.iprofesional.com/actualidad/467835-cybermonday-2026-cuando-es-que-marcas-participan-y-como-aprovechar-las-ofertas)

Costos de pauta (referencias en dólares, a validar con la cuenta propia):
- [Meta Ads CPM por país 2026 (Adligator)](https://adligator.com/blog/meta-ads-cpm-by-country-benchmarks)
- [Meta Ads CPM y CPC por país 2026 (Adamigo)](https://www.adamigo.ai/blog/meta-ads-cpm-cpc-benchmarks-by-country-2026)
- [Benchmarks de Meta Ads para ecommerce 2026 (MHI Growth Engine)](https://mhigrowthengine.com/blog/meta-ads-benchmarks-ecommerce-2026/)
- [Cargos operativos en cuentas de Google Ads en pesos (Ayuda de Google Ads)](https://support.google.com/google-ads/answer/13585789?hl=es-419)
- [Cómo pagar Meta Ads en Argentina (Tributo Simple)](https://tributosimple.com/como-conviene-pagar-meta-ads-en-argentina-tarjeta-vs-linea-de-credito-local/)
- [Google Shopping en Argentina 2026 (MKT Marketing Digital)](https://mktmarketingdigital.com/google-shopping-ecommerce-argentino-2026/)
- [Registro de cambios de Merchant Center (Ayuda de Google)](https://support.google.com/merchants/announcements/6192467?hl=es)

Herramientas de IA (precios cambian seguido):
- [Planes de video con IA 2026 (Higgsfield)](https://higgsfield.ai/blog/top-tier-ai-video-plans-filmmakers-2026)
- [Generadores de video con IA, costo por segundo (SaaS CRM Review)](https://saascrmreview.com/best-ai-video-generators/)
- [Generadores de video con IA 2026 (Pickaxe)](https://pickaxe.co/post/top-ai-video-generators)

Creadores:
- [Tarifas de influencers en TikTok 2026 (Influee)](https://influee.co/ar/blog/tiktok-influencer-rates)
- [Precios de influencers en Instagram 2026 (Influee)](https://influee.co/ar/blog/instagram-influencer-pricing)
- [Tarifas de microinfluencers 2026 (Influencer Marketing Hub)](https://influencermarketinghub.com/micro-influencer-rates/)

Competencia:
- [FullH4rd (Cultura Geek)](https://culturageek.com.ar/full-h4rd-tienda-tecno-gamer/)
- [Mexx, cuotas y promociones (Cultura Geek)](https://culturageek.com.ar/mexx-celebra-dia-del-padre-12-cuotas-sin-interes/)
