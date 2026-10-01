import type {DispatchTicket} from "../../api/dispatch";

export function coordOf(e: unknown): {lat: number; lng: number} | null {
  const geometry = (e as {geometry?: {coordinates?: unknown}})?.geometry;
  const coords = geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") return null;
  return {lng: coords[0], lat: coords[1]};
}

export function ticketById(list: DispatchTicket[], id: string): DispatchTicket | null {
  return list.find((ticket) => ticket.id === id) ?? null;
}

export function toggleSelected(current: string | null, tapped: string): string | null {
  if (current === tapped) return null;
  return tapped;
}
