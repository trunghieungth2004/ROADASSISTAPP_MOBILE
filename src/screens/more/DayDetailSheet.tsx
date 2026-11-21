import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {MyDayBooking, MyDayDetail, MyDayPayment, MyDayTicket} from "../../api/analytics";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import {formatDateDMY, formatDateTimeDMY} from "../../utils/date";
import {serviceColor} from "../assist/serviceColors";
import {ticketStatusLabel, ticketTypeLabel} from "../assist/ticketLabels";

export type DayTab = "tickets" | "bookings" | "payments";

type Props = {
  t: Strings;
  date: string;
  data: MyDayDetail | null;
  loading: boolean;
  error: string | null;
  tab: DayTab;
  onTab: (tab: DayTab) => void;
  onOpenTicket: (ticket: MyDayTicket) => void;
  onClose: () => void;
};

export default function DayDetailSheet({
  t,
  date,
  data,
  loading,
  error,
  tab,
  onTab,
  onOpenTicket,
  onClose,
}: Props) {
  const theme = themeForMode(useAppMode());
  const totals = data?.totals;
  return (
    <Overlay
      visible
      variant="sheet"
      title={`${t.more.dashboardDayDetail} · ${formatDateDMY(date)}`}
      closeLabel={t.common.close}
      onClose={onClose}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {loading ? <Text style={[styles.hint, {color: theme.muted}]}>{t.common.loading}</Text> : null}
        {totals ? (
          <View style={styles.chips}>
            <Chip label={`${t.more.dashboardTrips}: ${totals.tickets}`} theme={theme} />
            <Chip label={`${t.more.dashboardCompleted}: ${totals.completed}`} theme={theme} />
            <Chip label={`${t.more.dashboardBookings}: ${totals.bookings}`} theme={theme} />
            <Chip label={`${t.more.dashboardAmount}: ${totals.gross.toLocaleString()} ₫`} theme={theme} />
          </View>
        ) : null}
        <View style={styles.tabs}>
          {(["tickets", "bookings", "payments"] as DayTab[]).map((value) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => onTab(value)}
                style={[styles.tab, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : "transparent"}]}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
              >
                <Text style={[styles.tabText, {color: active ? "#fff" : theme.text}]}>
                  {value === "tickets" ? t.more.dashboardTickets : value === "bookings" ? t.more.dashboardBookings : t.more.dashboardPayments}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {tab === "tickets" ? <Tickets t={t} rows={data?.tickets ?? []} onOpen={onOpenTicket} theme={theme} /> : null}
        {tab === "bookings" ? <Bookings t={t} rows={data?.bookings ?? []} theme={theme} /> : null}
        {tab === "payments" ? <Payments t={t} rows={data?.payments ?? []} theme={theme} /> : null}
      </View>
    </Overlay>
  );
}

type Theme = ReturnType<typeof themeForMode>;

function Chip({label, theme}: {label: string; theme: Theme}) {
  return (
    <View style={[styles.chip, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <Text style={[styles.chipText, {color: theme.muted}]}>{label}</Text>
    </View>
  );
}

function Tickets({t, rows, onOpen, theme}: {t: Strings; rows: MyDayTicket[]; onOpen: (ticket: MyDayTicket) => void; theme: Theme}) {
  if (rows.length === 0) return <Text style={[styles.hint, {color: theme.muted}]}>{t.more.dashboardNoTickets}</Text>;
  return (
    <View style={styles.list}>
      {rows.map((ticket) => (
        <Pressable
          key={ticket.id}
          onPress={() => onOpen(ticket)}
          style={[styles.row, {borderColor: theme.border, backgroundColor: theme.paper}]}
          accessibilityRole="button"
          accessibilityLabel={`${ticketTypeLabel(ticket.ticketType, t)} ${ticketStatusLabel(ticket.status, t)}`}
        >
          <View style={[styles.dot, {backgroundColor: serviceColor(ticket.ticketType)}]} />
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>
              {`${ticketTypeLabel(ticket.ticketType, t)} · ${ticketStatusLabel(ticket.status, t)}`}
            </Text>
            <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={2}>
              {[
                ticket.createdAt ? formatDateTimeDMY(ticket.createdAt) : null,
                ticket.riderName ?? ticket.providerName,
                ticket.amount !== null ? `${ticket.amount.toLocaleString()} ₫` : null,
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function Bookings({t, rows, theme}: {t: Strings; rows: MyDayBooking[]; theme: Theme}) {
  if (rows.length === 0) return <Text style={[styles.hint, {color: theme.muted}]}>{t.more.dashboardNoBookings}</Text>;
  return (
    <View style={styles.list}>
      {rows.map((booking) => (
        <View key={booking.id} style={[styles.row, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>
              {`${booking.providerName ?? booking.providerId} · ${booking.status}`}
            </Text>
            <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={2}>
              {[
                booking.scheduledAt ? formatDateTimeDMY(booking.scheduledAt) : null,
                booking.serviceNames.join(", "),
                booking.depositAmount > 0 ? `${booking.depositAmount.toLocaleString()} ₫` : null,
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Payments({t, rows, theme}: {t: Strings; rows: MyDayPayment[]; theme: Theme}) {
  if (rows.length === 0) return <Text style={[styles.hint, {color: theme.muted}]}>{t.more.dashboardNoPayments}</Text>;
  return (
    <View style={styles.list}>
      {rows.map((payment) => (
        <View key={payment.id} style={[styles.row, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>
              {`${payment.amount.toLocaleString()} ₫ · ${payment.status} · ${payment.method}`}
            </Text>
            <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={2}>
              {[
                payment.createdAt ? formatDateTimeDMY(payment.createdAt) : null,
                payment.ticketId,
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardTicketSheet({t, ticket, onClose}: {t: Strings; ticket: MyDayTicket; onClose: () => void}) {
  const theme = themeForMode(useAppMode());
  const tone = serviceColor(ticket.ticketType);
  return (
    <Overlay
      visible
      variant="sheet"
      title={t.more.dashboardTicketDetails}
      closeLabel={t.common.close}
      onClose={onClose}
    >
      <View style={styles.body}>
        <View style={styles.ticketHead}>
          <View style={[styles.servicePill, {backgroundColor: `${tone}18`, borderColor: tone}]}>
            <View style={[styles.dot, {backgroundColor: tone}]} />
            <Text style={[styles.servicePillText, {color: tone}]}>{ticketTypeLabel(ticket.ticketType, t)}</Text>
          </View>
          <Text style={[styles.detailText, {color: theme.text}]}>{ticketStatusLabel(ticket.status, t)}</Text>
        </View>
        <DetailRow label={t.more.dashboardTicketId} value={ticket.id} theme={theme} />
        <DetailRow label={t.more.dashboardCreated} value={ticket.createdAt ? formatDateTimeDMY(ticket.createdAt) : "—"} theme={theme} />
        <DetailRow label={t.more.dashboardRider} value={ticket.riderName ?? ticket.riderId} theme={theme} />
        <DetailRow label={t.more.dashboardProvider} value={ticket.providerName ?? "—"} theme={theme} />
        <DetailRow label={t.more.dashboardAmount} value={ticket.amount !== null ? `${ticket.amount.toLocaleString()} ₫` : "—"} theme={theme} />
        <DetailRow label={t.more.dashboardPaymentStatus} value={ticket.paymentStatus ?? "—"} theme={theme} />
        {ticket.symptom ? <DetailRow label={t.more.dashboardService} value={ticket.symptom} theme={theme} /> : null}
        {ticket.description ? <DetailRow label={t.more.dashboardDescription} value={ticket.description} theme={theme} /> : null}
      </View>
    </Overlay>
  );
}

function DetailRow({label, value, theme}: {label: string; value: string; theme: Theme}) {
  return (
    <View style={[styles.detailRow, {borderBottomColor: theme.divider}]}>
      <Text style={[styles.detailLabel, {color: theme.muted}]}>{label}</Text>
      <Text style={[styles.detailValue, {color: theme.text}]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  hint: {fontSize: 12, lineHeight: 17},
  chips: {flexDirection: "row", flexWrap: "wrap", gap: 6},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8},
  chipText: {fontSize: 10, fontWeight: "600"},
  tabs: {flexDirection: "row", gap: 6},
  tab: {flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center"},
  tabText: {fontSize: 12, fontWeight: "700"},
  list: {gap: 8},
  row: {borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  rowBody: {flex: 1, gap: 2},
  rowTitle: {fontSize: 13, fontWeight: "700"},
  rowMeta: {fontSize: 11, lineHeight: 16},
  dot: {width: 9, height: 9, borderRadius: 5},
  ticketHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  servicePill: {flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9},
  servicePillText: {fontSize: 11, fontWeight: "700"},
  detailRow: {borderBottomWidth: 1, paddingVertical: 7, gap: 2},
  detailLabel: {fontSize: 10, fontWeight: "600"},
  detailText: {fontSize: 13, fontWeight: "700"},
  detailValue: {fontSize: 13, lineHeight: 18},
});
