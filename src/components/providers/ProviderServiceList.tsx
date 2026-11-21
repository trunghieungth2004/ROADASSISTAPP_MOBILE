import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {ServiceDraft} from "./useProviderDraft";
import ServiceCategoryIcon from "./ServiceCategoryIcon";
import {VehicleClassIcons} from "../vehicles/VehicleIcons";

type Props = {
  t: Strings;
  theme: AppTheme;
  rows: ServiceDraft[];
  onEdit: (index: number, service: ServiceDraft) => void;
  onAdd: () => void;
};

function classLabel(classes: string[], t: Strings): string {
  return classes.map((cls) => cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike).join(" · ");
}

function summary(row: ServiceDraft, t: Strings): string {
  return [
    row.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice,
    row.warrantyDays !== "" ? `${row.warrantyDays}d` : null,
    row.channels.map((channel) => channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist).join(" / "),
  ].filter((value): value is string => typeof value === "string" && value !== "").join(" · ");
}

export default function ProviderServiceList({t, theme, rows, onEdit, onAdd}: Props) {
  return (
    <View style={styles.block}>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.servicesTitle}</Text>
      <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.serviceHint}</Text>
      {rows.map((row, index) => (
        <Pressable
          key={`${index}-${row.code}`}
          style={[styles.card, {borderColor: theme.border}]}
          onPress={() => onEdit(index, row)}
          accessibilityRole="button"
          accessibilityLabel={`${t.provider.editService}: ${row.name || t.provider.serviceName}`}
        >
          <ServiceCategoryIcon category={row.category} size={20} color={theme.primary} />
          <View style={styles.body}>
            <Text style={[styles.name, {color: theme.text}]} numberOfLines={1}>{row.name || t.provider.serviceName}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.hint, {color: theme.muted}]} numberOfLines={2}>{summary(row, t)}</Text>
              <VehicleClassIcons
                classes={row.vehicleClasses}
                size={12}
                color={theme.muted}
                label={classLabel(row.vehicleClasses, t)}
              />
            </View>
          </View>
          <Text style={[styles.price, {color: theme.text}]}>{row.price === "" ? "0" : row.price} ₫</Text>
          <MaterialIcons name="edit" size={20} color={theme.primary} />
        </Pressable>
      ))}
      <Pressable
        style={[styles.add, {borderColor: theme.primary}]}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t.provider.addService}
      >
        <MaterialIcons name="add" size={16} color={theme.primary} />
        <Text style={{color: theme.primary}}>{t.provider.serviceAdd}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {gap: 8, paddingTop: 4},
  label: {fontSize: 13, fontWeight: "700"},
  hint: {fontSize: 12, lineHeight: 17},
  card: {borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56},
  body: {flex: 1, minWidth: 0, gap: 2},
  name: {fontSize: 14, fontWeight: "700"},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap"},
  price: {fontSize: 13, fontWeight: "800"},
  add: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start"},
});
