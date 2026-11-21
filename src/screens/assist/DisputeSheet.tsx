import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {PROVIDER_DISPUTE_REASONS, RIDER_DISPUTE_REASONS} from "../../api/dispatch";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {DISPUTE_PHOTO_MAX} from "../../services/photos";
import PhotoAttachments, {usePhotoDraft} from "../../components/ui/PhotoAttachments";

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
  const [localError, setLocalError] = useState<string | null>(null);
  const photoDraft = usePhotoDraft({t, max: DISPUTE_PHOTO_MAX});
  const reasons = viewer === "PROVIDER" ?
    [...PROVIDER_DISPUTE_REASONS] :
    RIDER_DISPUTE_REASONS.filter((reason) =>
      ticketType === "TOW" ?
        reason !== "FIX_NOT_DONE" && reason !== "POOR_QUALITY" :
        true,
    );
  function onSend(): void {
    if (!reason) {
      setLocalError(t.dispute.needReason);
      return;
    }
    const needsPhoto = reason === "OVERCHARGE" ||
      reason === "FIX_NOT_DONE" ||
      reason === "POOR_QUALITY";
    if (needsPhoto && photoDraft.photos.length === 0) {
      setLocalError(t.dispute.needPhoto);
      return;
    }
    onSubmit(reason, note.trim(), photoDraft.photos);
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
        <PhotoAttachments
          t={t}
          photos={photoDraft.photos}
          max={DISPUTE_PHOTO_MAX}
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
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chipBtn: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 64, textAlignVertical: "top"},
});
