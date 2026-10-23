import {useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {isPhotoPermissionError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";

export const UNFIXABLE_REASONS = ["NO_PARTS", "BEYOND_REPAIR", "SAFETY", "OTHER"] as const;

export type UnfixableReason = (typeof UNFIXABLE_REASONS)[number];

export function unfixableReasonLabel(reason: string, t: Strings): string {
  if (reason === "NO_PARTS") return t.assist.unfixableNoParts;
  if (reason === "BEYOND_REPAIR") return t.assist.unfixableBeyondRepair;
  if (reason === "SAFETY") return t.assist.unfixableSafety;
  return t.assist.unfixableOther;
}

type Props = {
  t: Strings;
  ticketLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string, photos: string[]) => void;
  onClose: () => void;
};

export default function UnfixableSheet({t, ticketLabel, busy, error, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [reason, setReason] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  async function onAddPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photos.length >= 5) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const picked = from === "camera" ? await takePhoto() : await pickPhotos(5, photos.length);
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, 5));
    } catch (err) {
      setLocalError(isPhotoPermissionError(err) ? (from === "camera" ? t.photos.cameraDenied : t.photos.denied) : err instanceof Error ? err.message : t.assist.unfixableNeedPhoto);
    } finally {
      setPhotoBusy(false);
    }
  }
  function onSend(): void {
    if (!reason) {
      setLocalError(t.assist.unfixableOther);
      return;
    }
    if (photos.length === 0) {
      setLocalError(t.assist.unfixableNeedPhoto);
      return;
    }
    onSubmit(reason, photos);
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.assist.unfixableAction} · ${ticketLabel}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.assist.unfixableAction, tone: "danger", busy, onPress: onSend}]}
    >
      <View style={styles.body}>
        {t.assist.unfixableRefund ? <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.unfixableRefund}</Text> : null}
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <View style={styles.chipRow}>
          {UNFIXABLE_REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[styles.chipBtn, {borderColor: theme.danger}, reason === r && {backgroundColor: theme.danger}]} accessibilityRole="button" accessibilityState={{checked: reason === r}} accessibilityLabel={unfixableReasonLabel(r, t)}>
              <Text style={{color: reason === r ? "#fff" : theme.text}}>{unfixableReasonLabel(r, t)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.unfixablePhotos}</Text>
        <View style={styles.photoRow}>
          {photos.map((uri, index) => (
            <View key={`${index}-${uri}`} style={styles.thumbWrap}>
              <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.assist.unfixablePhotos} ${index + 1}`}>
                <Image source={{uri}} style={styles.thumb} />
              </Pressable>
              <Pressable onPress={() => setPhotos((prev) => prev.filter((item) => item !== uri))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                <MaterialIcons name="close" size={16} color={theme.danger} />
              </Pressable>
            </View>
          ))}
          {photos.length < 5 ? (
            <>
              <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("camera")} accessibilityRole="button" accessibilityLabel={t.photos.take}>
                <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
                <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.photos.take}</Text>
              </Pressable>
              <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("library")} accessibilityRole="button" accessibilityLabel={t.flag.photo}>
                <MaterialIcons name="photo-library" size={16} color={theme.primary} />
                <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.flag.photo}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        {photoViewer.node}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  hint: {fontSize: 12},
  label: {fontSize: 13, fontWeight: "700"},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chipBtn: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  photoRow: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  thumbWrap: {flexDirection: "row", alignItems: "center", gap: 2},
  thumb: {width: 48, height: 48, borderRadius: 8},
});
