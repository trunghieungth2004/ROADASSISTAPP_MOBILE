import type {FeedDirection, FeedTicket} from "../../api/dispatch";

export type RecordFilter = "ALL" | "IN" | "OUT";

export const RECORD_FILTERS: RecordFilter[] = ["ALL", "IN", "OUT"];

export type BusinessKind = "SHOP" | "TOW";

export function directionOf(ticket: Pick<FeedTicket, "direction">): FeedDirection {
  return ticket.direction;
}

export function filterRecords(tickets: FeedTicket[], filter: RecordFilter): FeedTicket[] {
  if (filter === "ALL") return [...tickets];
  const want: FeedDirection = filter === "IN" ? "in" : "out";
  return tickets.filter((t) => t.direction === want);
}

function shopIdOf(ticket: FeedTicket): string | null {
  for (const key of ["assignedShopId", "providerId", "destinationShopId"] as const) {
    const value = ticket[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return null;
}

export function businessKindOf(ticket: FeedTicket, shopKinds: Map<string, BusinessKind>): BusinessKind | null {
  const shopId = shopIdOf(ticket);
  if (shopId !== null) {
    const kind = shopKinds.get(shopId);
    if (kind) return kind;
  }
  if (ticket.ticketType === "TOW") return "TOW";
  if (ticket.ticketType === "MECHANIC" || ticket.ticketType === "WALK_IN") return "SHOP";
  return null;
}

export function roleIconName(kind: BusinessKind | null): {set: "material" | "community"; name: string} {
  if (kind === "SHOP") return {set: "material", name: "storefront"};
  if (kind === "TOW") return {set: "community", name: "tow-truck"};
  return {set: "material", name: "person"};
}

export function filterByKind(
  tickets: FeedTicket[],
  showShop: boolean,
  showTow: boolean,
  showRider: boolean,
  shopKinds: Map<string, BusinessKind>,
): FeedTicket[] {
  if (showShop && showTow && showRider) return [...tickets];
  return tickets.filter((t) => {
    const kind = businessKindOf(t, shopKinds);
    if (kind === "SHOP") return showShop;
    if (kind === "TOW") return showTow;
    return showRider;
  });
}
