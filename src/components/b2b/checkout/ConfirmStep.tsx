import { useState } from "react";
import {
  CheckCircle2, FileDown, FileText, Save, Bookmark,
  Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";

export interface ConfirmStepProps {
  internalReference: string;
  notes: string;
  approvalReason: string;
  showAdvanced: boolean;
  cartItemCount: number;
  // Validation
  validationErrors: string[];
  blockingIssues: string[];
  // Actions
  orderSubmitting: boolean;
  reviewSubmitting: boolean;
  listSaved: boolean;
  draftSaved: boolean;
  templateSaved: boolean;
  reviewRequested: boolean;
  isDark: boolean;
  onSetInternalReference: (v: string) => void;
  onSetNotes: (n: string) => void;
  onSetApprovalReason: (r: string) => void;
  onConfirmOrder: () => void;
  onSaveQuote: () => void;
  onExportPDF: () => void;
  onSaveDraft: () => void;
  onSaveList: () => void;
  onRequestReview: () => void;
}

export function ConfirmStep({
  internalReference,
  notes,
  approvalReason,
  showAdvanced,
  cartItemCount,
  validationErrors,
  blockingIssues,
  orderSubmitting,
  reviewSubmitting,
  listSaved,
  draftSaved,
  templateSaved,
  reviewRequested,
  isDark,
  onSetInternalReference,
  onSetNotes,
  onSetApprovalReason,
  onConfirmOrder,
  onSaveQuote,
  onExportPDF,
  onSaveDraft,
  onSaveList,
  onRequestReview,
}: ConfirmStepProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [showSecondary, setShowSecondary] = useState(false);
  const hasBlockingErrors = blockingIssues.length > 0;
  const canConfirm = cartItemCount > 0 && !hasBlockingErrors;

  return (
    <div className="flex flex-col gap-5">
      <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
          <FileText size={13} className="text-[#2D9F6A]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Datos Corporativos (Opcional)</span>
        </div>
        <div className="px-4 py-3 border-b border-border/40">
          <label className="text-xs font-semibold block mb-1.5 text-foreground">Nº de Orden de Compra (PO)</label>
          <input
            type="text"
            value={internalReference}
            onChange={(e) => onSetInternalReference(e.target.value)}
            placeholder="Ej: PO-2023-458"
            className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
              ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Usá este campo si tu empresa requiere que la factura salga acompañada de un número de Orden de Compra interno.</p>
        </div>
        <div className="px-4 py-4">
          <label className="text-xs font-semibold block mb-1.5 text-foreground">Observaciones de entrega</label>
          <textarea
            value={notes}
            onChange={(e) => onSetNotes(e.target.value)}
            rows={3}
            placeholder="Notas del pedido, condiciones de entrega, aclaraciones especiales..."
            className={`w-full text-sm outline-none rounded-lg px-3 py-2.5 border resize-none transition
              ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
          />
          {showAdvanced && (
            <div className="mt-3">
              <label className="text-xs block mb-1.5 text-gray-500">Motivo de revisión / excepción comercial</label>
              <textarea
                value={approvalReason}
                onChange={(e) => onSetApprovalReason(e.target.value)}
                rows={2}
                placeholder="Explicá acá si necesitás una condición especial antes de confirmar"
                className={`w-full text-sm outline-none rounded-lg px-3 py-2.5 border resize-none transition
                  ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
              />
            </div>
          )}
        </div>
      </section>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={12} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-bold text-red-400">No se puede confirmar</span>
          </div>
          <ul className="space-y-0.5">
            {validationErrors.map((e, i) => (
              <li key={i} className="text-[11px] text-red-300">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Feedback indicators */}
      {listSaved && <FeedbackBanner icon={<CheckCircle2 size={12} />} text="Lista guardada correctamente" color="green" />}
      {templateSaved && <FeedbackBanner icon={<CheckCircle2 size={12} />} text="Plantilla de compra guardada" color="emerald" />}
      {draftSaved && <FeedbackBanner icon={<CheckCircle2 size={12} />} text="Borrador del checkout guardado" color="blue" />}
      {reviewRequested && <FeedbackBanner icon={<Sparkles size={12} />} text="Se envió a revisión comercial como cotización" color="amber" />}

      {/* Actions section */}
      <div className="space-y-3">
        {/* Primary CTA */}
        <button
          disabled={!canConfirm || orderSubmitting}
          onClick={onConfirmOrder}
          className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-[0.98] text-white font-bold rounded-xl py-3.5 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {orderSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Confirmando pedido...
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              Confirmar pedido
            </>
          )}
        </button>

        {/* Save Quote - prominent secondary */}
        <button
          onClick={onSaveQuote}
          disabled={cartItemCount === 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
            ${dk("border-[#2D9F6A]/40 bg-[#0d1f17] text-[#7de3ad] hover:bg-[#133222]", "border-[#bde5d0] bg-green-50 text-[#1f6c48] hover:bg-green-100")}`}
        >
          <FileText size={14} />
          Guardar cotización
        </button>

        {/* Secondary actions dropdown */}
        <div>
          <button
            type="button"
            onClick={() => setShowSecondary((v) => !v)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition
              ${dk("border-[#262626] text-gray-400 hover:text-gray-200 hover:border-[#333]", "border-[#e5e5e5] text-[#737373] hover:text-[#525252] hover:border-[#d4d4d4]")}`}
          >
            {showSecondary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showSecondary ? "Ocultar más opciones" : "Más opciones"}
          </button>

          {showSecondary && (
            <div className="mt-2 space-y-2">
              <SecondaryButton
                icon={<FileDown size={14} />}
                label="Generar cotización PDF"
                onClick={onExportPDF}
                disabled={cartItemCount === 0}
                isDark={isDark}
              />
              <SecondaryButton
                icon={<Save size={14} />}
                label="Guardar borrador"
                onClick={onSaveDraft}
                disabled={cartItemCount === 0}
                isDark={isDark}
              />
              <SecondaryButton
                icon={<Bookmark size={14} />}
                label="Guardar como lista"
                onClick={onSaveList}
                disabled={cartItemCount === 0}
                isDark={isDark}
              />
              {showAdvanced && (
                <SecondaryButton
                  icon={reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  label="Solicitar revisión comercial"
                  onClick={onRequestReview}
                  disabled={cartItemCount === 0 || reviewSubmitting}
                  isDark={isDark}
                  variant="amber"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecondaryButton({
  icon,
  label,
  onClick,
  disabled,
  isDark,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  isDark: boolean;
  variant?: "amber";
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const classes = variant === "amber"
    ? dk("border-[#3a2c10] hover:border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-[#241a08]", "border-amber-200 hover:border-amber-300 text-amber-700 hover:text-amber-800 hover:bg-amber-50")
    : dk("border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-gray-200 hover:bg-[#171717]", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500 hover:text-gray-700");

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none ${classes}`}
    >
      {icon}
      {label}
    </button>
  );
}

function FeedbackBanner({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div className={`p-2.5 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center gap-2`}>
      <span className={`text-${color}-400 shrink-0`}>{icon}</span>
      <span className={`text-[11px] text-${color}-300`}>{text}</span>
    </div>
  );
}
