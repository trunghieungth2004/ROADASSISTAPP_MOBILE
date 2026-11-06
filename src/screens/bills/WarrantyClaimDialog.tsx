import {useEffect, useState} from "react";
import {ActivityIndicator, Image, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import {toMessage} from "../../api/client";
import {fileWarrantyClaim} from "../../api/warranty";
import {useAuth} from "../../context/AuthContext";
import {usePhotoViewer} from "../../components/ui/PhotoViewer";
import {isPhotoPermissionError, pickPhotos, takePhoto, uploadPhotoPaths} from "../../services/photos";
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
  const photoViewer = usePhotoViewer(t.common.cancel);
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReason("");
    setPhotos([]);
    setPhotoBusy(false);
    setBusy(false);
    setError(null);
  }, [visible, line?.lineId]);

  async function addPhoto(source: "camera" | "library"): Promise<void> {
    if (photoBusy || photos.length >= 5) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const picked = source === "camera" ?
        await takePhoto() :
        await pickPhotos(5, photos.length);
      if (picked.length > 0) {
        setPhotos((prev) => [...prev, ...picked].slice(0, 5));
      }
    } catch (err) {
      setError(isPhotoPermissionError(err) ?
        (source === "camera" ? t.photos.cameraDenied : t.photos.denied) :
        toMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit(): Promise<void> {
    if (!token || !line || busy) return;
    setBusy(true);
    setError(null);
    try {
      let photoUrls: string[] | undefined;
      if (photos.length > 0) {
        if (!uid) throw new Error(t.photos.uploadFailed);
        const uploaded = await uploadPhotoPaths(`warranty/${uid}/${ticketId}`, photos);
        if (uploaded.length !== photos.length) {
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
      setError(toMessage(err));
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
      <Text style={[styles.muted, {color: theme.muted}]}>{t.bills.warrantyClaimHint}</Text>
      {error ? <Text style={[styles.muted, {color: theme.danger}]}>{error}</Text> : null}
      <View style={styles.photoRow}>
        {photos.map((path, index) => (
          <View key={`${path}-${index}`} style={styles.photoWrap}>
            <Pressable onPress={() => photoViewer.open(path)} accessibilityRole="button" accessibilityLabel={`${t.assist.photos} ${index + 1}`}>
              <Image source={{uri: path}} style={styles.photo} />
            </Pressable>
            <Pressable
              style={[styles.removePhoto, {backgroundColor: theme.danger}]}
              onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
              accessibilityRole="button"
              accessibilityLabel={t.common.delete}
            >
              <MaterialIcons name="close" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
        {photos.length < 5 ? (
          <>
            <Pressable
              style={[styles.photoBtn, {borderColor: theme.border}]}
              disabled={photoBusy}
              onPress={() => void addPhoto("camera")}
              accessibilityRole="button"
              accessibilityLabel={t.photos.take}
            >
              {photoBusy ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <MaterialIcons name="photo-camera" size={22} color={theme.primary} />
              )}
            </Pressable>
            <Pressable
              style={[styles.photoBtn, {borderColor: theme.border}]}
              disabled={photoBusy}
              onPress={() => void addPhoto("library")}
              accessibilityRole="button"
              accessibilityLabel={t.photos.choose}
            >
              <MaterialIcons name="photo-library" size={22} color={theme.primary} />
            </Pressable>
          </>
        ) : null}
      </View>
      <Text style={[styles.muted, {color: theme.muted}]}>{`${photos.length}/5`}</Text>
      <TextInput
        style={[styles.input, {borderColor: theme.border, color: theme.text}]}
        value={reason}
        onChangeText={setReason}
        placeholder={t.bills.refundReason}
        placeholderTextColor={theme.muted}
        multiline
      />
      {photoViewer.node}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  muted: {fontSize: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: "top"},
  photoRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  photoWrap: {position: "relative"},
  photo: {width: 64, height: 64, borderRadius: 8},
  removePhoto: {position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center"},
  photoBtn: {width: 56, height: 56, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center"},
});
