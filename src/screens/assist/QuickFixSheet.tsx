import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

export type QuickFixCatalogItem = {
  code: string;
  name: string;
  displayPrice: number;
};

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketLabel: string;
  catalog: QuickFixCatalogItem[];
  busy: boolean;
  error: string | null;
  onSubmit: (items: Array<{name: string; qty: number; unitPrice: number}>) => void;
  onClose: () => void;
};

export default function QuickFixSheet({t, theme, ticketLabel, catalog, busy, error, onSubmit, onClose}: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const items = catalog.filter((item) => (qty[item.code] ?? 0) > 0);
  const total = items.reduce(
    (sum, item) => sum + (qty[item.code] ?? 0) * item.displayPrice,
    0,
  );
  const bump = (code: string, delta: number): void => {
    setQty((prev) => {
      const next = Math.max(0, Math.min(10, (prev[code] ?? 0) + delta));
      return {...prev, [code]: next};
    });
    setLocalError(null);
  };
  const send = (): void => {
    if (items.length === 0) {
      setLocalError(t.provider.quickFixEmpty);
      return;
    }
    onSubmit(items.map((item) => ({
      name: item.name,
      qty: qty[item.code] ?? 1,
      unitPrice: item.displayPrice,
    })));
  };
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.provider.quickFix} · ${ticketLabel}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{
        label: `${t.provider.quickFix} · ${total.toLocaleString()} ₫`,
        tone: "primary",
        busy,
        disabled: items.length === 0,
        onPress: send,
      }]}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.quickFixHint}</Text>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.error, {color: theme.danger}]}>{localError}</Text> : null}
        {catalog.map((item) => {
          const count = qty[item.code] ?? 0;
          return (
            <View key={item.code} style={[styles.row, {borderColor: theme.border}]}>
              <View style={styles.rowText}>
                <Text style={[styles.name, {color: theme.text}]} numberOfLines={2}>{item.name}</Text>
                <Text style={[styles.price, {color: theme.muted}]}>{`${item.displayPrice.toLocaleString()} ₫`}</Text>
              </View>
              <Pressable style={[styles.step, {borderColor: theme.border}]} onPress={() => bump(item.code, -1)} accessibilityRole="button" accessibilityLabel={`- ${item.name}`}>
                <MaterialIcons name="remove" size={18} color={theme.text} />
              </Pressable>
              <Text style={[styles.count, {color: theme.text}]}>{count}</Text>
              <Pressable style={[styles.step, {borderColor: theme.border}]} onPress={() => bump(item.code, 1)} accessibilityRole="button" accessibilityLabel={`+ ${item.name}`}>
                <MaterialIcons name="add" size={18} color={theme.text} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  hint: {fontSize: 12},
  error: {fontSize: 12},
  row: {borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  rowText: {flex: 1, gap: 2},
  name: {fontSize: 14, fontWeight: "600"},
  price: {fontSize: 12},
  step: {width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  count: {minWidth: 20, textAlign: "center", fontSize: 14, fontWeight: "700"},
});
