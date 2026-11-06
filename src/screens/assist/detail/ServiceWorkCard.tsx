import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import type {AppTheme} from "../../../theme";
import type {WorkItem} from "../../../api/dispatch";
import {CardHead, DetailCard, detailStyles} from "./parts";

type Props = {
  t: Strings;
  theme: AppTheme;
  workType: string | null;
  items: WorkItem[];
  warrantyRework?: boolean;
};

export default function ServiceWorkCard({t, theme, workType, items, warrantyRework = false}: Props) {
  if (workType === null && items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (typeof item.amount === "number" ? item.amount : item.qty * item.unitPrice), 0);
  return (
    <DetailCard theme={theme}>
      <CardHead theme={theme} icon="build" title={t.provider.servicesWork} right={warrantyRework ? (
        <View style={[styles.pill, {backgroundColor: theme.primary}]}>
          <Text style={styles.pillText}>{t.provider.warrantyRework}</Text>
        </View>
      ) : undefined} />
      {workType !== null ? (
        <View style={styles.workRow}>
          <Text style={[styles.small, {color: theme.muted}]}>{t.provider.workType}</Text>
          <Text style={[styles.workValue, {color: theme.text}]}>{workType}</Text>
        </View>
      ) : null}
      {items.map((item, index) => (
        <View key={`${item.serviceCode ?? item.name}-${index}`} style={[styles.item, {borderColor: theme.divider}]}>
          <View style={detailStyles.rowBetween}>
            <Text style={[styles.name, {color: theme.text}]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.amount, {color: theme.text}]}>{`${(item.amount ?? item.qty * item.unitPrice).toLocaleString()} VND`}</Text>
          </View>
          <Text style={[styles.small, {color: theme.muted}]}>
            {`${item.qty} × ${item.unitPrice.toLocaleString()} VND`}
            {item.warrantyUntil ? ` · ${t.bills.warranty}: ${new Date(item.warrantyUntil).toLocaleDateString()}` :
              item.warrantyDays && item.warrantyDays > 0 ? ` · ${t.bills.warranty}: ${item.warrantyDays}d` : ""}
          </Text>
        </View>
      ))}
      {items.length > 0 ? (
        <View style={[styles.total, {borderTopColor: theme.divider}]}>
          <Text style={[styles.name, {color: theme.text}]}>{t.bills.total}</Text>
          <Text style={[styles.amount, {color: theme.text}]}>{`${total.toLocaleString()} VND`}</Text>
        </View>
      ) : null}
      {items.length === 0 ? <Text style={[styles.small, {color: theme.muted}]}>{t.provider.noServices}</Text> : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  workRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  workValue: {fontSize: 12, fontWeight: "700", flexShrink: 1},
  item: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, gap: 2},
  name: {fontSize: 13, fontWeight: "700", flex: 1},
  amount: {fontSize: 12, fontWeight: "700"},
  small: {fontSize: 11, lineHeight: 16},
  total: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
});
