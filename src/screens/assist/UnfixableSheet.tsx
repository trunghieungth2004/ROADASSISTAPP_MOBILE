import {useState} from "react";
import {Image, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {isPhotoPermissionError, pickPhotos, takePhoto, TICKET_PHOTO_MAX, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {unfixableReasonLabel} from "./ticketLabels";

export const UNFIXABLE_REASONS = ["NO_PARTS", "BEYOND_REPAIR", "SAFETY", "OTHER"] as const;

export type UnfixableReason = (typeof UNFIXABLE_REASONS)[number];

type Props = {
  t: Strings;
  ticketLabel: string;
  status: string;
  busy: boolean;
  error: string | null;
  callOutWaived?: boolean;
  onSubmit: (reason: string, photos: string[]) => void;
  onClose: () => void;
};

export default function UnfixableSheet({t, ticketLabel, status, busy, error, callOutWaived = false, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [reason, setReason] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  async function onAddPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photos.length >= TICKET_PHOTO_MAX) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const picked = from === "camera" ? await takePhoto() : await pickPhotos(TICKET_PHOTO_MAX, photos.length);
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked].slice(0, TICKET_PHOTO_MAX));
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
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.unfixableAction, tone: "danger", busy, onPress: onSend}]}
    >
      <View style={styles.body}>
        {callOutWaived ? <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.unfixableWaived}</Text> :
          t.assist.unfixableRefund ? <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.unfixableRefund}</Text> : null}
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <View style={styles.chipRow}>
          {UNFIXABLE_REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[styles.chipBtn, {borderColor: theme.danger}, reason === r && {backgroundColor: theme.danger}]} accessibilityRole="button" accessibilityState={{checked: reason === r}} accessibilityLabel={unfixableReasonLabel(r, t)}>
              <Text style={{color: reason === r ? "#fff" : theme.text}}>{unfixableReasonLabel(r, t)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.photoBlock}>
          <View style={styles.photoHeader}>
            <Text style={[styles.photoLabel, {color: theme.muted}]}>{t.assist.unfixablePhotos} ({photos.length}/{TICKET_PHOTO_MAX})</Text>
            {photos.length < TICKET_PHOTO_MAX ? (
              <Pressable style={[styles.libraryBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("library")} accessibilityRole="button" accessibilityLabel={t.flag.photo}>
                <MaterialIcons name="photo-library" size={14} color={theme.primary} />
                <Text style={{color: theme.primary, fontSize: 12}}>{photoBusy ? t.common.loading : t.flag.photo}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView style={styles.photoScroll} contentContainerStyle={styles.photoList} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {photos.map((uri, index) => (
              <View key={`${index}-${uri}`} style={styles.stripWrap}>
                <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={`${t.assist.unfixablePhotos} ${index + 1}`}>
                  <Image source={{uri}} style={styles.strip} />
                </Pressable>
                <Pressable style={[styles.removeBtn, {backgroundColor: theme.danger}]} onPress={() => setPhotos((prev) => prev.filter((item) => item !== uri))} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                  <MaterialIcons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < TICKET_PHOTO_MAX ? (
              <Pressable style={[styles.addStrip, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("camera")} accessibilityRole="button" accessibilityLabel={t.photos.take}>
                <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
                <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.photos.take}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
        {photoViewer.node}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  hint: {fontSize: 12},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chipBtn: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  photoBlock: {gap: 6},
  photoHeader: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  photoLabel: {fontSize: 12},
  libraryBtn: {flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8},
  photoScroll: {maxHeight: 188},
  photoList: {gap: 8},
  stripWrap: {position: "relative", width: "100%"},
  strip: {width: "100%", height: 56, borderRadius: 8},
  removeBtn: {position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center"},
  addStrip: {width: "100%", height: 56, minHeight: 56, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6},
});
