import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, AlertCircle, CheckCircle2, Eye, Loader2, X, Download } from "lucide-react";
import {
  COLUMNAS_CSV,
  interpretarCsv,
  plantillaCsv,
  type CategoriaDelCsv,
  type FilaInterpretada,
  type MarcaDelCsv,
} from "@/lib/catalogoCsv";

interface ImportResult { imported: number; errors: string[]; }

type Accion = "crear" | "actualizar" | "sin_cambios";

interface FilaParaImportar extends FilaInterpretada {
  accion: Accion;
  id: number | null;
}

/** Nombre de columna del CSV para cada campo, para mostrar qué cambia. */
const COLUMNA_DE: Record<string, string> = {
  name_custom: "nombre",
  brand_name: "marca",
  category_id: "categoria",
  description_short: "descripcion_corta",
  description_full: "descripcion",
  ficha: "ficha_tecnica",
  images: "fotos",
  weight_kg: "peso_kg",
  cost_price: "costo_usd",
  iva_rate: "iva",
  supplier_multiplier: "multiplicador",
  offer_percent: "oferta_porcentaje",
  stock: "stock",
  stock_min: "stock_min",
  tags: "etiquetas",
  external_id: "external_id",
  featured: "destacado",
  publicado: "publicado",
  active: "activo",
};

function columnasQueCambian(cambios: Record<string, unknown>): string[] {
  return [...new Set(Object.keys(cambios).map((k) => COLUMNA_DE[k]).filter(Boolean))];
}

function descargar(contenido: string, nombre: string) {
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function skusExistentes(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase.from("products").select("id, sku").order("id").range(desde, desde + pagina - 1);
    if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
    for (const fila of (data ?? []) as Array<{ id: number; sku: string | null }>) {
      if (fila.sku) mapa.set(fila.sku.trim().toUpperCase(), fila.id);
    }
    if (!data || data.length < pagina) break;
  }
  return mapa;
}

/** Agrupa por el conjunto exacto de columnas: cada grupo se inserta sin completar columnas con nulos. */
function agruparPorColumnas(filas: Array<Record<string, unknown>>): Array<Array<Record<string, unknown>>> {
  const grupos = new Map<string, Array<Record<string, unknown>>>();
  for (const fila of filas) {
    const firma = Object.keys(fila).sort().join(",");
    grupos.set(firma, [...(grupos.get(firma) ?? []), fila]);
  }
  return [...grupos.values()];
}

export default function ProductImport({ onImport, isDark = true }: { onImport: (result: ImportResult) => void; isDark?: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [filas, setFilas] = useState<FilaParaImportar[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const conErrores = filas.filter((f) => f.errores.length > 0);
  const aCrear = filas.filter((f) => f.errores.length === 0 && f.accion === "crear");
  const aActualizar = filas.filter((f) => f.errores.length === 0 && f.accion === "actualizar");
  const sinCambios = filas.filter((f) => f.errores.length === 0 && f.accion === "sin_cambios");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const archivo = files[0];
    setAvisos([]);
    setFilas([]);
    setFileName(archivo.name);
    setLeyendo(true);
    try {
      const [texto, { data: categorias, error: errorCategorias }, { data: marcas }] = await Promise.all([
        archivo.text(),
        supabase.from("categories").select("id, name, slug, active"),
        supabase.from("brands").select("id, name"),
      ]);
      if (errorCategorias) throw new Error(`No se pudieron leer las categorías: ${errorCategorias.message}`);
      const { filas: leidas, columnasIgnoradas, errorGeneral } = interpretarCsv(
        texto,
        (categorias ?? []) as CategoriaDelCsv[],
        (marcas ?? []) as MarcaDelCsv[],
      );
      if (errorGeneral) {
        setAvisos([errorGeneral]);
        return;
      }
      const existentes = await skusExistentes();
      const nuevosAvisos: string[] = [];
      if (columnasIgnoradas.length > 0) {
        nuevosAvisos.push(`Se ignoran las columnas que no reconoce: ${columnasIgnoradas.join(", ")}.`);
      }

      // Un SKU repetido en el archivo: vale la última fila.
      const porSku = new Map<string, FilaInterpretada>();
      for (const fila of leidas) {
        if (fila.sku && porSku.has(fila.sku)) nuevosAvisos.push(`El SKU ${fila.sku} está repetido: vale la fila ${fila.fila}.`);
        porSku.set(fila.sku || `fila-${fila.fila}`, fila);
      }

      const preparadas = [...porSku.values()].map((fila): FilaParaImportar => {
        const id = existentes.get(fila.sku) ?? null;
        if (id === null) {
          const errores = [...fila.errores];
          if (fila.sku && !fila.cambios.name_custom) errores.push("para crear un producto nuevo hace falta el nombre");
          if (fila.sku && !fila.cambios.cost_price) errores.push("para crear un producto nuevo hace falta costo_usd");
          return { ...fila, errores, accion: "crear", id };
        }
        return { ...fila, accion: Object.keys(fila.cambios).length > 0 ? "actualizar" : "sin_cambios", id };
      });
      setFilas(preparadas);
      setAvisos(nuevosAvisos);
    } catch (error) {
      setAvisos([error instanceof Error ? error.message : "No se pudo leer el archivo."]);
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleImport() {
    if (aCrear.length + aActualizar.length === 0) return;
    setImportando(true);
    const errores: string[] = [];
    let listos = 0;

    // Actualizaciones: una por producto, solo con las columnas que trae la fila.
    const cola = [...aActualizar];
    const trabajar = async () => {
      for (let fila = cola.shift(); fila; fila = cola.shift()) {
        const { error } = await supabase.from("products").update(fila.cambios).eq("id", fila.id as number);
        if (error) errores.push(`Fila ${fila.fila} (${fila.sku}): ${error.message}`);
        else listos += 1;
        setProgreso(`Actualizando ${listos} de ${aActualizar.length}...`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, trabajar));

    // Altas: agrupadas por columnas y de a 200.
    const nuevos = aCrear.map((fila) => ({
      sku: fila.sku,
      name: fila.cambios.name_custom,
      name_original: fila.cambios.name_custom,
      ...fila.cambios,
    }));
    for (const grupo of agruparPorColumnas(nuevos)) {
      for (let i = 0; i < grupo.length; i += 200) {
        const tanda = grupo.slice(i, i + 200);
        setProgreso(`Creando productos nuevos...`);
        const { error } = await supabase.from("products").insert(tanda);
        if (error) errores.push(`Alta de ${tanda.length} productos (${tanda.map((t) => t.sku).slice(0, 3).join(", ")}...): ${error.message}`);
        else listos += tanda.length;
      }
    }

    setImportando(false);
    setProgreso("");
    onImport({ imported: listos, errors: errores });
    if (errores.length === 0) reset();
  }

  function reset() {
    setFilas([]);
    setAvisos([]);
    setFileName("");
  }

  return (
    <div className="space-y-4">
      {/* Zona de carga */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-[#2D9F6A] bg-[#2D9F6A]/5"
            : `${dk("border-[#2a2a2a] bg-[#141414]", "border-[#d4d4d4] bg-[#f9f9f9]")} hover:border-[#2D9F6A]/40`
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); void handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
        {leyendo ? <Loader2 size={24} className="mx-auto mb-2 text-gray-600 animate-spin" /> : <Upload size={24} className="mx-auto mb-2 text-gray-600" />}
        {fileName ? (
          <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")}`}>{fileName}</p>
        ) : (
          <p className="text-sm text-gray-500">Arrastrá el CSV del catálogo o hacé click para elegirlo</p>
        )}
        <p className="text-[11px] text-gray-700 mt-1.5">
          Exportalo desde Productos con el botón CSV, editalo en Excel o Google Sheets y volvé a subirlo.
        </p>
      </div>

      {/* Referencia de columnas */}
      <div className={`${dk("bg-[#141414] border-[#222]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-lg px-3 py-2.5 space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">Columnas</p>
          <button
            type="button"
            onClick={() => descargar(plantillaCsv(), "plantilla-catalogo-teqo.csv")}
            className="text-[11px] text-[#2D9F6A] hover:underline flex items-center gap-1"
          >
            <Download size={11} /> Descargar plantilla
          </button>
        </div>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {COLUMNAS_CSV.map((c) => (
            <div key={c.columna} className="text-[11px] leading-4">
              <dt className={`inline font-mono ${c.columna === "sku" ? "text-[#2D9F6A]" : dk("text-gray-300", "text-[#262626]")}`}>{c.columna}</dt>
              <dd className="inline text-gray-500"> · {c.ayuda}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[10px] text-gray-600">
          Celda vacía: no cambia nada. Un guion (-): borra ese dato. Si el SKU no existe, se crea el producto (sin publicar, salvo que digas lo contrario).
        </p>
      </div>

      {/* Avisos */}
      {avisos.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5 space-y-1">
          {avisos.map((aviso, i) => (
            <p key={i} className="text-xs text-yellow-500/90">{aviso}</p>
          ))}
        </div>
      )}

      {/* Errores por fila */}
      {conErrores.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 space-y-1 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <AlertCircle size={12} /> {conErrores.length} fila{conErrores.length > 1 ? "s" : ""} con errores: no se importan
          </p>
          {conErrores.map((f) => (
            <p key={`${f.fila}-${f.sku}`} className="text-xs text-red-400/80 pl-4">
              Fila {f.fila}{f.sku ? ` (${f.sku})` : ""}: {f.errores.join("; ")}
            </p>
          ))}
        </div>
      )}

      {/* Vista previa */}
      {filas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Eye size={12} /> {aActualizar.length} a actualizar · {aCrear.length} nuevos · {sinCambios.length} sin cambios
            </p>
            <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-300 transition flex items-center gap-1">
              <X size={11} /> Limpiar
            </button>
          </div>

          <div className={`overflow-x-auto rounded-xl border max-h-96 overflow-y-auto ${dk("border-[#252525] bg-[#141414]", "border-[#e5e5e5] bg-white")}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${dk("border-[#252525]", "border-[#e5e5e5]")}`}>
                  {["SKU", "Acción", "Nombre", "Qué cambia"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.filter((f) => f.errores.length === 0 && f.accion !== "sin_cambios").map((f) => (
                  <tr key={`${f.fila}-${f.sku}`} className={`border-t ${dk("border-[#1e1e1e] hover:bg-[#1a1a1a]", "border-[#f0f0f0] hover:bg-[#fafafa]")} transition-colors`}>
                    <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">{f.sku}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {f.accion === "crear"
                        ? <span className="text-[#2D9F6A]">Nuevo</span>
                        : <span className="text-gray-400 flex items-center gap-1"><CheckCircle2 size={11} /> Actualiza</span>}
                    </td>
                    <td className={`px-3 py-2 max-w-[220px] truncate ${dk("text-white", "text-[#171717]")}`}>{String(f.cambios.name_custom ?? "—")}</td>
                    <td className="px-3 py-2 text-gray-500">{columnasQueCambian(f.cambios).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => void handleImport()}
            disabled={importando || aCrear.length + aActualizar.length === 0}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            {importando
              ? <><Loader2 size={14} className="animate-spin" /> {progreso || "Importando..."}</>
              : `Importar: actualizar ${aActualizar.length} y crear ${aCrear.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
