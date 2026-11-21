import {useState} from "react";
import {Pressable, StyleSheet, Switch, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {formatPoint} from "../../api/places";
import type {Strings} from "../../i18n/en";
import {themeForMode, type AppTheme} from "../../theme";
import ShopHoursEditor from "./ShopHoursEditor";
import {TOW_TYPES} from "../../services/towPlates";
import type {ProviderDraftState, ServiceDraft} from "./useProviderDraft";
import {emptyServiceDraft} from "./useProviderDraft";
import ServiceEditSheet from "./ServiceEditSheet";
import ProviderServiceList from "./ProviderServiceList";
import ExistingVehicleChoices from "./ExistingVehicleChoices";
import type {ProviderPricingLimits} from "../../api/providers";
import {VehicleGlyph, VehicleClassGlyph} from "../vehicles/VehicleIcons";
import {summarizeWeek} from "../../screens/more/shopHours";
import Overlay from "../overlay/Overlay";

type Props = {
  t: Strings;
  draft: ProviderDraftState;
  pricingLimits?: ProviderPricingLimits | null;
};

function SectionTitle({label, theme}: {label: string; theme: AppTheme}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionTitleText, {color: theme.text}]}>{label}</Text>
      <View style={[styles.sectionLine, {backgroundColor: theme.divider}]} />
    </View>
  );
}

function kindLabel(kind: "SHOP" | "TOW" | "MOBILE_SHOP", t: Strings): string {
  if (kind === "TOW") return t.provider.kindTow;
  if (kind === "MOBILE_SHOP") return t.provider.kindMobileShop;
  return t.provider.kindShop;
}

function kindIcon(kind: "SHOP" | "TOW" | "MOBILE_SHOP"): "storefront" | "local-shipping" | "build" {
  if (kind === "TOW") return "local-shipping";
  if (kind === "MOBILE_SHOP") return "build";
  return "storefront";
}

export default function ProviderFormSheet({t, draft, pricingLimits = null}: Props) {
  const scheme = useAppMode();
  const theme: AppTheme = themeForMode(scheme);
  const {kind, provider} = draft;
  const [serviceEdit, setServiceEdit] = useState<{index: number | null; service: ServiceDraft} | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const limitLabel = (min?: number, max?: number): string => {
    if (typeof min !== "number" || typeof max !== "number") return t.provider.pricingHint;
    return `${t.provider.pricingLimit}: ${min.toLocaleString("en-US")} – ${max.toLocaleString("en-US")} ₫`;
  };
  const hoursSummary = summarizeWeek(draft.week, t.provider.days, t.provider.hoursMixed);
  const existingChoices = (
    <ExistingVehicleChoices
      t={t}
      theme={theme}
      choices={draft.existingVehicles}
      currentPlate={draft.plate}
      onPick={draft.useExistingVehicle}
    />
  );
  const pricingFields = kind === "TOW" ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towBaseFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towBaseFee} onChangeText={draft.setTowBaseFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.TOW.baseMin, pricingLimits?.TOW.baseMax)}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPerKmFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towPerKmFee} onChangeText={draft.setTowPerKmFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.TOW.perKmMin, pricingLimits?.TOW.perKmMax)}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.waitingRate}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.waitingRate} onChangeText={draft.setWaitingRate} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
    </>
  ) : kind === "MOBILE_SHOP" ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.callOutFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.callOutFee} onChangeText={draft.setCallOutFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.MOBILE_SHOP.callOutMin, pricingLimits?.MOBILE_SHOP.callOutMax)}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.travelPerKmFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.travelPerKmFee} onChangeText={draft.setTravelPerKmFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.MOBILE_SHOP.travelPerKmMin, pricingLimits?.MOBILE_SHOP.travelPerKmMax)}</Text>
    </>
  ) : null;
  const locationFields = kind === "TOW" ? (
    <>
      <SectionTitle label={t.provider.sectionLocation} theme={theme} />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
      {provider ? (
        <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(draft.towPoint?.lat ?? provider.lat, draft.towPoint?.lng ?? provider.lng)}</Text>
      ) : draft.towPoint ? (
        <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(draft.towPoint.lat, draft.towPoint.lng)}</Text>
      ) : (
        <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>
      )}
      <Pressable onPress={() => draft.setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
        <Text style={{color: theme.text}} numberOfLines={1}>{t.provider.towAddress}</Text>
      </Pressable>
    </>
  ) : (
    <>
      <SectionTitle label={t.provider.sectionLocation} theme={theme} />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.shopAddress}</Text>
      <Pressable onPress={() => draft.setShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
        <Text style={{color: draft.point ? theme.text : theme.muted}} numberOfLines={1}>{draft.point ? (draft.point.label ?? formatPoint(draft.point.lat, draft.point.lng)) : t.provider.addressUnset}</Text>
      </Pressable>
      {draft.nearbyExisting.length > 0 ? (
        <Text style={[styles.coords, {color: theme.muted}]}>
          {t.provider.nearbyListed.replace("{n}", String(draft.nearbyExisting.length))}: {draft.nearbyExisting.slice(0, 3).map((s) => s.name).join(", ")}
        </Text>
      ) : null}
    </>
  );
  const vehicleFields = kind === "SHOP" ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.customerVehicles}</Text>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.customerVehiclesHint}</Text>
      <View style={styles.row}>
        {[{id: "SOLO_BIKE", label: t.shop.vehicleBike}, {id: "CAR", label: t.shop.vehicleCar}].map((c) => {
          const selected = draft.vehicleClasses.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => draft.toggleVehicleClass(c.id)} style={[styles.iconChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: selected}} accessibilityLabel={c.label}>
              <VehicleClassGlyph vehicleClass={c.id} color={selected ? "#fff" : theme.primary} />
            </Pressable>
          );
        })}
      </View>
    </>
  ) : kind === "MOBILE_SHOP" ? (
    <>
      {existingChoices}
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.mobileVehicle}</Text>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.mobileVehicleHint}</Text>
      <View style={styles.row}>
        {[{id: "BIKE", label: t.vehicle.types.BIKE}, {id: "CAR", label: t.vehicle.types.CAR}].map((c) => (
          <Pressable key={c.id} onPress={() => draft.setVehicleType(c.id)} style={[styles.iconChip, {borderColor: theme.primary}, draft.towType === c.id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: draft.towType === c.id}} accessibilityLabel={c.label}>
            <VehicleGlyph type={c.id} color={draft.towType === c.id ? "#fff" : theme.primary} />
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.label}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.vehicleLabel} onChangeText={draft.setVehicleLabel} placeholder={t.vehicle.labelPlaceholder} placeholderTextColor={theme.muted} />
      <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
      <TextInput style={[styles.input, {borderColor: !draft.plateOk ? theme.danger : theme.border, color: theme.text}]} value={draft.plate} onChangeText={draft.setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.mobilePlateHint}</Text>
      <View style={styles.fieldRow}>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.widthMeters}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towWidth} onChangeText={draft.setTowWidth} keyboardType="decimal-pad" />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.vehicleHeight} onChangeText={draft.setVehicleHeight} keyboardType="decimal-pad" />
        </View>
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.licenseNumber}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.licenseNumber} onChangeText={draft.setLicenseNumber} placeholder={t.provider.licenseNumber} placeholderTextColor={theme.muted} />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.licenseHint}</Text>
    </>
  ) : (
    <>
      {existingChoices}
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towTruck}</Text>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towTruckHint}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.label}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.vehicleLabel} onChangeText={draft.setVehicleLabel} placeholder={t.vehicle.labelPlaceholder} placeholderTextColor={theme.muted} />
      <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
      <TextInput style={[styles.input, {borderColor: !draft.plateOk ? theme.danger : theme.border, color: theme.text}]} value={draft.plate} onChangeText={draft.setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPlateHint}</Text>
      <View style={styles.row}>
        {TOW_TYPES.map((id) => (
          <Pressable key={id} onPress={() => draft.setVehicleType(id)} style={[styles.iconChip, {borderColor: theme.primary}, draft.towType === id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: draft.towType === id}} accessibilityLabel={t.vehicle.types[id]}>
            <VehicleGlyph type={id} color={draft.towType === id ? "#fff" : theme.primary} />
          </Pressable>
        ))}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.widthMeters}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towWidth} onChangeText={draft.setTowWidth} placeholder={t.vehicle.widthMeters} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.vehicleHeight} onChangeText={draft.setVehicleHeight} placeholder={t.vehicle.height} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
        </View>
      </View>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towWidthHint}</Text>
    </>
  );
  const hoursSection = kind === "SHOP" ? (
    <>
      <SectionTitle label={t.provider.sectionHours} theme={theme} />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.hours}</Text>
      <Pressable onPress={() => setHoursOpen(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.hours}>
        <Text style={{color: hoursSummary ? theme.text : theme.muted}} numberOfLines={1}>
          {hoursSummary ? `${t.provider.hours} — ${hoursSummary}` : `${t.provider.hours} — ${t.provider.hoursNotSet}`}
        </Text>
      </Pressable>
    </>
  ) : null;
  const servicesEditor = kind === "SHOP" || kind === "MOBILE_SHOP" ? (
    <ProviderServiceList
      t={t}
      theme={theme}
      rows={draft.serviceDrafts}
      onEdit={(index, service) => setServiceEdit({index, service: {...service}})}
      onAdd={() => setServiceEdit({
        index: null,
        service: emptyServiceDraft(kind, draft.bookingEnabled, draft.vehicleClasses, draft.towType),
      })}
    />
  ) : null;
  const bookingsSection = kind === "SHOP" && provider ? (
    <>
      <SectionTitle label={t.provider.sectionBookings} theme={theme} />
      <View style={styles.switchRow}>
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingEnabled}</Text>
        <Switch value={draft.bookingEnabled} onValueChange={draft.setBookingEnabled} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
      </View>
      <View style={styles.switchRow}>
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingAlwaysOpen}</Text>
        <Switch value={draft.bookingAlwaysOpen} onValueChange={draft.setBookingAlwaysOpen} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingSlotMinutes}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.bookingSlotMinutes} onChangeText={draft.setBookingSlotMinutes} placeholder="30" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingCapacity}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.bookingCapacity} onChangeText={draft.setBookingCapacity} placeholder="1" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingLeadMinutes}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.bookingLeadMinutes} onChangeText={draft.setBookingLeadMinutes} placeholder="60" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingHorizonDays}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.bookingHorizonDays} onChangeText={draft.setBookingHorizonDays} placeholder="7" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.bookingHours}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.bookingHours} onChangeText={draft.setBookingHours} placeholder={t.provider.hoursNotSet} placeholderTextColor={theme.muted} />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.bookingHoursHint}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.depositPolicy}</Text>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.depositHint}</Text>
      <View style={styles.row}>
        {(["NONE", "FIXED", "PERCENT"] as const).map((policy) => (
          <Pressable key={policy} onPress={() => draft.setDepositPolicy(policy)} style={[styles.categoryChip, {borderColor: draft.depositPolicy === policy ? theme.primary : theme.border, backgroundColor: draft.depositPolicy === policy ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
            <Text style={{color: draft.depositPolicy === policy ? theme.primary : theme.text}}>
              {policy === "NONE" ? t.provider.depositNone : policy === "FIXED" ? t.provider.depositFixed : t.provider.depositPercent}
            </Text>
          </Pressable>
        ))}
      </View>
      {draft.depositPolicy === "FIXED" ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.depositAmount}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.depositAmount} onChangeText={draft.setDepositAmount} placeholder="100000" placeholderTextColor={theme.muted} keyboardType="number-pad" />
        </>
      ) : null}
      {draft.depositPolicy === "PERCENT" ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.depositPercentValue}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.depositPercent} onChangeText={draft.setDepositPercent} placeholder="10" placeholderTextColor={theme.muted} keyboardType="number-pad" />
        </>
      ) : null}
    </>
  ) : null;
  return (
    <View style={styles.form}>
      {draft.error ? <Text style={[styles.error, {color: theme.danger}]}>{draft.error}</Text> : null}
      {provider?.suspended === true ? (
        <View style={[styles.suspended, {borderColor: theme.danger}]}>
          <Text style={[styles.error, {color: theme.danger}]}>{t.provider.suspended}</Text>
          {typeof provider.suspendedReason === "string" && provider.suspendedReason ? (
            <Text style={[styles.coords, {color: theme.muted}]}>{provider.suspendedReason}</Text>
          ) : null}
        </View>
      ) : null}
      <SectionTitle label={t.provider.sectionProfile} theme={theme} />
      <View style={[styles.kindRow, {borderColor: theme.border, backgroundColor: theme.paper}]}>
        <MaterialIcons name={kindIcon(kind)} size={20} color={theme.primary} />
        <Text style={[styles.kindText, {color: theme.text}]}>{kindLabel(kind, t)}</Text>
        <MaterialIcons name="lock-outline" size={16} color={theme.muted} />
      </View>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.kindLocked}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.name} onChangeText={draft.setName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.nameHint}</Text>
      {kind === "SHOP" ? (
        <>
          {locationFields}
          <SectionTitle label={t.provider.sectionVehicle} theme={theme} />
          {vehicleFields}
          {hoursSection}
          {servicesEditor}
          {bookingsSection}
        </>
      ) : null}
      {kind === "MOBILE_SHOP" ? (
        <>
          <SectionTitle label={t.provider.sectionVehicle} theme={theme} />
          {vehicleFields}
          {locationFields}
          {servicesEditor}
          <SectionTitle label={t.provider.pricing} theme={theme} />
          <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.pricingFieldHint}</Text>
          {pricingFields}
        </>
      ) : null}
      {kind === "TOW" ? (
        <>
          <SectionTitle label={t.provider.sectionVehicle} theme={theme} />
          {vehicleFields}
          {locationFields}
          <SectionTitle label={t.provider.pricing} theme={theme} />
          <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.pricingFieldHint}</Text>
          {pricingFields}
        </>
      ) : null}
      <SectionTitle label={t.provider.sectionBilling} theme={theme} />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.taxCode}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.taxCode} onChangeText={draft.setTaxCode} placeholder={t.provider.taxCode} placeholderTextColor={theme.muted} />
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.taxCodeHint}</Text>
      <Overlay visible={hoursOpen} variant="sheet" title={t.provider.hours} closeLabel={t.common.cancel} onClose={() => setHoursOpen(false)}>
        <ShopHoursEditor t={t} week={draft.week} setDay={draft.setDay} />
      </Overlay>
      {serviceEdit ? (
        <ServiceEditSheet
          t={t}
          kind={kind}
          service={serviceEdit.service}
          vehicleClasses={draft.vehicleClasses}
          towType={draft.towType}
          bookingEnabled={draft.bookingEnabled}
          existing={serviceEdit.index !== null}
          onSave={(next) => {
            if (serviceEdit.index === null) draft.addServiceRow(next);
            else draft.updateService(serviceEdit.index, next);
            setServiceEdit(null);
          }}
          onRemove={serviceEdit.index === null ? undefined : () => {
            draft.removeService(serviceEdit.index as number);
            setServiceEdit(null);
          }}
          onClose={() => setServiceEdit(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {gap: 10, width: "100%"},
  error: {fontSize: 13},
  suspended: {borderWidth: 1, borderRadius: 8, padding: 8, gap: 4},
  kindRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12},
  kindText: {flex: 1, fontSize: 14, fontWeight: "700"},
  label: {fontSize: 13, fontWeight: "700"},
  switchRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  iconChip: {width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  coords: {fontSize: 12},
  categoryChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  sectionTitle: {marginTop: 14, gap: 6},
  sectionTitleText: {fontSize: 15, fontWeight: "800"},
  sectionLine: {height: 1},
});
