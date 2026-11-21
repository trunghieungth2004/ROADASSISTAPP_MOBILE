import {useEffect, useState} from "react";
import {StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import {fileWarrantyClaim} from "../../api/warranty";
import {useAuth} from "../../context/AuthContext";
import {WARRANTY_PHOTO_MAX, uploadPhotoPaths} from "../../services/photos";
import PhotoAttachments, {photoUploadMessage, usePhotoDraft} from "../../components/ui/PhotoAttachments";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

type Props = {
  visible: boolean;
  ticketId: string;
  line: {lineId: string; name: string} | null;
  token: string | null;
  theme: AppTheme;
  t: Strings;
  onClose: () => void;
  onFiled: () => void | Promise<void>;
};

export default function WarrantyClaimDialog({visible, ticketId, line, token, theme, t, onClose, onFiled}: Props) {
  const {uid} = useAuth();
  const photoDraft = usePhotoDraft({t, max: WARRANTY_PHOTO_MAX});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReason("");
    photoDraft.clear();
    setBusy(false);
    setError(null);
  }, [visible, line?.lineId]);

  async function submit(): Promise<void> {
    if (!token || !line || busy) return;
    setBusy(true);
    setError(null);
    try {
      let photoUrls: string[] | undefined;
      if (photoDraft.photos.length > 0) {
        if (!uid) throw new Error(t.photos.uploadFailed);
        const uploaded = await uploadPhotoPaths(`warranty/${uid}/${ticketId}`, photoDraft.photos);
        if (uploaded.length !== photoDraft.photos.length) {
          throw new Error(t.photos.uploadFailed);
        }
        photoUrls = uploaded;
      }
      await fileWarrantyClaim({
        ticketId,
        lineId: line.lineId,
        reason: reason.trim(),
        ...(photoUrls !== undefined ? {photoUrls} : {}),
      }, token);
      await onFiled();
    } catch (err) {
      setError(photoUploadMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay
      visible={visible}
      variant="dialog"
      title={`${t.bills.claimWarranty} · ${line?.name ?? ""}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{
        label: t.bills.warrantySubmit,
        tone: "primary",
        busy,
        disabled: reason.trim().length < 5,
        onPress: () => void submit(),
      }]}
    >
      <View style={styles.body}>
        <Text style={[styles.muted, {color: theme.muted}]}>{t.bills.warrantyClaimHint}</Text>
        {error ? <Text style={[styles.muted, {color: theme.danger}]}>{error}</Text> : null}
        <PhotoAttachments
          t={t}
          photos={photoDraft.photos}
          max={WARRANTY_PHOTO_MAX}
          busy={photoDraft.busy}
          error={photoDraft.error}
          label={t.assist.photos}
          onAdd={(source) => void photoDraft.add(source)}
          onRemove={photoDraft.remove}
        />
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={reason}
          onChangeText={setReason}
          placeholder={t.bills.refundReason}
          placeholderTextColor={theme.muted}
          multiline
        />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  muted: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: "top"},
});
