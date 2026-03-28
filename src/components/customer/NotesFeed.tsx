import { useState } from "react";
import {
  MessageSquare, Phone, Users, AlertTriangle, Calendar,
  Plus, Loader2, ChevronDown,
} from "lucide-react";
import type { ClientNote } from "@/lib/api/clientDetail";
import { addClientNote } from "@/lib/api/clientDetail";

// ── Tipo config ───────────────────────────────────────────────────────────────

type NoteType = ClientNote["tipo"];

const TIPO_CONFIG: Record<NoteType, { label: string; icon: any; cls: string }> = {
  nota:        { label: "Nota",        icon: MessageSquare, cls: "bg-gray-500/15 text-gray-400 border-gray-500/30"     },
  llamada:     { label: "Llamada",     icon: Phone,         cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"     },
  reunion:     { label: "Reunión",     icon: Users,         cls: "bg-purple-500/15 text-purple-400 border-purple-500/30"},
  alerta:      { label: "Alerta",      icon: AlertTriangle, cls: "bg-red-500/15 text-red-400 border-red-500/30"        },
  seguimiento: { label: "Seguimiento", icon: Calendar,      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const TIPOS: NoteType[] = ["nota", "llamada", "reunion", "alerta", "seguimiento"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  notes: ClientNote[];
  isDark?: boolean;
  onAdd: () => void; // callback para refrescar desde el padre
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function NotesFeed({ clientId, notes, isDark = true, onAdd }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [open,    setOpen]    = useState(false);
  const [body,    setBody]    = useState("");
  const [tipo,    setTipo]    = useState<NoteType>("nota");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);

  async function submit() {
    if (!body.trim()) { setErr("Escribí algo antes de guardar"); return; }
    setSaving(true);
    setErr("");
    try {
      await addClientNote(clientId, body.trim(), tipo);
      setBody("");
      setTipo("nota");
      setOpen(false);
      onAdd();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al guardar nota");
    } finally {
      setSaving(false);
    }
  }

  const selectedCfg = TIPO_CONFIG[tipo];
  const SelIcon     = selectedCfg.icon;

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${dk("border-[#1a1a1a]","border-[#f0f0f0]")}`}>
        <div className="flex items-center gap-2">
          <MessageSquare size={13} className="text-amber-400" />
          <span className={`text-sm font-bold ${dk("text-white","text-[#171717]")}`}>Notas CRM</span>
          <span className="text-xs text-[#525252]">{notes.length}</span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] text-white px-2.5 py-1 rounded-lg transition"
        >
          <Plus size={11} /> Nueva nota
        </button>
      </div>

      {/* New note form */}
      {open && (
        <div className={`px-4 py-3 border-b space-y-2 ${dk("border-[#1a1a1a] bg-[#0d0d0d]","border-[#f0f0f0] bg-[#fafafa]")}`}>
          {/* Tipo selector */}
          <div className="relative inline-block">
            <button
              onClick={() => setTipoOpen((o) => !o)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition ${selectedCfg.cls}`}
            >
              <SelIcon size={11} />
              <span>{selectedCfg.label}</span>
              <ChevronDown size={10} />
            </button>
            {tipoOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTipoOpen(false)} />
                <div className={`absolute left-0 top-full mt-1 w-40 border rounded-xl shadow-2xl z-20 overflow-hidden ${dk("bg-[#111] border-[#2a2a2a]","bg-white border-[#e5e5e5]")}`}>
                  {TIPOS.map((t) => {
                    const cfg = TIPO_CONFIG[t];
                    const Ic  = cfg.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => { setTipo(t); setTipoOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition ${dk("hover:bg-[#1a1a1a]","hover:bg-[#f5f5f5]")} ${tipo === t ? dk("bg-[#1a1a1a]","bg-[#f5f5f5]") : ""}`}
                      >
                        <Ic size={12} className={cfg.cls.split(" ")[0]} />
                        <span className={dk("text-[#a3a3a3]","text-[#525252]")}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Textarea */}
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribí una nota sobre este cliente…"
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#111] border-[#262626] text-white placeholder:text-[#404040]","bg-white border-[#e0e0e0] text-[#171717] placeholder:text-[#aaa]")}`}
          />
          {err && <p className="text-xs text-red-400">{err}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setBody(""); setErr(""); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#262626] text-[#737373] hover:text-white","border-[#e0e0e0] text-[#737373] hover:text-[#171717]")}`}
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2 text-[#525252]">
          <MessageSquare size={20} className="opacity-20" />
          <p className="text-xs">Sin notas aún</p>
        </div>
      ) : (
        <div className={`divide-y ${dk("divide-[#1a1a1a]","divide-[#f0f0f0]")}`}>
          {notes.map((n) => {
            const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.nota;
            const Ic  = cfg.icon;
            return (
              <div key={n.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border ${cfg.cls}`}>
                  <Ic size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold ${cfg.cls.split(" ")[1]}`}>{cfg.label}</span>
                    <span className="text-[10px] text-[#525252]">{fmtDate(n.created_at)}</span>
                  </div>
                  <p className={`text-xs whitespace-pre-wrap break-words ${dk("text-[#d4d4d4]","text-[#404040]")}`}>{n.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
