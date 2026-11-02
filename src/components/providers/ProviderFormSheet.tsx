import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {formatPoint} from "../../api/places";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import ShopHoursEditor from "./ShopHoursEditor";
import {TOW_TYPES} from "../../services/towPlates";
import type {ProviderDraftState} from "./useProviderDraft";
import type {ProviderPricingLimits} from "../../api/providers";

type Props = {
  t: Strings;
  draft: ProviderDraftState;
  pricingLimits?: ProviderPricingLimits | null;
};

export default function ProviderFormSheet({t, draft, pricingLimits = null}: Props) {
  const scheme = useAppMode();
  const theme: AppTheme = scheme === "dark" ? darkTheme : lightTheme;
  const {kind, provider} = draft;
  const limitLabel = (min?: number, max?: number): string => {
    if (typeof min !== "number" || typeof max !== "number") return t.provider.pricingHint;
    return `${t.provider.pricingLimit}: ${min.toLocaleString("en-US")} – ${max.toLocaleString("en-US")} ₫`;
  };
  const existingVehicles = draft.existingVehicles.length > 0 ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.useExistingVehicle}</Text>
      <View style={styles.row}>
        {draft.existingVehicles.map((vehicle) => (
          <Pressable
            key={`${vehicle.plate}-${vehicle.vehicleType}`}
            style={[styles.chip, {borderColor: theme.primary}]}
            onPress={() => draft.useExistingVehicle(vehicle)}
            accessibilityRole="button"
          >
            <Text style={{color: theme.primary}}>{vehicle.plate}</Text>
          </Pressable>
        ))}
      </View>
    </>
  ) : null;
  const pricingFields = kind === "TOW" ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towBaseFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towBaseFee} onChangeText={draft.setTowBaseFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.TOW.baseMin, pricingLimits?.TOW.baseMax)}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPerKmFee}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towPerKmFee} onChangeText={draft.setTowPerKmFee} placeholder="0" placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <Text style={[styles.coords, {color: theme.muted}]}>{limitLabel(pricingLimits?.TOW.perKmMin, pricingLimits?.TOW.perKmMax)}</Text>
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
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.name} onChangeText={draft.setName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
      {kind === "SHOP" || kind === "MOBILE_SHOP" ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.shopAddress}</Text>
          <Pressable onPress={() => draft.setShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
            <Text style={{color: draft.point ? theme.text : theme.muted}} numberOfLines={1}>{draft.point ? (draft.point.label ?? formatPoint(draft.point.lat, draft.point.lng)) : t.provider.addressUnset}</Text>
          </Pressable>
          {draft.nearbyExisting.length > 0 ? (
            <Text style={[styles.coords, {color: theme.muted}]}>
              {t.provider.nearbyListed.replace("{n}", String(draft.nearbyExisting.length))}: {draft.nearbyExisting.slice(0, 3).map((s) => s.name).join(", ")}
            </Text>
          ) : null}
          {kind === "SHOP" ? (
            <>
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.serves}</Text>
              <View style={styles.row}>
                {[{id: "SOLO_BIKE", label: t.shop.vehicleBike}, {id: "CAR", label: t.shop.vehicleCar}].map((c) => {
                  const selected = draft.vehicleClasses.includes(c.id);
                  return (
                    <Pressable key={c.id} onPress={() => draft.toggleVehicleClass(c.id)} style={[styles.chip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: selected}} accessibilityLabel={c.label}>
                      <Text style={{color: selected ? "#fff" : theme.text}}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {kind === "MOBILE_SHOP" ? (
            <>
              {existingVehicles}
              <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
              <TextInput style={[styles.input, {borderColor: !draft.plateOk ? theme.danger : theme.border, color: theme.text}]} value={draft.plate} onChangeText={draft.setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
              <View style={styles.row}>
                {[{id: "BIKE", label: t.vehicle.types.BIKE}, {id: "CAR", label: t.vehicle.types.CAR}].map((c) => (
                  <Pressable key={c.id} onPress={() => draft.setTowType(c.id)} style={[styles.chip, {borderColor: theme.primary}, draft.towType === c.id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: draft.towType === c.id}}>
                    <Text style={{color: draft.towType === c.id ? "#fff" : theme.text}}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.licenseNumber}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.licenseNumber} onChangeText={draft.setLicenseNumber} placeholder={t.provider.licenseNumber} placeholderTextColor={theme.muted} />
              {pricingFields}
            </>
          ) : null}
        </>
      ) : (
        <>
          {provider ? (
            <>
              {existingVehicles}
              <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
              <TextInput style={[styles.input, {borderColor: !draft.plateOk ? theme.danger : theme.border, color: theme.text}]} value={draft.plate} onChangeText={draft.setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
              <View style={styles.row}>
                {TOW_TYPES.map((id) => (
                  <Pressable key={id} onPress={() => draft.setTowType(id)} style={[styles.chip, {borderColor: theme.primary}, draft.towType === id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: draft.towType === id}}>
                    <Text style={{color: draft.towType === id ? "#fff" : theme.text}}>{t.vehicle.types[id]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towWidth} onChangeText={draft.setTowWidth} placeholder={t.vehicle.widthMeters} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
              {pricingFields}
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(draft.towPoint?.lat ?? provider.lat, draft.towPoint?.lng ?? provider.lng)}</Text>
              <Pressable onPress={() => draft.setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
                <Text style={{color: theme.text}} numberOfLines={1}>{t.provider.towAddress}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {existingVehicles}
              <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
              <TextInput style={[styles.input, {borderColor: !draft.plateOk ? theme.danger : theme.border, color: theme.text}]} value={draft.plate} onChangeText={draft.setPlate} placeholder={t.tow.platePlaceholder} placeholderTextColor={theme.muted} autoCapitalize="characters" />
              <View style={styles.row}>
                {TOW_TYPES.map((id) => (
                  <Pressable key={id} onPress={() => draft.setTowType(id)} style={[styles.chip, {borderColor: theme.primary}, draft.towType === id && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: draft.towType === id}}>
                    <Text style={{color: draft.towType === id ? "#fff" : theme.text}}>{t.vehicle.types[id]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towWidth} onChangeText={draft.setTowWidth} placeholder={t.vehicle.widthMeters} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
              {pricingFields}
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              {draft.towPoint ? <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionSet}</Text> : <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>}
              <Pressable onPress={() => draft.setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
                <Text style={{color: draft.towPoint ? theme.text : theme.muted}} numberOfLines={1}>{draft.towPoint ? formatPoint(draft.towPoint.lat, draft.towPoint.lng) : t.provider.towAddressUnset}</Text>
              </Pressable>
            </>
          )}
        </>
      )}
      {kind === "SHOP" ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.hours}</Text>
          <ShopHoursEditor t={t} week={draft.week} setDay={draft.setDay} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {gap: 10, width: "100%"},
  error: {fontSize: 13},
  suspended: {borderWidth: 1, borderRadius: 8, padding: 8, gap: 4},
  label: {fontSize: 13, fontWeight: "700"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start"},
  coords: {fontSize: 12},
});
