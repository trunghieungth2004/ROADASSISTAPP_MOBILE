import {useState} from "react";
import {Pressable, StyleSheet, TextInput, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import type {Strings} from "../../i18n/en";
import { formatDateDMY, parseDateDMY } from "../../utils/date";

type Props = {
  t: Strings;
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / DAY_MS) + 1;
}

export default function RangePickerSheet({t, startDate, endDate, onApply, onClose}: Props) {
  const theme = themeForMode(useAppMode());
  const [start, setStart] = useState(formatDateDMY(startDate));
  const [end, setEnd] = useState(formatDateDMY(endDate));
  const [error, setError] = useState<string | null>(null);

  function apply(): void {
    const startIso = parseDateDMY(start);
    const endIso = parseDateDMY(end);
    if (startIso === null || endIso === null) {
      setError(t.more.dashboardRangeInvalid);
      return;
    }
    const span = daysBetween(startIso, endIso);
    if (span < 1) {
      setError(t.more.dashboardRangeInvalid);
      return;
    }
    if (span > 365) {
      setError(t.more.dashboardRangeTooLong);
      return;
    }
    setError(null);
    onApply(startIso, endIso);
  }

  function preset(days: number): void {
    setStart(formatDateDMY(dayKey(-(days - 1))));
    setEnd(formatDateDMY(dayKey(0)));
    setError(null);
  }

  return (
    <Overlay
      visible
      variant="dialog"
      title={t.more.dashboardCustom}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.more.dashboardApply, tone: "primary", onPress: apply}]}
    >
      <View style={styles.body}>
        <View style={styles.presetRow}>
          {[7, 30, 90, 365].map((days) => (
            <Pressable
              key={days}
              style={[styles.preset, {borderColor: theme.border}]}
              onPress={() => preset(days)}
              accessibilityRole="button"
            >
              <Text style={[styles.presetText, {color: theme.text}]}>
                {days === 7 ? t.more.dashboardLast7 :
                  days === 30 ? t.more.dashboardLast30 :
                    days === 90 ? t.more.dashboardLast90 :
                      t.more.dashboardLast365}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={[styles.label, {color: theme.muted}]}>{t.more.dashboardFrom}</Text>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={theme.muted}
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, {color: theme.muted}]}>{t.more.dashboardTo}</Text>
            <TextInput
              value={end}
              onChangeText={setEnd}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={theme.muted}
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 12},
  presetRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  preset: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  presetText: {fontSize: 12, fontWeight: "600"},
  fieldRow: {flexDirection: "row", gap: 10},
  field: {flex: 1, gap: 4},
  label: {fontSize: 11, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14},
  error: {fontSize: 12, lineHeight: 17},
});
