import { useEffect, useMemo, useState } from "react";
import { LifeBuoy, MessageSquare, Phone, Mail, Send, Sparkles } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useClientNotes } from "@/hooks/useClientNotes";
import { supabase } from "@/lib/supabase";

import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "¿Cómo cambio mi dirección de envío?",
    a: "Entrá a Mi cuenta → Empresa → Sucursales y cargá la dirección. Vas a poder elegirla en el checkout.",
  },
  {
    q: "¿Qué métodos de pago aceptan?",
    a: "Transferencia bancaria, eCheq, depósito, cuenta corriente (si tenés crédito) y otras según tu acuerdo. Lo configurás al confirmar el pedido.",
  },
  {
    q: "¿Cuánto tarda la entrega?",
    a: "Para Rosario y zona, 24–48hs. Resto del país, 2–5 días hábiles según el transporte. Vas a ver el tracking dentro de Pedidos.",
  },
  {
    q: "¿Cómo armo una cotización?",
    a: "Desde Cotizaciones → Nueva cotización express, o agregando productos al carrito y eligiendo Solicitar cotización en lugar de Confirmar pedido.",
  },
  {
    q: "¿Qué hago si recibo un producto defectuoso?",
    a: "Generá una solicitud RMA desde Pedidos → Devoluciones, indicando el pedido y el motivo. Te respondemos en 24hs hábiles.",
  },
];

const TICKET_PREFIX = "[PORTAL:SUPPORT_TICKET]";

interface AssignedSeller {
  name: string;
  email: string;
  phone: string | null;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function isSupportTicket(noteBody: string): boolean {
  return noteBody.startsWith(TICKET_PREFIX);
}

function stripTicketPrefix(noteBody: string): string {
  return noteBody.replace(/^\[PORTAL:SUPPORT_TICKET\]\s*/, "");
}

function extractSubject(noteBody: string): { subject: string; body: string } {
  const stripped = stripTicketPrefix(noteBody);
  const lines = stripped.split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  if (firstLine.startsWith("Asunto:")) {
    return {
      subject: firstLine.replace(/^Asunto:\s*/, ""),
      body: lines.slice(1).join("\n").trim(),
    };
  }
  return { subject: stripped.slice(0, 60), body: stripped };
}

export default function SupportPage() {
  const { toast } = useToast();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const [seller, setSeller] = useState<AssignedSeller | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { notes, loading: notesLoading, add } = useClientNotes(clientId);

  const recentTickets = useMemo(
    () => notes.filter((n) => isSupportTicket(n.body)).slice(0, 5),
    [notes],
  );

  useEffect(() => {
    const sellerId = profile?.assigned_seller_id ?? profile?.vendedor_id;
    if (!sellerId) {
      setSeller(null);
      return;
    }
    supabase
      .from("profiles")
      .select("company_name, contact_name, email, phone")
      .eq("id", sellerId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSeller({
          name: data.company_name || data.contact_name || "Vendedor Bartez",
          email: data.email || "ventas@bartez.com.ar",
          phone: data.phone ?? null,
        });
      });
  }, [profile?.assigned_seller_id, profile?.vendedor_id]);

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    const ticketBody = `${TICKET_PREFIX}\nAsunto: ${subject.trim()}\n\n${body.trim()}`;
    const ok = await add(ticketBody, "alerta");
    setSubmitting(false);
    if (!ok) {
      toast({ title: "No se pudo enviar el ticket", variant: "destructive" });
      return;
    }
    setSubject("");
    setBody("");
    toast({ title: "Ticket enviado", description: "Te respondemos en menos de 24hs hábiles." });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Soporte"
        description="Hablá con tu vendedor, abrí un ticket o consultá las preguntas frecuentes."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vendedor asignado */}
        <SurfaceCard tone="default" padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="portal-h3">Tu vendedor</h2>
          </div>
          {seller ? (
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
                  WhatsApp {seller.phone}
                </a>
              )}
              <p className="pt-2 text-xs text-muted-foreground">
                Disponibilidad: lunes a viernes 9–18hs. Por urgencias fuera de horario, abrí un ticket.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no tenés un vendedor asignado. Mientras tanto podés escribirnos a{" "}
              <a href="mailto:ventas@bartez.com.ar" className="text-brand-600 hover:underline">
                ventas@bartez.com.ar
              </a>
              .
            </p>
          )}
        </SurfaceCard>

        {/* Crear ticket */}
        <SurfaceCard tone="default" padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <h2 className="portal-h3">Abrir ticket</h2>
          </div>
          <form onSubmit={handleSubmitTicket} className="space-y-3">
            <div>
              <Label htmlFor="ticket-subject">Asunto</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej. Consulta sobre stock en SKU XYZ"
                disabled={submitting}
                required
              />
            </div>
            <div>
              <Label htmlFor="ticket-body">Detalle</Label>
              <Textarea
                id="ticket-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Contanos en qué podemos ayudarte. Mencioná números de pedido o factura si aplica."
                rows={4}
                disabled={submitting}
                required
              />
            </div>
            <Button type="submit" className="gap-2" disabled={submitting || !subject.trim() || !body.trim()}>
              <Send className="h-4 w-4" />
              Enviar ticket
            </Button>
          </form>
        </SurfaceCard>
      </div>

      {/* Tickets recientes */}
      <SurfaceCard tone="default" padding="md" className="space-y-3">
        <h2 className="portal-h3">Tus tickets recientes</h2>
        {notesLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : recentTickets.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            Aún no abriste tickets. Cuando lo hagas, los vas a ver acá.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recentTickets.map((note) => {
              const { subject, body } = extractSubject(note.body);
              return (
                <div key={note.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{subject || "Ticket sin asunto"}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{body}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className="text-xs">
                      Enviado
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(note.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* FAQ */}
      <SurfaceCard tone="subtle" padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4" />
          <h2 className="portal-h3">Preguntas frecuentes</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className="text-sm font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SurfaceCard>
    </div>
  );
}
