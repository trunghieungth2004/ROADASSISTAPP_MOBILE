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
};

function num(v: unknown): number | undefined {
  return typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
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
  return {
    ticketId: d.ticketId,
    ticketType: typeof d.ticketType === "string" ? d.ticketType : undefined,
    lat: num(d.lat),
    lng: num(d.lng),
    status: typeof d.status === "string" ? d.status : undefined,
  };
}
