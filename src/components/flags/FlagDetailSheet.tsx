import {Image, Pressable, StyleSheet, View, useColorScheme} from "react-native";
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
};

export default function FlagDetailSheet({t, flag, isOwn}: Props) {
  const scheme = useColorScheme();
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
      {flag.note ? <Text style={{color: theme.text}}>{flag.note}</Text> : null}
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
  photoRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
});
