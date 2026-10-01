import type {DispatchTicket} from "../../api/dispatch";

export function ticketById(list: DispatchTicket[], id: string): DispatchTicket | null {
  return list.find((ticket) => ticket.id === id) ?? null;
}

export function toggleSelected(current: string | null, tapped: string): string | null {
  if (current === tapped) return null;
  return tapped;
}
