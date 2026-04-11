import { useState, useEffect } from "react";
import { Building2, Loader2, MapPin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Badge } from "@/components/ui/badge";
import { updateClientProfile, fetchClientProfile, type ClientDetail } from "@/lib/api/clientDetail";
import type { UserProfile } from "@/lib/supabase";

interface AddressFields {
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
}

interface CompanyProfileEditorProps {
  profile: UserProfile;
  /** Pre-loaded detail (optional — will refetch if not provided) */
  initialDetail?: ClientDetail | null;
  onSaved?: () => void;
}

const EMPTY_ADDRESS: AddressFields = {
  calle: "",
  numero: "",
  ciudad: "",
  provincia: "",
  codigo_postal: "",
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
  mayorista: "Mayorista",
  reseller: "Reseller",
  empresa: "Empresa",
};

const PARTNER_LEVEL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

/** Validates Argentine CUIT format XX-XXXXXXXX-X and check digit. */
function validateCuit(raw: string): boolean {
  const digits = raw.replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = digits
    .slice(0, 10)
    .split("")
    .reduce((acc, d, i) => acc + parseInt(d, 10) * multipliers[i], 0);
  const remainder = sum % 11;
  const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return verifier === parseInt(digits[10], 10);
}

/** Normalize phone to +549XXXXXXXXXX if it looks like an Argentine mobile. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+549${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+549${digits.slice(1)}`;
  if (digits.length === 13 && digits.startsWith("549")) return `+${digits}`;
  return phone;
}

function addressFromJsonb(raw: unknown): AddressFields {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ADDRESS };
  const obj = raw as Record<string, string>;
  return {
    calle: obj.calle ?? "",
    numero: obj.numero ?? "",
    ciudad: obj.ciudad ?? "",
    provincia: obj.provincia ?? "",
    codigo_postal: obj.codigo_postal ?? "",
  };
}

export function CompanyProfileEditor({ profile, initialDetail, onSaved }: CompanyProfileEditorProps) {
  const [detail, setDetail] = useState<ClientDetail | null>(initialDetail ?? null);
  const [loading, setLoading] = useState(!initialDetail);

  const [companyName, setCompanyName] = useState(profile.company_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [cuitError, setCuitError] = useState("");
  const [billing, setBilling] = useState<AddressFields>({ ...EMPTY_ADDRESS });
  const [shipping, setShipping] = useState<AddressFields>({ ...EMPTY_ADDRESS });
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    if (initialDetail) {
      applyDetail(initialDetail);
      return;
    }
    let active = true;
    setLoading(true);
    fetchClientProfile(profile.id)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        applyDetail(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyDetail(d: ClientDetail) {
    setDetail(d);
    setCompanyName(d.company_name ?? "");
    setPhone(d.phone ?? "");
    const rawBilling = (d as unknown as Record<string, unknown>)["billing_address"];
    const rawShipping = (d as unknown as Record<string, unknown>)["shipping_addresses"];
    setBilling(addressFromJsonb(rawBilling));
    const shippingArr = Array.isArray(rawShipping) ? rawShipping : [];
    setShipping(addressFromJsonb(shippingArr[0] ?? null));
  }

  async function handleSave() {
    setSaveError("");
    setSaveSuccess("");

    const cuit = detail?.cuit ?? "";
    if (cuit && !validateCuit(cuit)) {
      setCuitError("CUIT inválido — verificá el formato XX-XXXXXXXX-X y el dígito verificador.");
      return;
    }
    setCuitError("");

    const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : "";
    const effectiveShipping = sameAsBilling ? { ...billing } : { ...shipping };

    setSaving(true);
    try {
      await updateClientProfile(profile.id, {
        company_name: companyName.trim() || undefined,
        phone: normalizedPhone || undefined,
        billing_address: billing as unknown as undefined,
        shipping_addresses: [effectiveShipping] as unknown as undefined,
      } as Parameters<typeof updateClientProfile>[1]);
      setSaveSuccess("Datos actualizados correctamente.");
      onSaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveSuccess(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Editable fields */}
      <SurfaceCard tone="default" padding="md" className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Datos de empresa</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Nombre / Empresa</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              placeholder="Ej. Distribuidora S.A."
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Teléfono</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              placeholder="+549XXXXXXXXXX"
            />
          </label>
        </div>

        {/* Read-only fields */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 pt-1">
          <ReadOnlyField label="Email" value={profile.email ?? "—"} />
          <ReadOnlyField
            label="Tipo de cliente"
            value={CLIENT_TYPE_LABEL[profile.client_type] ?? profile.client_type}
          />
          <ReadOnlyField
            label="Margen por defecto"
            value={`${profile.default_margin ?? 0}%`}
          />
          <ReadOnlyField
            label="Nivel"
            value={
              <Badge
                variant="outline"
                className="text-[11px]"
              >
                {PARTNER_LEVEL_LABEL[profile.partner_level ?? "cliente"] ?? "Cliente"}
              </Badge>
            }
          />
        </div>

        {detail?.cuit && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">CUIT</span>
            <p className="text-sm font-mono text-foreground">
              {detail.cuit}
              {!validateCuit(detail.cuit) && (
                <span className="ml-2 text-xs text-destructive">⚠ formato inválido</span>
              )}
            </p>
            {cuitError && <p className="text-xs text-destructive">{cuitError}</p>}
          </div>
        )}
      </SurfaceCard>

      {/* Billing address */}
      <SurfaceCard tone="default" padding="md" className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={15} className="text-blue-500" />
          <h3 className="text-sm font-bold text-foreground">Dirección de facturación</h3>
        </div>
        <AddressForm value={billing} onChange={setBilling} />
      </SurfaceCard>

      {/* Shipping address */}
      <SurfaceCard tone="default" padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-foreground">Dirección de entrega</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Misma que facturación
          </label>
        </div>
        {sameAsBilling ? (
          <p className="text-xs text-muted-foreground">Se usará la dirección de facturación.</p>
        ) : (
          <AddressForm value={shipping} onChange={setShipping} />
        )}
      </SurfaceCard>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saveSuccess && <span className="text-xs text-emerald-400">{saveSuccess}</span>}
        {saveError && <span className="text-xs text-destructive">{saveError}</span>}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function AddressForm({
  value,
  onChange,
}: {
  value: AddressFields;
  onChange: (val: AddressFields) => void;
}) {
  function field(key: keyof AddressFields, label: string, placeholder: string, wide?: boolean) {
    return (
      <label key={key} className={`space-y-1 ${wide ? "md:col-span-2" : ""}`}>
        <span className="text-xs text-muted-foreground">{label}</span>
        <input
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        />
      </label>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {field("calle", "Calle", "Ej. Av. Corrientes", true)}
      {field("numero", "Número", "1234")}
      {field("codigo_postal", "Código postal", "1405")}
      {field("ciudad", "Ciudad", "Buenos Aires")}
      {field("provincia", "Provincia", "CABA")}
    </div>
  );
}
