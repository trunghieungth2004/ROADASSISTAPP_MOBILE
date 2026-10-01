const PROVIDER_LICENSES = ["VOLUNTEER", "SHOP", "TOW"];

export function hasProviderLicense(services: string[] | undefined): boolean {
  return (services ?? []).some((service) => PROVIDER_LICENSES.includes(service));
}
