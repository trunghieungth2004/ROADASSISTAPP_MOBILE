import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {HANDOVER_PHOTO_MAX} from "../../services/photos";
import PhotoAttachments, {usePhotoDraft} from "../../components/ui/PhotoAttachments";

type Props = {
  t: Strings;
  theme: AppTheme;
  kind: "loaded" | "received";
  busy: boolean;
  error: string | null;
  onConfirm: (photos: string[]) => void;
  onSkip: () => void;
  onClose: () => void;
};

export default function HandoverPhotoSheet({t, theme, kind, busy, error, onConfirm, onSkip, onClose}: Props) {
  const photoDraft = usePhotoDraft({t, max: HANDOVER_PHOTO_MAX});
  return (
    <Overlay
      visible
      variant="dialog"
      title={kind === "loaded" ? t.assist.loaded : t.assist.receivedNotice}
      closeLabel={t.common.cancel}
      onClose={busy ? () => undefined : onClose}
      scrollable={false}
      actions={[
        {label: t.assist.skipPhoto, tone: "neutral" as const, outline: true, onPress: onSkip},
        {label: t.common.confirm, tone: "primary" as const, busy, onPress: () => onConfirm(photoDraft.photos)},
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.handoverPrompt}</Text>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        <PhotoAttachments
          t={t}
          photos={photoDraft.photos}
          max={HANDOVER_PHOTO_MAX}
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
  body: {gap: 10},
  hint: {fontSize: 12},
});
