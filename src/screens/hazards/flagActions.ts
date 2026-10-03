import type {OverlayAction} from "../../components/overlay/Overlay";

export type FlagAction = "confirm" | "deny" | "remove" | "locked";

export function flagActions(status: string, isOwn: boolean): FlagAction[] {
  if (status === "3") return isOwn ? ["locked"] : [];
  if (status === "1") return isOwn ? ["remove"] : ["confirm", "deny"];
  if (status === "2") return isOwn ? ["remove"] : [];
  return [];
}

export type UntilStrings = {expiresIn: string; expired: string};

export function joinMeta(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== "").join(" · ");
}
export function formatUntil(expiresMs: number | null | undefined, nowMs: number, s: UntilStrings): string | null {
  if (expiresMs === undefined || expiresMs === null) return null;
  const left = expiresMs - nowMs;
  if (left <= 0) return s.expired;
  const mins = Math.floor(left / 60000);
  if (mins < 60) return s.expiresIn.replace("{n}", `${mins}m`);
  const hours = Math.floor(mins / 60);
  if (hours < 48) return s.expiresIn.replace("{n}", `${hours}h`);
  return s.expiresIn.replace("{n}", `${Math.floor(hours / 24)}d`);
}

export type FlagActionLabels = {confirm: string; deny: string; remove: string};

export type FlagActionHandlers = {
  onConfirm: (flagId: string) => void;
  onDeny: (flagId: string) => void;
  onRemove: (flagId: string) => void;
};

export function flagOverlayActions(
  flagId: string,
  status: string,
  isOwn: boolean,
  voted: boolean,
  denied: boolean,
  busy: boolean,
  labels: FlagActionLabels,
  handlers: FlagActionHandlers,
): OverlayAction[] {
  const actions = flagActions(status, isOwn);
  const canConfirm = actions.includes("confirm") && !voted;
  const canDeny = actions.includes("deny") && !denied;
  const canRemove = actions.includes("remove");
  const out: OverlayAction[] = [];
  if (canRemove) {
    out.push({label: labels.remove, tone: "danger", busy, onPress: () => handlers.onRemove(flagId)});
  } else if (canConfirm) {
    out.push({label: labels.confirm, tone: "primary", busy, onPress: () => handlers.onConfirm(flagId)});
  }
  if (canDeny) {
    out.push({label: labels.deny, tone: "danger", outline: true, busy, onPress: () => handlers.onDeny(flagId)});
  }
  return out;
}
