import {Image, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text} from "../ui/AppText";
import type {Flag} from "../../api/flags";
import {flagActions, formatUntil, joinMeta} from "../../screens/hazards/flagActions";
import {darkTheme, lightTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {usePhotoUrls} from "../../services/photos";
import {usePhotoViewer} from "../ui/PhotoViewer";

type Props = {
  t: Strings;
  flag: Flag | null;
  isOwn: boolean;
  onChat?: ((flag: Flag) => void) | null;
};

export default function FlagDetailSheet({t, flag, isOwn, onChat}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const photos = usePhotoUrls(flag?.photoUrls);
  const photoViewer = usePhotoViewer(t.common.cancel);
  if (!flag) return null;
  const photoPaths = flag.photoUrls ?? [];
  const showLocked = flagActions(flag.status, isOwn).includes("locked");
  const until = formatUntil(flag.ttlExpiresAtMs, Date.now(), t.flag);
  const meta = joinMeta([flag.reporterHandle ? t.flag.reportedBy.replace("{h}", flag.reporterHandle) : null, until]);
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
      {photos.length > 0 ? (
        <View style={styles.photoRow}>
          {photos.map((uri, index) => (
            <Pressable key={`${index}-${uri}`} onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.flag.photos} ${index + 1}`}>
              <Image source={{uri}} style={styles.thumb} />
            </Pressable>
          ))}
        </View>
      ) : photoPaths.length > 0 ? (
        <View style={styles.photoRow}>
          {photoPaths.map((path, index) => (
            <View key={`pending-${index}-${path}`} style={[styles.thumb, {backgroundColor: theme.border}]} />
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
