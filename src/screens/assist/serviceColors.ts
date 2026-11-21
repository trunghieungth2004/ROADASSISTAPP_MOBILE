const SERVICE_COLORS: Record<string, string> = {
  SOS: "#be123c",
  TOW: "#0284c7",
  WALK_IN: "#15803d",
  MECHANIC: "#15803d",
  BOOKING: "#7c3aed",
};

export function serviceColor(ticketType: string | null | undefined): string {
  if (ticketType === null || ticketType === undefined) return "#64748b";
  return SERVICE_COLORS[ticketType] ?? "#64748b";
}
