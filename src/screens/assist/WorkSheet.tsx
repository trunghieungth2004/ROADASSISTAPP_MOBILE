import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {statusPillColor, ticketStatusLabel} from "./ticketLabels";
import {formatAmountInput, parseAmountInput} from "./money";
import type {WorkItem} from "../../api/dispatch";
import ServicePickerSheet, {type PickerService} from "./ServicePickerSheet";

export type WorkFormMode = "quote" | "done";

export type WorkFormValue = {
  workType: string;
  amount: number | null;
  invoiceRef: string;
  warrantyDays?: number;
  items?: Array<Pick<WorkItem, "name" | "qty" | "unitPrice" | "serviceCode">>;
};

type CatalogItem = PickerService;

type ItemDraft = {
  name: string;
  qty: string;
  unitPrice: string;
  serviceCode?: string;
};

type Props = {
  t: Strings;
  ticketLabel: string;
  mode: WorkFormMode;
  status: string;
  busy: boolean;
  error: string | null;
  initialWorkType?: string | null;
  initialInvoiceRef?: string | null;
  initialItems?: WorkItem[] | null;
  catalog?: CatalogItem[];
  onSubmit: (value: WorkFormValue) => void;
  onClose: () => void;
};

function draftsFrom(items: WorkItem[] | null | undefined): ItemDraft[] {
  return (items ?? []).map((item) => ({
    name: item.name,
    qty: String(item.qty),
    unitPrice: formatAmountInput(String(item.unitPrice)),
    ...(item.serviceCode ? {serviceCode: item.serviceCode} : {}),
  }));
}

export default function WorkSheet({t, ticketLabel, mode, status, busy, error, initialWorkType, initialInvoiceRef, initialItems, catalog, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  const [workType, setWorkType] = useState(typeof initialWorkType === "string" ? initialWorkType : "");
  const [amount, setAmount] = useState("");
  const [invoiceRef, setInvoiceRef] = useState(typeof initialInvoiceRef === "string" ? initialInvoiceRef : "");
  const [warrantyDays, setWarrantyDays] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() => draftsFrom(initialItems));
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function updateItem(index: number, patch: Partial<ItemDraft>): void {
    setItems((prev) => prev.map((item, i) => i === index ? {...item, ...patch} : item));
    setLocalError(null);
  }

  function addItem(): void {
    setItems((prev) => [...prev, {name: "", qty: "1", unitPrice: ""}]);
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

  function removeItem(index: number): void {
    setItems((prev) => prev.filter((_, i) => i !== index));
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

  function send(): void {
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
    if (mode === "quote") {
      const parsed = cleanItems.length > 0 ? itemTotal() : parseAmountInput(amount);
      if (parsed === null || parsed <= 0) {
        setLocalError(t.provider.invalidAmount);
        return;
      }
      setLocalError(null);
      onSubmit({
        workType: workType.trim(),
        amount: parsed,
        invoiceRef: "",
        ...(cleanItems.length > 0 ? {items: cleanItems} : {}),
      });
      return;
    }
    const warranty = warrantyDays.trim() === "" ? null :
      Number.parseInt(warrantyDays.replace(/[^0-9]/g, ""), 10);
    if (warranty !== null &&
      (!Number.isInteger(warranty) || warranty < 0 || warranty > 90)) {
      setLocalError(t.provider.invalidWarranty);
      return;
    }
    setLocalError(null);
    onSubmit({
      workType: workType.trim(),
      amount: null,
      invoiceRef: invoiceRef.trim(),
      ...(warranty !== null && warranty > 0 ? {warrantyDays: warranty} : {}),
      ...(cleanItems.length > 0 ? {items: cleanItems} : {}),
    });
  }

  return (
    <>
    <Overlay
      visible
      variant="dialog"
      title={`${mode === "quote" ? t.assist.sendQuote : t.provider.workDone} · ${ticketLabel}`}
      right={
        <View style={[styles.pill, {backgroundColor: statusPillColor(status, theme)}]}>
          <Text style={styles.pillText}>{ticketStatusLabel(status, t)}</Text>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: mode === "quote" ? t.assist.sendQuote : t.provider.saveWork, tone: "primary", busy, onPress: send}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.workType}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={workType}
          onChangeText={setWorkType}
          placeholder={t.provider.workPlaceholder}
          placeholderTextColor={theme.muted}
        />
        {mode === "done" ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.warrantyDays}</Text>
            <TextInput
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              value={warrantyDays}
              onChangeText={setWarrantyDays}
              placeholder="30"
              placeholderTextColor={theme.muted}
              keyboardType="number-pad"
            />
          </>
        ) : null}
        {mode === "quote" && catalog !== undefined && catalog.length > 0 ? (
          <Pressable
            style={[styles.addServices, {borderColor: theme.primary}]}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.provider.addServices}
          >
            <MaterialIcons name="playlist-add" size={18} color={theme.primary} />
            <Text style={{color: theme.primary, fontWeight: "700"}}>{t.provider.addServices}</Text>
          </Pressable>
        ) : null}
        <View style={styles.itemsHead}>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.invoiceItems}</Text>
          <Pressable onPress={addItem} accessibilityRole="button" accessibilityLabel={t.provider.addItem}>
            <Text style={{color: theme.primary, fontWeight: "700"}}>{t.provider.addItem}</Text>
          </Pressable>
        </View>
        {items.map((item, index) => {
          const service = catalog?.find((row) => row.code === item.serviceCode) ?? null;
          const meta = service === null ? null : [
            service.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice,
            service.warrantyDays && service.warrantyDays > 0 ? `${service.warrantyDays}d` : null,
            service.category ?? null,
            ...(service.vehicleClasses ?? []),
          ].filter((value): value is string => typeof value === "string" && value !== "").join(" · ");
          return (
          <View key={`item-${index}`} style={styles.itemBlock}>
          {meta !== null ? <Text style={[styles.itemMeta, {color: theme.muted}]}>{meta}</Text> : null}
          <View style={styles.itemRow}>
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
          </View>
          );
        })}
        {mode === "quote" && items.length === 0 ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.quotedAmount}</Text>
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
        ) : null}
        {items.length > 0 ? (
          <View style={[styles.totalRow, {borderTopColor: theme.divider}]}>
            <Text style={[styles.label, {color: theme.text}]}>{mode === "quote" ? t.provider.quoteTotal : t.provider.invoiceTotal}</Text>
            <Text style={[styles.total, {color: theme.text}]}>{`${itemTotal().toLocaleString()} ₫`}</Text>
          </View>
        ) : null}
        {mode === "done" ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.invoiceRef}</Text>
            <TextInput
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              value={invoiceRef}
              onChangeText={setInvoiceRef}
              placeholder={t.provider.invoicePlaceholder}
              placeholderTextColor={theme.muted}
              maxLength={80}
            />
          </>
        ) : null}
      </View>
    </Overlay>
    {pickerOpen ? (
      <ServicePickerSheet
        t={t}
        theme={theme}
        catalog={catalog ?? []}
        selectedCodes={items.map((item) => item.serviceCode ?? "").filter((code) => code !== "")}
        onAdd={(services) => services.forEach(addCatalogItem)}
        onClose={() => setPickerOpen(false)}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15},
  hint: {fontSize: 13},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  addServices: {borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6},
  itemsHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  itemBlock: {gap: 3},
  itemMeta: {fontSize: 10},
  itemRow: {flexDirection: "row", alignItems: "center", gap: 6},
  itemName: {flex: 1, minWidth: 0},
  itemQty: {width: 46, textAlign: "center"},
  itemPrice: {width: 96},
  totalRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 8},
  total: {fontSize: 16, fontWeight: "700"},
});
