import type { RefObject } from "react";
import { AlertCircle, Headset, RefreshCcw, ShieldAlert, StickyNote, Ticket } from "lucide-react";

import { ClientUnifiedTimeline } from "@/components/admin/client360/ClientUnifiedTimeline";
import type { PriorityAction, SupportSummary, TimelineItem } from "@/components/admin/client360/types";
import type { ClientNote } from "@/lib/api/clientDetail";
import type { RmaRequest } from "@/hooks/useRma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";

interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  priority: string;
  updated_at: string;
}

interface ClientActionRailProps {
  executiveName: string;
  priorities: PriorityAction[];
  supportSummary: SupportSummary;
  tickets: SupportTicketSummary[];
  rmas: RmaRequest[];
  noteType: ClientNote["tipo"];
  noteBody: string;
  onNoteTypeChange: (value: ClientNote["tipo"]) => void;
  onNoteBodyChange: (value: string) => void;
  onAddNote: () => void;
  savingNote: boolean;
  notes: ClientNote[];
  timelineItems: TimelineItem[];
  noteTextareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ClientActionRail({
  executiveName,
  priorities,
  supportSummary,
  tickets,
  rmas,
  noteType,
  noteBody,
  onNoteTypeChange,
  onNoteBodyChange,
  onAddNote,
  savingNote,
  notes,
  timelineItems,
  noteTextareaRef,
}: ClientActionRailProps) {
  return (
    <div className="space-y-2">
      <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Que tengo que hacer ahora</p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Prioridades de seguimiento</h3>
        </div>
        {priorities.length === 0 ? (
          <EmptyState
            title="Sin pendientes criticos"
            description="La cuenta no muestra alertas inmediatas. El siguiente paso puede ser empujar recompra o expansion."
            icon={<AlertCircle className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-1.5">
            {priorities.map((item) => (
              <div key={item.title} className="rounded-[14px] border border-border/70 bg-surface px-2.5 py-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-foreground">{item.title}</p>
                  <Badge variant={item.tone}>{item.tone}</Badge>
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Soporte concierge</p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Ventas, soporte y postventa</h3>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <SupportStat label="Responsable" value={executiveName} icon={Headset} />
          <SupportStat label="SLA" value={supportSummary.slaLabel} icon={ShieldAlert} />
          <SupportStat label="Tickets activos" value={String(supportSummary.openTickets)} icon={Ticket} />
          <SupportStat label="RMAs activos" value={String(supportSummary.activeRmas)} icon={RefreshCcw} />
        </div>
        {supportSummary.latestSubject ? (
          <div className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Caso mas reciente</p>
            <p className="mt-0.5 text-[12px] font-semibold text-foreground">{supportSummary.latestSubject}</p>
            {supportSummary.latestUpdatedLabel ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{supportSummary.latestUpdatedLabel}</p>
            ) : null}
            <div className="mt-1.5">
              <Badge variant={supportSummary.slaTone}>{supportSummary.slaLabel}</Badge>
            </div>
          </div>
        ) : null}
        {tickets.length > 0 ? (
          <div className="space-y-1.5">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">{ticket.subject}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {ticket.status} ? {ticket.priority}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{ticket.updated_at}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {rmas.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {rmas.slice(0, 3).map((rma) => (
              <Badge key={rma.id} variant="outline">
                {rma.rma_number} ? {rma.status}
              </Badge>
            ))}
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Seguimiento</p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Notas CRM</h3>
        </div>
        <div className="flex gap-1.5">
          <select
            value={noteType}
            onChange={(event) => onNoteTypeChange(event.target.value as ClientNote["tipo"])}
            className="flex h-9 rounded-lg border border-input/80 bg-card px-3 py-2 text-[12px]"
          >
            <option value="nota">Nota</option>
            <option value="llamada">Llamada</option>
            <option value="reunion">Reunion</option>
            <option value="alerta">Alerta</option>
            <option value="seguimiento">Seguimiento</option>
          </select>
          <Button onClick={onAddNote} disabled={savingNote || !noteBody.trim()} size="sm" className="shrink-0">
            {savingNote ? "Guardando..." : "Agregar nota"}
          </Button>
        </div>
        <textarea
          ref={noteTextareaRef}
          rows={3}
          value={noteBody}
          onChange={(event) => onNoteBodyChange(event.target.value)}
          placeholder="Registrar contexto comercial, llamada, seguimiento o acuerdo."
          className="w-full rounded-[14px] border border-input/80 bg-card px-3 py-2 text-[12px] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/90 focus-visible:ring-2 focus-visible:ring-ring"
        />
        {notes.length === 0 ? (
          <EmptyState
            title="Sin notas cargadas"
            description="Usa este bloque para registrar llamados, seguimientos y acuerdos comerciales."
            icon={<StickyNote className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-1.5">
            {notes.slice(0, 4).map((note) => (
              <div key={note.id} className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline">{note.tipo}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(note.created_at).toLocaleDateString("es-AR")}</span>
                </div>
                <p className="text-[12px] leading-5 text-foreground">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <ClientUnifiedTimeline items={timelineItems} />
    </div>
  );
}

interface SupportStatProps {
  label: string;
  value: string;
  icon: typeof Headset;
}

function SupportStat({ label, value, icon: Icon }: SupportStatProps) {
  return (
    <div className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-[12px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
