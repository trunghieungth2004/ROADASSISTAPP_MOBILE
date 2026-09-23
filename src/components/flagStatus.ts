import type {Strings} from "../i18n/en";

export function flagStatusLabel(status: string, t: Strings): string {
  if (status === "1") return t.flag.statusSuggested;
  if (status === "2") return t.flag.statusConfirmed;
  if (status === "3") return t.flag.statusLocked;
  return t.flag.statusOther;
}

export function flagStatusColor(status: string): string {
  if (status === "2") return "#dc2626";
  if (status === "3") return "#7f1d1d";
  if (status === "1") return "#f59e0b";
  return "#6b7280";
}
