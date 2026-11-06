import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../components/ui/AppText";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useAppMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import {toMessage} from "../api/client";
import {arriveBooking, cancelBooking, createBookingTow, depositCheckout, myBookings, type Booking, type BookingStatus} from "../api/bookings";
import {myProviders, type Provider, type ProviderService} from "../api/providers";
import {capturePosition} from "../services/locationBeats";
import {fetchShopPlaces, isRepairPlace} from "../components/place-search/shopMerge";
import {hasBookingService, hasChannel} from "../services/serviceChannels";
import PlaceSearchScreen from "./PlaceSearchScreen";
import BookingComposer from "./booking/BookingComposer";
import SePayCheckoutSheet from "./assist/SePayCheckoutSheet";
import ShopBookingsPanel from "./booking/ShopBookingsPanel";
import Overlay from "../components/overlay/Overlay";

type RouteParams = {
  providerId?: string;
  providerName?: string;
  services?: ProviderService[];
  at?: number;
};

const ACTIVE: BookingStatus[] = ["REQUESTED", "CONFIRMED", "ARRIVED"];

function statusTone(status: BookingStatus): "primary" | "success" | "muted" | "danger" {
  if (status === "CONFIRMED" || status === "COMPLETED") return "success";
  if (status === "REQUESTED" || status === "ARRIVED") return "primary";
  if (status === "NO_SHOW" || status === "DECLINED") return "danger";
  return "muted";
}

export default function BookingScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composerShop, setComposerShop] = useState<RouteParams | null>(
    params.providerId ? params : null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [depositPay, setDepositPay] = useState<{id: string; status: string; checkout?: import("../api/dispatch").SepayCheckout | null} | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "shop">("mine");
  const [shopProvider, setShopProvider] = useState<Provider | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [gps, setGps] = useState({lat: 10.7769, lng: 106.7009});

  useEffect(() => {
    if (params.providerId) setComposerShop(params);
  }, [params.providerId, params.at]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    void myBookings(token)
      .then((res) => setBookings(res.bookings))
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(useCallback(() => {
    load();
    if (!token) return;
    void myProviders(token)
      .then((rows) => setShopProvider(rows.find((row) => row.kind === "SHOP") ?? null))
      .catch(() => undefined);
    void capturePosition().then((point) => {
      if (point) setGps(point);
    }).catch(() => undefined);
  }, [load, token]));

  const now = Date.now();
  const upcoming = bookings.filter((b) =>
    ACTIVE.includes(b.status) && Date.parse(b.scheduledAt) >= now - 60 * 60 * 1000);
  const past = bookings.filter((b) =>
    !upcoming.includes(b));

  async function onCancel(booking: Booking): Promise<void> {
    if (!token || busyId !== null) return;
    Alert.alert(t.bookings.cancelPrompt, undefined, [
      {text: t.common.cancel, style: "cancel"},
      {
        text: t.bookings.cancelBooking,
        style: "destructive",
        onPress: () => {
          setBusyId(booking.id);
          void cancelBooking(booking.id, token)
            .then(() => { setNotice(t.bookings.cancelled); load(); })
            .catch((err) => setError(toMessage(err)))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  }

  async function onFileTow(booking: Booking): Promise<void> {
    if (!token || busyId !== null) return;
    Alert.alert(t.bookings.towIt, t.bookings.towConfirm, [
      {text: t.common.cancel, style: "cancel"},
      {
        text: t.bookings.towIt,
        onPress: () => {
          setBusyId(booking.id);
          void createBookingTow(booking.id, token)
            .then(() => { setNotice(t.bookings.towFiled); load(); })
            .catch((err) => setError(toMessage(err)))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  }

  async function onPayDeposit(booking: Booking): Promise<void> {
    if (!token || depositBusy) return;
    setDepositBusy(true);
    setDepositError(null);
    try {
      const next = await depositCheckout(booking.id, token);
      setDepositPay(next);
    } catch (err) {
      setDepositError(toMessage(err));
    } finally {
      setDepositBusy(false);
    }
  }

  async function onArrive(booking: Booking): Promise<void> {
    if (!token || busyId !== null) return;
    setBusyId(booking.id);
    try {
      await arriveBooking(booking.id, token);
      setNotice(t.bookings.checkedIn);
      load();
      navigation.navigate("Assist" as never);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function toneColor(tone: "primary" | "success" | "muted" | "danger"): string {
    if (tone === "success") return theme.success;
    if (tone === "danger") return theme.danger;
    if (tone === "primary") return theme.primary;
    return theme.muted;
  }

  function renderCard(booking: Booking) {
    const tone = statusTone(booking.status);
    const when = new Date(booking.scheduledAt).toLocaleString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const at = Date.parse(booking.scheduledAt);
    const canArrive = booking.status === "CONFIRMED" &&
      Date.now() >= at - 2 * 60 * 60 * 1000 &&
      Date.now() <= at + 4 * 60 * 60 * 1000;
    const canCancel = booking.status === "REQUESTED" || booking.status === "CONFIRMED";
    return (
      <View key={booking.id} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadText}>
            <Text style={[styles.shopName, {color: theme.text}]}>{booking.providerName}</Text>
            <Text style={[styles.when, {color: theme.muted}]}>{when}</Text>
          </View>
          <View style={[styles.pill, {borderColor: toneColor(tone)}]}>
            <Text style={[styles.pillText, {color: toneColor(tone)}]}>
              {booking.status === "REQUESTED" ? t.bookings.requested :
                booking.status === "CONFIRMED" ? t.bookings.confirmed :
                  booking.status === "DECLINED" ? t.bookings.declined :
                    booking.status === "CANCELLED" ? t.bookings.cancelled :
                      booking.status === "ARRIVED" ? t.bookings.arrived :
                        booking.status === "COMPLETED" ? t.bookings.completed :
                          t.bookings.noShow}
            </Text>
          </View>
        </View>
        {booking.serviceSnapshot && booking.serviceSnapshot.length > 0 ? (
          <Text style={[styles.services, {color: theme.text}]} numberOfLines={2}>
            {booking.serviceSnapshot.map((s) => t.bookings.serviceLine.replace("{name}", s.name).replace("{price}", `${s.price.toLocaleString()} ₫`)).join(" · ")}
          </Text>
        ) : null}
        <Text style={[styles.hint, {color: theme.muted}]}>{booking.arrivalMode === "TOW" ? t.bookings.towIt : t.bookings.rideIt}</Text>
        {booking.outsideHours ? <Text style={[styles.hint, {color: theme.muted}]}>{t.bookings.outsideHours}</Text> : null}
        {booking.depositAmount > 0 ? (
          <Text style={[styles.hint, {color: booking.depositStatus === "DUE" ? theme.primary : theme.muted}]}>
            {`${booking.depositStatus === "DUE" || booking.depositStatus === "REQUESTED" ? t.provider.depositDue : booking.depositStatus === "NONE" || booking.depositStatus === "WAIVED" ? t.provider.depositWaived : t.provider.depositCollected}: ${booking.depositAmount.toLocaleString()} ₫`}
          </Text>
        ) : null}
        {booking.note ? <Text style={[styles.hint, {color: theme.muted}]} numberOfLines={2}>{booking.note}</Text> : null}
        <View style={styles.cardActions}>
          {canCancel ? (
            <Pressable style={[styles.secondary, {borderColor: theme.border}]} disabled={busyId !== null} onPress={() => void onCancel(booking)} accessibilityRole="button">
              <Text style={[styles.secondaryText, {color: theme.danger}]}>{t.bookings.cancelBooking}</Text>
            </Pressable>
          ) : null}
          {booking.depositStatus === "REQUESTED" ? (
            <Pressable style={[styles.secondary, {borderColor: theme.primary}]} disabled={depositBusy} onPress={() => void onPayDeposit(booking)} accessibilityRole="button">
              {depositBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.secondaryText, {color: theme.primary}]}>{t.bookings.payDeposit}</Text>}
            </Pressable>
          ) : null}
          {booking.status === "CONFIRMED" && booking.arrivalMode === "TOW" ? (
            <Pressable style={[styles.secondary, {borderColor: theme.primary}]} disabled={busyId !== null} onPress={() => void onFileTow(booking)} accessibilityRole="button">
              {busyId === booking.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.secondaryText, {color: theme.primary}]}>{t.bookings.towIt}</Text>}
            </Pressable>
          ) : null}
          {(booking.status === "ARRIVED" || booking.status === "COMPLETED") &&
            (booking.linkedTicketIds?.length ?? 0) > 0 ? (
            <Pressable style={[styles.secondary, {borderColor: theme.border}]} onPress={() => (navigation as unknown as {navigate: (name: string, params?: unknown) => void}).navigate("JobSummary", {bookingId: booking.id})} accessibilityRole="button">
              <Text style={[styles.secondaryText, {color: theme.text}]}>{t.bookings.jobSummary}</Text>
            </Pressable>
          ) : null}
          {canArrive ? (
            <Pressable style={[styles.primary, {backgroundColor: theme.primary}]} disabled={busyId !== null} onPress={() => void onArrive(booking)} accessibilityRole="button">
              {busyId === booking.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t.bookings.imHere}</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={styles.headRow}>
          <Text style={[styles.title, {color: theme.text}]}>{t.bookings.title}</Text>
        </View>
        {shopProvider !== null ? (
          <View style={[styles.tabs, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            {(["mine", "shop"] as const).map((id) => {
              const active = tab === id;
              return (
                <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, active && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected: active}}>
                  <Text style={[styles.tabText, {color: active ? "#fff" : theme.text}]}>{id === "mine" ? t.bookings.mine : t.bookings.shop}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {tab === "shop" && shopProvider !== null && token ? (
          <ShopBookingsPanel token={token} providerId={shopProvider.id} onNotice={setNotice} />
        ) : (
          <>
            <Pressable
              style={[styles.searchBox, {backgroundColor: theme.paper, borderColor: theme.border}]}
              onPress={() => setSearchOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.bookings.searchPlaceholder}
            >
              <MaterialIcons name="search" size={20} color={theme.muted} />
              <Text style={[styles.searchInput, {color: theme.muted}]}>{t.bookings.searchPlaceholder}</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
            </Pressable>
            {loading && bookings.length === 0 ? <ActivityIndicator color={theme.primary} /> : null}
            {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
            {!loading && bookings.length === 0 && composerShop === null ? (
              <View style={[styles.empty, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                <MaterialIcons name="event-available" size={40} color={theme.muted} />
                <Text style={[styles.emptyTitle, {color: theme.text}]}>{t.bookings.none}</Text>
                <Text style={[styles.emptyHint, {color: theme.muted}]}>{t.bookings.searchHint}</Text>
              </View>
            ) : null}
            {upcoming.length > 0 ? <Text style={[styles.section, {color: theme.muted}]}>{t.bookings.upcoming.toUpperCase()}</Text> : null}
            {upcoming.map(renderCard)}
            {past.length > 0 ? <Text style={[styles.section, {color: theme.muted}]}>{t.bookings.past.toUpperCase()}</Text> : null}
            {past.map(renderCard)}
          </>
        )}
      </ScrollView>
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <View style={[styles.searchModal, {backgroundColor: theme.background}]}>
          <PlaceSearchScreen
            t={t}
            {...(token ? {token} : {})}
            lang={lang}
            title={t.bookings.searchPlaceholder}
            placeholder={t.bookings.searchPlaceholder}
            sources={["shop", "map"]}
            mapFilter={isRepairPlace}
            requireBookable
            shopPreviewChannel="BOOKING"
            shops={(query, filters) => fetchShopPlaces(
              query,
              token ?? "",
              gps,
              undefined,
              20000,
              true,
              filters,
            ).then((rows) => rows.filter((row) =>
              hasBookingService(row.services as never)))}
            onPick={(place) => {
              if (place.source === "shop" && place.id !== undefined &&
                place.bookingEnabled === true) {
                setComposerShop({
                  providerId: place.id,
                  providerName: place.label,
                  services: (place.services ?? []).filter((service) =>
                    hasChannel(service, "BOOKING")) as ProviderService[],
                  at: Date.now(),
                });
                setSearchOpen(false);
                return;
              }
              setNotice(place.source === "shop" ?
                t.bookings.notBookable :
                t.bookings.notRegistered);
            }}
            onClose={() => setSearchOpen(false)}
          />
        </View>
      </Modal>
      {composerShop?.providerId ? (
        <Overlay
          visible
          variant="sheet"
          title={t.bookings.bookAt.replace("{shop}", composerShop.providerName ?? "")}
          closeLabel={t.common.cancel}
          onClose={() => setComposerShop(null)}
          scrollable
        >
          <View style={styles.composerModal}>
            <BookingComposer
              token={token ?? ""}
              providerId={composerShop.providerId}
              providerName={composerShop.providerName ?? ""}
              services={composerShop.services ?? []}
              inModal
              onCreated={() => {
                setComposerShop(null);
                setNotice(t.bookings.sent);
                load();
              }}
              onClose={() => setComposerShop(null)}
            />
          </View>
        </Overlay>
      ) : null}
      {depositPay ? (
        <SePayCheckoutSheet
          t={t}
          url=""
          checkout={depositPay.checkout ?? null}
          status={depositPay.status}
          busy={false}
          error={depositError}
          onClose={() => setDepositPay(null)}
          onSuccess={() => { setDepositPay(null); setNotice(t.bookings.depositPaid); load(); }}
          onCancel={() => setDepositPay(null)}
          onFailure={() => { setDepositPay(null); setDepositError(t.bookings.depositFailed); }}
        />
      ) : null}
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  headRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  title: {fontSize: 22, fontWeight: "800"},
  bookBtn: {flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  bookBtnText: {fontSize: 13, fontWeight: "700"},
  section: {fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 8},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 8},
  cardHead: {flexDirection: "row", alignItems: "flex-start", gap: 10},
  cardHeadText: {flex: 1, gap: 2},
  shopName: {fontSize: 16, fontWeight: "700"},
  when: {fontSize: 13},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 10},
  pillText: {fontSize: 11, fontWeight: "700"},
  services: {fontSize: 12},
  hint: {fontSize: 12, lineHeight: 17},
  cardActions: {flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4},
  secondary: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  secondaryText: {fontSize: 13, fontWeight: "600"},
  primary: {borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16},
  primaryText: {color: "#fff", fontSize: 13, fontWeight: "700"},
  empty: {borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 8},
  emptyTitle: {fontSize: 16, fontWeight: "700"},
  emptyHint: {fontSize: 13, textAlign: "center"},
  error: {fontSize: 12},
  tabs: {borderWidth: 1, borderRadius: 12, padding: 4, flexDirection: "row", gap: 4},
  tab: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  tabText: {fontSize: 13, fontWeight: "700"},
  searchBox: {borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 8},
  searchInput: {flex: 1, paddingVertical: 8, fontSize: 14},
  searchModal: {flex: 1},
  composerModal: {minHeight: 420, paddingBottom: 8},
});
