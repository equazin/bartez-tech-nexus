export interface CheckoutOrderMeta {
  internalReference: string;
  branchName: string;
  receiverContact: string;
  requestedDate: string;
  finalClientName: string;
  quoteValidityDays: number;
  commercialMessage: string;
  approvalReason: string;
}

export interface CheckoutDraft {
  cart: Record<number, number>;
  resellerMode: boolean;
  resellerMargin: number;
  paymentMethod: string;
  echeqTermDays: number;
  currentAccountSharePct: number;
  shippingType: string;
  shippingAddress: string;
  shippingTransport: string;
  shippingCost: string;
  postalCode: string;
  notes: string;
  orderMeta: CheckoutOrderMeta;
  savedAt: string;
}

export interface CheckoutTemplate {
  id: string;
  name: string;
  clientType: string;
  branchName: string;
  paymentMethod: string;
  shippingType: string;
  shippingTransport: string;
  cart: Record<number, number>;
  notes: string;
  orderMeta: CheckoutOrderMeta;
  createdAt: string;
}

const RECENT_SHIPPING_LIMIT = 5;
const TEMPLATE_LIMIT = 12;

function draftKey(userId: string) {
  return `b2b_checkout_draft_${userId}`;
}

function addressesKey(userId: string) {
  return `b2b_recent_shipping_addresses_${userId}`;
}

function templatesKey(userId: string) {
  return `b2b_checkout_templates_${userId}`;
}

export function createEmptyOrderMeta(): CheckoutOrderMeta {
  return {
    internalReference: "",
    branchName: "",
    receiverContact: "",
    requestedDate: "",
    finalClientName: "",
    quoteValidityDays: 15,
    commercialMessage: "",
    approvalReason: "",
  };
}

export function readCheckoutDraft(userId: string): CheckoutDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft;
    return {
      ...parsed,
      orderMeta: {
        ...createEmptyOrderMeta(),
        ...(parsed.orderMeta ?? {}),
      },
    };
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(userId: string, draft: CheckoutDraft): CheckoutDraft {
  const nextDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(draftKey(userId), JSON.stringify(nextDraft));
  return nextDraft;
}

export function clearCheckoutDraft(userId: string): void {
  localStorage.removeItem(draftKey(userId));
}

export function getRecentShippingAddresses(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(addressesKey(userId)) || "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberShippingAddress(userId: string, address: string): string[] {
  const normalized = address.trim();
  if (!normalized) return getRecentShippingAddresses(userId);
  const all = [
    normalized,
    ...getRecentShippingAddresses(userId).filter((item) => item !== normalized),
  ].slice(0, RECENT_SHIPPING_LIMIT);
  localStorage.setItem(addressesKey(userId), JSON.stringify(all));
  return all;
}

export function readCheckoutTemplates(userId: string): CheckoutTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(templatesKey(userId)) || "[]") as CheckoutTemplate[];
  } catch {
    return [];
  }
}

export function saveCheckoutTemplate(userId: string, template: Omit<CheckoutTemplate, "id" | "createdAt">): CheckoutTemplate[] {
  const nextTemplate: CheckoutTemplate = {
    ...template,
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const nextTemplates = [nextTemplate, ...readCheckoutTemplates(userId)].slice(0, TEMPLATE_LIMIT);
  localStorage.setItem(templatesKey(userId), JSON.stringify(nextTemplates));
  return nextTemplates;
}

export function deleteCheckoutTemplate(userId: string, templateId: string): CheckoutTemplate[] {
  const nextTemplates = readCheckoutTemplates(userId).filter((template) => template.id !== templateId);
  localStorage.setItem(templatesKey(userId), JSON.stringify(nextTemplates));
  return nextTemplates;
}

export function buildOrderNotes(baseNotes: string, meta: CheckoutOrderMeta): string {
  const sections: string[] = [];
  const cleanedBase = baseNotes.trim();
  if (cleanedBase) {
    sections.push(cleanedBase);
  }

  const operationalLines = [
    meta.internalReference ? `Referencia / OC: ${meta.internalReference}` : null,
    meta.branchName ? `Sucursal / destino: ${meta.branchName}` : null,
    meta.receiverContact ? `Contacto de recepción: ${meta.receiverContact}` : null,
    meta.requestedDate ? `Fecha requerida: ${meta.requestedDate}` : null,
    meta.finalClientName ? `Cliente final: ${meta.finalClientName}` : null,
  ].filter((line): line is string => Boolean(line));

  if (operationalLines.length > 0) {
    sections.push(`Datos operativos:\n${operationalLines.map((line) => `- ${line}`).join("\n")}`);
  }

  if (meta.commercialMessage.trim()) {
    sections.push(`Mensaje comercial:\n${meta.commercialMessage.trim()}`);
  }

  if (meta.approvalReason.trim()) {
    sections.push(`Motivo de revisión / excepción:\n${meta.approvalReason.trim()}`);
  }

  return sections.join("\n\n").trim();
}
