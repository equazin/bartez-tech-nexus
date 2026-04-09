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

  return (
    <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
        <Truck size={13} className="text-[#2D9F6A]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Logística / Envío</span>
      </div>
      <div className="px-4 py-4">
        <div className="flex gap-3 mb-4">
          {[
            { value: "retiro" as ShippingType, label: "Retiro en sucursal" },
            { value: "envio" as ShippingType, label: "Envío a destino" },
          ].map(({ value, label }) => (
            <label
              key={value}
              className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition
                ${shippingType === value
                  ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                  : dk("border-[#1f1f1f] hover:border-[#2a2a2a] text-gray-400", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500")
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
              <div className={`h-3 w-3 rounded-full border-2 shrink-0 flex items-center justify-center transition
                ${shippingType === value ? "border-[#2D9F6A]" : dk("border-[#404040]", "border-[#d4d4d4]")}`}>
                {shippingType === value && <div className="h-1.5 w-1.5 rounded-full bg-[#2D9F6A]" />}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </label>
          ))}
        </div>

        {shippingType === "envio" && (
          <div className="flex flex-col gap-3">
            {/* Postal code + estimate */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs block mb-1.5 text-gray-500">Código postal destino</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => onSetPostalCode(e.target.value)}
                  placeholder="Ej: 1425"
                  className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={onEstimate}
                  disabled={!postalCode.trim() || estimating}
                  className="h-[38px] px-3 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold rounded-lg transition disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5"
                >
                  <Truck size={12} /> Estimar
                </button>
              </div>
            </div>

            {/* Carrier estimate cards */}
            {shippingEstimates.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Tarifas estimadas</p>
                <div className="grid grid-cols-2 gap-2">
                  {shippingEstimates.map((est) => {
                    const isSelected = shippingTransport === est.carrier;
                    return (
                      <button
                        key={est.carrier}
                        type="button"
                        onClick={() => onSelectEstimate(est)}
                        className={`text-left p-2.5 rounded-lg border transition text-xs ${
                          isSelected
                            ? "border-[#2D9F6A] bg-[#2D9F6A]/10"
                            : dk("border-[#2a2a2a] hover:border-[#3a3a3a]", "border-[#e5e5e5] hover:border-[#d4d4d4]")
                        }`}
                      >
                        <p className={`font-bold mb-0.5 ${isSelected ? "text-[#2D9F6A]" : dk("text-white", "text-[#171717]")}`}>{est.label}</p>
                        <p className="text-[#2D9F6A] font-semibold tabular-nums">{formatPrice(est.price_usd)}</p>
                        <p className={`text-[10px] mt-0.5 ${dk("text-gray-500", "text-gray-500")}`}>{est.days_min}-{est.days_max} días h-biles</p>
                        {est.notes && <p className="text-[9px] text-amber-400 mt-0.5">{est.notes}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Address */}
            <div>
              <label className="text-xs block mb-1.5 text-gray-500">
                <MapPin size={11} className="inline mr-1" />
                Dirección de entrega
              </label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => onSetAddress(e.target.value)}
                placeholder="Calle, número, ciudad, provincia"
                className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                  ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
              />
              {recentAddresses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentAddresses.map((address) => (
                    <button
                      key={address}
                      type="button"
                      onClick={() => onSetAddress(address)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:border-[#3a3a3a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:border-[#d4d4d4]")}`}
                    >
                      {address}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Transport + cost */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs block mb-1.5 text-gray-500">Transporte</label>
                <select
                  value={shippingTransport}
                  onChange={(e) => onSetTransport(e.target.value as Transport)}
                  className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                >
                  {(Object.keys(TRANSPORT_LABELS) as Transport[]).map((t) => (
                    <option key={t} value={t}>{TRANSPORT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs block mb-1.5 text-gray-500">Costo ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={shippingPaymentType === "destino" ? "0" : shippingCost}
                    onChange={(e) => onSetCost(e.target.value)}
                    disabled={shippingPaymentType === "destino" || (shippingTransport !== "otro" && shippingTransport !== "comisionista" && shippingTransport !== "expreso" && !isAdmin)}
                    className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                      ${(shippingPaymentType === "destino" || (shippingTransport !== "otro" && shippingTransport !== "comisionista" && shippingTransport !== "expreso" && !isAdmin))
                        ? dk("bg-[#0d0d0d] border-[#1a1a1a] text-gray-600", "bg-[#f9f9f9] border-[#f0f0f0] text-gray-400")
                        : dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                  />
                </div>
                <div>
                  {(shippingTransport === "comisionista" || shippingTransport === "expreso" || shippingTransport === "otro") ? (
                    <>
                      <label className="text-xs block mb-1.5 text-gray-500">Pago</label>
                      <select
                        value={shippingPaymentType}
                        onChange={(e) => onSetPaymentType(e.target.value as "origen" | "destino")}
                        className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                          ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                      >
                        <option value="origen">En origen</option>
                        <option value="destino">En destino</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="text-xs block mb-1.5 text-gray-500">Pago</label>
                      <div className={`w-full text-xs rounded-lg px-3 py-2 border ${dk("bg-[#0d0d0d] border-[#1a1a1a] text-gray-600", "bg-[#f9f9f9] border-[#f0f0f0] text-gray-400")}`}>
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
