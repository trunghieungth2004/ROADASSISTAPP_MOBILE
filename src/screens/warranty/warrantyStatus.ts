import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

export function warrantyStatusColor(status: string, theme: AppTheme): string {
  if (status === "OPEN") return "#d97706";
  if (status === "REBOOKED" || status === "ACCEPTED") return theme.primary;
  if (status === "COMPLETED" || status === "RESOLVED") return theme.success;
  if (status === "DECLINED" || status === "REJECTED") return theme.danger;
  if (status === "DISPUTED") return "#8b5cf6";
  return theme.muted;
}

export function warrantyStatusLabel(status: string, t: Strings): string {
  if (status === "OPEN") return t.vehicle.claimOpen;
  if (status === "REBOOKED" || status === "ACCEPTED") return t.vehicle.claimRebooked;
  if (status === "COMPLETED") return t.vehicle.claimCompleted;
  if (status === "DECLINED" || status === "REJECTED") return t.vehicle.claimDeclined;
  if (status === "DISPUTED") return t.provider.dispute;
  if (status === "RESOLVED") return t.vehicle.claimResolved;
  return status;
}

export function warrantyDeclineReasonLabel(
  code: string | null | undefined,
  t: Strings,
): string | null {
  if (code === null || code === undefined || code === "") return null;
  const labels = t.provider.warrantyDeclineReasons as Record<string, string>;
  return labels[code] ?? code;
}
