import {useCallback, useState} from "react";
import {Keyboard, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useIsFocused, useNavigation} from "@react-navigation/native";
import {updateProfile, volunteerHeartbeat} from "../api/users";
import {capturePosition, markBeat, useLocationBeat} from "../services/locationBeats";
import {operatedKinds, serviceLabel} from "./more/providerUi";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {myFlags} from "../api/flags";
import {myProviders, type Provider} from "../api/providers";
import Overlay from "../components/overlay/Overlay";
import DutySection from "./DutySection";
import {useThemeMode} from "../context/ThemeContext";
import {useSafeAreaInsets} from "react-native-safe-area-context";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export default function MoreScreen() {
  const {t} = useStrings();
  const {signOut, token} = useAuth();
  const {user, refresh} = useProfile();
  const {mode} = useThemeMode();
  const scheme = mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dutyError, setDutyError] = useState<string | null>(null);
  const navigation = useNavigation();
  const [reportCount, setReportCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [providers, setProviders] = useState<Provider[]>([]);
  useFocusEffect(useCallback(() => {
    if (!token) return;
    void myFlags(token)
      .then((rows) => {
        setReportCount(rows.length);
        setConfirmedCount(rows.filter((f) => f.status === "CONFIRMED").length);
      })
      .catch(() => undefined);
    void myProviders(token).then(setProviders).catch(() => undefined);
  }, [token]));
  const displayName = user?.displayName || user?.email || "—";
  const services = user?.services ?? [];
  const isAdmin = user?.role === "1";
  const volunteerOn = user?.volunteerAvailable === true;
  const moreFocused = useIsFocused();
  useLocationBeat(!!token && volunteerOn && moreFocused, 5 * 60 * 1000, async () => {
    if (!token) return;
    const pos = await capturePosition();
    if (!pos) return;
    await volunteerHeartbeat(pos.lat, pos.lng, token);
    markBeat("volunteer");
  });
  const operated = operatedKinds(providers);
  function openEdit() { setNameDraft(user?.displayName ?? ""); setEditError(null); setEditOpen(true); }
  async function onSaveName() {
    if (!token || !nameDraft.trim() || nameBusy) return;
    Keyboard.dismiss();
    setNameBusy(true);
    setEditError(null);
    try { await updateProfile({displayName: nameDraft.trim()}, token); await refresh(); setEditOpen(false); setNotice(t.more.saved); } catch (err) { setEditError(toMessage(err)); } finally { setNameBusy(false); }
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
                <View style={[styles.badge, {backgroundColor: theme.primary}]}><Text style={styles.badgeText}>{isAdmin ? t.more.roleAdmin : t.roles.rider}</Text></View>
                {[...new Set(services)].map((s) => (<View key={s} style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{serviceLabel(s, t)}</Text></View>))}
                {operated.shop ? (<View key="SHOP" style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{serviceLabel("SHOP", t)}</Text></View>) : null}
                {operated.tow ? (<View key="TOW" style={[styles.service, {borderColor: theme.border}]}><Text style={[styles.serviceText, {color: theme.text}]}>{serviceLabel("TOW", t)}</Text></View>) : null}
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
        <DutySection
          providers={providers}
          onProvidersChanged={() => {
            if (!token) return;
            void myProviders(token).then(setProviders).catch(() => undefined);
          }}
          onNotice={(message) => setNotice(message)}
          onError={(message) => setDutyError(message)}
        />
        <Overlay
          visible={editOpen}
          variant="dialog"
          title={t.more.displayName}
          closeLabel={t.common.cancel}
          onClose={() => { Keyboard.dismiss(); setEditOpen(false); }}
          scrollable={false}
          actions={[{label: t.common.save, tone: "primary", busy: nameBusy, disabled: !nameDraft.trim(), onPress: () => void onSaveName()}]}
        >
          {editError ? <Text style={[styles.error, {color: theme.danger}]}>{editError}</Text> : null}
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={nameDraft} onChangeText={setNameDraft} placeholder={t.more.displayName} placeholderTextColor={theme.muted} />
        </Overlay>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Settings" as never)} accessibilityRole="button" accessibilityLabel={t.more.settings}>
            <MaterialIcons name="settings" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.settings}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("About" as never)} accessibilityRole="button" accessibilityLabel={t.more.about}>
            <MaterialIcons name="info" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.about}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => void signOut()}><MaterialIcons name="logout" size={20} color={theme.danger} /><Text style={[styles.listText, {color: theme.danger}]}>{t.more.signOut}</Text></Pressable>
        </View>
      </ScrollView>
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      {dutyError ? (
        <Snack message={dutyError} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setDutyError(null)} />
      ) : null}
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
  error: {fontSize: 12, marginBottom: 6},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  divider: {height: 1, marginHorizontal: 16},
});
