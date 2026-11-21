import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {REPORT_PHOTO_MAX} from "../../services/photos";
import PhotoAttachments, {usePhotoDraft} from "../../components/ui/PhotoAttachments";
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
  const theme = themeForMode(scheme);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const photoDraft = usePhotoDraft({t, max: REPORT_PHOTO_MAX});
  const reasons = reportReasonsFor(viewer, status);

  function onSend(): void {
    if (!reason) {
      setLocalError(t.report.reasonRequired);
      return;
    }
    onSubmit(reason, note.trim(), photoDraft.photos);
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
        <PhotoAttachments
          t={t}
          photos={photoDraft.photos}
          max={REPORT_PHOTO_MAX}
          busy={photoDraft.busy}
          error={photoDraft.error}
          label={t.assist.photos}
          onAdd={(source) => void photoDraft.add(source)}
          onRemove={photoDraft.remove}
        />
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
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 64, textAlignVertical: "top"},
});
