import type { ClientNote } from "@/lib/api/clientDetail";

export type PortalAccessRole = "comprador" | "aprobador" | "admin_cuenta";
export type PortalAccessStatus = "pending" | "active" | "blocked";

export interface PortalAccessRecord {
  id: string;
  clientId: string;
  fullName: string;
  email: string;
  role: PortalAccessRole;
  status: PortalAccessStatus;
  allowedBranches: string[];
  orderLimit: number;
  comment: string;
  createdAt: string;
}

interface AccessDraft {
  fullName: string;
  email: string;
  role: PortalAccessRole;
  status: PortalAccessStatus;
  allowedBranches: string[];
  orderLimit: number;
  comment?: string;
}

const ACCESS_NOTE_REGEX =
  /^\[ACCESS:([A-Z_]+)\|([A-Z_]+)\|([^|]*)\|([^|]*)\|([^|]*)\|([^\]]*)\]\s*/i;

export const ACCESS_ROLE_LABELS: Record<PortalAccessRole, string> = {
  comprador: "Comprador",
  aprobador: "Aprobador",
  admin_cuenta: "Admin cuenta",
};

export const ACCESS_STATUS_LABELS: Record<PortalAccessStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  blocked: "Bloqueado",
};

function sanitizeSegment(value: string) {
  return value.replace(/[|\]]/g, " ").trim();
}

export function isAccessNote(body: string) {
  return body.startsWith("[ACCESS:");
}

export function formatAccessNote(draft: AccessDraft): string {
  const branches = draft.allowedBranches
    .map((branch) => sanitizeSegment(branch))
    .filter(Boolean)
    .join(",");

  return `[ACCESS:${draft.role.toUpperCase()}|${draft.status.toUpperCase()}|${sanitizeSegment(
    draft.email
  )}|${sanitizeSegment(draft.fullName)}|${branches || "-"}|${Math.max(
    0,
    Number(draft.orderLimit) || 0
  )}] ${sanitizeSegment(draft.comment ?? "")}`.trim();
}

export function parseAccessNote(note: Pick<ClientNote, "id" | "client_id" | "body" | "created_at">): PortalAccessRecord | null {
  const match = note.body.match(ACCESS_NOTE_REGEX);
  if (!match) return null;

  return {
    id: note.id,
    clientId: note.client_id,
    role: match[1].toLowerCase() as PortalAccessRole,
    status: match[2].toLowerCase() as PortalAccessStatus,
    email: match[3].trim(),
    fullName: match[4].trim(),
    allowedBranches:
      match[5].trim() && match[5].trim() !== "-"
        ? match[5]
            .split(",")
            .map((branch) => branch.trim())
            .filter(Boolean)
        : [],
    orderLimit: Number(match[6]) || 0,
    comment: note.body.replace(ACCESS_NOTE_REGEX, "").trim(),
    createdAt: note.created_at,
  };
}

export function extractAccessRecords(
  notes: Array<Pick<ClientNote, "id" | "client_id" | "body" | "created_at">>
): PortalAccessRecord[] {
  return notes
    .map(parseAccessNote)
    .filter((note): note is PortalAccessRecord => Boolean(note))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
