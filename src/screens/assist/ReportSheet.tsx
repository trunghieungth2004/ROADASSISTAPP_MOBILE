import {useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {isPhotoPermissionError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {reportReasonsFor} from "./reportReasons";

type Props = {
  t: Strings;
  ticketLabel: string;
  status: string;
  viewer: "RIDER" | "PROVIDER";
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string, note: string, photoUris: string[]) => void;
  onClose: () => void;
};

function reasonLabel(reason: string, t: Strings): string {
  if (reason === "NO_SHOW") return t.report.reasonNoShow;
  if (reason === "LATE") return t.report.reasonLate;
  if (reason === "CANCEL_MID") return t.report.reasonCancelMid;
  if (reason === "DECLINE_DROPOFF") return t.report.reasonDeclineDropoff;
  if (reason === "CONDUCT") return t.report.reasonConduct;
  if (reason === "PAYMENT_REFUSED") return t.report.reasonPaymentRefused;
  if (reason === "UNSAFE") return t.report.reasonUnsafe;
  if (reason === "HARASSMENT") return t.report.reasonHarassment;
  return t.report.reasonOther;
}

export default function ReportSheet({
  t,
  ticketLabel,
  status,
  viewer,
  busy,
  error,
  onSubmit,
  onClose,
}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  const reasons = reportReasonsFor(viewer, status);

  async function onAddPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photos.length >= 5) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const remaining = 5 - photos.length;
      const picked = from === "camera" ?
        await takePhoto() :
        await pickPhotos(remaining, 0);
      const next = picked.filter((item): item is string => typeof item === "string");
      if (next.length > 0) {
        setPhotos((prev) => [...prev, ...next].slice(0, 5));
      }
    } catch (err) {
      setLocalError(
        isPhotoPermissionError(err) ?
          (from === "camera" ? t.photos.cameraDenied : t.photos.denied) :
          err instanceof Error ? err.message : t.report.reasonRequired,
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function onSend(): void {
    if (!reason) {
      setLocalError(t.report.reasonRequired);
      return;
    }
    onSubmit(reason, note.trim(), photos);
  }

  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.report.behaviorTitle} · ${ticketLabel}`}
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.report.submit, tone: "primary", busy, onPress: onSend}]}
      scrollable={false}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.muted}]}>{t.report.reasonTitle}</Text>
        <View style={styles.chipRow}>
          {reasons.map((value) => (
            <Pressable
              key={value}
              onPress={() => setReason(value)}
              style={[styles.chipBtn, {borderColor: theme.primary}, reason === value && {backgroundColor: theme.primary}]}
              accessibilityRole="button"
              accessibilityState={{checked: reason === value}}
              accessibilityLabel={reasonLabel(value, t)}
            >
              <Text style={{color: reason === value ? "#fff" : theme.text}}>
                {reasonLabel(value, t)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          placeholder={t.report.notePlaceholder}
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
                <Pressable
                  onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.common.delete}
                >
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
            <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void onAddPhoto("library")} accessibilityRole="button" accessibilityLabel={t.report.notePlaceholder}>
              <MaterialIcons name="photo-library" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{`${t.assist.photos} ${photos.length}/5`}</Text>
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
  label: {fontSize: 12},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chipBtn: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  sourceRow: {flexDirection: "row", gap: 8, flexWrap: "wrap", alignSelf: "flex-start"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 64, textAlignVertical: "top"},
  photoRow: {flexDirection: "row", alignItems: "center", gap: 8},
  photoGrid: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
});
