import {useCallback, useState} from "react";
import {Modal, Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect} from "@react-navigation/native";
import {updateProfile} from "../api/users";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import OnboardingScreen from "./OnboardingScreen";
import DiagnosticsScreen from "./DiagnosticsScreen";
import {useThemeMode} from "../context/ThemeContext";
import {getPermissionStates, openAppSettings, requestBackgroundLocationPermission, requestNotificationPermission, type AppPermissionStates} from "../services/permissions";
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
  useFocusEffect(useCallback(() => {
    void getPermissionStates().then(setPerms).catch(() => undefined);
  }, []));
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
  const displayName = user?.displayName || user?.email || "—";
  const services = user?.services ?? [];
  const isAdmin = user?.role === "1";
  function openEdit() { setNameDraft(user?.displayName ?? ""); setEditError(null); setEditOpen(true); }
  async function onSaveName() {
    if (!token || !nameDraft.trim()) return;
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
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.headerCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.headerRow}>
            <View style={[styles.avatar, {backgroundColor: theme.primary}]}><Text style={styles.avatarText}>{initials(displayName)}</Text></View>
            <View style={styles.headerText}>
              <Text style={[styles.name, {color: theme.text}]}>{displayName}</Text>
              <Text style={[styles.email, {color: theme.muted}]}>{user?.email ?? ""}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, {backgroundColor: theme.primary}]}><Text style={styles.badgeText}>{isAdmin ? t.more.roleAdmin : t.more.roleUser}</Text></View>
                {services.map((s) => (<View key={s} style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{s}</Text></View>))}
              </View>
            </View>
            <Pressable style={[styles.editBtn, {backgroundColor: theme.primary}]} onPress={openEdit}><Text style={styles.editBtnText}>{t.common.save}</Text></Pressable>
          </View>
        </View>
        <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
          <View style={styles.modalOverlay}><View style={[styles.modalCard, {backgroundColor: theme.paper}]}><Text style={[styles.modalTitle, {color: theme.text}]}>{t.more.displayName}</Text>{editError ? <Text style={[styles.error, {color: theme.danger}]}>{editError}</Text> : null}<TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={nameDraft} onChangeText={setNameDraft} placeholder={t.more.displayName} placeholderTextColor={theme.muted} /><View style={styles.modalActions}><Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => setEditOpen(false)}><Text style={{color: theme.text}}>{t.common.close}</Text></Pressable><Pressable style={[styles.primary, {backgroundColor: theme.primary, opacity: !nameDraft.trim() ? 0.5 : 1}]} disabled={!nameDraft.trim()} onPress={() => void onSaveName()}><Text style={styles.primaryText}>{t.common.save}</Text></Pressable></View></View></View>
        </Modal>
        <Modal visible={servicesOpen} animationType="slide" onRequestClose={() => setServicesOpen(false)}>
          <OnboardingScreen t={t} busy={servicesBusy} error={servicesError} onFinish={(selected) => void onServicesFinish(selected)} onSkip={() => void onServicesSkip()} />
        </Modal>
        {notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow}><MaterialIcons name="home" size={20} color={theme.primary} /><Text style={[styles.listText, {color: theme.text}]}>{t.tabs.home}</Text></Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
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
        </View>
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
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  headerCard: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 12},
  avatar: {width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center"},
  avatarText: {color: "#fff", fontWeight: "700", fontSize: 18},
  headerText: {flex: 1, minWidth: 0, gap: 2},
  name: {fontSize: 18, fontWeight: "700"},
  email: {fontSize: 13},
  badgeRow: {flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4},
  badge: {borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  badgeText: {color: "#fff", fontSize: 12, fontWeight: "600"},
  service: {borderWidth: 1, borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  serviceText: {fontSize: 12},
  editBtn: {borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12},
  editBtnText: {color: "#fff", fontWeight: "600", fontSize: 12},
  vehicleLine: {fontSize: 13},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  error: {fontSize: 13},
  notice: {fontSize: 13, textAlign: "center"},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  permText: {flex: 1, minWidth: 0, gap: 2},
  permHint: {fontSize: 12},
  permPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  permPillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  permBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  permBtnText: {fontSize: 13, fontWeight: "700"},
  listSecondary: {fontSize: 13},
  divider: {height: 1, marginHorizontal: 16},
  primary: {borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center"},
  primaryText: {color: "#fff", fontWeight: "700"},
  chip: {borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center"},
});
