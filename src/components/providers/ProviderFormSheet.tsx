import {ActivityIndicator, Pressable, StyleSheet, Switch, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {formatPoint} from "../../api/places";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import ShopHoursEditor from "./ShopHoursEditor";
import {TOW_TYPES} from "../../services/towPlates";
import type {ProviderDraftState} from "./useProviderDraft";

type Props = {
  t: Strings;
  draft: ProviderDraftState;
};

export default function ProviderFormSheet({t, draft}: Props) {
  const scheme = useColorScheme();
  const theme: AppTheme = scheme === "dark" ? darkTheme : lightTheme;
  const {kind, provider} = draft;
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
      {kind === "SHOP" ? (
        <>
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.shopAddress}</Text>
          <Pressable onPress={() => draft.setShopSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.shopAddress}>
            <Text style={{color: draft.point ? theme.text : theme.muted}} numberOfLines={1}>{draft.point ? (draft.point.label ?? formatPoint(draft.point.lat, draft.point.lng)) : t.provider.addressUnset}</Text>
          </Pressable>
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
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.feeService}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.serviceFee} onChangeText={draft.setServiceFee} placeholder={t.provider.feeService} placeholderTextColor={theme.muted} keyboardType="numeric" />
        </>
      ) : (
        <>
          {provider ? (
            <>
              <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
              <Text style={[styles.coords, {color: theme.text}]}>{typeof provider.plate === "string" ? provider.plate : ""}</Text>
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(draft.towPoint?.lat ?? provider.lat, draft.towPoint?.lng ?? provider.lng)}</Text>
              <Pressable onPress={() => draft.setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
                <Text style={{color: theme.text}} numberOfLines={1}>{t.provider.towAddress}</Text>
              </Pressable>
              <Pressable style={[styles.chip, {borderColor: theme.primary}, draft.locBusy && styles.disabled]} disabled={draft.locBusy} onPress={() => void draft.stampTowPoint()} accessibilityRole="button" accessibilityLabel={t.provider.useLocation}>
                {draft.locBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary}}>{t.provider.useLocation}</Text>}
              </Pressable>
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.feeBase}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towBaseFee} onChangeText={draft.setTowBaseFee} placeholder={t.provider.feeBase} placeholderTextColor={theme.muted} keyboardType="numeric" />
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.feePerKm}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towPerKmFee} onChangeText={draft.setTowPerKmFee} placeholder={t.provider.feePerKm} placeholderTextColor={theme.muted} keyboardType="numeric" />
            </>
          ) : (
            <>
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
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.feeBase}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towBaseFee} onChangeText={draft.setTowBaseFee} placeholder={t.provider.feeBase} placeholderTextColor={theme.muted} keyboardType="numeric" />
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.feePerKm}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.towPerKmFee} onChangeText={draft.setTowPerKmFee} placeholder={t.provider.feePerKm} placeholderTextColor={theme.muted} keyboardType="numeric" />
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              {draft.towPoint ? <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionSet}</Text> : <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>}
              <Pressable onPress={() => draft.setTowSearch(true)} style={[styles.input, {borderColor: theme.border}]} accessibilityRole="button" accessibilityLabel={t.provider.towAddress}>
                <Text style={{color: draft.towPoint ? theme.text : theme.muted}} numberOfLines={1}>{draft.towPoint ? formatPoint(draft.towPoint.lat, draft.towPoint.lng) : t.provider.towAddressUnset}</Text>
              </Pressable>
              <Pressable style={[styles.chip, {borderColor: theme.primary}, draft.locBusy && styles.disabled]} disabled={draft.locBusy} onPress={() => void draft.stampTowPoint()} accessibilityRole="button" accessibilityLabel={t.provider.useLocation}>
                {draft.locBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary}}>{t.provider.useLocation}</Text>}
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
      {provider ? (
        <View style={styles.acceptRow}>
          <MaterialIcons name="store" size={20} color={theme.primary} />
          <Text style={[styles.acceptText, {color: theme.text}]}>{t.provider.accepting}</Text>
          <Switch value={draft.accepting} onValueChange={draft.setAccepting} disabled={!draft.editable} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
        </View>
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
  acceptRow: {flexDirection: "row", alignItems: "center", gap: 12},
  acceptText: {flex: 1, fontSize: 15, fontWeight: "500"},
  disabled: {opacity: 0.6},
});
