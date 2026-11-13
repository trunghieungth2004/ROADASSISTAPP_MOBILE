import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";

export type ReturnTowPoint = {lat: number; lng: number; label?: string | null};

type Props = {
  t: Strings;
  current: ReturnTowPoint | null;
  origin: ReturnTowPoint | null;
  destination: ReturnTowPoint | null;
  onOpenSearch: () => void;
  busy: boolean;
  error: string | null;
  onConfirm: (point: ReturnTowPoint) => void;
  onClose: () => void;
};

export default function ReturnTowSheet({t, current, origin, destination, onOpenSearch, busy, error, onConfirm, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [choice, setChoice] = useState<"CURRENT" | "ORIGIN">(
    current !== null ? "CURRENT" : "ORIGIN",
  );
  const selected = destination ?? (choice === "CURRENT" ? current : origin);
  const destinationLabel = destination?.label ?? (destination !== null ? `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}` : null);
  const options: Array<{key: "CURRENT" | "ORIGIN"; point: ReturnTowPoint | null; label: string}> = [
    {key: "CURRENT", point: current, label: t.assist.returnTowCurrent},
    ...(origin !== null ? [{key: "ORIGIN" as const, point: origin, label: origin.label ?? t.assist.returnTowHome}] : []),
  ];
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.assist.returnTowTitle}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.returnTowConfirm, tone: "primary", busy, disabled: selected === null, onPress: () => { if (selected) onConfirm(selected); }}]}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.returnTowHint}</Text>
        <Pressable style={[styles.searchField, {borderColor: theme.border}]} onPress={onOpenSearch} accessibilityRole="button" accessibilityLabel={t.assist.returnTowDropOff}>
          <MaterialIcons name="place" size={20} color={theme.primary} />
          <Text style={[styles.searchText, {color: destinationLabel === null ? theme.muted : theme.text}]} numberOfLines={1}>
            {destinationLabel ?? t.assist.returnTowChoosePlace}
          </Text>
          
        </Pressable>
        {options.map((option) => {
          const active = choice === option.key;
          const disabled = option.point === null;
          return (
            <Pressable key={option.key} disabled={disabled} onPress={() => setChoice(option.key)} style={[styles.option, {borderColor: active ? theme.primary : theme.border, opacity: disabled ? 0.4 : 1}]} accessibilityRole="button">
              <MaterialIcons name={option.key === "CURRENT" ? "my-location" : "home"} size={20} color={active ? theme.primary : theme.muted} />
              <Text style={[styles.optionText, {color: active ? theme.primary : theme.text}]}>{option.label}</Text>
              {active ? <MaterialIcons name="check-circle" size={18} color={theme.primary} /> : null}
            </Pressable>
          );
        })}
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  hint: {fontSize: 13, lineHeight: 19},
  option: {borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10},
  optionText: {flex: 1, fontSize: 14, fontWeight: "600"},
  searchField: {borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8},
  searchText: {flex: 1, fontSize: 14, fontWeight: "600"},
});
