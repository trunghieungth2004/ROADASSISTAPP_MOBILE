import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import {onColor, type AppTheme} from "../../../theme";
import type {FeedTicket} from "../../../api/dispatch";
import {ColumnHead, DetailCard, PhoneLink, PlaceLine, Stars, detailStyles, type Party} from "./parts";

export type DestinationShop = {
  id: string | null;
  name: string;
  label: string | null;
  avg: number | null;
  count: number | null;
  phone: string | null;
  openNow: boolean | null;
};

export type JourneyPreview = {
  title: string;
  loadingLabel: string;
  fareLabel: string;
  busy: boolean;
  error: string | null;
  summary: string | null;
  fareEstimate: number | null;
};

type Props = {
  t: Strings;
  lang: string;
  theme: AppTheme;
  ticket: FeedTicket;
  inbound: boolean;
  party: Party;
  partyOnPress: (() => void) | null;
  placeHeader: string;
  destShop: DestinationShop | null;
  destLat: number | null;
  destLng: number | null;
  destName: string | null;
  destLabel: string | null;
  onOpenDestination: (() => void) | null;
  etaText: string | null;
  dropoffEtaText: string | null;
  preview: JourneyPreview | null;
  busy: boolean;
};

function partyIconOf(party: Party): {set: "material" | "community"; name: string} {
  if (party.kind === "SHOP") return {set: "material", name: "storefront"};
  if (party.kind === "TOW") return {set: "community", name: "tow-truck"};
  return {set: "material", name: "person"};
}

export default function JourneyCard({t, lang, theme, ticket, inbound, party, partyOnPress, placeHeader, destShop, destLat, destLng, destName, destLabel, onOpenDestination, etaText, dropoffEtaText, preview, busy}: Props) {
  const partyStateColor = party.openNow === true ? theme.primary : theme.danger;
  const destStateColor = destShop !== null && destShop.openNow === true ? theme.primary : theme.danger;
  const hasDropoff = destShop !== null || (destLat !== null && destLng !== null);
  const isWalkIn = ticket.ticketType === "WALK_IN";
  const walkInDropoff = isWalkIn && hasDropoff;
  const walkInCustomer = walkInDropoff && party.kind !== "SHOP";
  const twoColumns = !walkInDropoff && (hasDropoff || ticket.ticketType === "TOW");
  const icon = partyIconOf(party);
  const partyCard = (
    <Pressable
      style={[detailStyles.inset, styles.party, {borderColor: theme.border, backgroundColor: theme.paper}]}
      onPress={partyOnPress ?? undefined}
      disabled={partyOnPress === null}
      accessibilityRole={partyOnPress === null ? undefined : "button"}
      accessibilityLabel={partyOnPress === null ? undefined : party.name}
    >
      <View style={detailStyles.insetHead}>
        <View style={[styles.partyIcon, {backgroundColor: `${theme.primary}1f`}]}>
          {icon.set === "community" ? (
            <MaterialCommunityIcons name={icon.name as never} size={15} color={theme.primary} />
          ) : (
            <MaterialIcons name={icon.name as never} size={15} color={theme.primary} />
          )}
        </View>
        <View style={detailStyles.insetTitleRow}>
          <Text numberOfLines={1} style={[detailStyles.name, {color: theme.text}]}>{party.name}</Text>
        </View>
        {party.openNow !== null ? (
          <View style={[detailStyles.pill, {backgroundColor: partyStateColor}]}>
            <Text style={[detailStyles.pillText, {color: onColor(partyStateColor)}]}>{party.openNow ? t.shop.open : t.shop.closed}</Text>
          </View>
        ) : null}
        {partyOnPress !== null ? <MaterialIcons name="chevron-right" size={18} color={theme.muted} /> : null}
      </View>
      {party.kind === "SHOP" && party.label !== null ? (
        <Text style={[detailStyles.labelText, {color: theme.muted}]}>{party.label}</Text>
      ) : null}
      <Stars theme={theme} avg={party.ratingAvg} count={party.ratingCount} />
      {party.phone !== null ? <PhoneLink theme={theme} phone={party.phone} /> : null}
    </Pressable>
  );
  const dropoffNode = (
    <>
      <ColumnHead theme={theme} icon="place" label={t.assist.dropOffPoint} />
      {destShop !== null ? (
        <>
          <PlaceLine theme={theme} lat={destLat} lng={destLng} lang={lang} address={destShop.label} />
          <Pressable
            style={[detailStyles.inset, styles.party, {borderColor: theme.border, backgroundColor: theme.paper}]}
            onPress={onOpenDestination ?? undefined}
            disabled={onOpenDestination === null}
            accessibilityRole={onOpenDestination === null ? undefined : "button"}
            accessibilityLabel={onOpenDestination === null ? undefined : destShop.name}
          >
            <View style={detailStyles.insetHead}>
              <View style={[styles.partyIcon, {backgroundColor: `${theme.primary}1f`}]}>
                <MaterialIcons name="storefront" size={15} color={theme.primary} />
              </View>
              <Text numberOfLines={1} style={[detailStyles.name, {flex: 1, color: theme.text}]}>{destShop.name}</Text>
              {destShop.openNow !== null ? (
                <View style={[detailStyles.pill, {backgroundColor: destStateColor}]}>
                  <Text style={[detailStyles.pillText, {color: onColor(destStateColor)}]}>{destShop.openNow ? t.shop.open : t.shop.closed}</Text>
                </View>
              ) : null}
              {onOpenDestination !== null ? <MaterialIcons name="chevron-right" size={18} color={theme.muted} /> : null}
            </View>
            <Stars theme={theme} avg={destShop.avg} count={destShop.count} />
            {destShop.phone !== null ? <PhoneLink theme={theme} phone={destShop.phone} /> : null}
          </Pressable>
        </>
      ) : destLat !== null && destLng !== null ? (
        <View style={[detailStyles.inset, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <View style={detailStyles.insetHead}>
            <MaterialIcons name={destName !== null ? "storefront" : "flag"} size={15} color={theme.primary} />
            <Text style={[detailStyles.name, {flex: 1, color: theme.text}]}>{destName ?? destLabel ?? t.assist.dropOffPoint}</Text>
          </View>
          <Text style={[detailStyles.muted, {color: theme.muted}]}>{`${destLat.toFixed(5)}, ${destLng.toFixed(5)}`}</Text>
        </View>
      ) : (
        <View style={[detailStyles.inset, styles.emptyDropoff, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <MaterialIcons name="flag" size={16} color={theme.muted} />
          <Text style={[detailStyles.muted, {color: theme.muted}]}>{inbound ? t.assist.noDropOffAssigned : t.assist.noDropOff}</Text>
        </View>
      )}
      {dropoffEtaText !== null ? <Text style={[detailStyles.muted, {color: theme.primary}]}>{dropoffEtaText}</Text> : null}
    </>
  );
  const pickupNode = (
    <>
      <ColumnHead theme={theme} icon="trip-origin" label={placeHeader} />
      <PlaceLine theme={theme} lat={ticket.lat} lng={ticket.lng} lang={lang} />
      {partyCard}
    </>
  );
  return (
    <DetailCard theme={theme} style={styles.card}>
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={[styles.column, styles.columnFlex]}>{pickupNode}</View>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <View style={[styles.column, styles.columnFlex]}>{dropoffNode}</View>
        </View>
      ) : (
        <View style={styles.single}>
          {walkInDropoff ? dropoffNode : pickupNode}
          {walkInCustomer ? (
            <>
              <ColumnHead theme={theme} icon="person" label={t.roles.rider} />
              {partyCard}
            </>
          ) : null}
        </View>
      )}
      {etaText !== null ? (
        <View style={styles.etaRow}>
          <MaterialIcons name="schedule" size={14} color={theme.primary} />
          <Text style={[detailStyles.muted, {color: theme.primary}]}>{etaText}</Text>
        </View>
      ) : null}
      {preview !== null ? (
        <View style={[detailStyles.inset, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <Text style={[detailStyles.muted, {color: theme.muted}]}>{preview.title}</Text>
          {preview.busy ? (
            <View style={styles.previewRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[detailStyles.muted, {color: theme.muted}]}>{preview.loadingLabel}</Text>
            </View>
          ) : preview.error !== null ? (
            <Text style={[detailStyles.muted, {color: theme.danger}]}>{preview.error}</Text>
          ) : preview.summary !== null ? (
            <Text style={[detailStyles.muted, {color: theme.text}]}>{preview.summary}</Text>
          ) : null}
          {preview.fareEstimate !== null ? (
            <Text style={[detailStyles.muted, {color: theme.text}]}>{`${preview.fareLabel}: ${preview.fareEstimate.toLocaleString()} VND`}</Text>
          ) : null}
        </View>
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  card: {gap: 8},
  columns: {flexDirection: "row", alignItems: "stretch", gap: 8},
  single: {gap: 6},
  column: {gap: 6, minWidth: 0},
  columnFlex: {flex: 1},
  divider: {width: 1, alignSelf: "stretch"},
  party: {gap: 5},
  partyIcon: {width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center"},
  emptyDropoff: {flexDirection: "row", alignItems: "center", gap: 6},
  etaRow: {flexDirection: "row", alignItems: "center", gap: 6},
  previewRow: {flexDirection: "row", alignItems: "center", gap: 8},
});
