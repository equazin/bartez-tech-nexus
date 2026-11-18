# Instagram de Teqo (@teqo.ar)

Kit hecho de cero el 18/11/2026. Reemplaza al que está en `brand/instagram/` del repositorio `equazin/teqo`,
que no se usa más: firmaba con otro logo, no tenía gaming ni producto y no decía nada de lo que la tienda promete.

Este kit sale de la tienda: mismo logo (Encendido, el del encabezado y el ícono), mismos colores y tipografías,
las mismas fotos de producto de las portadas y los mismos mensajes (precio final con IVA, mismo envío a todo el
país, configuraciones de fábrica, transferencia o Mercado Pago, 10 días para arrepentirte).

## Qué hay

| Carpeta | Piezas | Medida |
| --- | ---: | --- |
| `listas/perfil/` | Foto de perfil | 1080 × 1080 |
| `listas/feed/` | 14 publicaciones y 4 carruseles (25 láminas), numerados en orden de publicación | 1080 × 1350 |
| `listas/temporada/` | Fiestas y vuelta a clases | 1080 × 1350 |
| `listas/historias/` | 27 historias, en una carpeta por destacada | 1080 × 1920 |
| `listas/destacadas/` | 13 portadas de destacadas | 1080 × 1080 |
| `listas/reels/` | 4 portadas de reels (sin video) | 1080 × 1920 |
| `listas/plantillas/` | Pieza de producto, en publicación e historia. Tiene marcadores: no se publica así | 1350 y 1920 de alto |
| `vista-previa/` | Cómo queda la grilla del perfil y hojas con todas las piezas | |
| `fuente/` | Las páginas que generan todo | |

Los textos para acompañar cada pieza, la bio y los textos alternativos están en `TEXTOS.md`.

## Cómo arrancar la cuenta

1. Foto de perfil: `listas/perfil/foto-de-perfil.png`. Es el mismo símbolo que el ícono de la tienda.
2. Bio, nombre y enlace: los de `TEXTOS.md`.
3. Destacadas del primer día: Comprar, Envíos, Pagos, Armá tu PC, Ayuda y Tu cuenta. Cada una tiene sus historias en
   `listas/historias/<nombre>/`: se suben en orden, se guardan en la destacada y se le pone la portada de
   `listas/destacadas/`. Las demás portadas (Guías, Notebooks, Gaming, Monitores, Periféricos, Ofertas y Novedades)
   se usan cuando haya historias para guardar ahí; una destacada vacía no se puede crear.
4. Publicaciones: del 01 al 12, en ese orden. La 07, la 10 y la 12 son carruseles: se suben todas las láminas
   con el mismo número, en orden. Así la grilla alterna claro, rojo y oscuro (`vista-previa/grilla-del-perfil.jpg`).
   De la 13 a la 18 siguen después, intercaladas con piezas de producto. La 17 (carrusel) y la 18 son las de la
   cuenta y los puntos.
5. Historias de lanzamiento (`listas/historias/lanzamiento/`): el día que se publica la 01. En la tercera va el
   sticker de enlace a la tienda.

## Antes de publicar

- **La web.** Casi todas las piezas dicen `teqo.com.ar`. Confirmar que el dominio ya abre la tienda.
- **Fotos de producto.** Son las de las portadas de la tienda (`public/portadas` y `public/banners`): fotos de
  fabricantes compuestas para la web. Confirmar que se pueden usar también en redes.
- **Cuotas.** Las piezas dicen "en cuotas", sin número, para que no queden viejas si cambia la promoción.
- **Armado de PC.** Las piezas hablan del armador y de la compatibilidad; no prometen el servicio de armado y
  prueba, que en la tienda está inactivo hasta que tenga precio.
- **Cuenta y puntos.** Los beneficios de la cuenta son los que lista la página Mi cuenta de la tienda. Las piezas
  de Puntos Teqo no dicen cuánto suma ni cuánto vale cada punto, porque se cambia desde el panel: se publican
  solo con el programa prendido.
- **Garantía.** No hay pieza de garantía: falta definir el plazo. Cuando esté, se suma una historia en Ayuda.
- **Pieza de producto.** Se completa en `fuente/producto.js` con lo que muestra la ficha ese día y se genera de
  nuevo. Los precios cambian: una pieza con precio se publica el día que se genera.
- **Zonas libres.** En historias y portadas de reels no hay nada importante en los primeros 250 px ni en los
  últimos 340. Son márgenes prudentes; no los pude verificar contra la documentación oficial de Instagram.
  Los posts son 4:5; la grilla del perfil los recorta a 3:4 (unos 34 px por lado) y el texto queda adentro.

## Reglas del kit

- Un solo logo: Encendido, arriba a la derecha. No va el logotipo con punto.
- Titular en Barlow Condensed, en dos colores sobre oscuro o claro y todo en blanco sobre rojo. El resto, DM Sans.
- El rojo sobre grafito va solo en titulares grandes; el texto chico va en blanco o gris claro.
- Las etiquetas con borde son datos, no botones. La flecha "Deslizá" va solo en carruseles.
- Sin precios, plazos ni datos de producto inventados. Lo que no está confirmado va entre corchetes y no se publica.
- Si un texto no entra, se acorta: no se achica la letra por debajo de lo que hay ni se pisa la foto.

## Generar de nuevo

```
node marca/instagram/fuente/generar.cjs            todas las piezas
node marca/instagram/fuente/generar.cjs feed       solo fuente/feed.html
```

Necesita Playwright con Chromium (`npx playwright install chromium`). Cada pieza es un elemento con la clase
`pieza` en un `.html` de `fuente/`; el `id` es el nombre del archivo y `data-carpeta`, la subcarpeta de `listas/`.
El generador avisa si una pieza no mide lo que corresponde o si un texto queda pegado al borde.

Los colores y las fuentes son los de la tienda (`src/tema/tokens.json`, `public/fonts`). Los íconos son de Lucide
(licencia ISC), los mismos que usa la web.
