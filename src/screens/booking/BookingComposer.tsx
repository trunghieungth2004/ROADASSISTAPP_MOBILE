import {useEffect, useMemo, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import {useStrings} from "../../context/LanguageContext";
import {toMessage} from "../../api/client";
import {
  bookingAvailability,
  createBooking,
  type BookingAvailability,
  type BookingSlot,
} from "../../api/bookings";
import type {ProviderService} from "../../api/providers";
import {capturePosition} from "../../services/locationBeats";

const DAYS_AHEAD = 7;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function localDateKey(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayLabel(date: string, index: number, locale: string): string {
  const at = new Date(`${date}T12:00:00`);
  const weekday = at.toLocaleDateString(locale, {weekday: "short"});
  return index === 0 ? weekday : `${weekday} ${at.getDate()}`;
}

function localIso(date: string, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const at = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString();
}

type Props = {
  token: string;
  providerId: string;
  providerName: string;
  services: ProviderService[];
  onCreated: () => void;
  onClose: () => void;
  inModal?: boolean;
};

export default function BookingComposer({token, providerId, providerName, services, onCreated, onClose, inModal = false}: Props) {
  const {t, lang} = useStrings();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const dates = useMemo(() => Array.from({length: DAYS_AHEAD}, (_, i) => localDateKey(i)), []);
  const [date, setDate] = useState(dates[0]);
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookingSlot | null>(null);
  const [customTime, setCustomTime] = useState("");
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [arrivalMode, setArrivalMode] = useState<"SELF" | "TOW">("SELF");
  const [origin, setOrigin] = useState<{lat: number; lng: number; label: string} | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    setError(null);
    void bookingAvailability(providerId, token, date)
      .then((next) => {
        if (alive) setAvailability(next);
      })
      .catch((err) => {
        if (alive) setError(toMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [providerId, token, date]);

  const selectedServiceTotal = services
    .filter((service) => codes.includes(service.code))
    .reduce((sum, service) => sum + service.displayPrice, 0);
  const depositPreview = availability?.depositPolicy === "FIXED" ?
    availability.depositAmount :
    availability?.depositPolicy === "PERCENT" ?
      Math.round(selectedServiceTotal * availability.depositPercent / 100) :
      0;
  const scheduledAt = selected?.at ?? localIso(date, customTime);
  const customValid = TIME_PATTERN.test(customTime);
  const canSubmit = scheduledAt !== null && !busy &&
    availability?.bookingEnabled === true &&
    (selected !== null || note.trim() !== "") &&
    (arrivalMode === "SELF" || origin !== null);

  function toggleCode(code: string): void {
    setCodes((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]);
  }

  async function submit(): Promise<void> {
    if (!canSubmit || scheduledAt === null) return;
    setBusy(true);
    setError(null);
    try {
      await createBooking({
        providerId,
        scheduledAt,
        arrivalMode,
        bufferMinutes,
        ...(origin !== null ? {origin} : {}),
        ...(codes.length > 0 ? {serviceCodes: codes} : {}),
        ...(note.trim() !== "" ? {note: note.trim()} : {}),
      }, token);
      onCreated();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, inModal && styles.embedded, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      {inModal ? null : (
        <View style={styles.headRow}>
          <View style={styles.headText}>
            <Text style={[styles.title, {color: theme.text}]}>{t.bookings.bookAt.replace("{shop}", providerName)}</Text>
            <Text style={[styles.hint, {color: theme.muted}]}>{t.bookings.freeFormHint}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.cancel}>
            <MaterialIcons name="close" size={22} color={theme.muted} />
          </Pressable>
        </View>
      )}
      <Text style={[styles.label, {color: theme.text}]}>{t.bookings.arrival}</Text>
      <View style={styles.row}>
        {(["SELF", "TOW"] as const).map((mode) => {
          const active = arrivalMode === mode;
          return (
            <Pressable key={mode} onPress={() => setArrivalMode(mode)} style={[styles.modeChip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
              <MaterialIcons name={mode === "TOW" ? "local-shipping" : "two-wheeler"} size={16} color={active ? theme.primary : theme.muted} />
              <Text style={{color: active ? theme.primary : theme.text, fontSize: 12, fontWeight: "600"}}>{mode === "TOW" ? t.bookings.towIt : t.bookings.rideIt}</Text>
            </Pressable>
          );
        })}
      </View>
      {arrivalMode === "TOW" ? (
        <Pressable onPress={() => void capturePosition().then((point) => {
          if (point) setOrigin({...point, label: t.bookings.currentLocation});
        }).catch(() => undefined)} style={[styles.locationBtn, {borderColor: origin ? theme.primary : theme.border}]} accessibilityRole="button">
          <MaterialIcons name="my-location" size={16} color={theme.primary} />
          <Text style={{color: origin ? theme.text : theme.muted, fontSize: 12}}>
            {origin ? `${origin.label} · ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}` : t.bookings.useCurrentLocation}
          </Text>
        </Pressable>
      ) : null}
      {arrivalMode === "TOW" && origin === null ? <Text style={[styles.hint, {color: theme.danger}]}>{t.bookings.pickupMissing}</Text> : null}
      <Text style={[styles.label, {color: theme.text}]}>{t.bookings.reminderLead}</Text>
      <View style={styles.row}>
        {[15, 30, 60].map((value) => {
          const active = bufferMinutes === value;
          return (
            <Pressable key={value} onPress={() => setBufferMinutes(value)} style={[styles.modeChip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
              <Text style={{color: active ? theme.primary : theme.text, fontSize: 12, fontWeight: "600"}}>{t.bookings.minutesShort.replace("{n}", String(value))}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.bookings.pickDate}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {dates.map((day, index) => {
          const active = day === date;
          return (
            <Pressable key={day} onPress={() => setDate(day)} style={[styles.dateChip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
              <Text style={[styles.dateText, {color: active ? theme.primary : theme.text}]}>{dayLabel(day, index, locale)}</Text>
              <Text style={[styles.dateSub, {color: theme.muted}]}>{day.slice(5)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {!loading && availability && availability.bookingEnabled === false ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.bookings.noSlots}</Text>
      ) : null}
      {!loading && availability && availability.slots.length > 0 ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.bookings.pickTime}</Text>
          <View style={styles.slotGrid}>
            {availability.slots.map((slot) => {
              const active = selected?.slot === slot.slot;
              const disabled = slot.remaining <= 0;
              return (
                <Pressable key={slot.slot} disabled={disabled} onPress={() => { setSelected(slot); setCustomTime(""); }} style={[styles.slot, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : "transparent", opacity: disabled ? 0.4 : 1}]} accessibilityRole="button">
                  <Text style={[styles.slotText, {color: active ? "#fff" : theme.text}]}>{slot.slot}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {!loading && availability && availability.slots.length === 0 ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.bookings.noSlots}</Text>
      ) : null}
      <Text style={[styles.label, {color: theme.text}]}>{t.bookings.requestTime}</Text>
      <TextInput value={customTime} onChangeText={(v) => { setCustomTime(v); setSelected(null); }} placeholder="09:30" placeholderTextColor={theme.muted} keyboardType="numbers-and-punctuation" style={[styles.input, {borderColor: theme.border, color: theme.text}]} />
      {customTime !== "" && !customValid ? <Text style={[styles.hint, {color: theme.danger}]}>{t.bookings.invalidTime}</Text> : null}
      {services.length > 0 ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.bookings.services}</Text>
          <View style={styles.slotGrid}>
            {services.map((service) => {
              const active = codes.includes(service.code);
              return (
                <Pressable key={service.code} onPress={() => toggleCode(service.code)} style={[styles.serviceChip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
                  <Text style={[styles.serviceText, {color: active ? theme.primary : theme.text}]}>{t.bookings.serviceLine.replace("{name}", service.name).replace("{price}", service.quoteRequired ? t.provider.serviceQuote : `${service.displayPrice.toLocaleString()} ₫`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      <Text style={[styles.label, {color: theme.text}]}>{t.bookings.note}</Text>
      <TextInput value={note} onChangeText={setNote} placeholder={t.bookings.notePlaceholder} placeholderTextColor={theme.muted} multiline style={[styles.input, styles.note, {borderColor: theme.border, color: theme.text}]} />
      {depositPreview > 0 ? <Text style={[styles.hint, {color: theme.primary}]}>{`${t.provider.depositDue}: ${depositPreview.toLocaleString()} ₫`}</Text> : null}
      {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
      <Pressable disabled={!canSubmit} onPress={() => void submit()} style={[styles.submit, {backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5}]} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t.bookings.send}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 8},
  embedded: {borderWidth: 0, padding: 0, minHeight: 420},
  headRow: {flexDirection: "row", alignItems: "flex-start", gap: 12},
  headText: {flex: 1, gap: 4},
  title: {fontSize: 17, fontWeight: "700"},
  hint: {fontSize: 12, lineHeight: 18},
  label: {fontSize: 13, fontWeight: "600", marginTop: 4},
  dateRow: {gap: 8, paddingVertical: 4},
  dateChip: {borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 64},
  dateText: {fontSize: 13, fontWeight: "600"},
  dateSub: {fontSize: 11},
  slotGrid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  slot: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  slotText: {fontSize: 13, fontWeight: "600"},
  serviceChip: {borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10},
  serviceText: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 10, padding: 10},
  note: {minHeight: 72, textAlignVertical: "top"},
  submit: {borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 6},
  submitText: {color: "#fff", fontSize: 15, fontWeight: "700"},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  modeChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6},
  locationBtn: {borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
});
