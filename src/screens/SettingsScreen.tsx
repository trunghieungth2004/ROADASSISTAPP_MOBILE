import {useCallback, useState} from "react";
import {Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {setVolunteerAvailability, updateUserServices} from "../api/users";
import {missingKinds} from "./more/providerUi";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {createProvider, myProviders, type Provider} from "../api/providers";
import {normalizeTowPlate, parseTowWidth, validateTowDraft} from "../services/towPlates";
import type {ShopDraft, TowDraft} from "./OnboardingScreen";
import OnboardingScreen from "./OnboardingScreen";
import Overlay from "../components/overlay/Overlay";
import {useThemeMode} from "../context/ThemeContext";
import {toMessage} from "../api/client";

export default function SettingsScreen() {
  const {t, lang, toggle} = useStrings();
  const {token, uid} = useAuth();
  const {user, refresh, markOnboarded} = useProfile();
  const {mode, toggle: toggleTheme} = useThemeMode();
  const scheme = mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [notice, setNotice] = useState<string | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [volBusy, setVolBusy] = useState(false);
  const [volError, setVolError] = useState<string | null>(null);
  const isVolunteer = (user?.services ?? []).includes("VOLUNTEER");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const loadProviders = useCallback(async (): Promise<void> => {
    if (!token) {
      setProviders([]);
      return;
    }
    try {
      setProviders(await myProviders(token));
    } catch (err) {
      setProviderError(toMessage(err));
    }
  }, [token]);
  useFocusEffect(useCallback(() => {
    void loadProviders();
  }, [loadProviders]));
  async function onVolunteerOption(patch: {volunteerRadiusKm?: number; capability?: string}): Promise<void> {
    if (!token || volBusy) return;
    setVolBusy(true);
    setVolError(null);
    try {
      await setVolunteerAvailability({available: true, ...patch}, token);
      await refresh();
      setNotice(t.more.saved);
    } catch (err) {
      setVolError(toMessage(err));
    } finally {
      setVolBusy(false);
    }
  }
  const services = user?.services ?? [];
  async function onServicesFinish(selected: string[], shop: ShopDraft | null, tow: TowDraft | null) {
    setServicesBusy(true); setServicesError(null);
    try {
      if (shop && shop.name.trim() === "") throw new Error(t.provider.invalidName);
      if (tow) {
        if (tow.name.trim() === "") throw new Error(t.provider.invalidName);
        if (validateTowDraft({plate: tow.plate, vehicleType: tow.vehicleType, width: tow.width})) throw new Error(t.tow.invalid);
      }
      const held = user?.services ?? [];
      for (const service of selected) {
        if (!held.includes(service)) await markOnboarded(service);
      }
      if (token && uid && held.includes("VOLUNTEER") && !selected.includes("VOLUNTEER")) {
        await updateUserServices({targetUserId: uid, revoke: ["VOLUNTEER"]}, token);
      }
      if (token) {
        if (shop) {
          try {
            await createProvider({kind: "SHOP", name: shop.name.trim(), lat: shop.lat, lng: shop.lng, ...(shop.label ? {label: shop.label} : {}), ...(shop.openHours ? {openHours: shop.openHours} : {}), ...(shop.vehicleClasses ? {vehicleClasses: shop.vehicleClasses} : {})}, token);
          } catch (err) {
            throw new Error(`${t.provider.createShopFailed} ${toMessage(err)}`);
          }
        }
        if (tow) {
          try {
            await createProvider({kind: "TOW", name: tow.name.trim(), lat: tow.lat, lng: tow.lng, plate: normalizeTowPlate(tow.plate), vehicleType: tow.vehicleType, vehicleWidth: parseTowWidth(tow.width) ?? undefined}, token);
          } catch (err) {
            throw new Error(`${t.provider.createTowFailed} ${toMessage(err)}`);
          }
        }
      }
      await refresh(); await loadProviders(); setServicesOpen(false); setNotice(t.provider.saved);
    } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  async function onServicesSkip() {
    setServicesBusy(true); setServicesError(null);
    try { await markOnboarded("RIDER"); await refresh(); setServicesOpen(false); } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  const missing = missingKinds(providers);
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => { setServicesError(null); setServicesOpen(true); }}><MaterialIcons name="bookmark" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.services}</Text><MaterialIcons name="chevron-right" size={20} color={theme.muted} /></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Permissions" as never)} accessibilityRole="button" accessibilityLabel={t.more.permissions}>
            <MaterialIcons name="lock" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.permissions}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Providers" as never)} accessibilityRole="button" accessibilityLabel={t.provider.title}>
            <MaterialIcons name="store" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.provider.title}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={toggleTheme} accessibilityRole="switch" accessibilityState={{checked: scheme === "dark"}}><MaterialIcons name={scheme === "dark" ? "light-mode" : "dark-mode"} size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.appearance}</Text><View pointerEvents="none"><Switch value={scheme === "dark"} onValueChange={() => toggleTheme()} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={toggle}><MaterialIcons name="translate" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.language}</Text><Text style={[styles.listSecondary, {color: theme.muted}]}>{lang === "en" ? "EN" : "VI"}</Text><MaterialIcons name="chevron-right" size={20} color={theme.muted} /></Pressable>
        </View>
        {isVolunteer && user?.volunteerAvailable ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.optionBlock}>
              <Text style={[styles.optionLabel, {color: theme.text}]}>{t.more.volRadius}</Text>
              <View style={styles.optionRow}>
                {[2, 5, 10, 15].map((km) => {
                  const current = user?.volunteerRadiusKm ?? 5;
                  const selected = current === km;
                  return (
                    <Pressable key={km} style={[styles.optChip, {borderColor: selected ? theme.primary : theme.border}, selected && {backgroundColor: `${theme.primary}22`}]} disabled={volBusy} onPress={() => void onVolunteerOption({volunteerRadiusKm: km})} accessibilityRole="button">
                      <Text style={[styles.optText, {color: selected ? theme.primary : theme.text}]}>{km}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.optionBlock}>
              <Text style={[styles.optionLabel, {color: theme.text}]}>{t.more.volCapability}</Text>
              <View style={styles.optionRow}>
                {[{id: "SOLO_BIKE", label: t.more.volSoloBike}, {id: "CAR", label: t.more.volCar}].map((c) => {
                  const selected = (user?.capability ?? "SOLO_BIKE") === c.id;
                  return (
                    <Pressable key={c.id} style={[styles.optChip, {borderColor: selected ? theme.primary : theme.border}, selected && {backgroundColor: `${theme.primary}22`}]} disabled={volBusy} onPress={() => void onVolunteerOption({capability: c.id})} accessibilityRole="button">
                      <Text style={[styles.optText, {color: selected ? theme.primary : theme.text}]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
        <Overlay visible={servicesOpen} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setServicesOpen(false)}>
          {servicesOpen ? (
            <OnboardingScreen t={t} lang={lang} token={token} busy={servicesBusy} error={servicesError} selectedServices={services} registered={{shop: !missing.shop, tow: !missing.tow}} onFinish={(selected, shop, tow) => void onServicesFinish(selected, shop, tow)} onSkip={() => void onServicesSkip()} />
          ) : null}
        </Overlay>
      </ScrollView>
      {volError ? (
        <Snack message={volError} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setVolError(null)} />
      ) : providerError ? (
        <Snack message={providerError} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setProviderError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  listSecondary: {fontSize: 13},
  divider: {height: 1, marginHorizontal: 16},
  optionBlock: {gap: 8, paddingVertical: 14, paddingHorizontal: 16},
  optionLabel: {fontSize: 13, fontWeight: "700"},
  optionRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  optChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16},
  optText: {fontSize: 13, fontWeight: "600"},
});
