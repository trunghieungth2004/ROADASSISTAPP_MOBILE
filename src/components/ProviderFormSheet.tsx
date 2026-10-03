import {ActivityIndicator, Pressable, StyleSheet, Switch, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {formatPoint} from "../api/places";
import type {Strings} from "../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import {DOW, isValidTime} from "../screens/more/shopHours";
import {TOW_TYPES} from "../services/towPlates";
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
        </>
      ) : (
        <>
          {provider ? (
            <>
              <Text style={[styles.label, {color: theme.text}]}>{t.tow.plate}</Text>
              <Text style={[styles.coords, {color: theme.text}]}>{typeof provider.plate === "string" ? provider.plate : ""}</Text>
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(draft.towPoint?.lat ?? provider.lat, draft.towPoint?.lng ?? provider.lng)}</Text>
              <Pressable style={[styles.chip, {borderColor: theme.primary}, draft.locBusy && styles.disabled]} disabled={draft.locBusy} onPress={() => void draft.stampTowPoint()} accessibilityRole="button" accessibilityLabel={t.provider.useLocation}>
                {draft.locBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary}}>{t.provider.useLocation}</Text>}
              </Pressable>
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
              <Text style={[styles.label, {color: theme.text}]}>{t.provider.towPosition}</Text>
              {draft.towPoint ? <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionSet}</Text> : <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.towPositionUnset}</Text>}
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
          {DOW.map((day) => {
            const row = draft.week[day];
            const bad = row.enabled && (!isValidTime(row.open) || !isValidTime(row.close));
            return (
              <View key={day} style={[styles.dayRow, {borderColor: bad ? theme.danger : theme.border}]}>
                <Pressable style={[styles.dayChip, {borderColor: row.enabled ? theme.primary : theme.border}, row.enabled && {backgroundColor: theme.primary}]} onPress={() => draft.setDay(day, {enabled: !row.enabled})} accessibilityRole="button" accessibilityState={{checked: row.enabled}}>
                  <Text style={{color: row.enabled ? "#fff" : theme.text, fontWeight: "700"}}>{t.provider.days[day]}</Text>
                </Pressable>
                {row.enabled ? (
                  <>
                    <TextInput style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]} value={row.open} onChangeText={(v) => draft.setDay(day, {open: v})} placeholder="08:00" placeholderTextColor={theme.muted} maxLength={5} />
                    <Text style={{color: theme.muted}}>–</Text>
                    <TextInput style={[styles.time, {borderColor: bad ? theme.danger : theme.border, color: theme.text}]} value={row.close} onChangeText={(v) => draft.setDay(day, {close: v})} placeholder="18:00" placeholderTextColor={theme.muted} maxLength={5} />
                  </>
                ) : null}
              </View>
            );
          })}
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
  dayRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 8},
  dayChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  time: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center"},
  acceptRow: {flexDirection: "row", alignItems: "center", gap: 12},
  acceptText: {flex: 1, fontSize: 15, fontWeight: "500"},
  disabled: {opacity: 0.6},
});
