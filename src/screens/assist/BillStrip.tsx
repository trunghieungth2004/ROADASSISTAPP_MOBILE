import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Bill} from "../../api/bills";
import type {Strings} from "../../i18n/en";
import {onColor, type AppTheme} from "../../theme";

type Props = {
  t: Strings;
  theme: AppTheme;
  bills: Bill[];
  dueCount: number;
  dueTotal: number;
  onOpen: () => void;
};

export default function BillStrip({t, theme, bills, dueCount, dueTotal, onOpen}: Props) {
  if (bills.length === 0) return null;
  const due = dueCount > 0;
  const title = due ? (dueCount === 1 ? t.bills.dueOne : t.bills.dueMany.replace("{n}", String(dueCount))) : t.bills.title;
  const meta = due ? t.bills.outstanding.replace("{amount}", dueTotal.toLocaleString()) : t.bills.allSettled;
  return (
    <Pressable
      style={[styles.strip, {borderColor: due ? theme.primary : theme.border, backgroundColor: due ? `${theme.primary}14` : theme.background}]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${title} · ${meta}`}
    >
      <View style={[styles.icon, {backgroundColor: due ? theme.primary : theme.border}]}>
        <MaterialIcons name="receipt-long" size={17} color={due ? onColor(theme.primary) : theme.muted} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
        <Text style={[styles.meta, {color: due ? theme.danger : theme.muted}]}>{meta}</Text>
      </View>
      <Text style={[styles.link, {color: theme.primary}]}>{t.bills.view}</Text>
      <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10},
  icon: {width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center"},
  body: {flex: 1, gap: 1},
  title: {fontSize: 13, fontWeight: "700"},
  meta: {fontSize: 11},
  link: {fontSize: 12, fontWeight: "700"},
});
