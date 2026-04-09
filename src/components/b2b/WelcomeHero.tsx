import { ArrowRight, BookOpen, MessageSquare, Package, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

interface WelcomeHeroProps {
  clientName: string;
  companyName?: string;
  creditDisplay?: string;
  activeAgreementName?: string;
  sellerName?: string;
  sellerUrl?: string;
  onGoToCatalog: () => void;
  onGoToQuotes: () => void;
  onGoToAccount: () => void;
}

const ACTION_CARDS = [
  {
    icon: Search,
    title: "Explorar catálogo",
    description: "Buscá por marca, categoría o SKU entre +2.000 productos IT con precios B2B.",
    cta: "Ir al catálogo",
    action: "catalog" as const,
    gradient: "from-emerald-500/15 to-teal-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Package,
    title: "Armar una cotización",
    description: "Agregá productos al carrito y guardá la propuesta para presentar a tu cliente.",
    cta: "Ver cotizaciones",
    action: "quotes" as const,
    gradient: "from-blue-500/15 to-indigo-500/10",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    icon: MessageSquare,
    title: "Hablar con tu vendedor",
    description: "Tu ejecutivo de cuenta está disponible por WhatsApp para ayudarte con cualquier consulta.",
    cta: "Abrir WhatsApp",
    action: "seller" as const,
    gradient: "from-violet-500/15 to-purple-500/10",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
];

export function WelcomeHero({
  clientName,
  companyName,
  creditDisplay,
  activeAgreementName,
  sellerName,
  sellerUrl,
  onGoToCatalog,
  onGoToQuotes,
  onGoToAccount,
}: WelcomeHeroProps) {
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  })();

  const displayName = clientName?.split(" ")[0] || companyName || "equipo";

  const handleAction = (action: "catalog" | "quotes" | "seller") => {
    switch (action) {
      case "catalog":
        onGoToCatalog();
        break;
      case "quotes":
        onGoToQuotes();
        break;
      case "seller":
        if (sellerUrl) window.open(sellerUrl, "_blank", "noopener,noreferrer");
        else onGoToAccount();
        break;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/60">
            <Sparkles size={12} />
            Cuenta activa
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {greeting}, {displayName}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Tu cuenta B2B está lista para operar. Elegí por dónde arrancar:
          </p>
        </div>

        {/* Account summary chips */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {creditDisplay && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              💳 Crédito: {creditDisplay}
            </span>
          )}
          {activeAgreementName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              📊 {activeAgreementName}
            </span>
          )}
          {sellerName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              👤 Vendedor: {sellerName}
            </span>
          )}
        </div>
      </div>

      {/* 3 Action Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {ACTION_CARDS.map(({ icon: Icon, title, description, cta, action, gradient, iconBg }) => (
          <button
            key={action}
            type="button"
            onClick={() => handleAction(action)}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-[24px] border border-border/70 bg-card p-5 text-left transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
            <div className="relative">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg} transition-transform group-hover:scale-110`}>
                <Icon size={20} />
              </div>
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <div className="relative flex items-center gap-1 text-xs font-bold text-primary transition-all group-hover:gap-2">
              {cta}
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Quick links */}
      <SurfaceCard tone="subtle" padding="lg">
        <div className="flex items-center gap-3">
          <BookOpen size={14} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">¿Primera vez?</span>{" "}
            Explorá el catálogo, sumá productos al carrito y elegí si comprar directo o guardar como cotización.
            Tu vendedor te contactará automáticamente para confirmar condiciones.
          </p>
        </div>
      </SurfaceCard>
    </div>
  );
}
