import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

export type PickerService = {
  code: string;
  name: string;
  displayPrice: number;
  quoteRequired: boolean;
  warrantyDays?: number;
  category?: string;
  channels?: string[];
  vehicleClasses?: string[];
};

type Props = {
  t: Strings;
  theme: AppTheme;
  catalog: PickerService[];
  selectedCodes: string[];
  onAdd: (services: PickerService[]) => void;
  onClose: () => void;
};

export default function ServicePickerSheet({t, theme, catalog, selectedCodes, onAdd, onClose}: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const needle = query.trim().toLowerCase();
  const rows = catalog.filter((service) => {
    if (needle === "") return true;
    return service.name.toLowerCase().includes(needle) ||
      service.code.toLowerCase().includes(needle) ||
      (service.category ?? "").toLowerCase().includes(needle);
  });
  const toggle = (code: string): void => {
    if (selectedCodes.includes(code)) return;
    setPicked((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]);
  };
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.provider.addServices}
      closeLabel={t.common.close}
      onClose={onClose}
      scrollable
      actions={[{
        label: t.provider.addSelected.replace("{n}", String(picked.length)),
        tone: "primary",
        disabled: picked.length === 0,
        onPress: () => {
          onAdd(catalog.filter((service) => picked.includes(service.code)));
          setPicked([]);
          onClose();
        },
      }]}
    >
      <View style={styles.body}>
        <View style={[styles.search, {borderColor: theme.border}]}>
          <MaterialIcons name="search" size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, {color: theme.text}]}
            value={query}
            onChangeText={setQuery}
            placeholder={t.provider.searchServices}
            placeholderTextColor={theme.muted}
            autoFocus
          />
          {query !== "" ? (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t.route.clear}>
              <MaterialIcons name="close" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>
        {rows.length === 0 ? <Text style={[styles.empty, {color: theme.muted}]}>{t.provider.noServices}</Text> : null}
        {rows.map((service) => {
          const already = selectedCodes.includes(service.code);
          const selected = picked.includes(service.code);
          const meta = [
            service.warrantyDays && service.warrantyDays > 0 ? `${service.warrantyDays}d` : null,
            service.category ?? null,
            ...(service.vehicleClasses ?? []),
          ].filter((value): value is string => typeof value === "string" && value !== "").join(" · ");
          return (
            <Pressable
              key={service.code}
              style={[styles.row, {borderColor: selected ? theme.primary : theme.border, opacity: already ? 0.45 : 1}]}
              onPress={() => toggle(service.code)}
              disabled={already}
              accessibilityRole="button"
              accessibilityLabel={service.name}
              accessibilityState={{selected}}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, {color: theme.text}]} numberOfLines={2}>{service.name}</Text>
                <Text style={[styles.meta, {color: theme.muted}]} numberOfLines={1}>
                  {[service.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice, meta].filter((value) => value !== "").join(" · ")}
                </Text>
              </View>
              <Text style={[styles.price, {color: theme.text}]}>{service.quoteRequired ? t.provider.serviceQuote : `${service.displayPrice.toLocaleString()} ₫`}</Text>
              <MaterialIcons name={already ? "check" : selected ? "check-circle" : "add-circle-outline"} size={20} color={selected || already ? theme.primary : theme.muted} />
            </Pressable>
          );
        })}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8},
  search: {borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6},
  searchInput: {flex: 1, fontSize: 14, padding: 0},
  empty: {fontSize: 12, textAlign: "center", paddingVertical: 16},
  row: {borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  rowText: {flex: 1, minWidth: 0, gap: 2},
  name: {fontSize: 14, fontWeight: "700"},
  meta: {fontSize: 11},
  price: {fontSize: 12, fontWeight: "700"},
});
