import type {Strings} from "../../i18n/en";
import {DISPATCH_STATUS} from "../../api/dispatch";

export type StatusTone = "active" | "done" | "failed";

export function ticketStatusLabel(status: string, t: Strings): string {
  if (status === DISPATCH_STATUS.MATCHED) return t.assist.statusMatched;
  if (status === DISPATCH_STATUS.ARRIVED) return t.assist.statusArrived;
  if (status === DISPATCH_STATUS.RESOLVED) return t.assist.statusResolved;
  if (status === DISPATCH_STATUS.CANCELLED) return t.assist.statusCancelled;
  if (status === DISPATCH_STATUS.IN_PROGRESS) return t.assist.statusInProgress;
  if (status === DISPATCH_STATUS.READY) return t.assist.statusReady;
  if (status === DISPATCH_STATUS.DECLINED) return t.assist.statusDeclined;
  return t.assist.statusPending;
}

export function statusTone(status: string): StatusTone {
  if (status === DISPATCH_STATUS.RESOLVED || status === DISPATCH_STATUS.READY) return "done";
  if (status === DISPATCH_STATUS.CANCELLED || status === DISPATCH_STATUS.DECLINED) return "failed";
  return "active";
}

export function statusPillColor(status: string, theme: {primary: string; success: string; danger: string; muted: string}): string {
  if (status === DISPATCH_STATUS.RESOLVED) return theme.success;
  if (status === DISPATCH_STATUS.READY) return "#0d9488";
  if (status === DISPATCH_STATUS.MATCHED) return theme.primary;
  if (status === DISPATCH_STATUS.ARRIVED) return "#0284c7";
  if (status === DISPATCH_STATUS.IN_PROGRESS) return "#d97706";
  if (status === DISPATCH_STATUS.PENDING) return "#f59e0b";
  if (status === DISPATCH_STATUS.DECLINED) return theme.danger;
  return theme.muted;
}

export function statusStages(ticketType: string): string[] {
  if (ticketType === "WALK_IN") {
    return [
      DISPATCH_STATUS.PENDING,
      DISPATCH_STATUS.MATCHED,
      DISPATCH_STATUS.IN_PROGRESS,
      DISPATCH_STATUS.READY,
      DISPATCH_STATUS.RESOLVED,
    ];
  }
  return [
    DISPATCH_STATUS.PENDING,
    DISPATCH_STATUS.MATCHED,
    DISPATCH_STATUS.ARRIVED,
    DISPATCH_STATUS.RESOLVED,
  ];
}

export function stageLabel(ticketType: string, status: string, t: Strings): string {
  if (ticketType === "WALK_IN" && status === DISPATCH_STATUS.MATCHED) return t.assist.statusAccepted;
  return ticketStatusLabel(status, t);
}

export function declineReasonLabel(reason: string, t: Strings): string {
  if (reason === "FULL") return t.assist.declineFull;
  if (reason === "CLOSED") return t.assist.declineClosed;
  if (reason === "PARTS_DELAY") return t.assist.declinePartsDelay;
  return t.assist.declineOther;
}

export function ticketTypeLabel(ticketType: string, t: Strings): string {
  if (ticketType === "TOW") return t.assist.typeTow;
  if (ticketType === "SOS") return t.assist.typeSos;
  if (ticketType === "WALK_IN") return t.assist.typeWalkin;
  if (ticketType === "MECHANIC") return t.assist.typeMechanic;
  return ticketType;
}

export function ticketTitle(
  ticket: {ticketType: string; status: string},
  t: Strings,
): string {
  return `${ticketTypeLabel(ticket.ticketType, t)} · ${ticketStatusLabel(ticket.status, t)}`;
}
