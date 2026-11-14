import {View, StyleSheet} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";

export type DashboardStat = {label: string; value: string};
export type DashboardBar = {label: string; value: number; display: string};

export type DashboardData = {
  mode: "RIDER" | "PROVIDER";
  stats: DashboardStat[];
  monthly: DashboardBar[];
  breakdown: DashboardBar[];
};

function Bars({
  title,
  rows,
  color,
  muted,
  empty,
}: {
  title: string;
  rows: DashboardBar[];
  color: string;
  muted: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, {color: muted}]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={[styles.empty, {color: muted}]}>{empty}</Text>
      ) : rows.map((row) => (
        <View key={row.label} style={styles.barRow}>
          <View style={styles.barHead}>
            <Text style={[styles.barLabel, {color: muted}]}>{row.label}</Text>
            <Text style={[styles.barValue, {color: muted}]}>{row.display}</Text>
          </View>
          <View style={[styles.track, {backgroundColor: `${color}22`}]}>
            <View style={[styles.fill, {backgroundColor: color, width: `${Math.max(4, (row.value / max) * 100)}%`}]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Columns({
  title,
  rows,
  color,
  muted,
  empty,
}: {
  title: string;
  rows: DashboardBar[];
  color: string;
  muted: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, {color: muted}]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={[styles.empty, {color: muted}]}>{empty}</Text>
      ) : (
        <View style={styles.columns}>
          {rows.map((row) => (
            <View key={row.label} style={styles.column}>
              <Text style={[styles.columnValue, {color: muted}]}>{row.display}</Text>
              <View style={styles.columnTrack}>
                <View style={[styles.columnBar, {
                  backgroundColor: color,
                  height: Math.max(6, (row.value / max) * 112),
                }]} />
              </View>
              <Text style={[styles.columnLabel, {color: muted}]}>{row.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function DashboardView({t, data}: {t: Strings; data: DashboardData}) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const accent = data.mode === "RIDER" ? theme.primary : theme.success;
  return (
    <View style={styles.body}>
      <View style={styles.statGrid}>
        {data.stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, {borderColor: theme.border, backgroundColor: theme.paper}]}>
            <Text style={[styles.statLabel, {color: theme.muted}]}>{stat.label}</Text>
            <Text style={[styles.statValue, {color: theme.text}]}>{stat.value}</Text>
          </View>
        ))}
      </View>
      <Columns
        title={t.more.dashboardMonthly}
        rows={data.monthly}
        color={accent}
        muted={theme.muted}
        empty={t.more.dashboardNoActivity}
      />
      <Bars
        title={data.mode === "RIDER" ? t.more.dashboardByService : t.more.dashboardJobs}
        rows={data.breakdown}
        color={accent}
        muted={theme.muted}
        empty={t.more.dashboardNoActivity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 18, width: "100%"},
  statGrid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  statCard: {borderWidth: 1, borderRadius: 12, padding: 12, minWidth: "47%", flexGrow: 1, gap: 3},
  statLabel: {fontSize: 11},
  statValue: {fontSize: 18, fontWeight: "700"},
  section: {gap: 8},
  sectionTitle: {fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5},
  empty: {fontSize: 12},
  barRow: {gap: 4},
  columns: {flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 166, gap: 6, paddingTop: 8},
  column: {flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end"},
  columnValue: {fontSize: 8, textAlign: "center"},
  columnTrack: {height: 112, width: "100%", justifyContent: "flex-end", alignItems: "center"},
  columnBar: {width: "72%", borderRadius: 4},
  columnLabel: {fontSize: 9, textAlign: "center"},
  barHead: {flexDirection: "row", justifyContent: "space-between", gap: 8},
  barLabel: {fontSize: 12},
  barValue: {fontSize: 12, fontWeight: "600"},
  track: {height: 8, borderRadius: 4, overflow: "hidden"},
  fill: {height: 8, borderRadius: 4},
});
