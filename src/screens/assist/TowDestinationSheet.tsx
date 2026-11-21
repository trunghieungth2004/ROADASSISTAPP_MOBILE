import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";

export type TowPoint = {lat: number; lng: number; label?: string | null};

type Choice = {
  key: "CURRENT" | "ORIGIN";
  point: TowPoint | null;
  label: string;
  icon: "my-location" | "home";
};

type Props = {
  t: Strings;
  mode: "MOBILE" | "RETURN";
  pickupLabel: string;
  current?: TowPoint | null;
  origin?: TowPoint | null;
  destination: TowPoint | null;
  destinationLabel: string | null;
  onOpenSearch: () => void;
  busy: boolean;
  error: string | null;
  onConfirm: (point: TowPoint | null) => void;
  onClose: () => void;
};

function pointLabel(point: TowPoint | null | undefined): string | null {
  if (!point) return null;
  return point.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export default function TowDestinationSheet({
  t,
  mode,
  pickupLabel,
  current = null,
  origin = null,
  destination,
  destinationLabel,
  onOpenSearch,
  busy,
  error,
  onConfirm,
  onClose,
}: Props) {
  const theme = themeForMode(useAppMode());
  const [choice, setChoice] = useState<"CURRENT" | "ORIGIN">(
    current !== null ? "CURRENT" : "ORIGIN",
  );
  const options: Choice[] = mode === "RETURN" ? [
    {
      key: "CURRENT",
      point: current,
      label: t.assist.returnTowCurrent,
      icon: "my-location",
    },
    ...(origin !== null ? [{
      key: "ORIGIN" as const,
      point: origin,
      label: origin.label ?? t.assist.returnTowHome,
      icon: "home" as const,
    }] : []),
  ] : [];
  const choicePoint = choice === "CURRENT" ? current : origin;
  const selected = mode === "RETURN" ? destination ?? choicePoint : destination;
  const selectedLabel = mode === "RETURN" ?
    pointLabel(destination) ??
      pointLabel(choicePoint) ??
      (choice === "CURRENT" ?
        t.assist.returnTowCurrent :
        t.assist.returnTowHome) :
    destinationLabel;
  const canConfirm = mode === "RETURN" ?
    selected !== null :
    selectedLabel !== null;
  return (
    <Overlay
      visible
      variant="dialog"
      title={mode === "RETURN" ?
        t.assist.returnTowTitle :
        t.assist.mobileTowConfirmTitle}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{
        label: mode === "RETURN" ?
          t.assist.returnTowConfirm :
          t.assist.mobileTowConfirm,
        tone: "primary",
        busy,
        disabled: !canConfirm,
        onPress: () => onConfirm(selected),
      }]}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>
          {mode === "RETURN" ?
            t.assist.returnTowHint :
            t.assist.mobileTowConfirmHint}
        </Text>
        <View style={[styles.pointRow, {borderColor: theme.border}]}>
          <MaterialIcons name="my-location" size={20} color={theme.primary} />
          <View style={styles.pointText}>
            <Text style={[styles.label, {color: theme.muted}]}>
              {t.assist.mobileTowPickup}
            </Text>
            <Text style={[styles.value, {color: theme.text}]} numberOfLines={2}>
              {pickupLabel}
            </Text>
          </View>
        </View>
        <Pressable
          style={[styles.pointRow, {borderColor: theme.border}]}
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel={t.assist.mobileTowDropOff}
        >
          <MaterialIcons name="place" size={20} color={theme.primary} />
          <View style={styles.pointText}>
            <Text style={[styles.label, {color: theme.muted}]}>
              {t.assist.mobileTowDropOff}
            </Text>
            <Text
              style={[styles.value, {color: selectedLabel === null ? theme.muted : theme.text}]}
              numberOfLines={2}
            >
              {selectedLabel ?? t.assist.returnTowChoosePlace}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
        </Pressable>
        {options.map((option) => {
          const active = destination === null && choice === option.key;
          const disabled = option.point === null;
          return (
            <Pressable
              key={option.key}
              disabled={disabled}
              onPress={() => setChoice(option.key)}
              style={[
                styles.option,
                {
                  borderColor: active ? theme.primary : theme.border,
                  opacity: disabled ? 0.4 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
            >
              <MaterialIcons
                name={option.icon}
                size={20}
                color={active ? theme.primary : theme.muted}
              />
              <Text style={[styles.optionText, {color: active ? theme.primary : theme.text}]}>
                {option.label}
              </Text>
              {active ? (
                <MaterialIcons name="check-circle" size={18} color={theme.primary} />
              ) : null}
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
  pointRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pointText: {flex: 1, gap: 2},
  label: {fontSize: 11, fontWeight: "600"},
  value: {fontSize: 14, fontWeight: "600"},
  option: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionText: {flex: 1, fontSize: 14, fontWeight: "600"},
});
