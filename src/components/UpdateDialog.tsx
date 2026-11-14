import {useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAppMode} from "../context/ThemeContext";
import {AppText as Text} from "./ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import Overlay from "./overlay/Overlay";
import {themeForMode, darkTheme, lightTheme} from "../theme";
import {downloadAndInstall, type AppRelease} from "../services/appUpdate";
import {openAppSettings} from "../services/permissions";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  release: AppRelease;
  onSkip: () => void;
  onClose: () => void;
};

type Phase = "idle" | "busy" | "error";

export default function UpdateDialog({t, release, onSkip, onClose}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const notes = release.notes.trim();
  const percent: `${number}%` = `${Math.round(progress * 100)}%`;
  async function onDownload(): Promise<void> {
    if (phase === "busy") return;
    setPhase("busy");
    setProgress(0);
    try {
      await downloadAndInstall(release.apkUrl, setProgress);
      onClose();
    } catch {
      setPhase("error");
    }
  }
  return (
    <Overlay visible variant="fullScreen" closeLabel={t.common.close} onClose={onClose}>
      <View style={[styles.screen, {paddingTop: insets.top}]}>
        <View style={[styles.topBar, {borderColor: theme.border}]}>
          <View style={[styles.iconWrap, {backgroundColor: `${theme.primary}1f`}]}>
            <MaterialIcons name="system-update" size={22} color={theme.primary} />
          </View>
          <View style={styles.headText}>
            <Text style={[styles.title, {color: theme.text}]}>{t.more.updateAvailable}</Text>
            <Text style={[styles.version, {color: theme.muted}]}>{release.tag}</Text>
          </View>
          <Pressable
            style={[styles.closeBtn, {borderColor: theme.border}]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {notes !== "" ? (
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <Text style={[styles.cardLabel, {color: theme.muted}]}>{t.more.updateNotes}</Text>
              <Text selectable style={[styles.notes, {color: theme.text}]}>{notes}</Text>
            </View>
          ) : null}
          {phase === "busy" ? (
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.progressHead}>
                <Text style={[styles.progressLabel, {color: theme.text}]}>{t.more.updateDownload}</Text>
                <Text style={[styles.percent, {color: theme.muted}]}>{percent}</Text>
              </View>
              <View style={[styles.track, {backgroundColor: theme.border}]}>
                <View style={[styles.fill, {backgroundColor: theme.primary, width: percent}]} />
              </View>
            </View>
          ) : null}
          {phase === "error" ? (
            <View style={[styles.errorCard, {borderColor: theme.danger}]}>
              <Text style={[styles.error, {color: theme.danger}]}>{t.more.updateFailed}</Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, {borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 16)}]}>
          {phase === "busy" ? (
            <View style={[styles.primaryBtn, {backgroundColor: theme.primary}]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <>
              <Pressable
                style={[styles.primaryBtn, {backgroundColor: theme.primary}]}
                onPress={() => void onDownload()}
                accessibilityRole="button"
                accessibilityLabel={t.more.updateDownload}
              >
                <MaterialIcons name="download" size={18} color="#fff" />
                <Text style={styles.primaryText}>{t.more.updateDownload}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, {borderColor: theme.border}]}
                onPress={() => {
                  if (phase === "error") openAppSettings();
                  else onSkip();
                }}
                accessibilityRole="button"
                accessibilityLabel={phase === "error" ? t.more.updateOpenSettings : t.more.updateSkip}
              >
                <Text style={[styles.secondaryText, {color: theme.text}]}>
                  {phase === "error" ? t.more.updateOpenSettings : t.more.updateSkip}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  topBar: {flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1},
  iconWrap: {width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, minWidth: 0, gap: 2},
  title: {fontSize: 18, fontWeight: "700"},
  version: {fontSize: 13, fontWeight: "600"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  scroll: {flex: 1},
  scrollBody: {padding: 16, gap: 12},
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 8},
  cardLabel: {fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase"},
  notes: {fontSize: 14, lineHeight: 21},
  progressHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  progressLabel: {fontSize: 14, fontWeight: "600"},
  track: {height: 10, borderRadius: 5, overflow: "hidden"},
  fill: {height: 10, borderRadius: 5},
  percent: {fontSize: 13, fontWeight: "700", minWidth: 40, textAlign: "right"},
  errorCard: {borderWidth: 1, borderRadius: 12, padding: 12},
  error: {fontSize: 13},
  footer: {flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1},
  primaryBtn: {flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16},
  primaryText: {color: "#fff", fontSize: 15, fontWeight: "700"},
  secondaryBtn: {flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 16},
  secondaryText: {fontSize: 14, fontWeight: "700"},
});
