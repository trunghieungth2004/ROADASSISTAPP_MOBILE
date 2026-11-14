import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

export default function MoreDashboardCard({
  t,
  theme,
  hasCases,
  casesSummary,
  onOpenDashboard,
  onOpenCases,
}: {
  t: Strings;
  theme: AppTheme;
  hasCases: boolean;
  casesSummary: string;
  onOpenDashboard: () => void;
  onOpenCases: () => void;
}) {
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <Pressable
        style={styles.row}
        onPress={onOpenDashboard}
        accessibilityRole="button"
        accessibilityLabel={t.more.dashboard}
      >
        <MaterialIcons name="insights" size={20} color={theme.primary} />
        <View style={styles.info}>
          <Text style={[styles.label, {color: theme.text}]}>{t.more.dashboard}</Text>
          <Text style={[styles.hint, {color: theme.muted}]}>{t.more.dashboardHint}</Text>
        </View>
      </Pressable>
      {hasCases ? (
        <>
          <View style={[styles.divider, {backgroundColor: theme.divider}]} />
          <Pressable
            style={styles.row}
            onPress={onOpenCases}
            accessibilityRole="button"
            accessibilityLabel={t.more.cases}
          >
            <MaterialIcons name="gavel" size={20} color={theme.primary} />
            <View style={styles.info}>
              <Text style={[styles.label, {color: theme.text}]}>{t.more.cases}</Text>
              <Text style={[styles.hint, {color: theme.muted}]}>{casesSummary}</Text>
            </View>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: 18, overflow: "hidden"},
  row: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 16},
  info: {flex: 1, gap: 2, minWidth: 0},
  label: {fontSize: 15, fontWeight: "500"},
  hint: {fontSize: 11, lineHeight: 15},
  divider: {height: 1, marginHorizontal: 16},
});
