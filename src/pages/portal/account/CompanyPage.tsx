import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Users as UsersIcon, MapPin, Mail, Phone, Lock, Bell } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import UsersPage from "./UsersPage";
import BranchesPage from "./BranchesPage";

type TabKey = "perfil" | "usuarios" | "sucursales";

const TAB_KEYS: TabKey[] = ["perfil", "usuarios", "sucursales"];
const isValidTab = (v: string | null): v is TabKey => !!v && (TAB_KEYS as string[]).includes(v);

interface NotificationPreferences {
  invoiceDueAlerts: boolean;
  orderStatusAlerts: boolean;
  weeklySummary: boolean;
  stockAlerts: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  invoiceDueAlerts: true,
  orderStatusAlerts: true,
  weeklySummary: false,
  stockAlerts: false,
};

function notifPrefsKey(userId: string) {
  return `b2b_notification_preferences_${userId}`;
}

function loadNotifPrefs(userId: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(notifPrefsKey(userId));
    if (!raw) return DEFAULT_NOTIF_PREFS;
    return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(raw) as Partial<NotificationPreferences>) };
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export default function CompanyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : "perfil";

  function setTab(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Empresa"
        description="Datos de tu empresa, equipo y direcciones de envío."
      />

      <Tabs value={activeTab} onValueChange={setTab} className="mt-5">
        <TabsList className="w-full justify-start gap-1 sm:w-auto">
          <TabsTrigger value="perfil" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <UsersIcon className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="sucursales" className="gap-1.5">
            <MapPin className="h-4 w-4" />
            Sucursales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <CompanyProfileTab />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          {/* UsersPage already renders its own header. We strip it visually with negative margin? No — let it render normally inside the tab. */}
          <UsersPage />
        </TabsContent>
        <TabsContent value="sucursales" className="mt-4">
          <BranchesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AssignedSeller {
  name: string;
  email: string;
  phone: string | null;
}

function CompanyProfileTab() {
  const { profile: authProfile, user } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "";
  const [seller, setSeller] = useState<AssignedSeller | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => loadNotifPrefs(userId));

  useEffect(() => {
    setPrefs(loadNotifPrefs(userId));
  }, [userId]);

  useEffect(() => {
    const sellerId = profile?.assigned_seller_id ?? profile?.vendedor_id;
    if (!sellerId) {
      setSeller(null);
      return;
    }
    setLoadingSeller(true);
    supabase
      .from("profiles")
      .select("company_name, contact_name, email, phone")
      .eq("id", sellerId)
      .single()
      .then(({ data }) => {
        if (!data) {
          setSeller(null);
        } else {
          setSeller({
            name: data.company_name || data.contact_name || "Vendedor Bartez",
            email: data.email || "ventas@bartez.com.ar",
            phone: data.phone ?? null,
          });
        }
        setLoadingSeller(false);
      });
  }, [profile?.assigned_seller_id, profile?.vendedor_id]);

  function updatePref<K extends keyof NotificationPreferences>(key: K, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { localStorage.setItem(notifPrefsKey(userId), JSON.stringify(next)); } catch { /* ignore */ }
  }

  async function handleResetPassword() {
    const email = user?.email ?? profile?.email;
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    alert(`Te enviamos un email a ${email} para cambiar la contraseña.`);
  }

  if (!profile) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Datos fiscales */}
      <SurfaceCard tone="default" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="portal-h3">Datos fiscales</h3>
          <span className="text-xs text-muted-foreground">Sólo lectura</span>
        </div>
        <dl className="grid gap-2 text-sm">
          <Row label="Razón social" value={profile.razon_social ?? profile.company_name} />
          <Row label="Nombre fantasía" value={profile.company_name} />
          <Row label="CUIT" value={profile.cuit ?? "—"} mono />
          <Row label="Tipo de cliente" value={profile.client_type ?? "—"} />
          <Row label="Email" value={profile.email ?? user?.email ?? "—"} />
          <Row label="Teléfono" value={profile.phone ?? "—"} />
          {(profile.direccion || profile.ciudad || profile.provincia) && (
            <Row
              label="Dirección"
              value={[profile.direccion, profile.ciudad, profile.provincia].filter(Boolean).join(", ")}
            />
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          Si necesitás corregir datos fiscales, contactá a tu vendedor.
        </p>
      </SurfaceCard>

      {/* Vendedor asignado */}
      <SurfaceCard tone="default" padding="md" className="space-y-3">
        <h3 className="portal-h3">Tu vendedor</h3>
        {loadingSeller ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : seller ? (
          <div className="space-y-2">
            <p className="text-base font-semibold">{seller.name}</p>
            <a
              href={`mailto:${seller.email}`}
              className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {seller.email}
            </a>
            {seller.phone && (
              <a
                href={`https://wa.me/${seller.phone.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {seller.phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no tenés un vendedor asignado. Escribinos por WhatsApp o desde Soporte.
          </p>
        )}
      </SurfaceCard>

      {/* Notificaciones */}
      <SurfaceCard tone="default" padding="md" className="space-y-3 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <h3 className="portal-h3">Notificaciones</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Elegí qué avisos querés recibir por email.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PrefRow
            label="Facturas próximas a vencer"
            checked={prefs.invoiceDueAlerts}
            onChange={(v) => updatePref("invoiceDueAlerts", v)}
          />
          <PrefRow
            label="Cambios de estado en pedidos"
            checked={prefs.orderStatusAlerts}
            onChange={(v) => updatePref("orderStatusAlerts", v)}
          />
          <PrefRow
            label="Resumen semanal"
            checked={prefs.weeklySummary}
            onChange={(v) => updatePref("weeklySummary", v)}
          />
          <PrefRow
            label="Alertas de stock"
            checked={prefs.stockAlerts}
            onChange={(v) => updatePref("stockAlerts", v)}
          />
        </div>
      </SurfaceCard>

      {/* Seguridad mínima */}
      <SurfaceCard tone="subtle" padding="md" className="space-y-3 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <h3 className="portal-h3">Seguridad</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Te enviamos un link a tu email para cambiar la contraseña.
        </p>
        <Button variant="outline" onClick={handleResetPassword}>
          Cambiar contraseña
        </Button>
      </SurfaceCard>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-right text-sm ${mono ? "portal-sku" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function PrefRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <Label className="cursor-pointer text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
