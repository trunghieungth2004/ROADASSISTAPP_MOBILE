import {useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import {RIDER_DISPUTE_REASONS} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import {isPhotoPermissionError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";

type Props = {
  t: Strings;
  ticketLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string, note: string, photoUri: string | null) => void;
  onClose: () => void;
};

export function disputeReasonLabel(reason: string, t: Strings): string {
  if (reason === "LATE") return t.dispute.reasonLate;
  if (reason === "OVERCHARGE") return t.dispute.reasonOvercharge;
  if (reason === "NO_SHOW") return t.dispute.reasonNoShow;
  if (reason === "RUDE") return t.dispute.reasonRude;
  if (reason === "WRONG_ROUTE") return t.dispute.reasonWrongRoute;
  return t.dispute.reasonOther;
}

export default function DisputeSheet({t, ticketLabel, busy, error, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  async function onAddPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photo !== null) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const picked = from === "camera" ? await takePhoto() : await pickPhotos(1, 0);
      if (picked.length > 0 && typeof picked[0] === "string") setPhoto(picked[0] as string);
    } catch (err) {
      setLocalError(isPhotoPermissionError(err) ? (from === "camera" ? t.photos.cameraDenied : t.photos.denied) : err instanceof Error ? err.message : t.dispute.needReason);
    } finally {
      setPhotoBusy(false);
    }
  }
  function onSend(): void {
    if (!reason) {
      setLocalError(t.dispute.needReason);
      return;
    }
    onSubmit(reason, note.trim(), photo);
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.dispute.title} · ${ticketLabel}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.dispute.submit, tone: "primary", busy, onPress: onSend}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <View style={styles.chipRow}>
          {RIDER_DISPUTE_REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[styles.chipBtn, {borderColor: theme.primary}, reason === r && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: reason === r}} accessibilityLabel={disputeReasonLabel(r, t)}>
              <Text style={{color: reason === r ? "#fff" : theme.text}}>{disputeReasonLabel(r, t)}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          placeholder={t.dispute.notePlaceholder}
          placeholderTextColor={theme.muted}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />
        {photo ? (
          <View style={styles.photoRow}>
            <Pressable onPress={() => photoViewer.open(photo)} accessibilityRole="button" accessibilityLabel={t.assist.photos}>
              <Image source={{uri: photo}} style={styles.thumb} />
            </Pressable>
            <Pressable onPress={() => setPhoto(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.delete}>
              <MaterialIcons name="close" size={18} color={theme.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.sourceRow}>
            <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("camera")} accessibilityRole="button" accessibilityLabel={t.photos.take}>
              <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.photos.take}</Text>
            </Pressable>
            <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("library")} accessibilityRole="button" accessibilityLabel={t.dispute.photo}>
              <MaterialIcons name="photo-library" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.dispute.photo}</Text>
            </Pressable>
          </View>
        )}
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
  sourceRow: {flexDirection: "row", gap: 8, flexWrap: "wrap", alignSelf: "flex-start"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 64, textAlignVertical: "top"},
  photoRow: {flexDirection: "row", alignItems: "center", gap: 8},
  thumb: {width: 64, height: 64, borderRadius: 8},
});
