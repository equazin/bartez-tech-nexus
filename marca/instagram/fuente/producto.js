/* Datos de la pieza de producto. Completá cada campo con lo que muestra la ficha de la tienda en ese momento
   y generá de nuevo: node marca/instagram/fuente/generar.cjs producto

   Lo que está entre corchetes es un marcador: una pieza con marcadores no se publica.
   - Los precios son finales, con IVA incluido, tal como figuran en la ficha.
   - "cuotas" se copia de la ficha (cantidad y valor de cada cuota). Si ese producto no tiene cuotas, dejalo vacío.
   - "foto" es la ruta a la foto del producto sobre fondo blanco o gris claro, desde esta carpeta.
     Vacío deja el lugar marcado.
   - "datos" son tres o cuatro características de fábrica, las mismas de la ficha. */
const PRODUCTO = {
  categoria: "[CATEGORÍA]",
  marca: "[MARCA]",
  nombre: "[NOMBRE DEL PRODUCTO]",
  datos: ["[DATO 1]", "[DATO 2]", "[DATO 3]", "[DATO 4]"],
  foto: "",
  precio_transferencia: "$ [PRECIO]",
  precio_mercado_pago: "$ [PRECIO]",
  cuotas: "[N] cuotas de $ [VALOR]",
  vigencia: "Precios al [FECHA]. Pueden cambiar: el vigente es el de la web.",
};
