import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {onColor, type AppTheme} from "../../theme";
import type {Bill, BillItem} from "../../api/bills";
import {
  billDateTimeLabel,
  billItemStatusColor,
  billItemStatusLabel,
  billStatusColor,
  billStatusLabel,
  itemNetPayout,
  itemPayoutStatus,
  payeeSummary,
  payoutStatusColor,
  payoutStatusLabel,
} from "./billLabels";
import {ColumnHead, PhoneLink, PlaceLine} from "../assist/detail/parts";

const money = (value: number): string => `${value.toLocaleString()} VND`;
const RECEIVED = new Set(["HELD", "CONFIRMED", "PARTIAL"]);

export function BillStatusPill({label, color, theme}: {label: string; color: string; theme: AppTheme}) {
  return (
    <View style={[styles.pill, {backgroundColor: color}]}>
      <Text style={[styles.pillText, {color: onColor(color)}]}>{label}</Text>
    </View>
  );
}

function AmountRow({label, value, detail, theme, strong, muted, color}: {
  label: string;
  value: string;
  detail?: string | null;
  theme: AppTheme;
  strong?: boolean;
  muted?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[strong ? styles.rowLabelStrong : styles.rowLabel, {color: strong ? theme.text : theme.muted}]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, {color: theme.muted}]}>{detail}</Text> : null}
      </View>
      <Text style={[strong ? styles.rowValueStrong : styles.rowValue, {color: color ?? (muted ? theme.muted : theme.text)}]}>{value}</Text>
    </View>
  );
}

export function BillPartiesCard({item, t, theme, lang}: {
  item: BillItem;
  t: Strings;
  theme: AppTheme;
  lang: string;
}) {
  const rider = item.rider;
  const provider = item.provider;
  const pickup = item.pickup;
  const destination = item.destination;
  const isTow = item.kind === "TOW_FARE" || item.serviceType === "TOW";
  const isSos = item.serviceType === "SOS" || item.kind === "SOS";
  const showRoute = isTow && (pickup !== null && pickup !== undefined ||
    destination !== null && destination !== undefined);
  if (!rider && !provider && !showRoute) return null;
  return (
    <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <View style={styles.columns}>
        <View style={styles.column}>
          <ColumnHead theme={theme} icon="person" label={t.payments.rider} />
          <Text style={[styles.name, {color: theme.text}]} numberOfLines={2}>{rider?.name ?? t.assist.unassigned}</Text>
          {rider?.phone ? <PhoneLink theme={theme} phone={rider.phone} /> : null}
          {!isSos && (item.vehicleLabel || item.vehiclePlate) ? (
            <Text style={[styles.small, {color: theme.muted}]}>
              {[item.vehicleLabel, item.vehiclePlate].filter((value) => typeof value === "string" && value !== "").join(" · ")}
            </Text>
          ) : null}
        </View>
        <View style={[styles.divider, {backgroundColor: theme.divider}]} />
        <View style={styles.column}>
          <ColumnHead theme={theme} icon="storefront" label={t.payments.providerParty} />
          <Text style={[styles.name, {color: theme.text}]} numberOfLines={2}>{provider?.name ?? t.assist.unassigned}</Text>
          {provider?.phone ? <PhoneLink theme={theme} phone={provider.phone} /> : null}
          {provider?.label ? <Text style={[styles.small, {color: theme.muted}]}>{provider.label}</Text> : null}
        </View>
      </View>
      {showRoute ? (
        <>
          <View style={[styles.hr, {backgroundColor: theme.divider}]} />
          <View style={styles.columns}>
            <View style={styles.column}>
              <ColumnHead theme={theme} icon="trip-origin" label={t.assist.pickup} />
              {pickup ? <PlaceLine theme={theme} lat={pickup.lat} lng={pickup.lng} lang={lang} /> : <Text style={[styles.small, {color: theme.muted}]}>{t.assist.unassigned}</Text>}
            </View>
            <View style={[styles.divider, {backgroundColor: theme.divider}]} />
            <View style={styles.column}>
              <ColumnHead theme={theme} icon="place" label={t.assist.dropOffPoint} />
              {destination ? (
                <PlaceLine theme={theme} lat={destination.lat} lng={destination.lng} lang={lang} address={destination.label} />
              ) : <Text style={[styles.small, {color: theme.muted}]}>{t.assist.noDropOff}</Text>}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function breakdownLabel(code: string | undefined, fallback: string, t: Strings): string {
  if (code === "BASE") return t.bills.baseFare;
  if (code === "DISTANCE") return t.bills.extraDistance;
  if (code === "WAITING") return t.bills.waiting;
  if (code === "PRIOR_TOW") return t.bills.priorTowerTravel;
  if (code === "NIGHT") return t.bills.nightSurcharge;
  if (code === "CEILING") return t.bills.fareCap;
  if (code === "ROUNDING") return t.bills.rounding;
  if (code === "TRAVELED") return t.bills.traveledDistance;
  if (code === "CALLOUT") return t.bills.callOut;
  if (code === "TRAVEL") return t.bills.travel;
  if (code === "ADJUSTMENT") return t.bills.fareAdjustment;
  if (code === "REPAIR") return t.bills.repair;
  if (code === "PRIOR_VISIT") return t.bills.priorVisit;
  return fallback;
}

function breakdownDetail(code: string | undefined, row: {detail: string | null}, item: BillItem, t: Strings): string | null {
  if (code === "BASE") {
    return item.includedKm !== null && item.includedKm !== undefined ? t.bills.includedFirstKm.replace("{km}", String(item.includedKm)) : null;
  }
  if (code === "DISTANCE") {
    if (item.billableKm === null || item.billableKm === undefined) return row.detail;
    const rate = item.perKmFee !== null && item.perKmFee !== undefined ? ` × ${item.perKmFee.toLocaleString()} VND/km` : "";
    return `${item.billableKm.toFixed(2)} km${rate}`;
  }
  if (code === "NIGHT") {
    return item.nightMultiplier !== null && item.nightMultiplier !== undefined ? t.bills.nightMultiplierDetail.replace("{mult}", String(item.nightMultiplier)) : t.bills.nightApplied;
  }
  if (code === "PRIOR_TOW") return t.bills.priorTowerTravelHint;
  if (code === "CEILING") return null;
  if (code === "ROUNDING") return t.bills.roundingHint;
  return row.detail;
}

function CatalogLines({item, t, theme}: {item: BillItem; t: Strings; theme: AppTheme}) {
  const services = item.services ?? [];
  const extras = item.extras ?? [];
  const legacy = item.items ?? [];
  if (services.length + extras.length + legacy.length === 0) return null;
  return (
    <>
      {services.map((line, index) => (
        <AmountRow
          key={line.lineId ?? `service-${index}`}
          label={line.name}
          detail={`${line.qty} × ${line.unitPrice.toLocaleString()} VND${line.priceMode === "QUOTED" ? ` · ${t.bills.quoted}` : ` · ${t.bills.catalog}`}${line.warrantyUntil ? ` · ${t.bills.warranty}: ${new Date(line.warrantyUntil).toLocaleDateString()}` : ""}`}
          value={money(line.amount)}
          theme={theme}
        />
      ))}
      {extras.map((line, index) => (
        <AmountRow
          key={line.lineId ?? `extra-${index}`}
          label={`${line.name}${line.note ? ` · ${line.note}` : ""}`}
          detail={`${line.qty} × ${line.unitPrice.toLocaleString()} VND`}
          value={money(line.amount)}
          theme={theme}
        />
      ))}
      {services.length === 0 && extras.length === 0 ? legacy.map((line, index) => (
        <AmountRow
          key={`legacy-${index}`}
          label={line.name}
          detail={`${line.qty} × ${line.unitPrice.toLocaleString()} VND`}
          value={money(line.amount)}
          theme={theme}
        />
      )) : null}
    </>
  );
}

export function BillChargesCard({item, t, theme}: {item: BillItem; t: Strings; theme: AppTheme}) {
  const breakdown = item.breakdown ?? [];
  const isTow = item.kind === "TOW_FARE" || item.serviceType === "TOW";
  const catalogCount = (item.services?.length ?? 0) +
    (item.extras?.length ?? 0) + (item.items?.length ?? 0);
  const showBreakdown = isTow || item.serviceType === "SOS" ||
    catalogCount === 0;
  const capApplied = breakdown.some((row) => row.code === "CEILING") ||
    (item.ceiling !== null && item.ceiling !== undefined &&
      item.amount >= item.ceiling);
  const adjusted = breakdown.some((row) => row.code === "ADJUSTMENT");
  const partial = breakdown.some((row) => row.code === "TRAVELED");
  const shownBreakdown = breakdown.filter((row) =>
    row.code !== "CEILING" && row.code !== "ADJUSTMENT");
  return (
    <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <View style={styles.cardHeadRow}>
        <Text style={[styles.title, {color: theme.text}]}>{isTow ? t.bills.fareFormula : t.bills.services}</Text>
        {isTow && item.distanceKm !== null && item.distanceKm !== undefined ? (
          <View style={[styles.metaPill, {borderColor: theme.border}]}>
            <Text style={[styles.metaPillText, {color: theme.muted}]}>
              {`${partial ? t.bills.deadheadDistance : t.bills.loadedDistance}: ${item.distanceKm.toFixed(2)} km`}
            </Text>
          </View>
        ) : null}
      </View>
      {showBreakdown && shownBreakdown.length > 0 ? shownBreakdown.map((row, index) => (
        <AmountRow
          key={`${row.code ?? row.label}-${index}`}
          label={breakdownLabel(row.code, row.label, t)}
          detail={breakdownDetail(row.code, row, item, t)}
          value={money(row.amount)}
          theme={theme}
          muted={row.code === "CEILING" || row.code === "ROUNDING"}
          color={row.amount < 0 ? theme.muted : undefined}
        />
      )) : null}
      {catalogCount > 0 ? <CatalogLines item={item} t={t} theme={theme} /> : null}
      {catalogCount === 0 && breakdown.length === 0 ? (
        <AmountRow
          label={item.kind === "TOW_FARE" ? t.bills.towFare : t.bills.repair}
          value={money(item.amount)}
          theme={theme}
        />
      ) : null}
      {isTow && adjusted ? (
        <View style={[styles.note, {borderTopColor: theme.divider}]}>
          <Text style={[styles.noteText, {color: theme.muted}]}>
            {t.bills.fareAdjustedTo.replace("{amount}", money(item.amount))}
          </Text>
        </View>
      ) : null}
      {isTow && item.ceiling !== null && item.ceiling !== undefined ? (
        <View style={[styles.note, {borderTopColor: theme.divider}]}>
          <Text style={[styles.noteText, {color: capApplied ? theme.danger : theme.muted}]}>
            {capApplied ? t.bills.fareCapApplied.replace("{amount}", money(item.ceiling)) : `${t.bills.fareCap}: ${money(item.ceiling)} — ${t.bills.fareCapNotReached}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function BillTotalsCard({bill, payee, t, theme}: {
  bill: Bill;
  payee: boolean;
  t: Strings;
  theme: AppTheme;
}) {
  const summary = payee ? payeeSummary(bill) : null;
  return (
    <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <Text style={[styles.title, {color: theme.text}]}>{payee ? t.payments.yourItems : t.bills.title}</Text>
      {summary !== null ? (
        <>
          <AmountRow label={t.bills.total} value={money(bill.total)} theme={theme} />
          <AmountRow label={t.payments.collected} value={money(summary.collected)} theme={theme} />
          <AmountRow label={t.payments.commission} value={money(summary.commission)} theme={theme} color="#d97706" />
          <AmountRow label={t.payments.netPayout} value={money(summary.net)} theme={theme} color={theme.success} strong />
          <View style={[styles.totalDivider, {backgroundColor: theme.divider}]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, {color: theme.muted}]}>{t.payments.payout}</Text>
            <BillStatusPill label={payoutStatusLabel(summary.payout, t)} color={payoutStatusColor(summary.payout, theme)} theme={theme} />
          </View>
        </>
      ) : (
        <>
          <AmountRow label={t.bills.total} value={money(bill.total)} theme={theme} />
          <AmountRow label={t.bills.paid} value={money(bill.paid)} theme={theme} color={theme.success} />
          <View style={[styles.totalDivider, {backgroundColor: theme.divider}]} />
          <AmountRow label={t.bills.due} value={money(bill.due)} theme={theme} strong color={bill.due > 0 ? "#d97706" : theme.success} />
          {bill.due === 0 ? <Text style={[styles.small, {color: theme.muted}]}>{t.bills.nothingDue}</Text> : null}
        </>
      )}
    </View>
  );
}

export function BillPaymentCard({item, payee, t, theme}: {
  item: BillItem;
  payee: boolean;
  t: Strings;
  theme: AppTheme;
}) {
  const payment = item.payment;
  if (!payment) return null;
  const payout = itemPayoutStatus(item);
  const received = RECEIVED.has(payment.status) || payout === "PAID";
  return (
    <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <Text style={[styles.title, {color: theme.text}]}>{t.payments.title}</Text>
      <View style={styles.pillRow}>
        <BillStatusPill label={payment.method === "SEPAY" ? "SePay" : "Cash"} color={theme.border} theme={theme} />
        <BillStatusPill label={billItemStatusLabel(item.status, t)} color={billItemStatusColor(item.status, theme)} theme={theme} />
        {payee ? <BillStatusPill label={payoutStatusLabel(payout, t)} color={payoutStatusColor(payout, theme)} theme={theme} /> : null}
      </View>
      {payment.createdAt ? <AmountRow label={t.payments.opened} value={billDateTimeLabel(payment.createdAt)} theme={theme} /> : null}
      {payment.confirmedAt ? <AmountRow label={t.payments.confirmed} value={billDateTimeLabel(payment.confirmedAt)} theme={theme} /> : null}
      {payee && received ? <AmountRow label={t.payments.netPayout} value={money(itemNetPayout(item))} theme={theme} color={theme.success} /> : null}
    </View>
  );
}

export function billHeroStatus(bill: Bill, payee: boolean, t: Strings, theme: AppTheme): {label: string; color: string} {
  if (payee) {
    const summary = payeeSummary(bill);
    return {label: payoutStatusLabel(summary.payout, t), color: payoutStatusColor(summary.payout, theme)};
  }
  return {label: billStatusLabel(bill.status, t), color: billStatusColor(bill.status, theme)};
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: 14, padding: 12, gap: 8},
  title: {fontSize: 13, fontWeight: "800"},
  cardHeadRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  metaPill: {borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  metaPillText: {fontSize: 10, fontWeight: "700"},
  columns: {flexDirection: "row", alignItems: "stretch", gap: 10},
  column: {flex: 1, minWidth: 0, gap: 5},
  divider: {width: 1, alignSelf: "stretch"},
  hr: {height: 1, width: "100%"},
  name: {fontSize: 14, fontWeight: "700"},
  small: {fontSize: 11, lineHeight: 16},
  row: {flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10},
  rowText: {flex: 1, gap: 1},
  rowLabel: {fontSize: 12},
  rowLabelStrong: {fontSize: 13, fontWeight: "800"},
  rowDetail: {fontSize: 10, lineHeight: 14},
  rowValue: {fontSize: 12, fontWeight: "600", textAlign: "right", fontVariant: ["tabular-nums"]},
  rowValueStrong: {fontSize: 15, fontWeight: "800", textAlign: "right", fontVariant: ["tabular-nums"]},
  totalDivider: {height: 1, width: "100%", marginVertical: 2},
  note: {borderTopWidth: 1, paddingTop: 8, gap: 3},
  noteText: {fontSize: 11, lineHeight: 16},
  pillRow: {flexDirection: "row", flexWrap: "wrap", gap: 6},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  pillText: {fontSize: 10, fontWeight: "800"},
});
