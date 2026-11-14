import {useCallback, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useFocusEffect, useRoute} from "@react-navigation/native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../components/ui/AppText";
import ScreenContainer from "../components/ui/ScreenContainer";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useAppMode} from "../context/ThemeContext";
import {themeForMode, darkTheme, lightTheme} from "../theme";
import {toMessage} from "../api/client";
import {myBookings, type Booking} from "../api/bookings";
import {getTicket, type DispatchTicket} from "../api/dispatch";
import PaymentDetailSheet from "./bills/PaymentDetailSheet";

type Params = {bookingId?: string};

function legLabel(ticket: DispatchTicket, t: ReturnType<typeof useStrings>["t"]): string {
  if (ticket.ticketType === "TOW") {
    return ticket.towKind === "RETURN" ? t.assist.returnTowTitle : t.bookings.towIt;
  }
  return t.assist.walkIn;
}

function legAmount(ticket: DispatchTicket): number {
  if (typeof ticket.invoiceAmount === "number") return ticket.invoiceAmount;
  if (typeof ticket.shopQuotedAmount === "number") return ticket.shopQuotedAmount;
  if (ticket.towFare?.final) return ticket.towFare.final;
  if (ticket.towFare?.estimate) return ticket.towFare.estimate;
  if (typeof ticket.finalAmount === "number") return ticket.finalAmount;
  return 0;
}

export default function JobSummaryScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const route = useRoute();
  const {bookingId} = (route.params ?? {}) as Params;
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tickets, setTickets] = useState<DispatchTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetailFor, setPaymentDetailFor] = useState<DispatchTicket | null>(null);

  const load = useCallback(() => {
    if (!token || !bookingId) return;
    setLoading(true);
    void myBookings(token)
      .then((res) => {
        const found = res.bookings.find((row) => row.id === bookingId) ?? null;
        setBooking(found);
        const ids = found?.linkedTicketIds ?? [];
        return Promise.all(ids.map((id) => getTicket(id, token).catch(() => null)));
      })
      .then((rows) => setTickets((rows ?? []).filter((row): row is DispatchTicket => row !== null)))
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(false));
  }, [token, bookingId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.bookings.jobSummary}</Text>
        {booking ? (
          <Text style={[styles.hint, {color: theme.muted}]}>
            {`${booking.providerName} · ${new Date(booking.scheduledAt).toLocaleString(locale, {weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"})}`}
          </Text>
        ) : null}
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {!loading && tickets.length === 0 ? (
          <Text style={[styles.hint, {color: theme.muted}]}>{t.bookings.noLegs}</Text>
        ) : null}
        {tickets.map((ticket) => (
          <View key={ticket.id} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.row}>
              <MaterialIcons name={ticket.ticketType === "TOW" ? "local-shipping" : "build"} size={20} color={theme.primary} />
              <View style={styles.head}>
                <Text style={[styles.legTitle, {color: theme.text}]}>{legLabel(ticket, t)}</Text>
                <Text style={[styles.hint, {color: theme.muted}]}>{ticket.status}</Text>
              </View>
              <Text style={[styles.amount, {color: theme.text}]}>{`${legAmount(ticket).toLocaleString()} ₫`}</Text>
            </View>
            <Pressable
              style={[styles.openBtn, {borderColor: theme.border}]}
              onPress={() => setPaymentDetailFor(ticket)}
              accessibilityRole="button"
            >
              <Text style={[styles.openText, {color: theme.primary}]}>{t.payments.detailTitle}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {paymentDetailFor ? (
        <PaymentDetailSheet
          ticketId={paymentDetailFor.id}
          ticket={paymentDetailFor}
          onClose={() => setPaymentDetailFor(null)}
          onChanged={load}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  title: {fontSize: 22, fontWeight: "800"},
  hint: {fontSize: 12, lineHeight: 18},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 10},
  row: {flexDirection: "row", alignItems: "center", gap: 10},
  head: {flex: 1, gap: 2},
  legTitle: {fontSize: 15, fontWeight: "700"},
  amount: {fontSize: 14, fontWeight: "700"},
  openBtn: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center"},
  openText: {fontSize: 13, fontWeight: "700"},
});
