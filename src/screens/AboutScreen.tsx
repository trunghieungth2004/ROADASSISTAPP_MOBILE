import {useCallback, useState} from "react";
import {ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Application from "expo-application";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import UpdateDialog from "../components/UpdateDialog";
import {fetchLatestRelease, installedVersion, isAutoCheckEnabled, isNewer, setAutoCheckEnabled, skipRelease, type AppRelease} from "../services/appUpdate";
import {config} from "../config";
import {GITHUB_URL, REPO_SLUG} from "../services/appUpdate";

export default function AboutScreen() {
  const {t} = useStrings();
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const [updateRelease, setUpdateRelease] = useState<AppRelease | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  useFocusEffect(useCallback(() => {
    void isAutoCheckEnabled().then(setAutoUpdate).catch(() => undefined);
  }, []));
  const version = installedVersion();
  const build = Application.nativeBuildVersion ?? null;
  async function onCheckUpdates(): Promise<void> {
    if (updateChecking) return;
    setUpdateChecking(true);
    try {
      const release = await fetchLatestRelease();
      const current = installedVersion();
      if (release && current && isNewer(release.tag, current)) {
        setUpdateRelease(release);
      } else {
        setNotice(t.more.upToDate);
      }
    } catch {
      setNotice(t.more.upToDate);
    } finally {
      setUpdateChecking(false);
    }
  }
  async function onToggleAutoUpdate(next: boolean): Promise<void> {
    setAutoUpdate(next);
    await setAutoCheckEnabled(next);
  }
  const rows = (
    <>
      <View style={styles.listRow}>
        <MaterialIcons name="smartphone" size={20} color={theme.primary} />
        <Text style={[styles.listText, {color: theme.text}]}>{t.more.appVersion}</Text>
        <Text style={[styles.listValue, {color: theme.muted}]}>{version ?? t.more.diagNone}</Text>
      </View>
      {build ? (
        <>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <View style={styles.listRow}>
            <MaterialIcons name="tag" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.buildNumber}</Text>
            <Text style={[styles.listValue, {color: theme.muted}]}>{build}</Text>
          </View>
        </>
      ) : null}
      <View style={[styles.divider, {backgroundColor: theme.divider}]} />
      <View style={styles.listRow}>
        <MaterialIcons name="cloud" size={20} color={theme.primary} />
        <Text style={[styles.listText, {color: theme.text}]}>{t.more.backend}</Text>
        <Text style={[styles.listValue, {color: theme.muted}]} numberOfLines={1}>{config.apiBaseUrl}</Text>
      </View>
    </>
  );
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.hero}>
            <View style={[styles.logo, {backgroundColor: theme.primary}]}>
              <MaterialIcons name="two-wheeler" size={32} color="#fff" />
            </View>
            <Text style={[styles.appName, {color: theme.text}]}>RoadAssist</Text>
            <Text style={[styles.tagline, {color: theme.muted}]}>{t.more.tagline}</Text>
          </View>
        </View>
        {Platform.OS === "android" ? (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            {rows}
            <View style={[styles.divider, {backgroundColor: theme.divider}]} />
            <Pressable style={styles.listRow} onPress={() => void onCheckUpdates()} accessibilityRole="button" accessibilityLabel={t.more.checkUpdates}>
              <MaterialIcons name="system-update" size={20} color={theme.primary} />
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.checkUpdates}</Text>
              {updateChecking ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="chevron-right" size={20} color={theme.muted} />}
            </Pressable>
            <View style={[styles.divider, {backgroundColor: theme.divider}]} />
            <Pressable style={styles.listRow} onPress={() => void onToggleAutoUpdate(!autoUpdate)} accessibilityRole="switch" accessibilityState={{checked: autoUpdate}} accessibilityLabel={t.more.autoUpdate}>
              <MaterialIcons name="autorenew" size={20} color={theme.primary} />
              <Text style={[styles.listText, {color: theme.text}]}>{t.more.autoUpdate}</Text>
              <View pointerEvents="none"><Switch value={autoUpdate} onValueChange={(v) => void onToggleAutoUpdate(v)} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View>
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate("Diagnostics" as never)} accessibilityRole="button" accessibilityLabel={t.more.diagnostics}>
            <MaterialIcons name="bug-report" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.diagnostics}</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable style={styles.listRow} onPress={() => void Linking.openURL(GITHUB_URL)} accessibilityRole="button" accessibilityLabel={t.more.sourceCode}>
            <MaterialIcons name="code" size={20} color={theme.primary} />
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.sourceCode}</Text>
            <MaterialIcons name="open-in-new" size={18} color={theme.muted} />
          </Pressable>
        </View>
        <Text style={[styles.credits, {color: theme.muted}]}>{t.more.credits}</Text>
      </ScrollView>
      {updateRelease ? (
        <UpdateDialog
          t={t}
          release={updateRelease}
          onSkip={() => {
            void skipRelease(updateRelease.tag);
            setUpdateRelease(null);
          }}
          onClose={() => setUpdateRelease(null)}
        />
      ) : null}
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  hero: {alignItems: "center", gap: 6, paddingVertical: 20, paddingHorizontal: 16},
  logo: {width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  appName: {fontSize: 18, fontWeight: "700"},
  tagline: {fontSize: 13, textAlign: "center"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  listValue: {fontSize: 13},
  divider: {height: 1, marginHorizontal: 16},
  credits: {fontSize: 12, textAlign: "center", paddingHorizontal: 16},
});
