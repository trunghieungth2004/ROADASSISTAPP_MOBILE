import {useCallback, useState} from "react";
import {Keyboard, Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {setVolunteerAvailability, updateProfile, volunteerHeartbeat} from "../api/users";
import {capturePosition, useLocationBeat} from "../services/locationBeats";
import {missingKinds, providerPill, providerRowSubtitle, serviceLabel, switchEnabled} from "./more/providerUi";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import Snack from "../components/Snack";
import {snackAboveTabs} from "../components/snackOffset";
import {myFlags} from "../api/flags";
import {createProvider, myProviders, updateProvider, type Provider} from "../api/providers";
import {normalizeTowPlate, parseTowWidth, validateTowDraft} from "../services/towPlates";
import type {ShopDraft, TowDraft} from "./OnboardingScreen";
import ProviderFormDialog from "../components/ProviderFormDialog";
import OnboardingScreen from "./OnboardingScreen";
import Overlay from "../components/overlay/Overlay";
import {useThemeMode} from "../context/ThemeContext";
import {getPermissionStates, openAppSettings, openBatterySettings, requestBackgroundLocationPermission, requestNotificationPermission, type AppPermissionStates} from "../services/permissions";
import {syncPushToken} from "../services/push";
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export default function MoreScreen() {
  const {t, lang, toggle} = useStrings();
  const {signOut} = useAuth();
  const {user, refresh, markOnboarded} = useProfile();
  const {token, uid} = useAuth();
  const {mode, toggle: toggleTheme} = useThemeMode();
  const scheme = mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [perms, setPerms] = useState<AppPermissionStates>({notifications: {granted: false, canAskAgain: true}, backgroundLocation: {granted: false, canAskAgain: true}});
  const [permsBusy, setPermsBusy] = useState(false);
  const navigation = useNavigation();
  const [volBusy, setVolBusy] = useState(false);
  const [volError, setVolError] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const isVolunteer = (user?.services ?? []).includes("VOLUNTEER");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerCreate, setProviderCreate] = useState<"SHOP" | "TOW" | null>(null);
  const [providerEdit, setProviderEdit] = useState<Provider | null>(null);
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
    void getPermissionStates().then(setPerms).catch(() => undefined);
    if (!token) return;
    void myFlags(token)
      .then((list) => {
        setReportCount(list.length);
        setConfirmedCount(list.filter((f) => f.status === "2").length);
      })
      .catch(() => undefined);
    void loadProviders();
  }, [token, loadProviders]));
  async function onEnableNotifications() {
    if (permsBusy) return;
    setPermsBusy(true);
    try {
      if (perms.notifications.canAskAgain) {
        const next = await requestNotificationPermission();
        setPerms({...perms, notifications: next});
        if (next.granted) await syncPushToken(token, uid);
      } else {
        openAppSettings();
      }
    } finally {
      setPermsBusy(false);
    }
  }
  async function onEnableBackground() {
    if (permsBusy) return;
    setPermsBusy(true);
    try {
      if (perms.backgroundLocation.canAskAgain) {
        setPerms({...perms, backgroundLocation: await requestBackgroundLocationPermission()});
      } else {
        openAppSettings();
      }
    } finally {
      setPermsBusy(false);
    }
  }
  const volunteerOn = user?.volunteerAvailable === true;
  useLocationBeat(!!token && volunteerOn, 5 * 60 * 1000, async () => {
    if (!token) return;
    const pos = await capturePosition();
    if (!pos) return;
    await volunteerHeartbeat(pos.lat, pos.lng, token);
  });
  async function onVolunteerToggle(next: boolean): Promise<void> {
    if (!token || volBusy) return;
    setVolBusy(true);
    setVolError(null);
    try {
      await setVolunteerAvailability({available: next}, token);
      await refresh();
      if (next && token) {
        const pos = await capturePosition();
        if (pos) await volunteerHeartbeat(pos.lat, pos.lng, token);
      }
      setNotice(t.more.saved);
    } catch (err) {
      setVolError(toMessage(err));
    } finally {
      setVolBusy(false);
    }
  }
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
  const displayName = user?.displayName || user?.email || "—";
  const services = user?.services ?? [];
  const isAdmin = user?.role === "1";
  function openEdit() { setNameDraft(user?.displayName ?? ""); setEditError(null); setEditOpen(true); }
  async function onSaveName() {
    if (!token || !nameDraft.trim()) return;
    Keyboard.dismiss();
    setEditError(null);
    try { await updateProfile({displayName: nameDraft.trim()}, token); await refresh(); setEditOpen(false); setNotice(t.more.saved); } catch (err) { setEditError(toMessage(err)); }
  }
  async function onServicesFinish(selected: string[], shop: ShopDraft | null, tow: TowDraft | null) {
    setServicesBusy(true); setServicesError(null);
    try {
      if (shop && shop.name.trim() === "") throw new Error(t.provider.invalidName);
      if (tow) {
        if (tow.name.trim() === "") throw new Error(t.provider.invalidName);
        if (validateTowDraft({plate: tow.plate, vehicleType: tow.vehicleType, width: tow.width})) throw new Error(t.tow.invalid);
      }
      for (const service of selected) await markOnboarded(service);
      if (token) {
        if (shop) {
          try {
            await createProvider({kind: "SHOP", name: shop.name.trim(), lat: shop.lat, lng: shop.lng, ...(shop.label ? {label: shop.label} : {})}, token);
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
  async function onProviderToggle(provider: Provider, next: boolean): Promise<void> {
    if (!token || providerBusy) return;
    setProviderBusy(true);
    setProviderError(null);
    try {
      await updateProvider({providerId: provider.id, accepting: next}, token);
      await loadProviders();
      setNotice(t.more.saved);
    } catch (err) {
      setProviderError(toMessage(err));
    } finally {
      setProviderBusy(false);
    }
  }
  const missing = missingKinds(providers);
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.headerCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.headerRow}>
            <View>
              <View style={[styles.avatar, {backgroundColor: theme.primary}]}><Text style={styles.avatarText}>{initials(displayName)}</Text></View>
              <Pressable style={[styles.avatarEdit, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={openEdit} accessibilityRole="button" accessibilityLabel={t.more.editName}>
                <MaterialIcons name="edit" size={16} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.name, {color: theme.text}]}>{displayName}</Text>
              <Text style={[styles.email, {color: theme.muted}]}>{user?.email ?? ""}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, {backgroundColor: theme.primary}]}><Text style={styles.badgeText}>{isAdmin ? t.more.roleAdmin : t.more.roleUser}</Text></View>
                {services.map((s) => (<View key={s} style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{serviceLabel(s, t)}</Text></View>))}
              </View>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, {color: theme.text}]}>{user?.points ?? 0}</Text>
              <Text style={[styles.statLabel, {color: theme.muted}]}>{t.more.points}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, {color: theme.text}]}>{reportCount}</Text>
              <Text style={[styles.statLabel, {color: theme.muted}]}>{t.more.reports}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, {color: theme.text}]}>{confirmedCount}</Text>
              <Text style={[styles.statLabel, {color: theme.muted}]}>{t.more.confirmed}</Text>
            </View>
          </View>
        </View>
        <Overlay
          visible={editOpen}
          variant="dialog"
          title={t.more.displayName}
          closeLabel={t.common.cancel}
          onClose={() => { Keyboard.dismiss(); setEditOpen(false); }}
          scrollable={false}
          actions={[{label: t.common.save, tone: "primary", disabled: !nameDraft.trim(), onPress: () => void onSaveName()}]}
        >
          {editError ? <Text style={[styles.error, {color: theme.danger}]}>{editError}</Text> : null}
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={nameDraft} onChangeText={setNameDraft} placeholder={t.more.displayName} placeholderTextColor={theme.muted} />
        </Overlay>
        <Overlay visible={servicesOpen} variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setServicesOpen(false)}>
          {servicesOpen ? (
            <OnboardingScreen t={t} lang={lang} token={token} busy={servicesBusy} error={servicesError} selectedServices={services} registered={{shop: !missing.shop, tow: !missing.tow}} onFinish={(selected, shop, tow) => void onServicesFinish(selected, shop, tow)} onSkip={() => void onServicesSkip()} />
          ) : null}
        </Overlay>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => { setServicesError(null); setServicesOpen(true); }}><MaterialIcons name="bookmark" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.services}</Text><MaterialIcons name="chevron-right" size={20} color={theme.muted} /></Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={toggleTheme} accessibilityRole="switch" accessibilityState={{checked: scheme === "dark"}}><MaterialIcons name={scheme === "dark" ? "light-mode" : "dark-mode"} size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.appearance}</Text><View pointerEvents="none"><Switch value={scheme === "dark"} onValueChange={() => toggleTheme()} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={toggle}><MaterialIcons name="translate" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.language}</Text><Text style={[styles.listSecondary, {color: theme.muted}]}>{lang === "en" ? "EN" : "VI"}</Text><MaterialIcons name="chevron-right" size={20} color={theme.muted} /></Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.listRow}>
            <MaterialIcons name="notifications" size={20} color={theme.primary} />
            <View style={styles.permText}>
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.permNotifications}</Text>
              <Text style={[styles.permHint, {color: theme.muted}]}>{t.more.permNotificationsHint}</Text>
            </View>
            <View style={[styles.permPill, {backgroundColor: perms.notifications.granted ? theme.primary : theme.divider}]}><Text style={styles.permPillText}>{perms.notifications.granted ? t.more.permOn : t.more.permOff}</Text></View>
            {!perms.notifications.granted ? (
              <Pressable style={[styles.permBtn, {borderColor: theme.border}]} disabled={permsBusy} onPress={() => void onEnableNotifications()}><Text style={[styles.permBtnText, {color: theme.primary}]}>{perms.notifications.canAskAgain ? t.more.permEnable : t.more.permOpenSettings}</Text></Pressable>
            ) : null}
          </View>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <View style={styles.listRow}>
            <MaterialIcons name="location-on" size={20} color={theme.primary} />
            <View style={styles.permText}>
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.permBackground}</Text>
              <Text style={[styles.permHint, {color: theme.muted}]}>{t.more.permBackgroundHint}</Text>
            </View>
            <View style={[styles.permPill, {backgroundColor: perms.backgroundLocation.granted ? theme.primary : theme.divider}]}><Text style={styles.permPillText}>{perms.backgroundLocation.granted ? t.more.permOn : t.more.permOff}</Text></View>
            {!perms.backgroundLocation.granted ? (
              <Pressable style={[styles.permBtn, {borderColor: theme.border}]} disabled={permsBusy} onPress={() => void onEnableBackground()}><Text style={[styles.permBtnText, {color: theme.primary}]}>{perms.backgroundLocation.canAskAgain ? t.more.permEnable : t.more.permOpenSettings}</Text></Pressable>
            ) : null}
          </View>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <View style={styles.listRow}>
            <MaterialIcons name="battery-charging-full" size={20} color={theme.primary} />
            <View style={styles.permText}>
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.permBattery}</Text>
              <Text style={[styles.permHint, {color: theme.muted}]}>{t.more.permBatteryHint}</Text>
            </View>
            <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => openBatterySettings()}><Text style={[styles.permBtnText, {color: theme.primary}]}>{t.more.permOpenSettings}</Text></Pressable>
          </View>
        </View>
        {isVolunteer ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.listRow}>
              <MaterialIcons name="volunteer-activism" size={20} color={theme.primary} />
              <View style={styles.permText}>
                <Text style={[styles.listText, {color: theme.text}]}>{t.more.volTitle}</Text>
              </View>
              <View style={[styles.permPill, {backgroundColor: user?.volunteerAvailable ? theme.primary : theme.divider}]}>
                <Text style={styles.permPillText}>{user?.volunteerAvailable ? t.more.permOn : t.more.permOff}</Text>
              </View>
              <View pointerEvents="none">
                <Switch value={user?.volunteerAvailable === true} onValueChange={(v) => void onVolunteerToggle(v)} disabled={volBusy} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
              </View>
            </View>
            {user?.volunteerAvailable ? (
              <>
                <View style={[styles.divider, {backgroundColor: theme.divider}]} />
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
              </>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.listRow}>
            <MaterialIcons name="store" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.provider.title}</Text>
          </View>
          {(() => {
            if (!missing.shop && !missing.tow) return null;
            return (
              <View style={styles.providerCtas}>
                {missing.shop ? (
                  <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => setProviderCreate("SHOP")} accessibilityRole="button" accessibilityLabel={t.provider.addShop}>
                    <Text style={[styles.permBtnText, {color: theme.primary}]}>{t.provider.addShop}</Text>
                  </Pressable>
                ) : null}
                {missing.tow ? (
                  <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => setProviderCreate("TOW")} accessibilityRole="button" accessibilityLabel={t.provider.registerTow}>
                    <Text style={[styles.permBtnText, {color: theme.primary}]}>{t.provider.registerTow}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })()}
          {providers.map((provider, index) => {
            const pill = providerPill(provider, t);
            const pillBg = pill.tone === "on" ? theme.primary : pill.tone === "alert" ? theme.danger : theme.divider;
            const pillFg = pill.tone === "off" ? theme.text : "#fff";
            const note = provider.suspended === true && typeof provider.suspendedReason === "string" && provider.suspendedReason ?
              provider.suspendedReason :
              provider.status === "DENIED" && typeof provider.reviewNote === "string" && provider.reviewNote ?
                provider.reviewNote :
                null;
            return (
              <View key={provider.id}>
                {index === 0 ? null : <View style={[styles.divider, {backgroundColor: theme.divider}]} />}
                <View style={styles.listRow}>
                  <MaterialIcons name={provider.kind === "TOW" ? "local-shipping" : "storefront"} size={20} color={theme.primary} />
                  <Pressable style={styles.permText} onPress={() => setProviderEdit(provider)} accessibilityRole="button" accessibilityLabel={`${provider.name}, ${pill.label}`}>
                    <Text style={[styles.listText, {color: theme.text}]}>{provider.name}</Text>
                    <Text style={[styles.permHint, {color: theme.muted}]}>{providerRowSubtitle(provider, t)}</Text>
                    {note ? <Text style={[styles.permHint, {color: theme.muted}]}>{note}</Text> : null}
                  </Pressable>
                  <View style={[styles.permPill, {backgroundColor: pillBg}]}>
                    <Text style={[styles.permPillText, {color: pillFg}]}>{pill.label}</Text>
                  </View>
                  <Switch value={provider.accepting !== false} onValueChange={(v) => void onProviderToggle(provider, v)} disabled={!switchEnabled(provider, providerBusy)} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
                </View>
                {provider.kind === "TOW" && provider.status === "DENIED" ? (
                  <View style={styles.providerCtas}>
                    <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => setProviderCreate("TOW")} accessibilityRole="button" accessibilityLabel={t.provider.reapplyTow}>
                      <Text style={[styles.permBtnText, {color: theme.primary}]}>{t.provider.reapplyTow}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {providerCreate ? (
          <ProviderFormDialog t={t} token={token} kind={providerCreate} provider={null} onClose={() => { Keyboard.dismiss(); setProviderCreate(null); }} onSaved={() => { setProviderCreate(null); setNotice(t.provider.saved); void loadProviders(); }} />
        ) : null}
        {providerEdit ? (
          <ProviderFormDialog t={t} token={token} kind={providerEdit.kind === "TOW" ? "TOW" : "SHOP"} provider={providerEdit} onClose={() => { Keyboard.dismiss(); setProviderEdit(null); }} onSaved={() => { setProviderEdit(null); setNotice(t.provider.saved); void loadProviders(); }} />
        ) : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Diagnostics" as never)}>
            <MaterialIcons name="bug-report" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.diagnostics}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => void signOut()}><MaterialIcons name="logout" size={20} color={theme.danger} /><Text style={[styles.listText, {color: theme.danger}]}>{t.more.signOut}</Text></Pressable>
        </View>
      </ScrollView>
      {volError ? (
        <Snack message={volError} severity="error" sticky bottom={snackAboveTabs(insets.bottom)} dangerColor={theme.danger} onHide={() => setVolError(null)} />
      ) : providerError ? (
        <Snack message={providerError} severity="error" sticky bottom={snackAboveTabs(insets.bottom)} dangerColor={theme.danger} onHide={() => setProviderError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackAboveTabs(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  headerCard: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 12},
  avatar: {width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center"},
  avatarText: {color: "#fff", fontWeight: "700", fontSize: 18},
  avatarEdit: {position: "absolute", right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  statRow: {flexDirection: "row", marginTop: 4},
  stat: {flex: 1, alignItems: "center", gap: 2},
  statNumber: {fontSize: 18, fontWeight: "700"},
  statLabel: {fontSize: 11},
  headerText: {flex: 1, minWidth: 0, gap: 2},
  name: {fontSize: 18, fontWeight: "700"},
  email: {fontSize: 13},
  badgeRow: {flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4},
  badge: {borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  badgeText: {color: "#fff", fontSize: 12, fontWeight: "600"},
  service: {borderWidth: 1, borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  serviceText: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  error: {fontSize: 13},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  permText: {flex: 1, minWidth: 0, gap: 2},
  permHint: {fontSize: 12},
  permPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  permPillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  permBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  permBtnText: {fontSize: 13, fontWeight: "700"},
  optionBlock: {gap: 8, paddingVertical: 14, paddingHorizontal: 16},
  optionLabel: {fontSize: 13, fontWeight: "700"},
  optionRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  optChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16},
  optText: {fontSize: 13, fontWeight: "600"},
  listSecondary: {fontSize: 13},
  providerCtas: {flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14},
  divider: {height: 1, marginHorizontal: 16},
});
