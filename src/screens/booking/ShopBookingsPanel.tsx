import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Alert, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {useStrings} from "../../context/LanguageContext";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {toMessage} from "../../api/client";
import {collectBookingDeposit, completeBooking, requestBookingDeposit, respondBooking, shopBookings, type Booking} from "../../api/bookings";

type Props = {
  token: string;
  providerId: string;
  onNotice: (message: string) => void;
};

export default function ShopBookingsPanel({token, providerId, onNotice}: Props) {
  const {t, lang} = useStrings();
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !providerId) return;
    setLoading(true);
    void shopBookings(providerId, token)
      .then((res) => setRows(res.bookings))
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(false));
  }, [token, providerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(booking: Booking, accept: boolean): Promise<void> {
    if (busyId !== null) return;
    setBusyId(booking.id);
    try {
      await respondBooking(booking.id, accept, token);
      onNotice(accept ? t.bookings.confirmed : t.bookings.declined);
      load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function complete(booking: Booking): Promise<void> {
    if (busyId !== null) return;
    setBusyId(booking.id);
    try {
      await completeBooking(booking.id, token);
      onNotice(t.bookings.completed);
      load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function deposit(booking: Booking, collected: boolean): Promise<void> {
    if (busyId !== null) return;
    setBusyId(booking.id);
    try {
      await collectBookingDeposit(booking.id, collected, token);
      onNotice(collected ? t.provider.depositCollected : t.provider.depositWaived);
      load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function requestDeposit(booking: Booking): Promise<void> {
    if (busyId !== null) return;
    setBusyId(booking.id);
    try {
      await requestBookingDeposit(booking.id, token);
      onNotice(t.provider.depositRequested);
      load();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function confirmDecline(booking: Booking): void {
    Alert.alert(t.bookings.decline, booking.providerName, [
      {text: t.common.cancel, style: "cancel"},
      {text: t.bookings.decline, style: "destructive", onPress: () => void respond(booking, false)},
    ]);
  }

  function card(booking: Booking) {
    const when = new Date(booking.scheduledAt).toLocaleString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const pending = booking.status === "REQUESTED";
    const active = booking.status === "CONFIRMED" || booking.status === "ARRIVED";
    return (
      <View key={booking.id} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <Text style={[styles.when, {color: theme.text}]}>{when}</Text>
        <Text style={[styles.meta, {color: theme.muted}]}>{booking.status}</Text>
        <Text style={[styles.meta, {color: theme.muted}]}>{booking.arrivalMode === "TOW" ? t.bookings.towIt : t.bookings.rideIt}</Text>
        {booking.serviceSnapshot && booking.serviceSnapshot.length > 0 ? (
          <Text style={[styles.meta, {color: theme.text}]}>
            {booking.serviceSnapshot.map((s) => s.name).join(" · ")}
          </Text>
        ) : null}
        {booking.note ? <Text style={[styles.meta, {color: theme.muted}]}>{booking.note}</Text> : null}
        {booking.outsideHours ? <Text style={[styles.meta, {color: theme.danger}]}>{t.bookings.outsideHours}</Text> : null}
        {booking.depositAmount > 0 ? (
          <Text style={[styles.meta, {color: theme.text}]}>
            {`${booking.depositStatus === "DUE" || booking.depositStatus === "REQUESTED" ? t.provider.depositDue : booking.depositStatus === "NONE" || booking.depositStatus === "WAIVED" ? t.provider.depositWaived : t.provider.depositCollected}: ${booking.depositAmount.toLocaleString()} ₫`}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {pending ? (
            <>
              <Pressable style={[styles.secondary, {borderColor: theme.border}]} disabled={busyId !== null} onPress={() => confirmDecline(booking)} accessibilityRole="button">
                <Text style={[styles.secondaryText, {color: theme.danger}]}>{t.bookings.decline}</Text>
              </Pressable>
              <Pressable style={[styles.primary, {backgroundColor: theme.primary}]} disabled={busyId !== null} onPress={() => void respond(booking, true)} accessibilityRole="button">
                {busyId === booking.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t.bookings.accept}</Text>}
              </Pressable>
            </>
          ) : null}
          {booking.status === "ARRIVED" && booking.depositAmount > 0 && booking.depositStatus === "DUE" ? (
            <>
              <Pressable style={[styles.secondary, {borderColor: theme.border}]} disabled={busyId !== null} onPress={() => void deposit(booking, false)} accessibilityRole="button">
                <Text style={[styles.secondaryText, {color: theme.muted}]}>{t.provider.depositWaive}</Text>
              </Pressable>
              <Pressable style={[styles.secondary, {borderColor: theme.primary}]} disabled={busyId !== null} onPress={() => void requestDeposit(booking)} accessibilityRole="button">
                <Text style={[styles.secondaryText, {color: theme.primary}]}>{t.provider.depositRequest}</Text>
              </Pressable>
            </>
          ) : null}
          {booking.status === "ARRIVED" && booking.depositAmount > 0 && booking.depositStatus === "REQUESTED" ? (
            <Pressable style={[styles.secondary, {borderColor: theme.primary}]} disabled={busyId !== null} onPress={() => void deposit(booking, true)} accessibilityRole="button">
              <Text style={[styles.secondaryText, {color: theme.primary}]}>{t.provider.depositCollect}</Text>
            </Pressable>
          ) : null}
          {active ? (
            <Pressable style={[styles.primary, {backgroundColor: theme.success}]} disabled={busyId !== null} onPress={() => void complete(booking)} accessibilityRole="button">
              {busyId === booking.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t.bookings.complete}</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {loading && rows.length === 0 ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      {!loading && rows.length === 0 ? <Text style={[styles.meta, {color: theme.muted}]}>{t.bookings.none}</Text> : null}
      {rows.map(card)}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {gap: 12},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 6},
  when: {fontSize: 16, fontWeight: "700"},
  meta: {fontSize: 13},
  actions: {flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6},
  secondary: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  secondaryText: {fontSize: 13, fontWeight: "600"},
  primary: {borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16},
  primaryText: {color: "#fff", fontSize: 13, fontWeight: "700"},
  error: {fontSize: 12},
});
