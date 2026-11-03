import { useEffect, useState, type DependencyList } from "react";
import { Tienda } from "@/components/tienda/Tienda";
import { SeccionDelInicioVista } from "@/components/tienda/SeccionesDelInicio";
import { fotosPorCategoria, listarCategorias } from "@/lib/tienda/catalogo";
import { SECCIONES_POR_DEFECTO, listarSeccionesDelInicio, type SeccionDelInicio } from "@/lib/tienda/seccionesInicio";
import { usarSeo } from "@/lib/tienda/seo";

function useCarga<T>(cargar: () => Promise<T>, dependencias: DependencyList): T | null {
  const [valor, setValor] = useState<T | null>(null);
  useEffect(() => {
    let cancelado = false;
    cargar()
      .then((v) => {
        if (!cancelado) setValor(v);
      })
      .catch(() => {
        if (!cancelado) setValor(null);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
  return valor;
}

/** El inicio: las secciones activas del panel, en su orden. Sin secciones cargadas, el inicio de siempre. */
export default function Inicio() {
  usarSeo("Notebooks, gaming, monitores, periféricos y componentes", "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.");

  const raices = useCarga(() => listarCategorias(), []);
  const fotos = useCarga(() => fotosPorCategoria(), []);
  const [secciones, setSecciones] = useState<SeccionDelInicio[] | null>(null);

  useEffect(() => {
    const cargar = () =>
      listarSeccionesDelInicio()
        .then((lista) => setSecciones(lista.length > 0 ? lista : SECCIONES_POR_DEFECTO))
        .catch(() => setSecciones((actual) => actual ?? SECCIONES_POR_DEFECTO));
    cargar();
    // Al volver a la pestaña se releen: un cambio del panel se ve sin recargar.
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  return (
    <Tienda>
      <div className="flex flex-col gap-14 pb-4">
        {(secciones ?? []).map((s) => (
          <SeccionDelInicioVista key={s.id} seccion={s} raices={raices} fotos={fotos} />
        ))}
      </div>
    </Tienda>
  );
}
