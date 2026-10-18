import {useState} from "react";
import {Image, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../../api/flags";
import {toMessage} from "../../api/client";
import {darkTheme, lightTheme} from "../../theme";
import {hazardKind} from "./hazardStyle";
import type {Strings} from "../../i18n/en";
import {isPhotoPermissionError, takePhoto} from "../../services/photos";
import {usePhotoViewer} from "../ui/PhotoViewer";

export type FlagReport = {type: FlagType; radiusMeters: number; note?: string; photoUrls?: string[]};

export type FlagDraftState = {
  type: FlagType;
  radiusMeters: number;
  note: string;
  photoUris: string[];
  photoError: string | null;
  setType: (next: FlagType) => void;
  setRadiusMeters: (next: number) => void;
  setNote: (next: string) => void;
  addPhoto: () => Promise<void>;
  removePhoto: (uri: string) => void;
  build: () => FlagReport;
};

export function useFlagDraft(t: Strings): FlagDraftState {
  const [type, setType] = useState<FlagType>("FLOOD");
  const [radiusMeters, setRadiusMeters] = useState(50);
  const [note, setNote] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  async function addPhoto(): Promise<void> {
    setPhotoError(null);
    try {
      const picked = await takePhoto();
      if (picked.length === 0) return;
      setPhotoUris((prev) => [...prev, ...picked].slice(0, 3));
    } catch (err) {
      setPhotoError(isPhotoPermissionError(err) ? t.photos.cameraDenied : toMessage(err));
    }
  }
  function removePhoto(uri: string): void {
    setPhotoUris((prev) => prev.filter((item) => item !== uri));
  }
  return {
    type,
    radiusMeters,
    note,
    photoUris,
    photoError,
    setType,
    setRadiusMeters,
    setNote,
    addPhoto,
    removePhoto,
    build: () => ({type, radiusMeters, ...(note.trim() !== "" ? {note: note.trim()} : {}), ...(photoUris.length > 0 ? {photoUrls: photoUris} : {})}),
  };
}

type Props = {t: Strings; draft: FlagDraftState};

const TYPES: {id: FlagType; icon: "flood" | "car-crash" | "construction"}[] = [
  {id: "FLOOD", icon: "flood"},
  {id: "ACCIDENT", icon: "car-crash"},
  {id: "OBSTRUCTION", icon: "construction"},
];

const RADII = [25, 50, 100, 200, 250];

export default function FlagSheet({t, draft}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const photoViewer = usePhotoViewer(t.common.cancel);
  const typeLabel = (id: FlagType): string => (id === "FLOOD" ? t.flag.flood : id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction);
  return (
    <View style={styles.body}>
      <View style={styles.photoZone}>
        {draft.photoUris.map((uri) => (
          <View key={uri} style={styles.photoStripWrap}>
            <Pressable onPress={() => photoViewer.open(uri)} accessibilityRole="button" accessibilityLabel={t.flag.photos}>
              <Image source={{uri}} style={styles.photoStrip} />
            </Pressable>
            <Pressable style={[styles.photoRemove, {backgroundColor: theme.danger}]} onPress={() => draft.removePhoto(uri)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.delete}>
              <MaterialIcons name="close" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
        {draft.photoUris.length < 3 ? (
          <Pressable style={[styles.photoAdd, {borderColor: theme.primary}]} onPress={() => void draft.addPhoto()} accessibilityRole="button" accessibilityLabel={t.photos.take}>
            <MaterialIcons name="photo-camera" size={16} color={theme.primary} />
            <Text style={{color: theme.primary}}>{t.photos.take}</Text>
          </Pressable>
        ) : null}
      </View>
      {draft.photoError ? <Text style={[styles.photoError, {color: theme.danger}]}>{draft.photoError}</Text> : null}
      <View style={styles.detailRow}>
        <View style={styles.typeCol}>
          <Text style={[styles.label, {color: theme.text, textAlign: "center"}]}>{t.flag.type}</Text>
          <View style={styles.typeRow}>
            {TYPES.map((o) => {
              const kind = hazardKind(o.id);
              const active = draft.type === o.id;
              return (
                <Pressable
                  key={o.id}
                  style={[styles.typeBtn, {borderColor: active ? kind.color : theme.border, backgroundColor: active ? `${kind.color}22` : "transparent"}]}
                  onPress={() => draft.setType(o.id)}
                  accessibilityRole="button"
                  accessibilityLabel={typeLabel(o.id)}
                  accessibilityState={{checked: active}}
                >
                  <MaterialIcons name={o.icon} size={20} color={active ? kind.color : theme.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.radiusCol}>
          <Text style={[styles.label, {color: theme.text, textAlign: "center"}]}>{t.flag.radius} (m)</Text>
          <View style={styles.radiusRow}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                style={[styles.radiusChip, {borderColor: draft.radiusMeters === r ? theme.primary : theme.border, backgroundColor: draft.radiusMeters === r ? `${theme.primary}22` : "transparent"}]}
                onPress={() => draft.setRadiusMeters(r)}
                accessibilityRole="button"
                accessibilityState={{checked: draft.radiusMeters === r}}
              >
                <Text style={[styles.radiusText, {color: draft.radiusMeters === r ? theme.primary : theme.text}]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.hazards.note}</Text>
      <TextInput
        style={[styles.noteInput, {borderColor: theme.border, color: theme.text}]}
        placeholder={t.hazards.note}
        placeholderTextColor={theme.muted}
        value={draft.note}
        onChangeText={draft.setNote}
        maxLength={280}
      />
      {photoViewer.node}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "700"},
  photoZone: {gap: 8, width: "100%"},
  photoStripWrap: {position: "relative", width: "100%"},
  photoStrip: {width: "100%", height: 48, borderRadius: 8},
  photoRemove: {position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center"},
  photoAdd: {width: "100%", height: 48, minHeight: 48, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6},
  photoError: {fontSize: 12},
  detailRow: {flexDirection: "row", alignItems: "flex-start", gap: 8},
  typeCol: {flex: 1, minWidth: 0, gap: 6},
  radiusCol: {flex: 1, minWidth: 0, gap: 6},
  typeRow: {flexDirection: "row", gap: 4, justifyContent: "center"},
  typeBtn: {width: 40, height: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12},
  radiusRow: {flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center"},
  radiusChip: {flex: 1, maxWidth: 40, minWidth: 0, height: 44, minHeight: 44, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center"},
  radiusText: {fontSize: 12, fontWeight: "700"},
  noteInput: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13},
});
