import type {Strings} from "../../i18n/en";

export type DelayReason =
  | "PARTS"
  | "RIDER_UNREACHABLE"
  | "ACCESS"
  | "WEATHER"
  | "TRAFFIC"
  | "OTHER";

const RIDER_REASONS: DelayReason[] = [
  "TRAFFIC",
  "ACCESS",
  "WEATHER",
  "OTHER",
];

const PROVIDER_REASONS: DelayReason[] = [
  "PARTS",
  "RIDER_UNREACHABLE",
  "ACCESS",
  "WEATHER",
  "OTHER",
];

export function delayReasonsFor(direction: string): DelayReason[] {
  return direction === "out" ? RIDER_REASONS : PROVIDER_REASONS;
}

export function delayReasonLabel(value: string, t: Strings): string {
  if (value === "PARTS") return t.assist.holdParts;
  if (value === "RIDER_UNREACHABLE") return t.assist.holdRider;
  if (value === "ACCESS") return t.assist.holdAccess;
  if (value === "WEATHER") return t.assist.holdWeather;
  if (value === "TRAFFIC") return t.assist.holdTraffic;
  return t.assist.holdOther;
}
