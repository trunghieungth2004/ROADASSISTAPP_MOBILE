import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text} from "../ui/AppText";
import type {Flag} from "../../api/flags";
import {flagActions, formatUntil, joinMeta} from "../../screens/hazards/flagActions";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {resolvePhotoUrl} from "../../services/photos";
import {usePhotoViewer} from "../ui/PhotoViewer";
import PhotoThumb from "../ui/PhotoThumb";

type Props = {
  t: Strings;
  flag: Flag | null;
  isOwn: boolean;
  onChat?: ((flag: Flag) => void) | null;
};

export default function FlagDetailSheet({t, flag, isOwn, onChat}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const photoViewer = usePhotoViewer(t.common.cancel);
  if (!flag) return null;
  const photoPaths = (flag.photoUrls ?? []).filter((path) => typeof path === "string" && path !== "");
  const showLocked = flagActions(flag.status, isOwn).includes("locked");
  const until = formatUntil(flag.ttlExpiresAtMs, Date.now(), t.flag);
  const meta = joinMeta([flag.reporterHandle ? t.flag.reportedBy.replace("{h}", flag.reporterHandle) : null, until]);
  const openPhoto = (path: string): void => {
    void resolvePhotoUrl(path).then((uri) => {
      if (uri !== "") photoViewer.open(uri);
    });
  };
  return (
    <View style={styles.body}>
      {showLocked ? <Text style={[styles.lockedNote, {color: theme.muted}]}>{t.flag.lockedNote}</Text> : null}
      {meta !== "" ? <Text style={[styles.meta, {color: theme.muted}]}>{meta}</Text> : null}
      <View style={styles.noteRow}>
        <Text style={[styles.noteText, {color: theme.text}]}>{flag.note ?? ""}</Text>
        {onChat ? (
          <Pressable style={[styles.chatBtn, {borderColor: theme.primary}]} onPress={() => onChat(flag)} accessibilityRole="button" accessibilityLabel={t.chat.open}>
            <MaterialIcons name="chat" size={22} color={theme.primary} />
          </Pressable>
        ) : null}
      </View>
      {photoPaths.length > 0 ? (
        <View style={styles.photoRow}>
          {photoPaths.map((path, index) => (
            <PhotoThumb
              key={`${index}-${path}`}
              path={path}
              theme={theme}
              style={styles.thumb}
              accessibilityLabel={`${t.flag.photos} ${index + 1}`}
              onPress={openPhoto}
            />
          ))}
        </View>
      ) : null}
      {photoViewer.node}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  lockedNote: {fontSize: 12},
  meta: {fontSize: 13},
  noteRow: {flexDirection: "row", alignItems: "center", gap: 8},
  noteText: {flex: 1, fontSize: 14},
  chatBtn: {width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: "center", justifyContent: "center"},
  photoRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
});
