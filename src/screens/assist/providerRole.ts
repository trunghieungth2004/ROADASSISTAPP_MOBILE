const PROVIDER_SERVICES = ["SHOP", "TOW", "MOBILE_SHOP"];

export function profileHasProviderRole(services?: string[] | null): boolean {
  return Array.isArray(services) &&
    services.some((service) => PROVIDER_SERVICES.includes(service));
}
