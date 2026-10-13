import {useState} from "react";
import {StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "./ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import Overlay, {type OverlayAction} from "./overlay/Overlay";
import {darkTheme, lightTheme} from "../theme";
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
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const notes = release.notes.length > 600 ? `${release.notes.slice(0, 600)}…` : release.notes;
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
  const actions: OverlayAction[] =
    phase === "busy"
      ? []
      : phase === "error"
        ? [
            {label: t.more.updateDownload, tone: "primary", onPress: () => void onDownload()},
            {label: t.more.updateOpenSettings, tone: "neutral", outline: true, onPress: () => openAppSettings()},
          ]
        : [
            {label: t.more.updateDownload, tone: "primary", onPress: () => void onDownload()},
            {label: t.more.updateSkip, tone: "neutral", outline: true, onPress: onSkip},
          ];
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.more.updateAvailable} ${release.tag}`}
      closeLabel={t.common.close}
      onClose={onClose}
      actions={actions}
    >
      <View style={styles.body}>
        <View style={styles.headRow}>
          <MaterialIcons name="system-update" size={20} color={theme.primary} />
          {notes !== "" ? <Text style={[styles.notes, {color: theme.text}]}>{notes}</Text> : null}
        </View>
        {phase === "busy" ? (
          <View style={styles.progressRow}>
            <View style={[styles.track, {backgroundColor: theme.border}]}>
              <View style={[styles.fill, {backgroundColor: theme.primary, width: `${Math.round(progress * 100)}%`}]} />
            </View>
            <Text style={[styles.percent, {color: theme.muted}]}>{`${Math.round(progress * 100)}%`}</Text>
          </View>
        ) : null}
        {phase === "error" ? (
          <Text style={[styles.error, {color: theme.danger}]}>{t.more.updateFailed}</Text>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  headRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  notes: {fontSize: 13, flex: 1},
  progressRow: {flexDirection: "row", alignItems: "center", gap: 8},
  track: {flex: 1, height: 8, borderRadius: 4, overflow: "hidden"},
  fill: {height: 8, borderRadius: 4},
  percent: {fontSize: 12, fontWeight: "700", minWidth: 36, textAlign: "right"},
  error: {fontSize: 12},
});
