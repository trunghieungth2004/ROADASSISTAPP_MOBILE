import {useState} from "react";
import {Pressable, StyleSheet, Switch, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
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

function SectionTitle({label, theme}: {label: string; theme: AppTheme}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionTitleText, {color: theme.text}]}>{label}</Text>
      <View style={[styles.sectionLine, {backgroundColor: theme.divider}]} />
    </View>
  );
}

export default function ProviderFormSheet({t, draft, pricingLimits = null}: Props) {
  const scheme = useAppMode();
  const theme: AppTheme = scheme === "dark" ? darkTheme : lightTheme;
  const {kind, provider} = draft;
  const [openService, setOpenService] = useState<number | null>(null);
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
  const servicesEditor = kind === "SHOP" || kind === "MOBILE_SHOP" ? (
    <>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.servicesTitle}</Text>
      <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.serviceHint}</Text>
      {draft.serviceDrafts.map((row, index) => {
        const open = openService === index;
        const summary = [
          t.services.categories[row.category],
          row.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice,
          row.warrantyDays !== "" ? `${row.warrantyDays}d` : null,
          row.channels.map((channel) => channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist).join(" / "),
          row.vehicleClasses.map((cls) => cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike).join(" / "),
        ].filter((value): value is string => typeof value === "string" && value !== "").join(" · ");
        return (
          <View key={`${index}-${row.code}`} style={[styles.serviceCard, {borderColor: theme.border}]}>
            <View style={styles.serviceHead}>
              <View style={styles.serviceHeadText}>
                <Text style={[styles.serviceTitle, {color: theme.text}]} numberOfLines={1}>{row.name || t.provider.serviceName}</Text>
                <Text style={[styles.coords, {color: theme.muted}]} numberOfLines={1}>{summary}</Text>
              </View>
              <Text style={[styles.serviceAmount, {color: theme.text}]}>{row.price === "" ? "0" : row.price} ₫</Text>
              <Pressable onPress={() => setOpenService(open ? null : index)} accessibilityRole="button" accessibilityLabel={t.provider.edit}>
                <MaterialIcons name={open ? "expand-less" : "expand-more"} size={20} color={theme.primary} />
              </Pressable>
              <Pressable onPress={() => draft.removeService(index)} accessibilityRole="button" accessibilityLabel={t.provider.serviceRemove}>
                <MaterialIcons name="delete-outline" size={18} color={theme.danger} />
              </Pressable>
            </View>
            {open ? (
              <>
                <TextInput
                  style={[styles.input, {borderColor: theme.border, color: theme.text}]}
                  value={row.name}
                  onChangeText={(value: string) => draft.updateService(index, {name: value})}
                  placeholder={t.provider.serviceName}
                  placeholderTextColor={theme.muted}
                />
                <View style={styles.serviceRow}>
                  <TextInput
                    style={[styles.input, styles.servicePrice, {borderColor: theme.border, color: theme.text}]}
                    value={row.price}
                    onChangeText={(value: string) => draft.updateService(index, {price: value})}
                    placeholder={t.provider.servicePrice}
                    placeholderTextColor={theme.muted}
                    keyboardType="number-pad"
                  />
                  <Pressable
                    style={[styles.chip, {borderColor: theme.primary}, row.quoteRequired && {backgroundColor: theme.primary}]}
                    onPress={() => draft.updateService(index, {quoteRequired: !row.quoteRequired})}
                    accessibilityRole="button"
                    accessibilityState={{checked: row.quoteRequired}}
                  >
                    <Text style={{color: row.quoteRequired ? "#fff" : theme.text}}>{t.provider.serviceQuoteToggle}</Text>
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.servicePrice, {borderColor: theme.border, color: theme.text}]}
                    value={row.warrantyDays}
                    onChangeText={(value: string) => draft.updateService(index, {warrantyDays: value})}
                    placeholder={t.provider.warrantyDays}
                    placeholderTextColor={theme.muted}
                    keyboardType="number-pad"
                  />
                  <Pressable
                    style={[styles.chip, {borderColor: theme.primary}, row.warrantyParts === "LABOR_ONLY" && {backgroundColor: theme.primary}]}
                    onPress={() => draft.updateService(index, {warrantyParts: "LABOR_ONLY"})}
                    accessibilityRole="button"
                  >
                    <Text style={{color: row.warrantyParts === "LABOR_ONLY" ? "#fff" : theme.text}}>{t.provider.warrantyLabor}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, {borderColor: theme.primary}, row.warrantyParts === "PARTS_AND_LABOR" && {backgroundColor: theme.primary}]}
                    onPress={() => draft.updateService(index, {warrantyParts: "PARTS_AND_LABOR"})}
                    accessibilityRole="button"
                  >
                    <Text style={{color: row.warrantyParts === "PARTS_AND_LABOR" ? "#fff" : theme.text}}>{t.provider.warrantyPartsCovered}</Text>
                  </Pressable>
                </View>
                <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.channelHint}</Text>
                {kind === "SHOP" && !draft.bookingEnabled ? (
                  <Text style={[styles.coords, {color: theme.muted}]}>{t.provider.channelBookingsOff}</Text>
                ) : null}
                <View style={styles.row}>
                  {(kind === "MOBILE_SHOP" ? ["ASSIST"] as const : ["BOOKING", "ASSIST"] as const).map((channel) => {
                    const selected = row.channels.includes(channel);
                    const disabled = channel === "BOOKING" &&
                      kind === "SHOP" && !draft.bookingEnabled;
                    return (
                      <Pressable
                        key={channel}
                        disabled={disabled}
                        style={[styles.categoryChip, {borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? `${theme.primary}22` : "transparent", opacity: disabled ? 0.45 : 1}]}
                        onPress={() => draft.updateService(index, {
                          channels: selected && row.channels.length === 1 ?
                            row.channels :
                            selected ?
                              row.channels.filter((item) => item !== channel) :
                              [...row.channels, channel],
                        })}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                      >
                        <Text style={{color: selected ? theme.primary : theme.muted, fontSize: 11}}>
                          {channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.row}>
                  {(kind === "MOBILE_SHOP" ?
                    [draft.towType === "CAR" ? "CAR" : "SOLO_BIKE"] :
                    draft.vehicleClasses).map((cls) => {
                    const selected = row.vehicleClasses.includes(cls);
                    return (
                      <Pressable
                        key={cls}
                        style={[styles.categoryChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]}
                        onPress={() => draft.updateService(index, {
                          vehicleClasses: selected && row.vehicleClasses.length === 1 ?
                            row.vehicleClasses :
                            selected ?
                              row.vehicleClasses.filter((item) => item !== cls) :
                              [...row.vehicleClasses, cls],
                        })}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                      >
                        <Text style={{color: selected ? "#fff" : theme.primary, fontSize: 11}}>
                          {cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.row}>
                  {(["FLAT_TIRE", "FLUID_LEAK", "CHAIN_SLACK", "SPARK_CAP", "ELECTRICAL", "ENGINE", "BRAKES", "OTHER"] as const).map((category) => {
                    const selected = row.category === category;
                    return (
                      <Pressable
                        key={category}
                        style={[styles.categoryChip, {borderColor: theme.border}, selected && {borderColor: theme.primary, backgroundColor: `${theme.primary}22`}]}
                        onPress={() => draft.updateService(index, {category})}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                      >
                        <Text style={{color: selected ? theme.primary : theme.muted, fontSize: 11}}>{t.services.categories[category]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      <Pressable style={[styles.chip, {borderColor: theme.primary, alignSelf: "flex-start"}]} onPress={draft.addService} accessibilityRole="button">
        <MaterialIcons name="add" size={16} color={theme.primary} />
        <Text style={{color: theme.primary}}>{t.provider.serviceAdd}</Text>
      </Pressable>
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
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.name}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.name} onChangeText={draft.setName} placeholder={t.provider.name} placeholderTextColor={theme.muted} />
      {kind === "SHOP" || kind === "MOBILE_SHOP" ? (
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
          <SectionTitle label={t.provider.sectionHours} theme={theme} />
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.hours}</Text>
          <ShopHoursEditor t={t} week={draft.week} setDay={draft.setDay} />
        </>
      ) : null}
      {kind === "SHOP" && provider ? (
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
          <Text style={[styles.label, {color: theme.text}]}>{t.provider.depositPolicy}</Text>
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
      ) : null}
      <SectionTitle label={t.provider.sectionBilling} theme={theme} />
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.taxCode}</Text>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={draft.taxCode} onChangeText={draft.setTaxCode} placeholder={t.provider.taxCode} placeholderTextColor={theme.muted} />
      {servicesEditor}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {gap: 10, width: "100%"},
  error: {fontSize: 13},
  suspended: {borderWidth: 1, borderRadius: 8, padding: 8, gap: 4},
  label: {fontSize: 13, fontWeight: "700"},
  switchRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start"},
  coords: {fontSize: 12},
  serviceCard: {borderWidth: 1, borderRadius: 10, padding: 8, gap: 8},
  serviceRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  serviceHead: {flexDirection: "row", alignItems: "center", gap: 8},
  serviceHeadText: {flex: 1, minWidth: 0, gap: 2},
  serviceTitle: {fontSize: 14, fontWeight: "700"},
  serviceAmount: {fontSize: 13, fontWeight: "800"},
  servicePrice: {flex: 1},
  categoryChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  sectionTitle: {marginTop: 14, gap: 6},
  sectionTitleText: {fontSize: 15, fontWeight: "800"},
  sectionLine: {height: 1},
});
