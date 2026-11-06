import type {FeedTicket} from "../../../api/dispatch";
import type {Strings} from "../../../i18n/en";
import type {AppTheme} from "../../../theme";
import {vehicleMeta, vehicleTypeName} from "../../../components/vehicles/vehicleMeta";
import {CardHead, DetailCard, FeeRow} from "./parts";

export default function VehicleCard({t, theme, ticket}: {t: Strings; theme: AppTheme; ticket: FeedTicket}) {
  const type = ticket.vehicleType ?? ticket.vehicleClass ?? "";
  const rawLabel = typeof ticket.vehicleLabel === "string" ? ticket.vehicleLabel : "";
  const label = rawLabel !== "" && !["CAR", "BIKE"].includes(rawLabel.toUpperCase()) ?
    rawLabel : t.vehicle.myVehicle;
  const dimensions = typeof ticket.vehicleWidth === "number" ?
    typeof ticket.vehicleHeight === "number" ?
      vehicleMeta(ticket.vehicleWidth, ticket.vehicleHeight) :
      `${ticket.vehicleWidth} m` :
    null;
  if (ticket.vehicleId === null && type === "" && dimensions === null &&
    !ticket.vehiclePlate) return null;
  return (
    <DetailCard theme={theme}>
      <CardHead theme={theme} icon="directions-car" title={label} />
      <FeeRow
        theme={theme}
        label={t.vehicle.type}
        value={type === "" ? t.vehicle.notRecorded : vehicleTypeName(type, t)}
      />
      <FeeRow
        theme={theme}
        label={t.vehicle.dimensions}
        value={dimensions ?? t.vehicle.notRecorded}
      />
      <FeeRow
        theme={theme}
        label={t.vehicle.plate}
        value={ticket.vehiclePlate ?? t.vehicle.notRecorded}
      />
    </DetailCard>
  );
}
