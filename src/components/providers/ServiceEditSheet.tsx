import {useState} from "react";
import {Alert, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import Overlay from "../overlay/Overlay";
import type {Strings} from "../../i18n/en";
import {useAppMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import type {ServiceDraft} from "./useProviderDraft";
import {VehicleClassGlyph} from "../vehicles/VehicleIcons";
import ServiceCategoryIcon from "./ServiceCategoryIcon";

const CATEGORIES = [
  "FLAT_TIRE",
  "FLUID_LEAK",
  "CHAIN_SLACK",
  "SPARK_CAP",
  "ELECTRICAL",
  "ENGINE",
  "BRAKES",
  "OTHER",
] as const;

type Props = {
  t: Strings;
  kind: "SHOP" | "TOW" | "MOBILE_SHOP";
  service: ServiceDraft;
  vehicleClasses: string[];
  towType: string;
  bookingEnabled: boolean;
  existing: boolean;
  onSave: (service: ServiceDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
};

export default function ServiceEditSheet({
  t,
  kind,
  service,
  vehicleClasses,
  towType,
  bookingEnabled,
  existing,
  onSave,
  onRemove,
  onClose,
}: Props) {
  const theme = themeForMode(useAppMode());
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(service.price);
  const [quoteRequired, setQuoteRequired] = useState(service.quoteRequired);
  const [category, setCategory] = useState(service.category);
  const [warrantyDays, setWarrantyDays] = useState(service.warrantyDays);
  const [warrantyParts, setWarrantyParts] = useState(service.warrantyParts);
  const [channels, setChannels] = useState(service.channels);
  const [classes, setClasses] = useState(service.vehicleClasses);
  const [error, setError] = useState<string | null>(null);
  const scope = kind === "MOBILE_SHOP" ?
    [towType === "CAR" ? "CAR" : "SOLO_BIKE"] :
    vehicleClasses;
  const availableChannels = kind === "MOBILE_SHOP" ?
    ["ASSIST"] as const :
    ["BOOKING", "ASSIST"] as const;

  function toggleChannel(channel: "BOOKING" | "ASSIST"): void {
    setChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== channel);
      }
      return [...prev, channel];
    });
  }

  function toggleClass(cls: string): void {
    setClasses((prev) => {
      if (prev.includes(cls)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== cls);
      }
      return [...prev, cls];
    });
  }

  function save(): void {
    const trimmed = name.trim();
    const digits = price.replace(/[^0-9]/g, "");
    if (trimmed === "" || digits === "") {
      setError(t.provider.serviceInvalid);
      return;
    }
    const warrantyDigits = warrantyDays.replace(/[^0-9]/g, "");
    const warranty = warrantyDigits === "" ? "" : String(Number(warrantyDigits));
    if (warranty !== "" && (!Number.isFinite(Number(warranty)) ||
      Number(warranty) < 0 || Number(warranty) > 90)) {
      setError(t.provider.invalidWarranty);
      return;
    }
    onSave({
      ...service,
      name: trimmed,
      price: digits,
      quoteRequired,
      category,
      warrantyDays: warranty,
      warrantyParts,
      channels,
      vehicleClasses: classes,
    });
  }

  function remove(): void {
    if (!onRemove) return;
    Alert.alert(t.provider.serviceDeleteTitle, t.provider.serviceDeleteMessage, [
      {text: t.common.cancel, style: "cancel"},
      {text: t.provider.serviceRemove, style: "destructive", onPress: onRemove},
    ]);
  }

  return (
    <Overlay
      visible
      variant="sheet"
      title={existing ? t.provider.editService : t.provider.addService}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[
        ...(existing && onRemove ? [{label: t.provider.serviceRemove, tone: "danger" as const, outline: true, group: "secondary" as const, onPress: remove}] : []),
        {label: t.common.cancel, tone: "neutral" as const, outline: true, group: "secondary" as const, onPress: onClose},
        {label: t.provider.serviceSave, tone: "primary" as const, onPress: save},
      ]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.serviceName}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={name}
          onChangeText={setName}
          placeholder={t.provider.serviceName}
          placeholderTextColor={theme.muted}
        />
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.servicePrice}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={price}
          onChangeText={setPrice}
          placeholder={t.provider.servicePrice}
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, {borderColor: theme.primary}, !quoteRequired && {backgroundColor: theme.primary}]}
            onPress={() => setQuoteRequired(false)}
            accessibilityRole="button"
            accessibilityState={{selected: !quoteRequired}}
          >
            <Text style={{color: !quoteRequired ? "#fff" : theme.primary}}>{t.provider.serviceFixedPrice}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, {borderColor: theme.primary}, quoteRequired && {backgroundColor: theme.primary}]}
            onPress={() => setQuoteRequired(true)}
            accessibilityRole="button"
            accessibilityState={{selected: quoteRequired}}
          >
            <Text style={{color: quoteRequired ? "#fff" : theme.primary}}>{t.provider.serviceQuoteToggle}</Text>
          </Pressable>
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.serviceCategory}</Text>
        <View style={styles.row}>
          {CATEGORIES.map((id) => {
            const active = category === id;
            return (
              <Pressable
                key={id}
                style={[styles.iconChip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]}
                onPress={() => setCategory(id)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
                accessibilityLabel={t.services.categories[id]}
              >
                <ServiceCategoryIcon category={id} size={18} color={active ? theme.primary : theme.muted} />
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.warrantyDays}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.warranty, {borderColor: theme.border, color: theme.text}]}
            value={warrantyDays}
            onChangeText={setWarrantyDays}
            placeholder="0"
            placeholderTextColor={theme.muted}
            keyboardType="number-pad"
          />
          <Pressable
            style={[styles.chip, {borderColor: theme.primary}, warrantyParts === "LABOR_ONLY" && {backgroundColor: theme.primary}]}
            onPress={() => setWarrantyParts("LABOR_ONLY")}
            accessibilityRole="button"
          >
            <Text style={{color: warrantyParts === "LABOR_ONLY" ? "#fff" : theme.primary}}>{t.provider.warrantyLabor}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, {borderColor: theme.primary}, warrantyParts === "PARTS_AND_LABOR" && {backgroundColor: theme.primary}]}
            onPress={() => setWarrantyParts("PARTS_AND_LABOR")}
            accessibilityRole="button"
          >
            <Text style={{color: warrantyParts === "PARTS_AND_LABOR" ? "#fff" : theme.primary}}>{t.provider.warrantyPartsCovered}</Text>
          </Pressable>
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.channelHint}</Text>
        <View style={styles.row}>
          {availableChannels.map((channel) => {
            const selected = channels.includes(channel);
            const disabled = channel === "BOOKING" && kind === "SHOP" && !bookingEnabled;
            return (
              <Pressable
                key={channel}
                disabled={disabled}
                style={[styles.category, {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? `${theme.primary}22` : "transparent",
                  opacity: disabled ? 0.4 : 1,
                }]}
                onPress={() => toggleChannel(channel)}
                accessibilityRole="button"
                accessibilityState={{selected, disabled}}
              >
                <Text style={{color: selected ? theme.primary : theme.muted, fontSize: 11}}>
                  {channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {kind === "SHOP" && !bookingEnabled ? (
          <Text style={[styles.hint, {color: theme.muted}]}>{t.provider.channelBookingsOff}</Text>
        ) : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.serviceVehicles}</Text>
        <View style={styles.row}>
          {scope.map((cls) => {
            const selected = classes.includes(cls);
            return (
              <Pressable
                key={cls}
                style={[styles.iconChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]}
                onPress={() => toggleClass(cls)}
                accessibilityRole="button"
                accessibilityState={{selected}}
                accessibilityLabel={cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike}
              >
                <VehicleClassGlyph vehicleClass={cls} color={selected ? "#fff" : theme.primary} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, paddingBottom: 8},
  label: {fontSize: 12, fontWeight: "700"},
  input: {borderWidth: 1, borderRadius: 10, padding: 10},
  warranty: {width: 90},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center"},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12},
  iconChip: {width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  category: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10},
  hint: {fontSize: 12, lineHeight: 17},
  error: {fontSize: 12, lineHeight: 17},
});
