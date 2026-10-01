import {useCallback, useEffect, useState} from "react";
import {Keyboard, Modal, Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import * as Location from "expo-location";
import {setVolunteerAvailability, updateProfile, volunteerHeartbeat} from "../api/users";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import Snack from "../components/Snack";
import {snackAbove} from "../components/snackOffset";
import {myFlags} from "../api/flags";
import {myShops, updateShop, type Shop} from "../api/shops";
import ShopFormSheet from "../components/ShopFormSheet";
import OnboardingScreen from "./OnboardingScreen";
import DiagnosticsScreen from "./DiagnosticsScreen";
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
  const [diagOpen, setDiagOpen] = useState(false);
  const [volBusy, setVolBusy] = useState(false);
  const [volError, setVolError] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const isVolunteer = (user?.services ?? []).includes("VOLUNTEER");
  const isShopOwner = (user?.services ?? []).includes("SHOP");
  const [shopList, setShopList] = useState<Shop[]>([]);
  const [shopBusyId, setShopBusyId] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopCreateOpen, setShopCreateOpen] = useState(false);
  const [shopEdit, setShopEdit] = useState<Shop | null>(null);
  const loadShops = useCallback(async (): Promise<void> => {
    if (!token) {
      setShopList([]);
      return;
    }
    try {
      setShopList(await myShops(token));
    } catch (err) {
      setShopError(toMessage(err));
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
    if (isShopOwner) void loadShops();
  }, [token, isShopOwner, loadShops]));
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
  const beatHeart = useCallback(async (): Promise<void> => {
    if (!token) return;
    const {status} = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    await volunteerHeartbeat(pos.coords.latitude, pos.coords.longitude, token);
  }, [token]);
  useEffect(() => {
    if (!user?.volunteerAvailable) return;
    void beatHeart().catch(() => undefined);
    const timer = setInterval(() => {
      void beatHeart().catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user?.volunteerAvailable, beatHeart]);
  async function onVolunteerToggle(next: boolean): Promise<void> {
    if (!token || volBusy) return;
    setVolBusy(true);
    setVolError(null);
    try {
      await setVolunteerAvailability({available: next}, token);
      await refresh();
      if (next) await beatHeart();
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
  async function onServicesFinish(selected: string[]) {
    setServicesBusy(true); setServicesError(null);
    try { for (const service of selected) await markOnboarded(service); await refresh(); setServicesOpen(false); setNotice(t.more.saved); } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  async function onServicesSkip() {
    setServicesBusy(true); setServicesError(null);
    try { await markOnboarded("RIDER"); await refresh(); setServicesOpen(false); } catch (err) { setServicesError(toMessage(err)); } finally { setServicesBusy(false); }
  }
  async function onShopToggle(shop: Shop, next: boolean): Promise<void> {
    if (!token || shopBusyId) return;
    setShopBusyId(shop.id);
    setShopError(null);
    try {
      await updateShop({shopId: shop.id, accepting: next}, token);
      await loadShops();
      setNotice(t.more.saved);
    } catch (err) {
      setShopError(toMessage(err));
    } finally {
      setShopBusyId(null);
    }
  }
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
                {services.map((s) => (<View key={s} style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{s}</Text></View>))}
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
        <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => { Keyboard.dismiss(); setEditOpen(false); }}>
          <View style={styles.modalOverlay}><View style={[styles.modalCard, {backgroundColor: theme.paper}]}><Text style={[styles.modalTitle, {color: theme.text}]}>{t.more.displayName}</Text>{editError ? <Text style={[styles.error, {color: theme.danger}]}>{editError}</Text> : null}<TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={nameDraft} onChangeText={setNameDraft} placeholder={t.more.displayName} placeholderTextColor={theme.muted} /><View style={styles.modalActions}><Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => { Keyboard.dismiss(); setEditOpen(false); }}><Text style={{color: theme.text}}>{t.common.close}</Text></Pressable><Pressable style={[styles.primary, {backgroundColor: theme.primary, opacity: !nameDraft.trim() ? 0.5 : 1}]} disabled={!nameDraft.trim()} onPress={() => void onSaveName()}><Text style={styles.primaryText}>{t.common.save}</Text></Pressable></View></View></View>
        </Modal>
        <Modal visible={servicesOpen} animationType="slide" onRequestClose={() => setServicesOpen(false)}>
          <OnboardingScreen t={t} busy={servicesBusy} error={servicesError} onFinish={(selected) => void onServicesFinish(selected)} onSkip={() => void onServicesSkip()} />
        </Modal>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => { setServicesError(null); setServicesOpen(true); }}><MaterialIcons name="bookmark" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.services}</Text></Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={toggleTheme} accessibilityRole="switch" accessibilityState={{checked: scheme === "dark"}}><MaterialIcons name={scheme === "dark" ? "light-mode" : "dark-mode"} size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.appearance}</Text><View pointerEvents="none"><Switch value={scheme === "dark"} onValueChange={() => toggleTheme()} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={toggle}><MaterialIcons name="translate" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.more.language}</Text><Text style={[styles.listSecondary, {color: theme.muted}]}>{lang === "en" ? "EN" : "VI"}</Text></Pressable>
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
        {isShopOwner ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.listRow}>
              <MaterialIcons name="store" size={20} color={theme.primary} />
              <Text style={[styles.listText, {color: theme.text}]}>{t.shop.myShops}</Text>
              <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => setShopCreateOpen(true)} accessibilityRole="button" accessibilityLabel={t.shop.addShop}>
                <Text style={[styles.permBtnText, {color: theme.primary}]}>{t.shop.addShop}</Text>
              </Pressable>
            </View>
            {shopList.length === 0 ? (
              <Text style={[styles.emptyShops, {color: theme.muted}]}>{t.shop.noOwned}</Text>
            ) : (
              shopList.map((shop, index) => (
                <View key={shop.id}>
                  {index === 0 ? null : <View style={[styles.divider, {backgroundColor: theme.divider}]} />}
                  <View style={styles.listRow}>
                    <Pressable style={styles.permText} onPress={() => setShopEdit(shop)} accessibilityRole="button">
                      <Text style={[styles.listText, {color: theme.text}]}>{shop.name}</Text>
                      <Text style={[styles.permHint, {color: theme.muted}]}>{shop.type}</Text>
                    </Pressable>
                    <View style={[styles.permPill, {backgroundColor: shop.accepting !== false ? theme.primary : theme.divider}]}>
                      <Text style={styles.permPillText}>{shop.accepting !== false ? t.more.permOn : t.more.permOff}</Text>
                    </View>
                    <View pointerEvents="none">
                      <Switch value={shop.accepting !== false} onValueChange={(v) => void onShopToggle(shop, v)} disabled={shopBusyId !== null} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
        <Modal visible={shopCreateOpen} transparent animationType="fade" onRequestClose={() => { Keyboard.dismiss(); setShopCreateOpen(false); }}>
          <View style={styles.modalOverlay}><View style={[styles.modalCard, {backgroundColor: theme.paper}]}><ShopFormSheet t={t} token={token} shop={null} onClose={() => { Keyboard.dismiss(); setShopCreateOpen(false); }} onSaved={() => { setShopCreateOpen(false); setNotice(t.shop.shopSaved); void loadShops(); }} /></View></View>
        </Modal>
        <Modal visible={shopEdit !== null} transparent animationType="fade" onRequestClose={() => { Keyboard.dismiss(); setShopEdit(null); }}>
          <View style={styles.modalOverlay}><View style={[styles.modalCard, {backgroundColor: theme.paper}]}>{shopEdit ? <ShopFormSheet t={t} token={token} shop={shopEdit} onClose={() => { Keyboard.dismiss(); setShopEdit(null); }} onSaved={() => { setShopEdit(null); setNotice(t.shop.shopSaved); void loadShops(); }} /> : null}</View></View>
        </Modal>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => setDiagOpen(true)}>
            <MaterialIcons name="bug-report" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.diagnostics}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
        </View>
        <Modal visible={diagOpen} animationType="slide" onRequestClose={() => setDiagOpen(false)}>
          <DiagnosticsScreen t={t} authToken={token} onClose={() => setDiagOpen(false)} />
        </Modal>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => void signOut()}><MaterialIcons name="logout" size={20} color={theme.danger} /><Text style={[styles.listText, {color: theme.danger}]}>{t.more.signOut}</Text></Pressable>
        </View>
      </ScrollView>
      {volError ? (
        <Snack message={volError} severity="error" sticky bottom={snackAbove(insets.bottom, 24)} dangerColor={theme.danger} onHide={() => setVolError(null)} />
      ) : shopError ? (
        <Snack message={shopError} severity="error" sticky bottom={snackAbove(insets.bottom, 24)} dangerColor={theme.danger} onHide={() => setShopError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackAbove(insets.bottom, 24)} accentColor={theme.primary} onHide={() => setNotice(null)} />
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
  vehicleLine: {fontSize: 13},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8},
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
  emptyShops: {fontSize: 13, paddingHorizontal: 16, paddingBottom: 14},
  divider: {height: 1, marginHorizontal: 16},
  primary: {borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center"},
  primaryText: {color: "#fff", fontWeight: "700"},
  chip: {borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center"},
});
