import {useCallback, useState} from "react";
import {ActivityIndicator, Image, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import type {Strings} from "../../i18n/en";
import {isPhotoPermissionError, isPhotoUploadError, pickPhotos, takePhoto, type PhotoSource} from "../../services/photos";
import {toMessage} from "../../api/client";
import {AppText as Text} from "./AppText";
import {usePhotoViewer} from "./PhotoViewer";

export type PhotoDraft = {
  photos: string[];
  busy: boolean;
  error: string | null;
  add: (source: PhotoSource) => Promise<void>;
  remove: (index: number) => void;
  clear: () => void;
  setError: (value: string | null) => void;
};

export function usePhotoDraft({t, max}: {t: Strings; max: number}): PhotoDraft {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useCallback(async (source: PhotoSource): Promise<void> => {
    if (busy || photos.length >= max) return;
    setBusy(true);
    setError(null);
    try {
      const picked = source === "camera" ?
        await takePhoto() :
        await pickPhotos(max, photos.length);
      if (picked.length > 0) {
        setPhotos((prev) => [...prev, ...picked].slice(0, max));
      }
    } catch (err) {
      setError(isPhotoPermissionError(err) ?
        (source === "camera" ? t.photos.cameraDenied : t.photos.denied) :
        t.photos.uploadFailed);
    } finally {
      setBusy(false);
    }
  }, [busy, max, photos.length, t]);
  const remove = useCallback((index: number): void => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const clear = useCallback((): void => {
    setPhotos([]);
    setError(null);
  }, []);
  return {photos, busy, error, add, remove, clear, setError};
}

export function photoUploadMessage(err: unknown, t: Strings): string {
  return isPhotoUploadError(err) ? t.photos.uploadFailed : toMessage(err);
}

type SourceProps = {
  t: Strings;
  busy?: boolean;
  disabled?: boolean;
  onAdd: (source: PhotoSource) => void;
  iconOnly?: boolean;
};

export function PhotoSourceButtons({t, busy = false, disabled = false, onAdd, iconOnly = false}: SourceProps) {
  const theme = themeForMode(useAppMode());
  const locked = busy || disabled;
  if (iconOnly) {
    return (
      <View style={styles.iconRow}>
        <Pressable
          style={[styles.iconBtn, {borderColor: theme.border, backgroundColor: theme.paper}, locked && styles.disabled]}
          disabled={locked}
          onPress={() => onAdd("camera")}
          accessibilityRole="button"
          accessibilityLabel={t.photos.take}
        >
          {busy ? <ActivityIndicator color={theme.primary} /> : <MaterialIcons name="photo-camera" size={20} color={theme.primary} />}
        </Pressable>
        <Pressable
          style={[styles.iconBtn, {borderColor: theme.border, backgroundColor: theme.paper}, locked && styles.disabled]}
          disabled={locked}
          onPress={() => onAdd("library")}
          accessibilityRole="button"
          accessibilityLabel={t.photos.choose}
        >
          {busy ? <ActivityIndicator color={theme.primary} /> : <MaterialIcons name="photo-library" size={20} color={theme.primary} />}
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.sourceRow}>
      <Pressable
        style={[styles.sourceBtn, {borderColor: theme.border, backgroundColor: theme.paper}, locked && styles.disabled]}
        disabled={locked}
        onPress={() => onAdd("camera")}
        accessibilityRole="button"
        accessibilityLabel={t.photos.take}
      >
        <MaterialIcons name="photo-camera" size={18} color={theme.primary} />
        <Text style={[styles.sourceText, {color: theme.text}]}>{t.photos.take}</Text>
      </Pressable>
      <Pressable
        style={[styles.sourceBtn, {borderColor: theme.border, backgroundColor: theme.paper}, locked && styles.disabled]}
        disabled={locked}
        onPress={() => onAdd("library")}
        accessibilityRole="button"
        accessibilityLabel={t.photos.choose}
      >
        <MaterialIcons name="photo-library" size={18} color={theme.primary} />
        <Text style={[styles.sourceText, {color: theme.text}]}>{t.photos.choose}</Text>
      </Pressable>
    </View>
  );
}

type GridProps = {
  t: Strings;
  photos: string[];
  onRemove: (index: number) => void;
  size?: number;
  compact?: boolean;
};

export function PhotoGrid({t, photos, onRemove, size = 72, compact = false}: GridProps) {
  const theme = themeForMode(useAppMode());
  const viewer = usePhotoViewer(t.common.cancel);
  if (photos.length === 0) return null;
  return (
    <>
      <View style={[styles.grid, compact && styles.gridCompact]}>
        {photos.map((uri, index) => (
          <View key={`${index}-${uri}`} style={styles.thumbWrap}>
            <Pressable
              onPress={() => viewer.open(uri)}
              accessibilityRole="button"
              accessibilityLabel={`${t.assist.photos} ${index + 1}`}
            >
              <Image source={{uri}} style={[styles.thumb, {width: size, height: size}]} />
            </Pressable>
            <Pressable
              style={[styles.remove, {backgroundColor: theme.danger}]}
              onPress={() => onRemove(index)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.common.delete}
            >
              <MaterialIcons name="close" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>
      {viewer.node}
    </>
  );
}

type Props = {
  t: Strings;
  photos: string[];
  max: number;
  busy?: boolean;
  error?: string | null;
  label?: string;
  onAdd: (source: PhotoSource) => void;
  onRemove: (index: number) => void;
};

export default function PhotoAttachments({
  t,
  photos,
  max,
  busy = false,
  error = null,
  label,
  onAdd,
  onRemove,
}: Props) {
  const theme = themeForMode(useAppMode());
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.label, {color: theme.muted}]}>
          {`${label ?? t.assist.photos} (${photos.length}/${max})`}
        </Text>
        {busy ? <ActivityIndicator size="small" color={theme.primary} /> : null}
      </View>
      <PhotoGrid t={t} photos={photos} onRemove={onRemove} />
      {photos.length < max ? (
        <PhotoSourceButtons t={t} busy={busy} onAdd={onAdd} />
      ) : null}
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  header: {flexDirection: "row", alignItems: "center", gap: 8},
  label: {fontSize: 12, fontWeight: "600", flexGrow: 1},
  grid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  gridCompact: {gap: 6},
  thumbWrap: {position: "relative"},
  thumb: {borderRadius: 10},
  remove: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  sourceBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceText: {fontSize: 12, fontWeight: "600"},
  iconRow: {flexDirection: "row", gap: 8},
  iconBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {opacity: 0.6},
  error: {fontSize: 12, lineHeight: 17},
});
