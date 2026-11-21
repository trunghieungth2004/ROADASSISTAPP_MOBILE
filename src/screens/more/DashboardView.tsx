import {Pressable, View, StyleSheet} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import { serviceColor } from "../assist/serviceColors";

export type DashboardBar = {label: string; value: number; display: string; date?: string};
export type DashboardKpiIcon = "route" | "task-alt" | "bolt" | "star" | "assignment-turned-in" | "event" | "hourglass-empty" | "percent";
export type DashboardKpi = {label: string; value: string; change?: number; icon?: DashboardKpiIcon};
export type DashboardHero = {
  label: string;
  value: string;
  change?: number;
  series: number[];
};

export type DashboardData = {
  mode: "RIDER" | "PROVIDER";
  lastUpdated: string;
  hero: DashboardHero;
  stats: DashboardKpi[];
  activity: DashboardBar[];
  breakdown: DashboardBar[];
  serviceTypes: DashboardBar[];
  topService: string;
  serviceCount: number;
};

function Sparkline({values, color}: {values: number[]; color: string}) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.spark}>
      {values.map((value, index) => (
        <View
          key={`${index}-${value}`}
          style={[styles.sparkBar, {
            height: Math.max(3, (value / max) * 38),
            backgroundColor: color,
            opacity: 0.35 + (0.65 * (index + 1)) / Math.max(1, values.length),
          }]}
        />
      ))}
    </View>
  );
}

function Delta({change, label, theme}: {change: number; label: string; theme: ReturnType<typeof themeForMode>}) {
  const up = change > 0;
  const flat = change === 0;
  const color = flat ? theme.muted : up ? theme.success : theme.danger;
  return (
    <View style={styles.deltaRow}>
      <MaterialIcons
        name={flat ? "remove" : up ? "trending-up" : "trending-down"}
        size={15}
        color={color}
      />
      <Text style={[styles.deltaText, {color}]}>
        {`${up ? "+" : ""}${change.toFixed(1)}%`}
      </Text>
      <Text style={[styles.deltaLabel, {color: theme.muted}]}>{label}</Text>
    </View>
  );
}

function HeroCard({data, label, accent}: {data: DashboardHero; label: string; accent: string}) {
  const theme = themeForMode(useAppMode());
  return (
    <View style={[styles.hero, {borderColor: `${accent}55`, backgroundColor: `${accent}0d`}]}>
      <Text style={[styles.heroLabel, {color: theme.muted}]}>{data.label}</Text>
      <Text style={[styles.heroValue, {color: theme.text}]}>{data.value}</Text>
      {data.change !== undefined ? <Delta change={data.change} label={label} theme={theme} /> : null}
      <Sparkline values={data.series} color={accent} />
    </View>
  );
}

function KpiGrid({stats, tint}: {stats: DashboardKpi[]; tint: string}) {
  const theme = themeForMode(useAppMode());
  return (
    <View style={styles.statGrid}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.statCard, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <View style={styles.statHead}>
            {stat.icon ? <MaterialIcons name={stat.icon} size={15} color={tint} /> : null}
            <Text style={[styles.statLabel, {color: theme.muted}]}>{stat.label}</Text>
          </View>
          <Text style={[styles.statValue, {color: theme.text}]}>{stat.value}</Text>
          {stat.change !== undefined ? (
            <View style={styles.statDelta}>
              <MaterialIcons
                name={stat.change === 0 ? "remove" : stat.change > 0 ? "trending-up" : "trending-down"}
                size={13}
                color={stat.change === 0 ? theme.muted : stat.change > 0 ? theme.success : theme.danger}
              />
              <Text style={[styles.statDeltaText, {
                color: stat.change === 0 ? theme.muted : stat.change > 0 ? theme.success : theme.danger,
              }]}>
                {`${stat.change > 0 ? "+" : ""}${stat.change.toFixed(1)}%`}
              </Text>
            </View>
          ) : (
            <View style={[styles.statDot, {backgroundColor: tint}]} />
          )}
        </View>
      ))}
    </View>
  );
}

function Activity({rows, color, muted, empty, onSelectDate}: {
  rows: DashboardBar[];
  color: string;
  muted: string;
  empty: string;
  onSelectDate?: (date: string) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <Text style={[styles.empty, {color: muted}]}>{empty}</Text>;
  }
  return (
    <View style={styles.columns}>
      {rows.map((row) => (
        <Pressable
          key={row.label}
          style={styles.column}
          onPress={() => row.date ? onSelectDate?.(row.date) : undefined}
          accessibilityRole="button"
          accessibilityLabel={row.date ?? row.label}
        >
          <View style={styles.columnTrack}>
            <View style={[styles.columnBar, {
              backgroundColor: color,
              height: Math.max(6, (row.value / max) * 104),
            }]} />
          </View>
          <Text style={[styles.columnLabel, {color: muted}]} numberOfLines={1} allowFontScaling={false}>{row.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RankedBars({rows, color, muted, empty, topService}: {
  rows: DashboardBar[];
  color: string;
  muted: string;
  empty: string;
  topService: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.section}>
      {topService !== "-" ? (
        <View style={[styles.topServicePill, {borderColor: `${color}55`, backgroundColor: `${color}12`}]}>
          <MaterialIcons name="local-fire-department" size={15} color={color} />
          <Text style={[styles.topServiceText, {color}]} numberOfLines={1}>{topService}</Text>
        </View>
      ) : null}
      {rows.length === 0 ? (
        <Text style={[styles.empty, {color: muted}]}>{empty}</Text>
      ) : rows.map((row) => (
        <View key={row.label} style={styles.barRow}>
          <View style={styles.barHead}>
            <Text style={[styles.barLabel, {color: muted}]} numberOfLines={1}>{row.label}</Text>
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

function ServiceTypes({rows, muted, empty}: {rows: DashboardBar[]; muted: string; empty: string}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (rows.length === 0) return <Text style={[styles.empty, {color: muted}]}>{empty}</Text>;
  return (
    <View style={styles.section}>
      <View style={styles.typeBar}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              flex: Math.max(1, row.value),
              backgroundColor: serviceColor(row.label),
            }}
          />
        ))}
      </View>
      <View style={styles.typeLegend}>
        {rows.map((row) => (
          <View key={row.label} style={styles.typeLegendRow}>
            <View style={[styles.typeDot, {backgroundColor: serviceColor(row.label)}]} />
            <Text style={[styles.typeLabel, {color: muted}]} numberOfLines={1}>{row.label}</Text>
            <Text style={[styles.typeValue, {color: muted}]}>
              {`${row.value} · ${Math.round((row.value / Math.max(1, total)) * 100)}%`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DashboardSkeleton({t}: {t: Strings}) {
  const theme = themeForMode(useAppMode());
  return (
    <View style={styles.body}>
      <View style={[styles.hero, {borderColor: theme.border, backgroundColor: theme.paper}]}>
        <View style={[styles.skeletonLine, {width: "32%", backgroundColor: theme.divider}]} />
        <View style={[styles.skeletonValue, {backgroundColor: theme.divider}]} />
        <View style={[styles.skeletonLine, {width: "48%", backgroundColor: theme.divider}]} />
      </View>
      <View style={styles.statGrid}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.statCard, {borderColor: theme.border, backgroundColor: theme.paper}]}>
            <View style={[styles.skeletonLine, {width: "58%", backgroundColor: theme.divider}]} />
            <View style={[styles.skeletonSmall, {backgroundColor: theme.divider}]} />
          </View>
        ))}
      </View>
      <Text style={[styles.loadingText, {color: theme.muted}]}>{t.common.loading}</Text>
    </View>
  );
}

export default function DashboardView({t, data, onSelectDate}: {t: Strings; data: DashboardData; onSelectDate?: (date: string) => void}) {
  const theme = themeForMode(useAppMode());
  const accent = data.mode === "RIDER" ? theme.primary : theme.success;
  return (
    <View style={styles.body}>
      <HeroCard data={data.hero} label={t.more.dashboardVsPrevious} accent={accent} />
      <KpiGrid stats={data.stats} tint={accent} />
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.muted}]}>{t.more.dashboardActivity}</Text>
        <Activity rows={data.activity} color={accent} muted={theme.muted} empty={t.more.dashboardNoActivity} onSelectDate={onSelectDate} />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.muted}]}>{t.more.dashboardTopServices}</Text>
        <RankedBars
          rows={data.breakdown}
          color={accent}
          muted={theme.muted}
          empty={t.more.dashboardNoActivity}
          topService={data.topService}
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.muted}]}>{t.more.dashboardServiceTypes}</Text>
        <ServiceTypes rows={data.serviceTypes} muted={theme.muted} empty={t.more.dashboardNoActivity} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 18, width: "100%"},
  hero: {borderWidth: 1, borderRadius: 18, padding: 16, gap: 5},
  heroLabel: {fontSize: 12, fontWeight: "600"},
  heroValue: {fontSize: 30, fontWeight: "800", letterSpacing: -0.5},
  deltaRow: {flexDirection: "row", alignItems: "center", gap: 3},
  deltaText: {fontSize: 12, fontWeight: "700"},
  deltaLabel: {fontSize: 11},
  spark: {flexDirection: "row", alignItems: "flex-end", gap: 3, height: 42, marginTop: 4},
  sparkBar: {flex: 1, borderRadius: 2, minWidth: 2},
  statGrid: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  statCard: {borderWidth: 1, borderRadius: 14, padding: 12, minWidth: "47%", flexGrow: 1, gap: 3},
  statHead: {flexDirection: "row", alignItems: "center", gap: 4},
  statLabel: {fontSize: 11},
  statValue: {fontSize: 19, fontWeight: "700"},
  statDelta: {flexDirection: "row", alignItems: "center", gap: 2},
  statDeltaText: {fontSize: 10, fontWeight: "600"},
  statDot: {width: 18, height: 3, borderRadius: 2, marginTop: 2},
  section: {gap: 8},
  sectionTitle: {fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5},
  empty: {fontSize: 12},
  columns: {flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 144, gap: 6, paddingTop: 6},
  column: {flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end"},
  columnTrack: {height: 104, width: "100%", justifyContent: "flex-end", alignItems: "center"},
  columnBar: {width: "68%", borderRadius: 4},
  columnLabel: {fontSize: 9, textAlign: "center"},
  barRow: {gap: 4},
  barHead: {flexDirection: "row", justifyContent: "space-between", gap: 8},
  barLabel: {fontSize: 12, flexShrink: 1},
  barValue: {fontSize: 12, fontWeight: "600"},
  track: {height: 9, borderRadius: 5, overflow: "hidden"},
  fill: {height: 9, borderRadius: 5},
  topServicePill: {flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, maxWidth: "100%"},
  topServiceText: {fontSize: 11, fontWeight: "700", flexShrink: 1},
  typeBar: {flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2},
  typeLegend: {gap: 6},
  typeLegendRow: {flexDirection: "row", alignItems: "center", gap: 6},
  typeDot: {width: 8, height: 8, borderRadius: 4},
  typeLabel: {fontSize: 12, flex: 1},
  typeValue: {fontSize: 11, fontWeight: "600"},
  skeletonLine: {height: 10, borderRadius: 5},
  skeletonValue: {height: 28, width: "55%", borderRadius: 8},
  skeletonSmall: {height: 18, width: "42%", borderRadius: 6, marginTop: 4},
  loadingText: {fontSize: 12, textAlign: "center"},
});
