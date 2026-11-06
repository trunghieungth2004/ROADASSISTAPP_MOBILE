import {useState} from "react";
import {ActivityIndicator, Image, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {isPhotoPermissionError, pickPhotos, takePhoto} from "../../services/photos";

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
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function addPhoto(source: "camera" | "library"): Promise<void> {
    if (photoBusy || photos.length >= 5) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const picked = source === "camera" ?
        await takePhoto() :
        await pickPhotos(5, photos.length);
      if (picked.length > 0) {
        setPhotos((prev) => [...prev, ...picked].slice(0, 5));
      }
    } catch (err) {
      setPhotoError(isPhotoPermissionError(err) ?
        (source === "camera" ? t.photos.cameraDenied : t.photos.denied) :
        t.photos.uploadFailed);
    } finally {
      setPhotoBusy(false);
    }
  }

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
        {label: t.common.confirm, tone: "primary" as const, busy, disabled: photos.length === 0 && photoBusy, onPress: () => onConfirm(photos)},
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.handoverPrompt}</Text>
        {error ?? photoError ? <Text style={[styles.hint, {color: theme.danger}]}>{error ?? photoError}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            style={[styles.photoBtn, {borderColor: theme.border}]}
            disabled={photoBusy}
            onPress={() => void addPhoto("camera")}
            accessibilityRole="button"
            accessibilityLabel={t.photos.take}
          >
            <MaterialIcons name="photo-camera" size={22} color={theme.primary} />
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
          {photoBusy ? <ActivityIndicator color={theme.primary} /> : null}
        </View>
        <View style={styles.grid}>
          {photos.map((path, index) => (
            <View key={`${path}-${index}`} style={styles.photoWrap}>
              <Image source={{uri: path}} style={styles.photo} />
              <Pressable
                style={[styles.remove, {backgroundColor: theme.danger}]}
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                accessibilityRole="button"
                accessibilityLabel={t.common.delete}
              >
                <MaterialIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.photosMax}</Text>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  hint: {fontSize: 12},
  actions: {flexDirection: "row", alignItems: "center", gap: 10},
  photoBtn: {width: 56, height: 56, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  grid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  photoWrap: {position: "relative"},
  photo: {width: 64, height: 64, borderRadius: 8},
  remove: {position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center"},
});
