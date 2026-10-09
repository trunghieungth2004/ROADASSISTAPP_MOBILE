import * as Location from "expo-location";
import {createTicket} from "../../api/dispatch";
import {getFix} from "../../services/geo";

export async function checkInAtShop(args: {
  providerId: string;
  token: string;
  vehicleType?: string;
  vehicleWidth?: number;
  deniedMessage: string;
}): Promise<{lat: number; lng: number}> {
  const {status} = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error(args.deniedMessage);
  const point = await getFix({timeoutMs: 5000});
  await createTicket(
    {
      ticketType: "WALK_IN",
      lat: point.lat,
      lng: point.lng,
      providerId: args.providerId,
      vehicleType: args.vehicleType,
      vehicleWidth: args.vehicleWidth,
    },
    args.token,
  );
  return point;
}
