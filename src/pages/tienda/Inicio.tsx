import { Fragment, useEffect, useState, type DependencyList } from "react";
import { Tienda } from "@/components/tienda/Tienda";
import { AccesosDeLaPortada, SeccionDelInicioVista } from "@/components/tienda/SeccionesDelInicio";
import { fotosPorCategoria, listarCategorias } from "@/lib/tienda/catalogo";
import { recordarSecciones, seccionesConocidas, sonIguales } from "@/lib/tienda/datosDelInicio";
import { useEsCelular } from "@/lib/tienda/pantalla";
import { SECCIONES_POR_DEFECTO, listarSeccionesDelInicio, type SeccionDelInicio } from "@/lib/tienda/seccionesInicio";
import { usarSeo } from "@/lib/tienda/seo";

/** Sin secciones cargadas en el panel, el inicio de siempre. */
const conLasPorDefecto = (lista: SeccionDelInicio[]): SeccionDelInicio[] => (lista.length > 0 ? lista : SECCIONES_POR_DEFECTO);

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
  usarSeo("Notebooks, gaming, monitores, periféricos y componentes", "Tecnología para trabajar, crear y jugar, con envío a domicilio y precios finales con IVA incluido.");

  const raices = useCarga(() => listarCategorias(), []);
  const fotos = useCarga(() => fotosPorCategoria(), []);
  // Abierto por el inicio, las secciones ya vienen escritas en la página: se dibujan sin esperar a la base.
  const [secciones, setSecciones] = useState<SeccionDelInicio[] | null>(() => {
    const conocidas = seccionesConocidas();
    return conocidas ? conLasPorDefecto(conocidas) : null;
  });

  useEffect(() => {
    const cargar = () =>
      listarSeccionesDelInicio()
        .then((lista) => {
          recordarSecciones(lista);
          const nuevas = conLasPorDefecto(lista);
          // Si son las que ya están dibujadas, quedan como están: las secciones no vuelven a pedir sus productos.
          setSecciones((actual) => (actual && sonIguales(actual, nuevas) ? actual : nuevas));
        })
        .catch(() => setSecciones((actual) => actual ?? SECCIONES_POR_DEFECTO));
    cargar();
    // Al volver a la pestaña se releen: un cambio del panel se ve sin recargar.
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  // En el celular los accesos de la portada (monitores para jugar y componentes) van después de la sección que le
  // sigue, que como está cargado el inicio son los destacados: así los primeros productos con precio aparecen antes.
  // Si la portada es la última sección, quedan debajo de ella. En pantalla ancha siguen dentro de la portada.
  const esCelular = useEsCelular();
  const lista = secciones ?? [];
  const indiceDeLaPortada = lista.findIndex((s) => s.tipo === "portada");
  const accesosDespuesDe = indiceDeLaPortada === -1 ? -1 : Math.min(indiceDeLaPortada + 1, lista.length - 1);

  return (
    <Tienda>
      <div className="flex flex-col gap-14 pb-4">
        {lista.map((s, indice) => (
          <Fragment key={s.id}>
            <SeccionDelInicioVista seccion={s} raices={raices} fotos={fotos} accesosAparte={esCelular} />
            {esCelular && indice === accesosDespuesDe && <AccesosDeLaPortada raices={raices} fotos={fotos} aparte />}
          </Fragment>
        ))}
      </div>
    </Tienda>
  );
}
