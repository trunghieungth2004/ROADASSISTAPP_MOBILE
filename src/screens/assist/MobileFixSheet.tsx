import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";
import {formatAmountInput, parseAmountInput} from "./money";
import type {WorkItem} from "../../api/dispatch";

type Props = {
  t: Strings;
  ticketLabel: string;
  status: string;
  busy: boolean;
  error: string | null;
  initialAmount: number | null;
  initialItems?: WorkItem[] | null;
  catalog?: CatalogItem[];
  onSubmit: (amount: number, items?: Array<Pick<WorkItem, "name" | "qty" | "unitPrice" | "serviceCode">>) => void;
  onClose: () => void;
};

type ItemDraft = {name: string; qty: string; unitPrice: string; serviceCode?: string};
type CatalogItem = {code: string; name: string; displayPrice: number};

function draftsFrom(items: WorkItem[] | null | undefined): ItemDraft[] {
  return (items ?? []).map((item) => ({
    name: item.name,
    qty: String(item.qty),
    unitPrice: formatAmountInput(String(item.unitPrice)),
    ...(item.serviceCode ? {serviceCode: item.serviceCode} : {}),
  }));
}

export default function MobileFixSheet({
  t,
  ticketLabel,
  status,
  busy,
  error,
  initialAmount,
  initialItems,
  catalog,
  onSubmit,
  onClose,
}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [amount, setAmount] = useState(
    typeof initialAmount === "number" ? initialAmount.toLocaleString("en-US") : "",
  );
  const [items, setItems] = useState<ItemDraft[]>(() => draftsFrom(initialItems));
  const [localError, setLocalError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<ItemDraft>): void {
    setItems((prev) => prev.map((item, i) => i === index ? {...item, ...patch} : item));
    setLocalError(null);
  }

  function addItem(): void {
    setItems((prev) => [...prev, {name: "", qty: "1", unitPrice: ""}]);
    setLocalError(null);
  }

  function removeItem(index: number): void {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setLocalError(null);
  }

  function addCatalogItem(item: CatalogItem): void {
    setItems((prev) => [...prev, {
      name: item.name,
      qty: "1",
      unitPrice: formatAmountInput(String(item.displayPrice)),
      serviceCode: item.code,
    }]);
    setLocalError(null);
  }

  function itemTotal(): number {
    return items.reduce((sum, item) => {
      const qty = Number.parseInt(item.qty, 10);
      const price = parseAmountInput(item.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0 || price === null) return sum;
      return sum + qty * price;
    }, 0);
  }

  function submit(): void {
    const payloadItems = items.map((item) => ({
      name: item.name.trim(),
      qty: Number.parseInt(item.qty, 10),
      unitPrice: parseAmountInput(item.unitPrice),
      ...(item.serviceCode ? {serviceCode: item.serviceCode} : {}),
    }));
    const invalid = payloadItems.find((item) =>
      item.name === "" ||
      !Number.isInteger(item.qty) || item.qty < 1 ||
      item.unitPrice === null);
    if (invalid) {
      setLocalError(t.provider.invalidItem);
      return;
    }
    const cleanItems = payloadItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice as number,
      ...(item.serviceCode ? {serviceCode: item.serviceCode} : {}),
    }));
    const parsed = cleanItems.length > 0 ? itemTotal() : parseAmountInput(amount);
    if (parsed === null) {
      setLocalError(t.provider.invalidAmount);
      return;
    }
    setLocalError(null);
    onSubmit(parsed, cleanItems.length > 0 ? cleanItems : undefined);
  }

  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.assist.fixComplete} · ${ticketLabel}`}
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.mobileFixSave, tone: "primary", busy, onPress: submit}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        {catalog !== undefined && catalog.length > 0 ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.fixItems}</Text>
            <View style={styles.catalogRow}>
              {catalog.slice(0, 8).map((item) => (
                <Pressable
                  key={item.code}
                  style={[styles.catalogChip, {borderColor: theme.primary}]}
                  onPress={() => addCatalogItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={{color: theme.primary}}>{item.name}</Text>
                  <Text style={[styles.catalogPrice, {color: theme.muted}]}>{`${item.displayPrice.toLocaleString()} ₫`}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <View style={styles.itemsHead}>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.invoiceItems}</Text>
          <Pressable onPress={addItem} accessibilityRole="button" accessibilityLabel={t.provider.addItem}>
            <Text style={{color: theme.primary, fontWeight: "700"}}>{t.provider.addItem}</Text>
          </Pressable>
        </View>
        {items.map((item, index) => (
          <View key={`item-${index}`} style={styles.itemRow}>
            <TextInput
              style={[styles.input, styles.itemName, {borderColor: theme.border, color: theme.text}]}
              value={item.name}
              onChangeText={(value) => updateItem(index, {name: value})}
              placeholder={t.provider.itemName}
              placeholderTextColor={theme.muted}
            />
            <TextInput
              style={[styles.input, styles.itemQty, {borderColor: theme.border, color: theme.text}]}
              value={item.qty}
              onChangeText={(value) => updateItem(index, {qty: value.replace(/[^0-9]/g, "")})}
              placeholder={t.provider.qty}
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.itemPrice, {borderColor: theme.border, color: theme.text}]}
              value={item.unitPrice}
              onChangeText={(value) => updateItem(index, {unitPrice: formatAmountInput(value)})}
              placeholder={t.provider.unitPrice}
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
            />
            <Pressable onPress={() => removeItem(index)} accessibilityRole="button" accessibilityLabel={t.provider.removeItem} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={theme.danger} />
            </Pressable>
          </View>
        ))}
        {items.length === 0 ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.assist.mobileFixAmount}</Text>
            <TextInput
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              value={amount}
              onChangeText={(value) => {
                setAmount(formatAmountInput(value));
                setLocalError(null);
              }}
              placeholder="0"
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
              autoFocus
            />
          </>
        ) : (
          <View style={[styles.totalRow, {borderTopColor: theme.divider}]}>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.invoiceTotal}</Text>
            <Text style={[styles.total, {color: theme.text}]}>{`${itemTotal().toLocaleString()} ₫`}</Text>
          </View>
        )}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15},
  hint: {fontSize: 13},
  itemsHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  itemRow: {flexDirection: "row", alignItems: "center", gap: 6},
  itemName: {flex: 1, minWidth: 0},
  itemQty: {width: 46, textAlign: "center"},
  itemPrice: {width: 96},
  catalogRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  catalogChip: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10},
  catalogPrice: {fontSize: 11},
  totalRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 8},
  total: {fontSize: 16, fontWeight: "700"},
});
