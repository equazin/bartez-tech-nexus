import { Truck, MapPin } from "lucide-react";
import type { ShippingEstimate } from "@/lib/shipping";

type ShippingType = "retiro" | "envio";
type Transport = "andreani" | "oca" | "expreso" | "comisionista" | "otro";

const TRANSPORT_LABELS: Record<Transport, string> = {
  andreani: "Andreani",
  oca: "OCA",
  expreso: "Expreso",
  comisionista: "Comisionista",
  otro: "Otro",
};

export interface ShippingStepProps {
  shippingType: ShippingType;
  shippingAddress: string;
  shippingTransport: Transport;
  shippingCost: string;
  postalCode: string;
  shippingPaymentType: "origen" | "destino";
  shippingEstimates: ShippingEstimate[];
  freeShippingApplied: boolean;
  estimating: boolean;
  recentAddresses: string[];
  isAdmin: boolean;
  currency: string;
  exchangeRate: number;
  formatPrice: (n: number) => string;
  isDark: boolean;
  onSetShippingType: (t: ShippingType) => void;
  onSetAddress: (a: string) => void;
  onSetTransport: (t: Transport) => void;
  onSetCost: (c: string) => void;
  onSetPostalCode: (cp: string) => void;
  onSetPaymentType: (pt: "origen" | "destino") => void;
  onEstimate: () => void;
  onSelectEstimate: (est: ShippingEstimate) => void;
}

export function ShippingStep({
  shippingType,
  shippingAddress,
  shippingTransport,
  shippingCost,
  postalCode,
  shippingPaymentType,
  shippingEstimates,
  freeShippingApplied,
  estimating,
  recentAddresses,
  isAdmin,
  currency,
  formatPrice,
  isDark,
  onSetShippingType,
  onSetAddress,
  onSetTransport,
  onSetCost,
  onSetPostalCode,
  onSetPaymentType,
  onEstimate,
  onSelectEstimate,
}: ShippingStepProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const costLocked = freeShippingApplied || shippingPaymentType === "destino";
  const manualCostLocked =
    costLocked || (shippingTransport !== "otro" && shippingTransport !== "comisionista" && shippingTransport !== "expreso" && !isAdmin);

  return (
    <section className={`overflow-hidden rounded-xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
      <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
        <Truck size={13} className="text-[#2D9F6A]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Logistica / Envio</span>
      </div>
      <div className="px-4 py-4">
        <div className="mb-4 flex gap-3">
          {[
            { value: "retiro" as ShippingType, label: "Retiro en sucursal" },
            { value: "envio" as ShippingType, label: "Envio a destino" },
          ].map(({ value, label }) => (
            <label
              key={value}
              className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 transition ${
                shippingType === value
                  ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                  : dk("border-[#1f1f1f] text-gray-400 hover:border-[#2a2a2a]", "border-[#e5e5e5] text-gray-500 hover:border-[#d4d4d4]")
              }`}
            >
              <input
                type="radio"
                name="shippingType"
                value={value}
                checked={shippingType === value}
                onChange={() => onSetShippingType(value)}
                className="sr-only"
              />
              <div className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 transition ${
                shippingType === value ? "border-[#2D9F6A]" : dk("border-[#404040]", "border-[#d4d4d4]")
              }`}>
                {shippingType === value && <div className="h-1.5 w-1.5 rounded-full bg-[#2D9F6A]" />}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </label>
          ))}
        </div>

        {shippingType === "envio" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs text-gray-500">Codigo postal destino</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => onSetPostalCode(e.target.value)}
                  placeholder="Ej: 1425"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                    dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")
                  }`}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={onEstimate}
                  disabled={!postalCode.trim() || estimating}
                  className="flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#2D9F6A] px-3 text-xs font-bold text-white transition hover:bg-[#25835A] disabled:opacity-40"
                >
                  <Truck size={12} /> Estimar
                </button>
              </div>
            </div>

            {freeShippingApplied && (
              <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${dk("border-[#183a28] bg-[#0f241a] text-[#7de3ad]", "border-[#d4ebd8] bg-[#eaf5ef] text-[#25835a]")}`}>
                Envio gratis por superar los USD 800 en mercaderia.
              </div>
            )}

            {shippingEstimates.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Tarifas estimadas</p>
                <div className="grid grid-cols-2 gap-2">
                  {shippingEstimates.map((est) => {
                    const isSelected = shippingTransport === est.carrier;
                    return (
                      <button
                        key={est.carrier}
                        type="button"
                        onClick={() => onSelectEstimate(est)}
                        className={`rounded-lg border p-2.5 text-left text-xs transition ${
                          isSelected
                            ? "border-[#2D9F6A] bg-[#2D9F6A]/10"
                            : dk("border-[#2a2a2a] hover:border-[#3a3a3a]", "border-[#e5e5e5] hover:border-[#d4d4d4]")
                        }`}
                      >
                        <p className={`mb-0.5 font-bold ${isSelected ? "text-[#2D9F6A]" : dk("text-white", "text-[#171717]")}`}>{est.label}</p>
                        <p className="font-semibold tabular-nums text-[#2D9F6A]">{est.price_usd === 0 ? "Gratis" : formatPrice(est.price_usd)}</p>
                        <p className={`mt-0.5 text-[10px] ${dk("text-gray-500", "text-gray-500")}`}>{est.days_min}-{est.days_max} dias habiles</p>
                        {est.notes && <p className="mt-0.5 text-[9px] text-amber-400">{est.notes}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs text-gray-500">
                <MapPin size={11} className="mr-1 inline" />
                Direccion de entrega
              </label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => onSetAddress(e.target.value)}
                placeholder="Calle, numero, ciudad, provincia"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                  dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")
                }`}
              />
              {recentAddresses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentAddresses.map((address) => (
                    <button
                      key={address}
                      type="button"
                      onClick={() => onSetAddress(address)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${dk("border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a] hover:text-white", "border-[#e5e5e5] text-[#737373] hover:border-[#d4d4d4] hover:text-[#171717]")}`}
                    >
                      {address}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">Transporte</label>
                <select
                  value={shippingTransport}
                  onChange={(e) => onSetTransport(e.target.value as Transport)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                    dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")
                  }`}
                >
                  {(Object.keys(TRANSPORT_LABELS) as Transport[]).map((transport) => (
                    <option key={transport} value={transport}>{TRANSPORT_LABELS[transport]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">Costo ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={costLocked ? "0" : shippingCost}
                    onChange={(e) => onSetCost(e.target.value)}
                    disabled={manualCostLocked}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                      manualCostLocked
                        ? dk("bg-[#0d0d0d] border-[#1a1a1a] text-gray-600", "bg-[#f9f9f9] border-[#f0f0f0] text-gray-400")
                        : dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")
                    }`}
                  />
                </div>
                <div>
                  {freeShippingApplied ? (
                    <>
                      <label className="mb-1.5 block text-xs text-gray-500">Pago</label>
                      <div className={`w-full rounded-lg border px-3 py-2 text-xs ${dk("bg-[#0f241a] border-[#183a28] text-[#7de3ad]", "bg-[#eaf5ef] border-[#d4ebd8] text-[#25835a]")}`}>
                        Bonificado
                      </div>
                    </>
                  ) : (shippingTransport === "comisionista" || shippingTransport === "expreso" || shippingTransport === "otro") ? (
                    <>
                      <label className="mb-1.5 block text-xs text-gray-500">Pago</label>
                      <select
                        value={shippingPaymentType}
                        onChange={(e) => onSetPaymentType(e.target.value as "origen" | "destino")}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                          dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")
                        }`}
                      >
                        <option value="origen">En origen</option>
                        <option value="destino">En destino</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-xs text-gray-500">Pago</label>
                      <div className={`w-full rounded-lg border px-3 py-2 text-xs ${dk("bg-[#0d0d0d] border-[#1a1a1a] text-gray-600", "bg-[#f9f9f9] border-[#f0f0f0] text-gray-400")}`}>
                        En origen
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
