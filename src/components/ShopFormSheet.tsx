import {useState} from "react";
import {ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Switch, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {createShop, updateShop, type Shop} from "../api/shops";
import {formatPoint} from "../api/places";
import {toMessage} from "../api/client";
import type {Strings} from "../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import {DOW, buildOpenHours, emptyWeek, isValidTime, parseOpenHours, validateWeek, type WeekHours} from "../screens/more/shopHours";

type Props = {
  t: Strings;
  token: string | null;
  shop: Shop | null;
  onClose: () => void;
  onSaved: () => void;
};

const SHOP_TYPES = ["SHOP", "MOBILE", "TOW"] as const;

function typeLabel(type: string, t: Strings): string {
  if (type === "MOBILE") return t.shop.typeMobile;
  if (type === "TOW") return t.shop.typeTow;
  return t.shop.typeShop;
}

export default function ShopFormSheet({t, token, shop, onClose, onSaved}: Props) {
  const scheme = useColorScheme();
  const theme: AppTheme = scheme === "dark" ? darkTheme : lightTheme;
  const [name, setName] = useState(shop?.name ?? "");
  const [kind, setKind] = useState<string>(typeof shop?.type === "string" ? shop.type : "SHOP");
  const [point, setPoint] = useState<{lat: number; lng: number} | null>(shop ? {lat: shop.lat, lng: shop.lng} : null);
  const [week, setWeek] = useState<WeekHours>(() => parseOpenHours(typeof shop?.openHours === "string" ? shop.openHours : null));
  const [accepting, setAccepting] = useState(shop?.accepting !== false);
  const [locBusy, setLocBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoursOk = validateWeek(week);
  function setDay(day: (typeof DOW)[number], patch: {enabled?: boolean; open?: string; close?: string}): void {
    setWeek((prev) => ({...prev, [day]: {...prev[day], ...patch}}));
  }
  async function useMyLocation(): Promise<void> {
    if (locBusy) return;
    setLocBusy(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error(t.nav.locationDenied);
      const pos = await Location.getCurrentPositionAsync({});
      setPoint({lat: pos.coords.latitude, lng: pos.coords.longitude});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocBusy(false);
    }
  }
  async function onSave(): Promise<void> {
    if (!token || busy) return;
    if (name.trim() === "") {
      setError(t.shop.invalidName);
      return;
    }
    if (!point) {
      setError(t.shop.invalidLocation);
      return;
    }
    if (!hoursOk) {
      setError(t.shop.invalidHours);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      Keyboard.dismiss();
      const hours = buildOpenHours(week);
      if (shop) {
        await updateShop({shopId: shop.id, name: name.trim(), openHours: hours, accepting}, token);
      } else {
        await createShop({name: name.trim(), lat: point.lat, lng: point.lng, type: kind, ...(hours ? {openHours: hours} : {})}, token);
      }
      onSaved();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, {color: theme.text}]}>{shop ? t.shop.editShop : t.shop.addShop}</Text>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <Text style={[styles.label, {color: theme.text}]}>{t.shop.shopName}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={name} onChangeText={setName} placeholder={t.shop.shopName} placeholderTextColor={theme.muted} />
      {shop ? null : (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.shop.shopType}</Text>
          <View style={styles.row}>
            {SHOP_TYPES.map((id) => (
              <Pressable key={id} style={[styles.chip, {borderColor: theme.primary}, kind === id && {backgroundColor: theme.primary}]} onPress={() => setKind(id)} accessibilityRole="button">
                <Text style={{color: kind === id ? "#fff" : theme.text}}>{typeLabel(id, t)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <View style={styles.row}>
        <Pressable style={[styles.chip, {borderColor: theme.primary}, locBusy && styles.disabled]} disabled={locBusy} onPress={() => void useMyLocation()} accessibilityRole="button" accessibilityLabel={t.shop.useLocation}>
          <Text style={{color: theme.primary}}>{t.shop.useLocation}</Text>
        </Pressable>
      </View>
      {point ? <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(point.lat, point.lng)}</Text> : null}
      <Text style={[styles.label, {color: theme.text}]}>{t.shop.hours}</Text>
      {DOW.map((day) => {
        const row = week[day];
        const bad = row.enabled && (!isValidTime(row.open) || !isValidTime(row.close));
        return (
          <View key={day} style={[styles.dayRow, {borderColor: bad ? theme.danger : theme.border}]}>
            <Pressable style={[styles.dayChip, {borderColor: row.enabled ? theme.primary : theme.border}, row.enabled && {backgroundColor: theme.primary}]} onPress={() => setDay(day, {enabled: !row.enabled})} accessibilityRole="button">
              <Text style={{color: row.enabled ? "#fff" : theme.text, fontWeight: "700"}}>{t.shop.days[day]}</Text>
            </Pressable>
            {row.enabled ? (
              <>
                <TextInput style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]} value={row.open} onChangeText={(v) => setDay(day, {open: v})} placeholder="08:00" placeholderTextColor={theme.muted} maxLength={5} />
                <Text style={{color: theme.muted}}>–</Text>
                <TextInput style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]} value={row.close} onChangeText={(v) => setDay(day, {close: v})} placeholder="18:00" placeholderTextColor={theme.muted} maxLength={5} />
              </>
            ) : null}
          </View>
        );
      })}
      {shop ? (
        <View style={styles.acceptRow}>
          <MaterialIcons name="store" size={20} color={theme.primary} />
          <Text style={[styles.acceptText, {color: theme.text}]}>{t.shop.accepting}</Text>
          <Switch value={accepting} onValueChange={setAccepting} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <Text style={{color: theme.text}}>{t.common.close}</Text>
        </Pressable>
        <Pressable style={[styles.save, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSave()} accessibilityRole="button" accessibilityLabel={t.common.save}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t.common.save}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {gap: 10, maxHeight: 480},
  title: {fontSize: 16, fontWeight: "700"},
  error: {fontSize: 13},
  label: {fontSize: 13, fontWeight: "700"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  coords: {fontSize: 12},
  dayRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 8},
  dayChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  time: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center"},
  acceptRow: {flexDirection: "row", alignItems: "center", gap: 12},
  acceptText: {flex: 1, fontSize: 15, fontWeight: "500"},
  actions: {flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 4},
  save: {borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center"},
  saveText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
