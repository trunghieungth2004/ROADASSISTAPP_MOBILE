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
import {getPermissionStates, openAppSettings, openBatterySettings, requestBackgroundLocationPermission, requestNotificationPermission, type AppPermissionStates} from "../services/permissions";
import {syncPushToken} from "../services/push";

export default function PermissionsScreen() {
  const {t} = useStrings();
  const {token, uid} = useAuth();
  const {mode} = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [perms, setPerms] = useState<AppPermissionStates>({notifications: {granted: false, canAskAgain: true}, backgroundLocation: {granted: false, canAskAgain: true}});
  const [permsBusy, setPermsBusy] = useState(false);
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
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
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
  permPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  permPillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  permBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  permBtnText: {fontSize: 13, fontWeight: "700"},
  divider: {height: 1, marginHorizontal: 16},
});
