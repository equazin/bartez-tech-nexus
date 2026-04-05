import {
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  ClipboardPlus,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  ShoppingCart,
} from "lucide-react";

import { AssignedExecutiveSelect } from "@/components/admin/client360/AssignedExecutiveSelect";
import type { Client360Tag, Client360BadgeTone, ExecutiveOption } from "@/components/admin/client360/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

interface Client360HeaderProps {
  accountName: string;
  contactName: string;
  segmentLabel: string;
  marginLabel: string;
  scoreLabel: string;
  scoreTone: Client360BadgeTone;
  lastContactLabel: string;
  commercialStatusLabel: string;
  commercialStatusTone: Client360BadgeTone;
  tags: Client360Tag[];
  executiveOptions: ExecutiveOption[];
  selectedExecutiveId: string;
  onExecutiveChange: (value: string) => void;
  onSaveExecutive: () => void;
  executiveDirty: boolean;
  savingExecutive: boolean;
  onQuickCreateOrder: () => void;
  onQuickCreateQuote: () => void;
  onQuickAddNote: () => void;
  onQuickRegisterContact: () => void;
}

export function Client360Header({
  accountName,
  contactName,
  segmentLabel,
  marginLabel,
  scoreLabel,
  scoreTone,
  lastContactLabel,
  commercialStatusLabel,
  commercialStatusTone,
  tags,
  executiveOptions,
  selectedExecutiveId,
  onExecutiveChange,
  onSaveExecutive,
  executiveDirty,
  savingExecutive,
  onQuickCreateOrder,
  onQuickCreateQuote,
  onQuickAddNote,
  onQuickRegisterContact,
}: Client360HeaderProps) {
  return (
    <SurfaceCard tone="elevated" padding="sm" className="space-y-3 rounded-[20px] shadow-md shadow-black/5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Centro de control comercial</p>
            <h2 className="font-display text-[1.4rem] font-bold tracking-tight text-foreground">{accountName}</h2>
            <p className="text-[12px] text-muted-foreground">{contactName || "Sin contacto principal"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={commercialStatusTone}>{commercialStatusLabel}</Badge>
            <Badge variant="outline">{segmentLabel}</Badge>
            {tags.map((tag) => (
              <Badge key={tag.label} variant={tag.tone}>
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:min-w-[500px] xl:grid-cols-4">
          <HeaderStat label="Segmento" value={segmentLabel} icon={BriefcaseBusiness} />
          <HeaderStat label="Score comercial" value={scoreLabel} icon={ShieldAlert} tone={scoreTone} />
          <HeaderStat label="Ultimo contacto" value={lastContactLabel} icon={CalendarClock} />
          <HeaderStat label="Margen cliente" value={marginLabel} icon={CircleDollarSign} />
        </div>
      </div>

      <div className="grid gap-2 xl:grid-cols-[1.4fr_auto] xl:items-end">
        <AssignedExecutiveSelect
          value={selectedExecutiveId}
          options={executiveOptions}
          onChange={onExecutiveChange}
          disabled={savingExecutive}
        />
        <Button onClick={onSaveExecutive} disabled={!executiveDirty || savingExecutive} size="sm" className="xl:min-w-[156px]">
          {savingExecutive ? "Guardando..." : "Guardar responsable"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button onClick={onQuickCreateOrder} size="sm">
          <ShoppingCart className="h-4 w-4" />
          Crear pedido
        </Button>
        <Button variant="soft" onClick={onQuickCreateQuote} size="sm">
          <Send className="h-4 w-4" />
          Crear cotizacion
        </Button>
        <Button variant="toolbar" onClick={onQuickAddNote} size="sm">
          <ClipboardPlus className="h-4 w-4" />
          Agregar nota
        </Button>
        <Button variant="toolbar" onClick={onQuickRegisterContact} size="sm">
          <MessageSquarePlus className="h-4 w-4" />
          Registrar contacto
        </Button>
      </div>
    </SurfaceCard>
  );
}

interface HeaderStatProps {
  label: string;
  value: string;
  icon: typeof ShieldAlert;
  tone?: Client360BadgeTone;
}

function HeaderStat({ label, value, icon: Icon, tone = "outline" }: HeaderStatProps) {
  const toneClass = tone === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "destructive"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";

  return (
    <div className="rounded-[16px] border border-border/70 bg-surface px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`text-[12px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
