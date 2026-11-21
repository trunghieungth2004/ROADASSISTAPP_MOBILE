import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {EVIDENCE_PHOTO_MAX} from "../../services/photos";
import PhotoAttachments, {usePhotoDraft} from "../../components/ui/PhotoAttachments";
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
  const [localError, setLocalError] = useState<string | null>(null);
  const photoDraft = usePhotoDraft({t, max: EVIDENCE_PHOTO_MAX});
  function onSend(): void {
    if (!reason) {
      setLocalError(t.assist.unfixableOther);
      return;
    }
    if (photoDraft.photos.length === 0) {
      setLocalError(t.assist.unfixableNeedPhoto);
      return;
    }
    onSubmit(reason, photoDraft.photos);
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
        <PhotoAttachments
          t={t}
          photos={photoDraft.photos}
          max={EVIDENCE_PHOTO_MAX}
          busy={photoDraft.busy}
          error={photoDraft.error}
          label={t.assist.unfixablePhotos}
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
});
