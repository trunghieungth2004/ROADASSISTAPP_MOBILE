import {useState} from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import type {AppealReason, AppealSubjectKind} from "../../api/appeals";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import {isPhotoPermissionError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";

const RATING_REASONS: AppealReason[] = [
  "RETALIATORY",
  "NOT_THE_SERVICE",
  "WRONG_TICKET",
  "ABUSIVE_CONTENT",
  "SPAM",
  "OTHER",
];

const REPORT_REASONS: AppealReason[] = [
  "FALSE_REPORT",
  "NOT_MY_CONDUCT",
  "CONTEXT_MISSING",
  "NEW_EVIDENCE",
  "PROCEDURAL_ERROR",
  "OTHER",
];

const DISPUTE_REASONS: AppealReason[] = [
  "NEW_EVIDENCE",
  "WRONG_OUTCOME",
  "AMOUNT_ERROR",
  "PROCEDURAL_ERROR",
  "OTHER",
];

function reasonsFor(subject: AppealSubjectKind): AppealReason[] {
  if (subject === "REPORT") return REPORT_REASONS;
  if (subject === "DISPUTE") return DISPUTE_REASONS;
  return RATING_REASONS;
}

function reasonLabel(reason: AppealReason, t: Strings): string {
  if (reason === "RETALIATORY") return t.more.appealRetaliatory;
  if (reason === "NOT_THE_SERVICE") return t.more.appealNotService;
  if (reason === "WRONG_TICKET") return t.more.appealWrongTicket;
  if (reason === "ABUSIVE_CONTENT") return t.more.appealAbusive;
  if (reason === "SPAM") return t.more.appealSpam;
  if (reason === "FALSE_REPORT") return t.more.appealFalseReport;
  if (reason === "NOT_MY_CONDUCT") return t.more.appealNotMyConduct;
  if (reason === "CONTEXT_MISSING") return t.more.appealContextMissing;
  if (reason === "NEW_EVIDENCE") return t.more.appealNewEvidence;
  if (reason === "WRONG_OUTCOME") return t.more.appealWrongOutcome;
  if (reason === "AMOUNT_ERROR") return t.more.appealAmountError;
  if (reason === "PROCEDURAL_ERROR") return t.more.appealProcedural;
  return t.more.appealOther;
}

export default function AppealSheet({
  t,
  subjectKind,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  t: Strings;
  subjectKind: AppealSubjectKind;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: AppealReason, note: string, photoUris: string[]) => void;
  onClose: () => void;
}) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [reason, setReason] = useState<AppealReason | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const photoViewer = usePhotoViewer(t.common.cancel);
  const reasons = reasonsFor(subjectKind);
  const reasonTitle = subjectKind === "REPORT" ?
    t.more.appealSubjectReport :
    subjectKind === "DISPUTE" ?
      t.more.appealSubjectDispute :
      t.more.appealSubjectRating;

  async function addPhoto(from: PhotoSource): Promise<void> {
    if (photoBusy || photos.length >= 3) return;
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const remaining = 3 - photos.length;
      const picked = from === "camera" ?
        await takePhoto() :
        await pickPhotos(remaining, 0);
      const next = picked.filter((item): item is string => typeof item === "string");
      if (next.length > 0) setPhotos((prev) => [...prev, ...next].slice(0, 3));
    } catch (err) {
      setLocalError(
        isPhotoPermissionError(err) ?
          (from === "camera" ? t.photos.cameraDenied : t.photos.denied) :
          err instanceof Error ? err.message : t.more.appealNote,
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function submit(): void {
    if (!reason) {
      setLocalError(t.report.reasonRequired);
      return;
    }
    if (note.trim() === "") {
      setLocalError(t.more.appealNote);
      return;
    }
    onSubmit(reason, note.trim(), photos);
  }

  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.more.appealTitle} · ${reasonTitle}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.more.appealSubmit, tone: "primary", busy, onPress: submit}]}
      scrollable
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.muted}]}>{t.more.appealReasonTitle}</Text>
        <View style={styles.chipRow}>
          {reasons.map((value) => (
            <Pressable
              key={value}
              onPress={() => setReason(value)}
              style={[
                styles.chip,
                {borderColor: theme.primary},
                reason === value && {backgroundColor: theme.primary},
              ]}
              accessibilityRole="button"
              accessibilityState={{checked: reason === value}}
            >
              <Text style={{color: reason === value ? "#fff" : theme.text}}>
                {reasonLabel(value, t)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          placeholder={t.more.appealNotePlaceholder}
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
                <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button">
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
        {photos.length < 3 ? (
          <View style={styles.sourceRow}>
            <Pressable style={[styles.chip, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void addPhoto("camera")} accessibilityRole="button">
              <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{photoBusy ? t.common.loading : t.photos.take}</Text>
            </Pressable>
            <Pressable style={[styles.chip, {borderColor: theme.primary}]} disabled={photoBusy} onPress={() => void addPhoto("library")} accessibilityRole="button">
              <MaterialIcons name="photo-library" size={16} color={theme.primary} />
              <Text style={{color: theme.primary}}>{`${t.assist.photos} ${photos.length}/3`}</Text>
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
  chip: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: "top"},
  photoGrid: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  photoRow: {flexDirection: "row", alignItems: "center", gap: 8},
  thumb: {width: 64, height: 64, borderRadius: 8},
  sourceRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
});
