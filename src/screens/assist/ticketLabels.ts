import type {Strings} from "../../i18n/en";

export function ticketStatusLabel(status: string, t: Strings): string {
  if (status === "2") return t.assist.statusMatched;
  if (status === "3") return t.assist.statusArrived;
  if (status === "4") return t.assist.statusResolved;
  if (status === "5") return t.assist.statusCancelled;
  return t.assist.statusPending;
}

export function ticketTypeLabel(ticketType: string, t: Strings): string {
  if (ticketType === "TOW") return t.assist.typeTow;
  if (ticketType === "SOS") return t.assist.typeSos;
  if (ticketType === "MECHANIC") return t.assist.typeMechanic;
  return ticketType;
}

export function ticketTitle(
  ticket: {ticketType: string; status: string},
  t: Strings,
): string {
  return `${ticketTypeLabel(ticket.ticketType, t)} · ${ticketStatusLabel(ticket.status, t)}`;
}
