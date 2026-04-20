import { RefreshCw, Download, Zap, CheckCircle2, AlertTriangle, Clock, Package } from "lucide-react";
import { useAirSync } from "@/hooks/useAirSync";

interface Props {
  isDark?: boolean;
  userId?: string;
  onSyncDone?: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Esperando",
  checking: "Verificando token...",
  fetching: "Descargando catalogo AIR...",
  upserting: "Consolidando productos y costos...",
  done: "Sync completado",
  error: "Error en sync",
};

export function AirSyncTab({ isDark = true, userId, onSyncDone }: Props) {
  const { progress, lastSync, running, runCatalogSync, runSypSync, runIncomingSync } = useAirSync(userId);
  const dk = (dark: string, light: string) => (isDark ? dark : light);

  const card = `border rounded-xl p-5 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`;
  const isIdle = progress.phase === "idle";
  const isDone = progress.phase === "done";
  const isError = progress.phase === "error";

  async function handleCatalog() {
    await runCatalogSync();
    onSyncDone?.();
  }

  async function handleSyp() {
    await runSypSync();
    onSyncDone?.();
  }

  async function handleIncoming() {
    await runIncomingSync();
    onSyncDone?.();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>
            Sincronizacion AIR Intranet
          </h2>
          <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
            api.air-intra.com · Lista 5 · paginacion 500 productos por pagina
          </p>
        </div>
        {lastSync && (
          <div className={`text-right text-xs ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
            <p>
              Ultima sync:{" "}
              <span className="font-semibold">{lastSync.type === "catalog" ? "Catalogo" : lastSync.type === "incoming" ? "Entrantes" : "Precios/Stock"}</span>
            </p>
            <p>{new Date(lastSync.finishedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</p>
            <p className="text-[#2D9F6A]">
              +{lastSync.inserted} nuevos · ↻{lastSync.updated} actualizados
            </p>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 flex items-center justify-center shrink-0">
              <Download size={16} className="text-[#2D9F6A]" />
            </div>
            <div>
              <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")}`}>Sync catalogo completo</p>
              <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                Baja AIR completo, detecta productos repetidos entre proveedores y deja el menor costo como fuente
                preferida del catalogo.
              </p>
            </div>
          </div>
          <button
            onClick={handleCatalog}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold py-2.5 rounded-lg transition disabled:opacity-40 disabled:pointer-events-none"
          >
            <RefreshCw size={14} className={running && progress.phase !== "idle" ? "animate-spin" : ""} />
            {running ? "Sincronizando..." : "Iniciar sync completo"}
          </button>
        </div>

        <div className={card}>
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-blue-400" />
            </div>
            <div>
              <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")}`}>Sync precios y stock</p>
              <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                Refresca costos y stock de AIR sin romper el producto canonico ni la eleccion del proveedor mas
                conveniente.
              </p>
            </div>
          </div>
          <button
            onClick={handleSyp}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg border transition disabled:opacity-40 disabled:pointer-events-none ${dk("bg-[#1a1a1a] hover:bg-[#222] border-[#2a2a2a] text-blue-400 hover:text-blue-300", "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700")}`}
          >
            <Zap size={14} />
            {running ? "Sincronizando..." : "Sync rapido precios/stock"}
          </button>
        </div>

        <div className={card}>
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Package size={16} className="text-sky-400" />
            </div>
            <div>
              <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")}`}>Sync entrantes AIR</p>
              <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                Solo agrega productos con stock entrante y los marca con ingreso estimado.
              </p>
            </div>
          </div>
          <button
            onClick={handleIncoming}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg border transition disabled:opacity-40 disabled:pointer-events-none ${dk("bg-[#1a1a1a] hover:bg-[#222] border-[#2a2a2a] text-sky-300 hover:text-sky-200", "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700")}`}
          >
            <Package size={14} />
            {running ? "Sincronizando..." : "Sync solo entrantes"}
          </button>
        </div>
      </div>

      {!isIdle && (
        <div className={card}>
          <div className="flex items-center gap-2 mb-4">
            {isError ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : isDone ? (
              <CheckCircle2 size={16} className="text-[#2D9F6A]" />
            ) : (
              <RefreshCw size={16} className="text-[#2D9F6A] animate-spin" />
            )}
            <span
              className={`text-sm font-semibold ${
                isError ? "text-red-400" : isDone ? "text-[#2D9F6A]" : dk("text-white", "text-[#171717]")
              }`}
            >
              {PHASE_LABELS[progress.phase]}
            </span>
            {progress.durationSeconds !== undefined && (
              <span className={`ml-auto text-xs flex items-center gap-1 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                <Clock size={11} /> {progress.durationSeconds}s
              </span>
            )}
          </div>

          {running && progress.fetched > 0 && (
            <div className={`h-1.5 rounded-full mb-4 overflow-hidden ${dk("bg-[#222]", "bg-[#e8e8e8]")}`}>
              <div
                className="h-full bg-[#2D9F6A] transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((progress.updated + progress.inserted) / Math.max(1, progress.fetched)) * 100
                  )}%`,
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Descargados" value={progress.fetched} color={undefined} dk={dk} />
            <Metric label="Nuevos" value={progress.inserted} color="text-[#2D9F6A]" dk={dk} />
            <Metric label="Actualizados" value={progress.updated} color="text-blue-400" dk={dk} />
            <Metric
              label="Errores"
              value={progress.errors.length}
              color={progress.errors.length > 0 ? "text-red-400" : undefined}
              dk={dk}
            />
          </div>

          {progress.errors.length > 0 && (
            <div className={`mt-4 rounded-lg p-3 text-xs space-y-0.5 max-h-32 overflow-y-auto ${dk("bg-red-500/8 text-red-400", "bg-red-50 text-red-600")}`}>
              {progress.errors.map((error, index) => (
                <p key={index}>• {error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`rounded-xl px-4 py-3 text-xs border ${dk("bg-blue-500/8 border-blue-500/20 text-blue-300", "bg-blue-50 border-blue-200 text-blue-700")}`}>
        <p className="font-semibold mb-1">Como funciona el sync</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>
            <strong>Productos nuevos</strong>: se crean como catalogo canonico y se vinculan a AIR dentro de{" "}
            <code>product_suppliers</code>.
          </li>
          <li>
            <strong>Productos repetidos</strong>: si otro proveedor ya tiene el mismo item, se reutiliza ese producto y
            se compara costo entre ambos.
          </li>
          <li>
            <strong>Proveedor preferido</strong>: despues del sync se marca automaticamente la fuente mas barata y se
            refleja en precio y stock del catalogo.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  dk,
}: {
  label: string;
  value: number;
  color?: string;
  dk: (dark: string, light: string) => string;
}) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${dk("bg-[#0d0d0d]", "bg-[#f5f5f5]")}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
        {label}
      </p>
      <p className={`text-xl font-extrabold tabular-nums ${color ?? dk("text-white", "text-[#171717]")}`}>
        {value.toLocaleString("es-AR")}
      </p>
    </div>
  );
}
