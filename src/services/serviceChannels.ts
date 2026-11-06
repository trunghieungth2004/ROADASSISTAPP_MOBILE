import type {ProviderService, ServiceChannel} from "../api/providers";

export const SERVICE_CHANNELS: ServiceChannel[] = ["BOOKING", "ASSIST"];

export function channelsOf(service: Pick<ProviderService, "channels">): ServiceChannel[] {
  const channels = service.channels;
  return Array.isArray(channels) && channels.length > 0 ?
    channels :
    SERVICE_CHANNELS;
}

export function hasChannel(
  service: Pick<ProviderService, "channels">,
  channel: ServiceChannel,
): boolean {
  return channelsOf(service).includes(channel);
}

export function matchesVehicleClass(
  service: Pick<ProviderService, "vehicleClasses">,
  vehicleClass?: string | null,
): boolean {
  const classes = service.vehicleClasses;
  if (vehicleClass === undefined || vehicleClass === null ||
    !Array.isArray(classes) || classes.length === 0) return true;
  return classes.includes(vehicleClass);
}

export function hasBookingService(
  services: ProviderService[] | null | undefined,
): boolean {
  return Array.isArray(services) && services.some((service) =>
    hasChannel(service, "BOOKING"));
}
