/**
 * El enlace de una compra (email, Mercado Pago, Mi cuenta) trae el token de acceso al pedido en la dirección. Apenas
 * carga la página se guarda en esta pestaña y se saca de la dirección, antes de que corra cualquier etiqueta de
 * medición: Google y Meta reciben la dirección de cada página y no tienen que ver ese token.
 */

const clave = (id: string) => `teqo:compra:${id}`;

export function guardarTokenDeLaDireccion(): void {
  const { pathname, search, hash } = window.location;
  const compra = /^\/compra\/(\d+)/.exec(pathname);
  if (!compra) return;
  const parametros = new URLSearchParams(search);
  const token = parametros.get("t");
  if (!token) return;
  try {
    window.sessionStorage.setItem(clave(compra[1]), token);
  } catch {
    // Sin almacenamiento el token queda en la dirección y la compra se sigue viendo; la medición no se activa ahí.
    return;
  }
  parametros.delete("t");
  const resto = parametros.toString();
  window.history.replaceState(window.history.state, "", `${pathname}${resto ? `?${resto}` : ""}${hash}`);
}

export function tokenGuardado(id: string): string | null {
  try {
    return window.sessionStorage.getItem(clave(id));
  } catch {
    return null;
  }
}
