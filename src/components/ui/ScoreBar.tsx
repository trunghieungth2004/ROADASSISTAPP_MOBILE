import {StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";
import type {AppTheme} from "../../theme";

export default function ScoreBar({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: AppTheme;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const width = `${clamped}%` as `${number}%`;
  return (
    <View
      style={styles.block}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${clamped} / 100`}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <View style={styles.head}>
        <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.text }]}>{clamped}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "600" },
  value: { fontSize: 13, fontWeight: "700" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
