import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import {DOW, formatTimeInput, isOvernight, isValidTime, type Day} from "../../screens/more/shopHours";

type Props = {
  t: Strings;
  week: Record<Day, {enabled: boolean; open: string; close: string}>;
  setDay: (day: Day, patch: {enabled?: boolean; open?: string; close?: string}) => void;
};

const PRESETS: {open: string; close: string}[] = [
  {open: "07:00", close: "19:00"},
  {open: "08:00", close: "18:00"},
  {open: "08:00", close: "20:00"},
];

function applyAll(setDay: Props["setDay"], open: string, close: string, days: readonly Day[]): void {
  for (const day of days) setDay(day, {enabled: true, open, close});
}

export default function ShopHoursEditor({t, week, setDay}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={styles.editor}>
      <View style={styles.row}>
        <Pressable
          style={[styles.propagate, {borderColor: theme.primary}]}
          onPress={() => {
            const first = DOW.map((day) => week[day]).find((row) => row.enabled) ?? {open: "08:00", close: "18:00"};
            applyAll(setDay, first.open, first.close, DOW);
          }}
          accessibilityRole="button"
          accessibilityLabel={t.provider.sameEveryDay}
        >
          <MaterialIcons name="content-copy" size={16} color={theme.primary} />
          <Text style={[styles.propagateText, {color: theme.primary}]}>{t.provider.sameEveryDay}</Text>
        </Pressable>
        <Pressable
          style={[styles.propagate, {borderColor: theme.primary}]}
          onPress={() => applyAll(setDay, "08:00", "18:00", DOW.filter((day) => day !== "SUN"))}
          accessibilityRole="button"
          accessibilityLabel={t.provider.monToSat}
        >
          <MaterialIcons name="work" size={16} color={theme.primary} />
          <Text style={[styles.propagateText, {color: theme.primary}]}>{t.provider.monToSat}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {PRESETS.map((preset) => (
          <Pressable
            key={`${preset.open}-${preset.close}`}
            style={[styles.preset, {borderColor: theme.border}]}
            onPress={() => applyAll(setDay, preset.open, preset.close, DOW)}
            accessibilityRole="button"
            accessibilityLabel={`${preset.open}–${preset.close}`}
          >
            <Text style={[styles.presetText, {color: theme.text}]}>{`${preset.open}–${preset.close}`}</Text>
          </Pressable>
        ))}
      </View>
      {DOW.map((day, index) => {
        const row = week[day];
        const bad = row.enabled && (!isValidTime(row.open) || !isValidTime(row.close));
        const overnight = row.enabled && !bad && isOvernight(row.open, row.close);
        return (
          <View key={day} style={[styles.dayRow, index > 0 && {borderTopWidth: 1, borderTopColor: theme.divider}]}>
            <Pressable
              style={[styles.dayChip, {borderColor: row.enabled ? theme.primary : theme.border}, row.enabled && {backgroundColor: theme.primary}]}
              onPress={() => setDay(day, {enabled: !row.enabled})}
              accessibilityRole="button"
              accessibilityState={{checked: row.enabled}}
              accessibilityLabel={t.provider.days[day]}
            >
              {row.enabled ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
              <Text style={{color: row.enabled ? "#fff" : theme.text, fontWeight: "700"}}>{t.provider.days[day]}</Text>
            </Pressable>
            {row.enabled ? (
              <View style={styles.times}>
                <TextInput
                  style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]}
                  value={row.open}
                  onChangeText={(v) => setDay(day, {open: formatTimeInput(row.open, v)})}
                  placeholder="08:00"
                  placeholderTextColor={theme.muted}
                  maxLength={5}
                  keyboardType="numeric"
                />
                <Text style={{color: theme.muted}}>–</Text>
                <TextInput
                  style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]}
                  value={row.close}
                  onChangeText={(v) => setDay(day, {close: formatTimeInput(row.close, v)})}
                  placeholder="18:00"
                  placeholderTextColor={theme.muted}
                  maxLength={5}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <Text style={[styles.closed, {color: theme.muted}]}>{t.provider.closed}</Text>
            )}
            {overnight ? <Text style={[styles.nextDay, {color: theme.muted}]}>{t.provider.nextDay}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {gap: 4, width: "100%"},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  propagate: {borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6},
  propagateText: {fontSize: 13, fontWeight: "700"},
  preset: {borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12},
  presetText: {fontSize: 13, fontWeight: "600"},
  dayRow: {flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, flexWrap: "wrap"},
  dayChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 4},
  times: {flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 160},
  time: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center"},
  closed: {fontSize: 13, fontStyle: "italic"},
  nextDay: {fontSize: 11, width: "100%"},
});
