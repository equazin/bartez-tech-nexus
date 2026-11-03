/** Categorías vistas desde el panel: las opciones para elegir una categoría de Teqo. */

export interface CategoriaDelPanel {
  id: number;
  name: string;
  parent_id: number | null;
  active: boolean;
  orden: number | null;
}

export interface OpcionDeCategoria {
  id: number;
  etiqueta: string;
}

/** Las categorías activas en el orden del menú, con la madre delante ("Notebooks › Gamer"). */
export function opcionesDeCategoria(categorias: CategoriaDelPanel[]): OpcionDeCategoria[] {
  const activas = categorias.filter((c) => c.active);
  const porMadre = new Map<number | null, CategoriaDelPanel[]>();
  for (const c of activas) porMadre.set(c.parent_id, [...(porMadre.get(c.parent_id) ?? []), c]);
  const ids = new Set(activas.map((c) => c.id));
  const ordenar = (lista: CategoriaDelPanel[]) =>
    [...lista].sort((a, b) => (a.orden ?? 100) - (b.orden ?? 100) || a.name.localeCompare(b.name, "es"));
  const opciones: OpcionDeCategoria[] = [];
  const recorrer = (madre: number | null, prefijo: string) => {
    for (const c of ordenar(porMadre.get(madre) ?? [])) {
      opciones.push({ id: c.id, etiqueta: prefijo ? `${prefijo} › ${c.name}` : c.name });
      recorrer(c.id, prefijo ? `${prefijo} › ${c.name}` : c.name);
    }
  };
  // Raíces: sin madre, o con una madre inactiva (no se ven en la tienda, pero se pueden elegir).
  recorrer(null, "");
  for (const c of ordenar(activas.filter((x) => x.parent_id !== null && !ids.has(x.parent_id)))) {
    opciones.push({ id: c.id, etiqueta: `${c.name} (fuera del menú)` });
  }
  return opciones;
}
