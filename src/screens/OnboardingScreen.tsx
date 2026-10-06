import {useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {toMessage} from "../api/client";
import {formatPoint} from "../api/places";
import {getFix} from "../services/geo";
import type {Place} from "../components/place-search/PlaceSearch.types";
import type {Strings} from "../i18n/en";
import {darkTheme, lightTheme} from "../theme";
import {TOW_TYPES, validateTowDraft} from "../services/towPlates";
import {DOW, buildOpenHours, emptyWeek, summarizeWeek, type Day, type WeekHours} from "./more/shopHours";
import PlaceSearchScreen from "./PlaceSearchScreen";
import MapPickOverlay from "../components/map/MapPickOverlay";
import ShopHoursEditor from "../components/providers/ShopHoursEditor";
import Overlay from "../components/overlay/Overlay";

export type ShopDraft = {name: string; lat: number; lng: number; label?: string; openHours?: string; vehicleClasses?: string[]};

export type TowDraft = {name: string; plate: string; vehicleType: string; width: string; lat: number; lng: number};

export type OnboardingProps = {t: Strings; lang: string; token: string | null; busy?: boolean; error?: string | null; selectedServices?: string[]; registered?: {shop: boolean; tow: boolean}; onFinish: (services: string[], shop: ShopDraft | null, tow: TowDraft | null) => void; onSkip: () => void};

const ROLE_ICONS = {
  rider: "two-wheeler",
  volunteer: "volunteer-activism",
  shop: "storefront",
  tow: "local-shipping",
} as const;

function RoleIcon({name, active, theme}: {name: (typeof ROLE_ICONS)[keyof typeof ROLE_ICONS]; active: boolean; theme: {primary: string; text: string}}) {
  return (
    <View style={styles.iconSlot}>
      <MaterialIcons name={name} size={20} color={active ? "#fff" : theme.primary} />
    </View>
  );
}

export default function OnboardingScreen({t, lang, token, busy, error, selectedServices, registered, onFinish, onSkip}: OnboardingProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const shopChosen = (selectedServices ?? []).includes("SHOP");
  const towChosen = (selectedServices ?? []).includes("TOW");
  const hasShop = shopChosen || registered?.shop === true;
  const shopRegistered = registered?.shop === true;
  const hasTow = towChosen || registered?.tow === true;
  const towRegistered = registered?.tow === true;
  const [volunteer, setVolunteer] = useState((selectedServices ?? []).includes("VOLUNTEER"));
  const [shopOpen, setShopOpen] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopPoint, setShopPoint] = useState<{lat: number; lng: number; label?: string} | null>(null);
  const [shopSearch, setShopSearch] = useState(false);
  const [shopMap, setShopMap] = useState(false);
  const [week, setWeek] = useState<WeekHours>(() => emptyWeek());
  const [hoursOpen, setHoursOpen] = useState(false);
  const [shopClasses, setShopClasses] = useState<string[]>(["SOLO_BIKE", "CAR"]);
  function toggleShopClass(cls: string): void {
    setShopClasses((prev) => {
      if (prev.includes(cls)) {
        const next = prev.filter((c) => c !== cls);
        return next.length > 0 ? next : prev;
      }
      return [...prev, cls];
    });
  }
  function setDay(day: Day, patch: {enabled?: boolean; open?: string; close?: string}): void {
    setWeek((prev) => ({...prev, [day]: {...prev[day], ...patch}}));
  }
  const hoursSummary = summarizeWeek(week, t.provider.days, t.provider.hoursMixed);
  const [towOpen, setTowOpen] = useState(false);
  const [towName, setTowName] = useState("");
  const [plate, setPlate] = useState("");
  const [towType, setTowType] = useState<string>("VAN");
  const [width, setWidth] = useState("");
  const [towPoint, setTowPoint] = useState<{lat: number; lng: number} | null>(null);
  const [towSearch, setTowSearch] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  async function stampTowPosition(): Promise<void> {
    if (locBusy) return;
    setLocBusy(true);
    setFieldError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error(t.nav.locationDenied);
      const pos = await getFix();
      setTowPoint({lat: pos.lat, lng: pos.lng});
    } catch (err) {
      setFieldError(toMessage(err));
    } finally {
      setLocBusy(false);
    }
  }
  function onPickShopPlace(place: Place): void {
    setShopPoint({lat: place.lat, lng: place.lng, label: place.label});
    setShopSearch(false);
  }
  function onConfirmShopMap(lat: number, lng: number, label: string): void {
    setShopPoint({lat, lng, label});
    setShopMap(false);
  }
  function onPickTowPlace(place: Place): void {
    setTowPoint({lat: place.lat, lng: place.lng});
    setTowSearch(false);
  }
  function onContinue(): void {
    if (busy) return;
    setFieldError(null);
    let shop: ShopDraft | null = null;
    if (shopOpen) {
      if (shopName.trim() === "") {
        setFieldError(t.provider.invalidName);
        return;
      }
      if (!shopPoint) {
        setFieldError(t.provider.invalidLocation);
        return;
      }
      const hours = buildOpenHours(week);
      if (DOW.some((day) => week[day].enabled) && !hours) {
        setFieldError(t.provider.invalidHours);
        return;
      }
      shop = {name: shopName.trim(), lat: shopPoint.lat, lng: shopPoint.lng, ...(shopPoint.label ? {label: shopPoint.label} : {}), ...(hours ? {openHours: hours} : {}), vehicleClasses: shopClasses};
    }
    let tow: TowDraft | null = null;
    if (towOpen) {
      if (towName.trim() === "") {
        setFieldError(t.provider.invalidName);
        return;
      }
      const bad = validateTowDraft({plate, vehicleType: towType, width});
      if (bad === "plate") {
        setFieldError(t.provider.invalidPlate);
        return;
      }
      if (bad === "type") {
        setFieldError(t.provider.invalidType);
        return;
      }
      if (bad === "width") {
        setFieldError(t.provider.invalidWidth);
        return;
      }
      if (!towPoint) {
        setFieldError(t.provider.invalidLocation);
        return;
      }
      tow = {name: towName.trim(), plate, vehicleType: towType, width, lat: towPoint.lat, lng: towPoint.lng};
    }
    onFinish(["RIDER", ...(volunteer ? ["VOLUNTEER"] : [])], shop, tow);
  }
  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, {color: theme.text}]}>{t.roles.title}</Text>
      <Text style={[styles.subtitle, {color: theme.muted}]}>{t.roles.subtitle}</Text>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      {fieldError ? <Text style={[styles.error, {color: theme.danger}]}>{fieldError}</Text> : null}
      <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true}}>
          <RoleIcon name={ROLE_ICONS.rider} active theme={theme} />
          <Text style={{color: "#fff"}}>{t.roles.rider} — {t.roles.riderHint}</Text>
        </View>
        <Pressable disabled={busy} onPress={() => setVolunteer((v) => !v)} style={[styles.option, {borderColor: theme.primary}, volunteer && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: volunteer}}>
          <RoleIcon name={ROLE_ICONS.volunteer} active={volunteer} theme={theme} />
          <Text style={{color: volunteer ? "#fff" : theme.text}}>{t.roles.volunteer} — {t.roles.volunteerHint}</Text>
        </Pressable>
        {hasShop ? (
          <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true, disabled: true}}>
            <RoleIcon name={ROLE_ICONS.shop} active theme={theme} />
            <Text style={{color: "#fff"}}>{t.roles.shop} — {shopRegistered ? t.provider.registered : t.provider.chosenNeedsDetails}</Text>
          </View>
        ) : (
          <Pressable disabled={busy} onPress={() => setShopOpen((v) => !v)} style={[styles.option, {borderColor: theme.primary}, shopOpen && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: shopOpen}}>
            <RoleIcon name={ROLE_ICONS.shop} active={shopOpen} theme={theme} />
            <Text style={{color: shopOpen ? "#fff" : theme.text}}>{t.roles.shop} — {t.roles.shopHint}</Text>
          </Pressable>
        )}
        {shopOpen ? (
          <View style={styles.subForm}>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={shopName} onChangeText={setShopName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
            <Pressable disabled={busy} onPress={() => setShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
              <Text style={{color: shopPoint ? theme.text : theme.muted}} numberOfLines={1}>{shopPoint ? (shopPoint.label ?? formatPoint(shopPoint.lat, shopPoint.lng)) : t.provider.addressUnset}</Text>
            </Pressable>
            <View style={styles.row}>
              {[{id: "SOLO_BIKE", label: t.shop.vehicleBike}, {id: "CAR", label: t.shop.vehicleCar}].map((c) => {
                const selected = shopClasses.includes(c.id);
                return (
                  <Pressable key={c.id} disabled={busy} onPress={() => toggleShopClass(c.id)} style={[styles.chip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: selected}} accessibilityLabel={c.label}>
                    <Text style={{color: selected ? "#fff" : theme.text}}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable disabled={busy} onPress={() => setHoursOpen(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.hours}>
              <Text style={{color: hoursSummary ? theme.text : theme.muted}} numberOfLines={1}>{hoursSummary ? `${t.provider.hours} — ${hoursSummary}` : `${t.provider.hours} — ${t.provider.hoursNotSet}`}</Text>
            </Pressable>
          </View>
        ) : null}
        {hasTow ? (
          <View style={[styles.option, {borderColor: theme.primary, backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: true, disabled: true}}>
            <RoleIcon name={ROLE_ICONS.tow} active theme={theme} />
            <Text style={{color: "#fff"}}>{t.roles.tow} — {towRegistered ? t.provider.registered : t.provider.chosenNeedsDetails}</Text>
          </View>
        ) : (
          <Pressable disabled={busy} onPress={() => setTowOpen((v) => !v)} style={[styles.option, {borderColor: theme.primary}, towOpen && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: towOpen}}>
            <RoleIcon name={ROLE_ICONS.tow} active={towOpen} theme={theme} />
            <Text style={{color: towOpen ? "#fff" : theme.text}}>{t.roles.tow} — {t.roles.towHint}</Text>
          </Pressable>
        )}
        {towOpen ? (
          <View style={styles.subForm}>
            <Text style={[styles.subLabel, {color: theme.text}]}>{t.tow.register}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={towName} onChangeText={setTowName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={plate} onChangeText={setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
            <View style={styles.row}>
              {TOW_TYPES.map((id) => (
                <Pressable key={id} disabled={busy} onPress={() => setTowType(id)} style={[styles.chip, {borderColor: theme.primary}, towType === id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: towType === id}}>
                  <Text style={{color: towType === id ? "#fff" : theme.text}}>{t.vehicle.types[id]}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={width} onChangeText={setWidth} placeholder={t.vehicle.widthMeters} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
            <Pressable disabled={busy} onPress={() => setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
              <Text style={{color: towPoint ? theme.text : theme.muted}} numberOfLines={1}>{towPoint ? formatPoint(towPoint.lat, towPoint.lng) : t.provider.towAddressUnset}</Text>
            </Pressable>
            <Pressable disabled={busy || locBusy} onPress={() => void stampTowPosition()} style={[styles.chip, {borderColor: theme.primary}, locBusy && styles.disabled]} accessibilityRole="button" accessibilityLabel={t.provider.useLocation}>
              {locBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary}}>{t.provider.useLocation}</Text>}
            </Pressable>
            {towPoint ? <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionSet}</Text> : <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>}
          </View>
        ) : null}
      </View>
      <Pressable
        disabled={busy}
        onPress={onContinue}
        style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}
      >
        <Text style={styles.primaryText}>{t.roles.done}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onSkip}><Text style={[styles.skip, {color: theme.primary}]}>{t.roles.skip}</Text></Pressable>
      </ScrollView>
      <Overlay visible={shopSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setShopSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={token ?? undefined}
          lang={lang}
          title={t.provider.shopAddress}
          placeholder={t.provider.shopAddress}
          onPick={onPickShopPlace}
          onPickOnMap={() => {
            setShopSearch(false);
            setShopMap(true);
          }}
          onClose={() => setShopSearch(false)}
        />
      </Overlay>
      <Overlay visible={shopMap} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setShopMap(false)}>
        <MapPickOverlay
          t={t}
          lang={lang}
          title={t.provider.shopAddress}
          initial={shopPoint}
          onPick={onConfirmShopMap}
          onClose={() => setShopMap(false)}
        />
      </Overlay>
      <Overlay visible={towSearch} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setTowSearch(false)}>
        <PlaceSearchScreen
          t={t}
          token={token ?? undefined}
          lang={lang}
          title={t.provider.towAddress}
          placeholder={t.provider.towAddress}
          onPick={onPickTowPlace}
          onClose={() => setTowSearch(false)}
        />
      </Overlay>
      <Overlay visible={hoursOpen} variant="sheet" title={t.provider.hours} closeLabel={t.common.cancel} onClose={() => setHoursOpen(false)}>
        <ShopHoursEditor t={t} week={week} setDay={setDay} />
      </Overlay>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {flex: 1},
  container: {padding: 20, gap: 12},
  title: {fontSize: 22, fontWeight: "700"},
  subtitle: {fontSize: 13, marginTop: 4, marginBottom: 8},
  error: {fontSize: 13, marginBottom: 4},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8},
  option: {borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  iconSlot: {width: 24, alignItems: "center"},
  subForm: {gap: 8, paddingTop: 4},
  subLabel: {fontSize: 13, fontWeight: "700"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6},
  coords: {fontSize: 12},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  skip: {textAlign: "center", marginTop: 8},
});
