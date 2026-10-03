import type {Strings} from "../../i18n/en";
import type {Provider} from "../../api/providers";

export type PillTone = "on" | "off" | "alert";

export function providerStatusLabel(
  provider: {status: string; suspended?: boolean},
  t: Strings,
): string {
  if (provider.suspended === true) return t.provider.suspended;
  if (provider.status === "ACTIVE") return t.provider.active;
  if (provider.status === "DENIED") return t.provider.denied;
  return t.provider.pending;
}

export function providerPill(
  provider: {status: string; suspended?: boolean; accepting?: boolean},
  t: Strings,
): {label: string; tone: PillTone} {
  if (provider.suspended === true) {
    return {label: t.provider.suspended, tone: "alert"};
  }
  if (provider.status === "DENIED") {
    return {label: t.provider.denied, tone: "alert"};
  }
  if (provider.status !== "ACTIVE") {
    return {label: t.provider.pending, tone: "off"};
  }
  if (provider.accepting === false) {
    return {label: t.provider.offDuty, tone: "off"};
  }
  return {label: t.provider.active, tone: "on"};
}

export function switchEnabled(
  provider: {status: string; suspended?: boolean},
  busy: boolean,
): boolean {
  return !busy && provider.status === "ACTIVE" && provider.suspended !== true;
}

export function missingKinds(
  providers: {kind: string; status: string}[],
): {shop: boolean; tow: boolean} {
  return {
    shop: !providers.some((p) => p.kind === "SHOP"),
    tow: !providers.some(
      (p) => p.kind === "TOW" && p.status !== "DENIED",
    ),
  };
}

export function providerRowSubtitle(provider: Provider, t: Strings): string {
  if (provider.kind === "TOW" && typeof provider.plate === "string") {
    return provider.plate;
  }
  return providerStatusLabel(provider, t);
}

export function serviceLabel(code: string, t: Strings): string {
  if (code === "VOLUNTEER") return t.roles.volunteer;
  if (code === "SHOP") return t.roles.shop;
  if (code === "TOW") return t.roles.tow;
  return t.roles.rider;
}
