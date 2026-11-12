/**
 * Codifica el camino de la dirección de una foto. Las de los mayoristas traen el nombre del producto, con
 * caracteres que en una dirección significan otra cosa: un «?» corta el camino y un «%» suelto lo invalida.
 * Lo que ya venía bien codificado queda intacto.
 * Es la misma función que usa la tienda (src/lib/direccionDeImagen.ts): si cambia una, cambiar la otra.
 */
export function codificarDireccionDeImagen(url: string): string {
  const partes = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url);
  if (!partes) return url;
  const origen = partes[1];
  const resto = partes[2] ?? "";
  const corte = resto.indexOf("?");
  // Un «?» seguido de clave=valor es una consulta de verdad; si no, es parte del nombre del archivo.
  const consulta = corte >= 0 && /^[^=&]+=/.test(resto.slice(corte + 1)) ? resto.slice(corte) : "";
  const camino = consulta ? resto.slice(0, corte) : resto;
  const codificado = camino
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .split(/(%[0-9A-Fa-f]{2})/)
    .map((parte, i) => (i % 2 === 1 ? parte : encodeURI(parte).replace(/\?/g, "%3F").replace(/#/g, "%23")))
    .join("");
  return origen + codificado + consulta;
}
