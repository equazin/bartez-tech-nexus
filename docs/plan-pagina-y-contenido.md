# Plan: página principal, categorías y contenido de la tienda

Fecha: 3 de noviembre de 2026. Estado: la tienda está publicada en https://teqo-tienda.vercel.app con la base vacía.
La página principal muestra solo lo que no depende de datos (portada y franja de confianza); el resto de los
bloques existe en código pero no tiene con qué llenarse.

Este plan dice qué mostrar, cómo organizar las categorías y qué contenido hace falta, tomando lo que sirve de
cinco tiendas de referencia y descartando lo que choca con las reglas de Teqo. Manda la maqueta aprobada
(Nocturno × Prisma, `design/maquetas/propuestas/06-nocturno-prisma/` en equazin/teqo) y el plan de marca
(`docs/plan-de-marca.md`): catálogo curado de 50 a 80 productos, "te decimos cuál comprar y por qué".

## 1. Qué hacen las tiendas que miramos

Relevadas en vivo el 3/11/2026: Compragamer, FullH4rd y GoldenTech Store. PcComponentes y Micro Center bloquean
la navegación automatizada; lo que se dice de ellas sale de conocimiento previo, no de una visita, y conviene
verificarlo a mano antes de copiar algo puntual.

| Tienda | Qué muestra en la portada | Categorías | Precio y pago | Confianza | Tomamos | Dejamos |
| --- | --- | --- | --- | --- | --- | --- |
| **Compragamer** (AR) | Carrusel de promociones bancarias (cuotas sin interés por banco, "sin tarjeta") | Menú corto: Notebooks, PCs armadas, Armá tu PC, Outlet, Ayuda, Posventa | Precio especial por efectivo o transferencia y precio de lista | Página "Por qué comprar", "Promociones vigentes", "Garantía con la marca", botón de arrepentimiento en el pie, posventa con seguimiento | "Por qué comprar" y "Promociones vigentes" como páginas vivas; posventa con número de caso | Quince banners de bancos como portada; dos precios por producto; armador de PC |
| **FullH4rd** (AR) | "¿Qué estás buscando?" con diez subcategorías, grilla de ofertas, bloques PC a medida y PC armadas, destacados, marcas, reseñas de Google | Mega menú por tipo de producto con dos niveles (Hardware › Placas de video › NVIDIA) | "Precio especial" (efectivo y transferencia), promociones por día de la semana solo presenciales, hasta 24 cuotas | Etiqueta "despacho en 24 hs" en la tarjeta, reseñas de Google con nombre, libro de quejas, "¿Cómo comprar?", preguntas frecuentes | Subcategorías a un clic desde la portada; etiqueta de despacho; bloque de marcas; reseñas reales; "¿Cómo comprar?" | Nombres de producto en mayúsculas copiados del mayorista; "la tienda gamer #1"; promociones presenciales; empresas |
| **GoldenTech Store** (AR, CABA) | Categorías destacadas, "Los más buscados", "Novedades", armador de PC, "Ofertas" con precio anterior tachado, reseñas | Árbol WooCommerce clásico: Componentes, Computadoras, Conectividad, Periféricos, Accesorios | Un precio; en ofertas, precio anterior tachado; "envío gratis" en algunos | "Entrega inmediata" y "Disponible 24-48 hs" en cada tarjeta, 577 reseñas, dirección física | Disponibilidad en la tarjeta con tres estados; "Novedades"; ofertas con precio anterior | SKU en la tarjeta; aviso de cookies que tapa la portada; dirección y retiro |
| **PcComponentes** (ES, de memoria) | Categorías profundas con filtros por especificación, fichas con reseñas y preguntas, outlet y reacondicionados, guías de compra, comparador | Árbol profundo y filtros facetados por atributos reales (pulgadas, Hz, panel) | Precio único con financiación visible; envío en 24 hs | Reseñas verificadas, preguntas y respuestas en la ficha, "ventajas" en una franja | Filtros por atributos reales; comparador; guías de compra; preguntas en la ficha; outlet con garantía clara | Profundidad de catálogo (nosotros curamos); marca propia |
| **Micro Center** (EE. UU., de memoria) | Armador de PC, combos procesador + placa madre, "open box", artículos "cómo elegir", precios en tienda | Hardware exhaustivo | Precio en tienda vs. online | Especificaciones exhaustivas y normalizadas, reseñas verificadas, contenido educativo | Especificaciones normalizadas por categoría; contenido educativo corto; "abierto de caja" como outlet | Todo lo que depende de sucursal: retiro, precio en tienda, stock por local |

Lo que las tres argentinas tienen en común y Teqo todavía no: disponibilidad visible en la tarjeta, reseñas
reales, marcas como bloque, y páginas de ayuda concretas ("Cómo comprar", "Envíos", "Garantía").

## 2. Qué no copiamos, por regla

- Un solo precio final con IVA, mostrado como contado (transferencia) y en cuotas con Mercado Pago. Nada de
  "precio especial" ni "precio de lista" ambiguos.
- Nada de ampliaciones de memoria o disco en las notebooks: solo configuraciones de fábrica. El armador de PC sí
  va, por decisión de Nico del 3/11/2026 (Armá tu PC, con componentes sueltos y compatibilidad verificada).
- Nada de sucursal, retiro, entrega en el día ni ciudad destacada: el envío es el mismo en todo el país.
- Sin superlativos que no se puedan probar ("la tienda #1"), sin signos de exclamación en títulos, sin
  mayúsculas gritadas en nombres de producto.
- Sin carrusel de bancos en la portada: las promociones vigentes van en una página "Pagá como quieras" que
  lee las cuotas reales de Mercado Pago (ya existe el recurso `cuotas` en la API).
- Sin reseñas inventadas ni contadores de "personas mirando esto".

## 3. La página principal, bloque por bloque

Orden propuesto, siguiendo la maqueta y sumando lo que aportan las referencias. "Datos" es de dónde sale cada
bloque; "Esfuerzo" es S (horas), M (un par de días), L (una semana).

| # | Bloque | Qué muestra | Datos | Estado | Esfuerzo |
| --- | --- | --- | --- | --- | --- |
| 1 | Portada | Titular de campaña ("Subí tu mundo." o "Más FPS. Menos excusas." para Gaming), bajada, dos botones (Ver notebooks, Ver gaming) | Fijo; la campaña se cambia desde el panel más adelante | Hecho con un botón | S |
| 2 | Qué estás buscando | Las cuatro categorías con cantidad y, debajo, diez accesos directos a subcategorías (notebooks gamer, para estudiar, monitores de 144 Hz o más, teclados, mouse, auriculares, SSD externos, webcams, hubs, routers) | `tienda_categorias()` y el árbol de la sección 4 | Hecho sin subcategorías | S |
| 3 | Elegido de la semana | Un producto con cuatro datos clave, precio y tres líneas de "por qué lo elegimos" (es el diferencial del plan de marca) | Campo `elegido_semana` con texto en el panel | Falta | M |
| 4 | Lo más jugado / Lo más vendido | Ocho productos con chips de marca para filtrar; etiqueta Nuevo u Oferta cuando corresponde | Ventas de `order_items` de las últimas cuatro semanas; hasta que haya ventas, los marcados como destacados | Hecho como "Destacados" | M |
| 5 | Ofertas | Productos con precio anterior tachado y porcentaje de ahorro | `precio_lista_ars` mayor que `precio_final_ars` (ya calculado) | Falta el bloque | S |
| 6 | Comparador | "Tres monitores, lado a lado": invitación a marcar hasta tres productos y ver qué cambia | Especificaciones normalizadas (sección 5) | Falta | L |
| 7 | Franja de confianza | Cuatro promesas: envíos iguales a todo el país, garantía de [N] meses, hasta [N] cuotas, 10 días para arrepentirte, más "no vemos ni guardamos tu tarjeta" | Configuración legal del panel | Hecho con tres | S |
| 8 | Nuevos ingresos | Lo último que entró al catálogo | `created_at` de productos activos con precio | Falta | S |
| 9 | Marcas | Logos de las marcas con productos activos, enlazando al filtro | Tabla `brands` depurada (hay 36 de Bartez) | Falta | S |
| 10 | ¿Cuál me compro? | Tres guías cortas: notebook para estudiar y trabajar, notebook gamer por presupuesto, monitor para jugar; cada una enlaza a dos o tres productos | Páginas de contenido (sección 6) | Falta | M |
| 11 | Opiniones | Reseñas reales de Google con nombre y fecha, cuando existan | Integración con Google Business, después de las primeras ventas | Después | M |
| 12 | Pie | Comprar, Ayuda, Legales, Pagá como quieras, datos del vendedor y Data Fiscal | `tienda_contenido_legal()` | Hecho | - |

Con el catálogo cargado, los bloques 2, 4, 5, 8 y 9 se llenan solos. El 3 y el 10 son editoriales y son los
que hacen que Teqo no parezca una lista de precios más.

## 4. Categorías y subcategorías

El menú queda con seis entradas. La maqueta tiene Notebooks, Gaming, Monitores, Periféricos, Componentes y
Red de la casa; la red de la casa va dentro de Accesorios, como complemento. Componentes entra al menú como
"PC y componentes" por decisión de Nico del 3/11/2026: Teqo también vende componentes, mini PC y consolas
(migración 122).

| Categoría | Subcategorías | Filtros propios | Notas |
| --- | --- | --- | --- |
| Notebooks | Para estudiar y trabajar · Gamer · Para crear · Ultralivianas | Marca, precio, pantalla, procesador, memoria, almacenamiento, placa de video, uso | Las subcategorías son por uso, no por marca; es lo que el cliente pregunta |
| Gaming | Notebooks gamer · Monitores gaming · Teclados · Mouse · Auriculares · Joysticks y volantes · Streaming (webcam, micrófono, capturadora) · Consolas | Marca, precio, frecuencia, conexión (cable o inalámbrico), plataforma | Es una vista transversal: un monitor de 165 Hz vive en Monitores y aparece en Gaming |
| Monitores | Para jugar (120 Hz o más) · Para trabajar y estudiar · Ultrawide y curvos · Soportes | Marca, precio, pulgadas, resolución, frecuencia, panel, conexiones | Los filtros de la maqueta ya son estos |
| Periféricos | Teclados · Mouse · Auriculares · Parlantes · Webcams · Mousepads · Combos | Marca, precio, conexión, formato, iluminación | Rotación y venta cruzada |
| Accesorios y red | SSD externos y pendrives · Hubs y adaptadores · Cargadores · Mochilas y fundas · Routers y Wi-Fi · Estabilizadores y UPS | Marca, precio, capacidad, compatibilidad | Menos del 30% de las ventas según el plan de marca |
| PC y componentes | Mini PC · Procesadores · Motherboards · Placas de video · Memorias RAM · Discos internos · Fuentes · Gabinetes · Coolers y refrigeración | Marca, precio, socket, capacidad, potencia, formato | Se venden sueltos; en la ficha de una notebook no se ofrecen como ampliación (la regla de configuraciones de fábrica sigue) |

Vistas virtuales, sin categoría propia: Ofertas, Nuevos ingresos y, más adelante, Outlet (abiertos de caja o
última unidad, con la garantía explicada).

Cómo se implementa: la tabla `categories` ya tiene `parent_id`, `slug` y `active`, y `tienda_categorias()`
suma los productos de las hijas. Hay que crear este árbol, desactivar las nueve categorías de Bartez (punto de
venta y afines), y cargar `category_mapping` para que lo que entra de los mayoristas caiga en la subcategoría
correcta. Gaming se resuelve con una etiqueta (`tags`) más que con duplicar productos.

## 5. Tarjeta de producto y ficha

**Tarjeta** (grilla de categoría, portada, "también podés mirar"):

- Marca y nombre corto normalizado ("ASUS Vivobook 15", no "NOTEBOOK ASUS 15.6 VIVOBOOK X1504ZA I5 8GB 512GB").
- Tres o cuatro chips con los datos que deciden la compra, distintos por categoría: notebook (procesador,
  memoria, almacenamiento, pantalla); monitor (pulgadas, resolución, frecuencia, panel); periférico
  (conexión, formato, iluminación).
- Precio contado y precio con Mercado Pago con cuotas (ya existe), siempre final.
- Disponibilidad en tres estados: Entrega inmediata (stock propio), En 24 a 48 hs (stock del mayorista) y
  A pedido con plazo. Sale de `product_suppliers.lead_time_days` y del stock.
- Etiquetas Nuevo, Oferta y Últimas unidades (ya calculado `pocas_unidades`).
- Agregar y Comparar.

**Ficha**, en el orden de la maqueta:

1. Galería con tres fotos o más, sobre fondo uniforme (hay buscador de imágenes en el panel).
2. Marca, nombre, una línea de qué es y para qué, cuatro chips.
3. Precio contado, precio con Mercado Pago, cuotas con CFT, "Ver medios de pago".
4. Calculá el envío: con el código postal muestra la tarifa nacional y el plazo. Un solo servicio.
5. Garantía, arrepentimiento y "no guardamos tu tarjeta", en tres líneas.
6. "¿Es para vos?": tres puntos de "para quién es" y tres de "no es para". Este texto es el que ninguna de las
   cinco tiendas tiene y es la promesa de la marca.
7. Especificaciones agrupadas (Pantalla, Rendimiento, Conexiones, Físico, En la caja), normalizadas por
   categoría, con la nota "datos del fabricante".
8. Envío, garantía y arrepentimiento explicados.
9. También podés mirar: parecidos por precio o por el dato clave.
10. Después: preguntas y respuestas del producto (PcComponentes) y reseñas verificadas.

Para que la ficha funcione hace falta un esquema de especificaciones por categoría (qué claves y en qué orden)
y un generador de "para quién es" revisable desde el panel. Bartez ya tiene `contentEnricher` para descripción
corta y larga; se extiende con los dos bloques nuevos y se aprueba desde el panel antes de publicar.

## 6. Contenido

- **Textos de categoría:** dos o tres líneas arriba de la grilla ("De 21,5 a 32 pulgadas, de 60 a 180 Hz. Filtrá
  por lo que te importa") y tres preguntas frecuentes al pie. Sirven al cliente y al buscador; el prerender ya
  los indexa.
- **Guías "¿Cuál me compro?":** tres al inicio, en `/guias/<tema>`, de 400 a 600 palabras, con una tabla de
  dos o tres productos y un cierre claro. Temas: notebook para estudiar y trabajar por presupuesto, notebook
  gamer según los juegos, monitor para jugar (Hz, resolución y panel explicados).
- **Ayuda:** Cómo comprar, Envíos (plazos, seguimiento, qué pasa si no estás), Garantía (quién responde y
  cómo se tramita), Cambios y devoluciones, Preguntas frecuentes. Compragamer y FullH4rd las tienen; hoy en
  Teqo hay una sola página de ayuda.
- **Pagá como quieras:** cuotas vigentes de Mercado Pago por banco (del recurso `cuotas`) y el descuento por
  transferencia. Reemplaza al carrusel de bancos.
- **Por qué comprar en Teqo:** una página corta con las cuatro promesas y el "elegimos por vos", sin
  superlativos.
- **Nombres y fotos:** normalizar nombres con `name_custom`, una foto principal sobre fondo uniforme y dos
  más; esto es lo que más separa visualmente a Teqo de FullH4rd y GoldenTech, que publican el nombre y la
  foto del mayorista tal cual.
- **Legales:** reemplazar los marcadores de términos, privacidad, garantías y datos del vendedor antes de la
  primera venta.

## 7. Datos que hay que cargar para que todo esto funcione

1. El árbol de categorías de la sección 4 y el mapeo desde los mayoristas.
2. Dólar, margen y tarifas de envío (sin esto no hay precios).
3. Entre 50 y 80 productos importados, con nombre normalizado, peso, tres fotos, especificaciones en el
   esquema de su categoría y marca depurada.
4. Marcas activas (de las 36 heredadas quedan las que tengan productos).
5. Un "elegido de la semana" y ocho destacados iniciales.
6. Textos legales reales.

## 8. Orden de trabajo

| Fase | Qué | Depende de | Tiempo |
| --- | --- | --- | --- |
| A · Datos | Categorías de Teqo, mapeo, importación de los primeros productos, nombres, fotos, dólar | Nada | 1 semana, mitad panel y mitad carga |
| B · Portada completa | Elegido de la semana, lo más vendido, ofertas, nuevos ingresos, marcas, franja de cuatro, accesos a subcategorías | A | 1 semana |
| C · Categoría y ficha | Filtros por especificación, orden, disponibilidad en tres estados, comparador hasta tres, "¿Es para vos?", especificaciones agrupadas, calculá el envío | A | 1 a 2 semanas |
| D · Contenido | Guías, textos de categoría, Ayuda completa, Pagá como quieras, Por qué comprar | B | 1 semana |
| E · Confianza y conversión | Reseñas de Google, preguntas en la ficha, outlet, medición (Meta y Google) y feed de catálogo | Ventas reales | Continuo |

A y B se pueden empezar ya con la tienda publicada. C y D no cambian de forma, cambian de contenido, así que
conviene hacerlos con productos reales a la vista.

## 9. Decisiones abiertas

- Si Gaming incluye sillas y escritorios (FullH4rd los vende; pesan y el envío nacional los encarece).
- Resuelta el 3/11/2026: Teqo vende componentes sueltos, mini PC y consolas ("PC y componentes" en el menú y
  Consolas dentro de Gaming).
- Cuántas cuotas se muestran como tope en la tarjeta ([N] en la maqueta) y el porcentaje de descuento por
  transferencia.
- Si el comparador entra antes del lanzamiento o después de los primeros 30 días.
- Outlet y abiertos de caja: solo con una política de garantía escrita.

## Fuentes

- Compragamer: https://compragamer.com/ (portada, menú y pie, 3/11/2026).
- FullH4rd: https://fullh4rd.com.ar/ (portada completa y mega menú, 3/11/2026).
- GoldenTech Store: https://goldentechstore.com.ar/ (portada y menú, 3/11/2026).
- PcComponentes (https://www.pccomponentes.com/) y Micro Center (https://www.microcenter.com/): bloqueadas
  por Cloudflare para navegación automatizada; descripciones de memoria.
- Maqueta aprobada: `design/maquetas/propuestas/06-nocturno-prisma/01-inicio.html`, `02-categoria.html`,
  `03-ficha.html` en equazin/teqo.
- Plan de marca: `docs/plan-de-marca.md` en equazin/teqo (público, catálogo de arranque, recomendador).

## Rediseño aprobado (3/11/2026)

Nico aprobó la maqueta "Teqo tienda nueva" (https://claude.ai/artifact/CEFqa5VbYjdsKe5RgUvvUo), armada con lo que
funciona en Compragamer y FullH4rd y la identidad Prisma × Central. Quedó programada en la rama `teqo`:

- **Encabezado:** franja de servicio (envío, IVA, ayuda, seguimiento, arrepentimiento), buscador con selector de
  categoría, menú desplegable con el árbol real y las cantidades, acceso a "Seguí tu compra" y carrito con total.
  Debajo, las categorías raíz, Ofertas y Nuevos ingresos.
- **Tarjeta:** datos clave de la ficha en chips según el tipo de producto, precio final, cuotas reales de Mercado Pago,
  disponibilidad y, en los listados, el botón Comparar.
- **Inicio:** portada con dos accesos, promesas, "Qué estás buscando" con foto, destacados con pestañas, elegido de la
  semana (el primer destacado), PC y componentes, accesos por uso, notebooks, comparador, periféricos, marcas y ayuda.
- **Categoría, Ofertas, Nuevos ingresos y Buscar:** filtros calculados de la ficha (marca, precio, stock y hasta seis
  claves como pulgadas, Hz, panel o procesador), filtros activos, orden y comparador. La selección queda en la URL.
- **Comparar:** hasta tres productos lado a lado; lo que mejora queda resaltado.
- **Producto:** galería, datos clave, caja de compra con cantidad, envío nacional cotizado, especificaciones agrupadas,
  envío y garantía, "Completá el setup" y "También podés mirar".
- **Carrito:** pasos, chips, resumen con medio de pago (Mercado Pago muestra las cuotas del total) y complementos.

Quedan para después, porque no hay contenido ni datos: las guías "¿Cuál me compro?", el bloque "¿Es para vos?" de la
ficha, las preguntas y respuestas por producto y el texto propio del elegido de la semana.

### Armá tu PC (3/11/2026)

En /arma-tu-pc: ocho pasos (procesador, motherboard, memoria, almacenamiento, placa de video, fuente, gabinete y
cooler) con las opciones ordenadas por compatibilidad según la ficha de cada componente: mismo socket entre procesador
y motherboard, DDR4 o DDR5 según la motherboard, memoria de PC (UDIMM), formato de la motherboard que entra en el
gabinete y potencia de fuente recomendada según el procesador y la placa de video. Avisa si el procesador no trae
gráficos o cooler. Si falta un dato, pide confirmarlo en la ficha en lugar de bloquear. El resumen muestra los totales
por transferencia y Mercado Pago y agrega todo al carrito. Se llega desde el menú, el desplegable de PC y
componentes, el inicio, las categorías de componentes, la ficha de cada componente ("Sumalo a Armá tu PC") y el pie.
Los coolers no traen socket en la ficha: el armador pide confirmarlo hasta que se cargue ese dato.
