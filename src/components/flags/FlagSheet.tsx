import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../../api/flags";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {hazardKind} from "./hazardStyle";
import type {Strings} from "../../i18n/en";
import {FLAG_PHOTO_MAX} from "../../services/photos";
import PhotoAttachments, {usePhotoDraft} from "../ui/PhotoAttachments";

export type FlagReport = {type: FlagType; radiusMeters: number; note?: string; photoUrls?: string[]; ttlMinutes?: number};

export type FlagDraftState = {
  type: FlagType;
  radiusMeters: number;
  ttlMinutes: number;
  note: string;
  photoUris: string[];
  photoBusy: boolean;
  photoError: string | null;
  setType: (next: FlagType) => void;
  setRadiusMeters: (next: number) => void;
  setTtlMinutes: (next: number) => void;
  setNote: (next: string) => void;
  addPhoto: (source: "camera" | "library") => Promise<void>;
  removePhoto: (uri: string) => void;
  build: () => FlagReport;
};

export function useFlagDraft(t: Strings): FlagDraftState {
  const [type, setType] = useState<FlagType>("FLOOD");
  const [radiusMeters, setRadiusMeters] = useState(50);
  const [ttlMinutes, setTtlMinutes] = useState(120);
  const [note, setNote] = useState("");
  const photoDraft = usePhotoDraft({t, max: FLAG_PHOTO_MAX});
  return {
    type,
    radiusMeters,
    ttlMinutes,
    note,
    photoUris: photoDraft.photos,
    photoBusy: photoDraft.busy,
    photoError: photoDraft.error,
    setType,
    setRadiusMeters,
    setTtlMinutes,
    setNote,
    addPhoto: photoDraft.add,
    removePhoto: (uri: string) => {
      const index = photoDraft.photos.indexOf(uri);
      if (index >= 0) photoDraft.remove(index);
    },
    build: () => ({
      type,
      radiusMeters,
      ttlMinutes,
      ...(note.trim() !== "" ? {note: note.trim()} : {}),
      ...(photoDraft.photos.length > 0 ? {photoUrls: photoDraft.photos} : {}),
    }),
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
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const typeLabel = (id: FlagType): string => (id === "FLOOD" ? t.flag.flood : id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction);
  return (
    <View style={styles.body}>
      <PhotoAttachments
        t={t}
        photos={draft.photoUris}
        max={FLAG_PHOTO_MAX}
        busy={draft.photoBusy}
        error={draft.photoError}
        label={t.flag.photos}
        onAdd={(source) => void draft.addPhoto(source)}
        onRemove={(index) => {
          const uri = draft.photoUris[index];
          if (uri !== undefined) draft.removePhoto(uri);
        }}
      />
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, {color: theme.text}]}>{t.flag.type}</Text>
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
                <Text numberOfLines={1} style={[styles.typeText, {color: active ? kind.color : theme.text}]}>{typeLabel(o.id)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.twoColRow}>
        <View style={styles.col}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, {color: theme.text}]}>{t.flag.radius} (m)</Text>
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
        <View style={styles.col}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, {color: theme.text}]}>{t.hazards.ttl}</Text>
            {[60, 120, 240, 720, 1440].map((minutes) => (
              <Pressable
                key={minutes}
                style={[styles.ttlChip, {borderColor: draft.ttlMinutes === minutes ? theme.primary : theme.border, backgroundColor: draft.ttlMinutes === minutes ? `${theme.primary}22` : "transparent"}]}
                onPress={() => draft.setTtlMinutes(minutes)}
                accessibilityRole="button"
                accessibilityState={{checked: draft.ttlMinutes === minutes}}
              >
                <Text style={[styles.ttlText, {color: draft.ttlMinutes === minutes ? theme.primary : theme.text}]}>{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "700"},
  fieldBlock: {gap: 6},
  typeRow: {flexDirection: "row", gap: 8, justifyContent: "space-between"},
  typeBtn: {flex: 1, minWidth: 0, height: 48, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8},
  typeText: {fontSize: 12, fontWeight: "700", flexShrink: 1},
  twoColRow: {flexDirection: "row", alignItems: "flex-start", gap: 12},
  col: {flex: 1, minWidth: 0},
  labelRow: {flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap"},
  radiusChip: {minWidth: 34, height: 44, minHeight: 44, paddingHorizontal: 8, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center"},
  radiusText: {fontSize: 12, fontWeight: "700"},
  ttlChip: {minWidth: 38, height: 44, minHeight: 44, paddingHorizontal: 8, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center"},
  ttlText: {fontSize: 12, fontWeight: "700"},
  noteInput: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13},
});
