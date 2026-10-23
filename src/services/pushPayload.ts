export type HazardPushData = {
  flagId: string;
  type?: string;
  status?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  removed?: boolean;
};

export type DispatchPushData = {
  ticketId: string;
  ticketType?: string;
  lat?: number;
  lng?: number;
  status?: string;
  declineReason?: string;
  urgent?: boolean;
  kind?: string;
  paymentStatus?: string;
};

export type PaymentPushData = {
  event: string;
  paymentId: string;
  ticketId: string;
  payoutId?: string;
};

function num(v: unknown): number | undefined {
  return typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
}

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parseHazardPush(data: unknown): HazardPushData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.flagId !== "string" || d.flagId === "") return null;
  return {
    flagId: d.flagId,
    type: typeof d.type === "string" ? d.type : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    lat: num(d.lat),
    lng: num(d.lng),
    radiusMeters: num(d.radiusMeters),
    removed: d.removed === true || d.removed === "true" || undefined,
  };
}

export function parseDispatchPush(data: unknown): DispatchPushData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.ticketId !== "string" || d.ticketId === "") return null;
  const kindRaw = typeof d.kind === "string" ? d.kind : typeof d.type === "string" ? d.type : undefined;
  const payRaw = typeof d.paymentStatus === "string" ? d.paymentStatus : typeof d.payment_status === "string" ? d.payment_status : undefined;
  return {
    ticketId: d.ticketId,
    ticketType: typeof d.ticketType === "string" ? d.ticketType : undefined,
    lat: num(d.lat),
    lng: num(d.lng),
    status: typeof d.status === "string" ? d.status : undefined,
    declineReason: typeof d.declineReason === "string" ? d.declineReason : undefined,
    urgent: d.urgent === true || d.urgent === "true" || undefined,
    kind: kindRaw,
    paymentStatus: payRaw,
  };
}

export function parsePaymentPush(data: unknown): PaymentPushData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.screen === "string" && d.screen !== "" && d.screen !== "payments") return null;
  const event = text(d.event);
  const paymentId = text(d.paymentId);
  const ticketId = text(d.ticketId);
  const payoutId = text(d.payoutId);
  if (event === "") return null;
  if (paymentId === "" && ticketId === "" && payoutId === "") return null;
  return {
    event,
    paymentId,
    ticketId,
    ...(payoutId === "" ? {} : {payoutId}),
  };
}
