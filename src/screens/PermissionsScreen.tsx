import {useCallback, useState} from "react";
import {Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect} from "@react-navigation/native";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import PermissionRow from "../components/permissions/PermissionRow";
import {getPermissionStates, openAppSettings, openBatterySettings, requestBackgroundLocationPermission, requestCameraPermission, requestMediaLibraryPermission, requestNotificationPermission, type AppPermissionStates} from "../services/permissions";
import {syncPushToken} from "../services/push";

type PermKey = "notifications" | "camera" | "mediaLibrary" | "backgroundLocation";

const OFF: AppPermissionStates = {
  notifications: {granted: false, canAskAgain: true},
  camera: {granted: false, canAskAgain: true},
  mediaLibrary: {granted: false, canAskAgain: true},
  backgroundLocation: {granted: false, canAskAgain: true},
};

export default function PermissionsScreen() {
  const {t} = useStrings();
  const {token, uid} = useAuth();
  const {mode} = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [perms, setPerms] = useState<AppPermissionStates>(OFF);
  const [permsBusy, setPermsBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    void getPermissionStates().then(setPerms).catch(() => undefined);
  }, []));
  async function onEnable(which: PermKey) {
    if (permsBusy) return;
    if (!perms[which].canAskAgain) {
      openAppSettings();
      return;
    }
    setPermsBusy(true);
    try {
      const next = which === "notifications" ? await requestNotificationPermission() : which === "camera" ? await requestCameraPermission() : which === "mediaLibrary" ? await requestMediaLibraryPermission() : await requestBackgroundLocationPermission();
      setPerms((prev) => ({...prev, [which]: next}));
      if (which === "notifications" && next.granted) await syncPushToken(token, uid);
    } finally {
      setPermsBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <PermissionRow t={t} theme={theme} mode="manage" icon="notifications" title={t.more.permNotifications} hint={t.more.permNotificationsHint} state={perms.notifications} busy={permsBusy} onGrant={() => void onEnable("notifications")} />
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <PermissionRow t={t} theme={theme} mode="manage" icon="photo-camera" title={t.more.permCamera} hint={t.more.permCameraHint} state={perms.camera} busy={permsBusy} onGrant={() => void onEnable("camera")} />
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <PermissionRow t={t} theme={theme} mode="manage" icon="photo-library" title={t.more.permPhotos} hint={t.more.permPhotosHint} state={perms.mediaLibrary} busy={permsBusy} onGrant={() => void onEnable("mediaLibrary")} />
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <PermissionRow t={t} theme={theme} mode="manage" icon="location-on" title={t.more.permBackground} hint={t.more.permBackgroundHint} state={perms.backgroundLocation} busy={permsBusy} onGrant={() => void onEnable("backgroundLocation")} />
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
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  permText: {flex: 1, minWidth: 0, gap: 2},
  permHint: {fontSize: 12},
  permBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  permBtnText: {fontSize: 13, fontWeight: "700"},
  divider: {height: 1, marginHorizontal: 16},
});
