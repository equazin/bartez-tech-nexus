import { supabase } from "@/lib/supabase";

export type PaymentProofType = "transferencia" | "echeq";

export interface PaymentProof {
  orderId: string;
  type: PaymentProofType;
  amount: number;
  date: string;
  filePath: string;
  publicUrl: string;
  uploadedAt: string;
}

const PROOFS_KEY = "b2b_order_payment_proofs";

type PaymentProofMap = Record<string, PaymentProof[]>;

function getMap(): PaymentProofMap {
  try {
    return JSON.parse(localStorage.getItem(PROOFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMap(value: PaymentProofMap) {
  localStorage.setItem(PROOFS_KEY, JSON.stringify(value));
}

export function getOrderProofs(orderId: string): PaymentProof[] {
  const map = getMap();
  return map[orderId] ?? [];
}

export function addOrderProof(orderId: string, proof: PaymentProof) {
  const map = getMap();
  const current = map[orderId] ?? [];
  map[orderId] = [proof, ...current];
  saveMap(map);
}

export async function uploadPaymentProof(
  userId: string,
  orderId: string,
  file: File
): Promise<{ filePath: string; publicUrl: string }> {
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const maxSizeBytes = 8 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato no permitido. Subí PDF, PNG, JPG o WEBP.");
  }
  if (file.size > maxSizeBytes) {
    throw new Error("El archivo supera 8MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${userId}/${orderId}/${safeName}`;

  const { error } = await supabase.storage.from("payment-proofs").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);
  return { filePath, publicUrl: data.publicUrl };
}
