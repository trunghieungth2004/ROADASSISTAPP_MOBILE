import {useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {PROVIDER_DISPUTE_REASONS, RIDER_DISPUTE_REASONS} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {isPhotoPermissionError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";

type Props = {
  t: Strings;
  ticketLabel: string;
  ticketType: string;
  status: string;
  viewer: "RIDER" | "PROVIDER";
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string, note: string, photoUris: string[]) => void;
  onClose: () => void;
};

export function disputeReasonLabel(reason: string, t: Strings): string {
  if (reason === "LATE") return t.dispute.reasonLate;
  if (reason === "OVERCHARGE") return t.dispute.reasonOvercharge;
  if (reason === "NO_SHOW") return t.dispute.reasonNoShow;
  if (reason === "RUDE") return t.dispute.reasonRude;
  if (reason === "WRONG_ROUTE") return t.dispute.reasonWrongRoute;
  if (reason === "UNSAFE") return t.dispute.reasonUnsafe;
  if (reason === "FIX_NOT_DONE") return t.dispute.reasonFixNotDone;
  if (reason === "POOR_QUALITY") return t.dispute.reasonPoorQuality;
  if (reason === "UNFIXABLE_DISAGREE") return t.dispute.reasonUnfixableDisagree;
  if (reason === "RIDER_NO_SHOW") return t.dispute.reasonRiderNoShow;
  if (reason === "RIDER_UNREACHABLE") return t.dispute.reasonRiderUnreachable;
  if (reason === "RIDER_REFUSED_PAYMENT") return t.dispute.reasonRiderRefusedPayment;
  if (reason === "RIDER_ABUSIVE") return t.dispute.reasonRiderAbusive;
  return t.dispute.reasonOther;
}

export default function DisputeSheet({t, ticketLabel, ticketType, status, viewer, busy, error, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  const reasons = viewer === "PROVIDER" ?
    [...PROVIDER_DISPUTE_REASONS] :
    RIDER_DISPUTE_REASONS.filter((reason) =>
      ticketType === "TOW" ?
        reason !== "FIX_NOT_DONE" && reason !== "POOR_QUALITY" :
        true,
    );
  async function onAddPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photos.length >= 5) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const remaining = 5 - photos.length;
      const picked = from === "camera" ? await takePhoto() : await pickPhotos(remaining, 0);
      const next = picked.filter((item): item is string => typeof item === "string");
      if (next.length > 0) setPhotos((prev) => [...prev, ...next].slice(0, 5));
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
    const needsPhoto = reason === "OVERCHARGE" ||
      reason === "FIX_NOT_DONE" ||
      reason === "POOR_QUALITY";
    if (needsPhoto && photos.length === 0) {
      setLocalError(t.dispute.needPhoto);
      return;
    }
    onSubmit(reason, note.trim(), photos);
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.dispute.title} · ${ticketLabel}`}
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.dispute.submit, tone: "primary", busy, onPress: onSend}]}
      scrollable={false}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <View style={styles.chipRow}>
          {reasons.map((r) => (
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
        {photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoRow}>
                <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={t.assist.photos}>
                  <Image source={{uri}} style={styles.thumb} />
                </Pressable>
                <Pressable onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                  <MaterialIcons name="close" size={18} color={theme.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {photos.length < 5 ? (
          <View style={styles.sourceRow}>
            <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("camera")} accessibilityRole="button" accessibilityLabel={t.photos.take}>
              <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.photos.take}</Text>
            </Pressable>
            <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("library")} accessibilityRole="button" accessibilityLabel={t.dispute.photo}>
              <MaterialIcons name="photo-library" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{`${t.dispute.photo} ${photos.length}/5`}</Text>
            </Pressable>
          </View>
        ) : null}
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
  photoGrid: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
});
