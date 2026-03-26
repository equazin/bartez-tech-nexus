/**
 * OrderPaymentProof
 * Per-order payment proof upload section in the B2B portal orders tab.
 * Allows clients to attach transfer receipts or echeqs to their orders.
 */
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Paperclip, Upload, X, CheckCircle2, Loader2, FileText, Image } from "lucide-react";

type ProofType = "transferencia" | "echeq" | "otro";

interface ProofEntry {
  id: string;
  type: ProofType;
  amount: string;
  date: string;
  fileName: string;
  fileUrl?: string;
}

interface OrderPaymentProofProps {
  orderId: string | number;
  existingProofs?: unknown[];
  isDark: boolean;
  onProofsUpdated: (proofs: ProofEntry[]) => void;
}

const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  transferencia: "Transferencia",
  echeq:         "Echeq",
  otro:          "Otro",
};

export function OrderPaymentProof({
  orderId,
  existingProofs,
  isDark,
  onProofsUpdated,
}: OrderPaymentProofProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [open,     setOpen]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const [proofType,   setProofType]   = useState<ProofType>("transferencia");
  const [amount,      setAmount]      = useState("");
  const [proofDate,   setProofDate]   = useState(new Date().toISOString().slice(0, 10));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse existing proofs (stored as unknown[] in DB)
  const parsed: ProofEntry[] = (() => {
    if (!existingProofs?.length) return [];
    try { return existingProofs as ProofEntry[]; }
    catch { return []; }
  })();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar 10 MB.");
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) { setError("Seleccioná un archivo."); return; }
    setUploading(true);
    setError(null);

    let fileUrl: string | undefined;

    // Try to upload to Supabase Storage (bucket: payment-proofs)
    const filePath = `${orderId}/${Date.now()}_${selectedFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, selectedFile, { upsert: false });

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filePath);
      fileUrl = urlData?.publicUrl;
    }
    // If bucket doesn't exist yet we still record the metadata

    const newProof: ProofEntry = {
      id:       Date.now().toString(),
      type:     proofType,
      amount:   amount.trim(),
      date:     proofDate,
      fileName: selectedFile.name,
      fileUrl,
    };

    const updated = [...parsed, newProof];

    // Persist to order row
    const { error: dbError } = await supabase
      .from("orders")
      .update({ payment_proofs: updated })
      .eq("id", orderId);

    setUploading(false);

    if (dbError) {
      setError(`Error al guardar: ${dbError.message}`);
      return;
    }

    onProofsUpdated(updated);
    setSuccess(true);
    setSelectedFile(null);
    setAmount("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setSuccess(false), 3000);
  }

  function fileIcon(name: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText size={13} className="text-red-400 shrink-0" />;
    return <Image size={13} className="text-blue-400 shrink-0" />;
  }

  return (
    <div className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-2.5 text-xs transition
          ${dk("text-gray-600 hover:text-gray-300", "text-gray-500 hover:text-gray-700")}`}
      >
        <span className="flex items-center gap-1.5">
          <Paperclip size={12} />
          Comprobantes de pago
          {parsed.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
              ${dk("bg-[#1c1c1c] text-[#2D9F6A]", "bg-green-50 text-[#2D9F6A]")}`}>
              {parsed.length}
            </span>
          )}
        </span>
        <span className={`text-[10px] transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-5 pb-4">

          {/* Existing proofs */}
          {parsed.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {parsed.map((p) => (
                <div key={p.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs
                    ${dk("bg-[#0d0d0d] border-[#222] text-gray-400", "bg-[#f9f9f9] border-[#e5e5e5] text-gray-600")}`}>
                  {fileIcon(p.fileName)}
                  <span className="font-medium">{PROOF_TYPE_LABELS[p.type]}</span>
                  {p.amount && <span className="tabular-nums">${p.amount}</span>}
                  <span className="text-gray-600">{p.date}</span>
                  <span className="truncate flex-1 min-w-0 text-gray-600">{p.fileName}</span>
                  {p.fileUrl && (
                    <a
                      href={p.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2D9F6A] hover:underline shrink-0"
                    >
                      Ver
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload form */}
          <div className={`rounded-xl border p-3 space-y-3 ${dk("border-[#1f1f1f] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
              Adjuntar comprobante
            </p>
            <div className="grid grid-cols-3 gap-2">
              {/* Type */}
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Tipo</label>
                <select
                  value={proofType}
                  onChange={(e) => setProofType(e.target.value as ProofType)}
                  className={`w-full text-xs outline-none rounded-lg px-2 py-1.5 border
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                >
                  {(Object.keys(PROOF_TYPE_LABELS) as ProofType[]).map((t) => (
                    <option key={t} value={t}>{PROOF_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              {/* Amount */}
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Monto</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`w-full text-xs outline-none rounded-lg px-2 py-1.5 border
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#525252]", "bg-white border-[#e5e5e5] text-[#171717] placeholder-[#a3a3a3]")}`}
                />
              </div>
              {/* Date */}
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Fecha</label>
                <input
                  type="date"
                  value={proofDate}
                  onChange={(e) => setProofDate(e.target.value)}
                  className={`w-full text-xs outline-none rounded-lg px-2 py-1.5 border
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                />
              </div>
            </div>

            {/* File picker */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id={`proof-file-${orderId}`}
              />
              <label
                htmlFor={`proof-file-${orderId}`}
                className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-3 py-3 cursor-pointer transition text-xs
                  ${selectedFile
                    ? dk("border-[#2D9F6A]/50 text-[#2D9F6A]", "border-[#2D9F6A]/40 text-[#2D9F6A]")
                    : dk("border-[#2a2a2a] text-gray-600 hover:border-[#404040]", "border-[#e5e5e5] text-gray-500 hover:border-[#d4d4d4]")
                  }`}
              >
                {selectedFile ? (
                  <>
                    {fileIcon(selectedFile.name)}
                    <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className={`ml-auto shrink-0 ${dk("hover:text-red-400", "hover:text-red-500")}`}
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    PDF o imagen (máx. 10 MB)
                  </>
                )}
              </label>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11px] text-red-400">{error}</p>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#2D9F6A]">
                <CheckCircle2 size={12} /> Comprobante cargado correctamente
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-semibold rounded-lg py-2 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              {uploading ? (
                <><Loader2 size={12} className="animate-spin" /> Subiendo…</>
              ) : (
                <><Upload size={12} /> Subir comprobante</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
