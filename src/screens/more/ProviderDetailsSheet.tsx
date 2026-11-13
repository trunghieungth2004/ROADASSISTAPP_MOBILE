import {useState} from "react";
import {Switch, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import {AppText as Text} from "../../components/ui/AppText";
import {toMessage} from "../../api/client";
import {updateProvider, type Provider, type ProviderService} from "../../api/providers";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {onColor} from "../../theme";
import {providerPill} from "./providerUi";

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  provider: Provider;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onChanged: () => void;
};

function money(value: number | null | undefined, t: Strings): string {
  return typeof value === "number" ? `${value.toLocaleString()} VND` : t.provider.notSet;
}

function kindLabel(kind: string, t: Strings): string {
  if (kind === "TOW") return t.provider.kindTow;
  if (kind === "MOBILE_SHOP") return t.provider.kindMobileShop;
  return t.provider.kindShop;
}

function serviceMeta(service: ProviderService, provider: Provider, t: Strings): string {
  const classes = Array.isArray(service.vehicleClasses) && service.vehicleClasses.length > 0 ?
    service.vehicleClasses :
    provider.vehicleClasses ?? [];
  const parts = [
    service.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice,
    ...(typeof service.warrantyDays === "number" && service.warrantyDays > 0 ?
      [`${service.warrantyDays}d`] : []),
    ...(service.channels ?? []).map((channel) =>
      channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist),
    ...classes.map((cls) =>
      cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike),
  ];
  return parts.join(" · ");
}

export default function ProviderDetailsSheet({t, theme, token, provider, onClose, onEdit, onRemove, onChanged}: Props) {
  const [current, setCurrent] = useState(provider);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pill = providerPill(current, t);
  const isTow = current.kind === "TOW";
  const isMobile = current.kind === "MOBILE_SHOP";
  const services = Array.isArray(current.services) ? current.services : [];
  const actions: OverlayAction[] = [
    {label: t.provider.edit, tone: "primary", onPress: onEdit},
    {
      label: t.provider.removeLicence,
      tone: "danger",
      outline: true,
      iconOnly: true,
      icon: <MaterialIcons name="delete-outline" size={20} color={theme.danger} />,
      onPress: onRemove,
    },
  ];
  async function toggle(next: boolean): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateProvider({providerId: current.id, accepting: next}, token);
      setCurrent((prev) => ({...prev, accepting: next}));
      onChanged();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay
      visible
      variant="sheet"
      title={current.name}
      closeLabel={t.common.close}
      onClose={onClose}
      actions={actions}
      actionLayout="ticket"
      scrollable
    >
      <View style={styles.body}>
        <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <View style={styles.head}>
            <View style={[styles.icon, {backgroundColor: `${theme.primary}22`}]}>
              <MaterialIcons name={isTow ? "local-shipping" : isMobile ? "build" : "storefront"} size={26} color={theme.primary} />
            </View>
            <View style={styles.headText}>
              <Text style={[styles.title, {color: theme.text}]}>{current.name}</Text>
              <Text style={[styles.small, {color: theme.muted}]}>
                {[kindLabel(current.kind, t), current.plate, current.vehicleType].filter((value) => typeof value === "string" && value !== "").join(" · ")}
              </Text>
            </View>
            <View style={[styles.pill, {backgroundColor: pill.tone === "on" ? theme.primary : pill.tone === "alert" ? theme.danger : theme.divider}]}>
              <Text style={[styles.pillText, {color: onColor(pill.tone === "on" ? theme.primary : pill.tone === "alert" ? theme.danger : theme.divider)}]}>{pill.label}</Text>
            </View>
          </View>
          {error ? <Text style={[styles.small, {color: theme.danger}]}>{error}</Text> : null}
        </View>

        <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <Text style={[styles.section, {color: theme.text}]}>{t.provider.operations}</Text>
          <View style={styles.row}>
            <Text style={[styles.small, {color: theme.muted}]}>
              {isTow ? t.more.dutyTow : isMobile ? t.more.dutyMobileShop : t.more.dutyShop}
            </Text>
            <Switch value={current.accepting !== false} onValueChange={(value) => void toggle(value)} disabled={busy} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#fff" />
          </View>
          <View style={styles.row}>
            <Text style={[styles.small, {color: theme.muted}]}>{t.provider.rating}</Text>
            <Text style={[styles.value, {color: theme.text}]}>{`${(current.ratingAvg ?? 0).toFixed(1)} · ${current.ratingCount ?? 0}`}</Text>
          </View>
          {current.label ? (
            <View style={styles.row}>
              <Text style={[styles.small, {color: theme.muted}]}>{isTow ? t.provider.towAddress : t.provider.shopAddress}</Text>
              <Text style={[styles.value, {color: theme.text, flexShrink: 1, textAlign: "right"}]} numberOfLines={2}>{current.label}</Text>
            </View>
          ) : null}
          {!isTow && current.kind === "SHOP" ? (
            <View style={styles.row}>
              <Text style={[styles.small, {color: theme.muted}]}>{t.provider.bookingEnabled}</Text>
              <Text style={[styles.value, {color: theme.text}]}>{current.bookingEnabled === true ? t.assist.accept : t.provider.notSet}</Text>
            </View>
          ) : null}
          {current.kind === "SHOP" && Array.isArray(current.vehicleClasses) && current.vehicleClasses.length > 0 ? (
            <View style={styles.row}>
              <Text style={[styles.small, {color: theme.muted}]}>{t.provider.serves}</Text>
              <Text style={[styles.value, {color: theme.text}]}>{current.vehicleClasses.map((cls) => cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike).join(" · ")}</Text>
            </View>
          ) : null}
          {isMobile && current.licenseNumber ? (
            <View style={styles.row}>
              <Text style={[styles.small, {color: theme.muted}]}>{t.provider.licenseNumber}</Text>
              <Text style={[styles.value, {color: theme.text}]}>{current.licenseNumber}</Text>
            </View>
          ) : null}
        </View>

        {!isTow ? (
          <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
            <Text style={[styles.section, {color: theme.text}]}>{t.provider.servicesTitle}</Text>
            {services.length === 0 ? <Text style={[styles.small, {color: theme.muted}]}>{t.provider.noServices}</Text> : services.map((service) => (
              <View key={service.code} style={[styles.service, {borderColor: theme.divider}]}>
                <View style={styles.row}>
                  <Text style={[styles.serviceName, {color: theme.text}]} numberOfLines={2}>{service.name}</Text>
                  <Text style={[styles.value, {color: theme.text}]}>{money(service.displayPrice, t)}</Text>
                </View>
                <Text style={[styles.small, {color: theme.muted}]}>{serviceMeta(service, current, t)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <Text style={[styles.section, {color: theme.text}]}>{t.provider.pricing}</Text>
          {isTow ? (
            <>
              <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.towBaseFee}</Text><Text style={[styles.value, {color: theme.text}]}>{money(current.towBaseFee, t)}</Text></View>
              <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.towPerKmFee}</Text><Text style={[styles.value, {color: theme.text}]}>{money(current.towPerKmFee, t)}</Text></View>
              <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.waitingRate}</Text><Text style={[styles.value, {color: theme.text}]}>{money(current.waitingRatePer15Min, t)}</Text></View>
            </>
          ) : isMobile ? (
            <>
              <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.callOutFee}</Text><Text style={[styles.value, {color: theme.text}]}>{money(current.callOutFee, t)}</Text></View>
              <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.travelPerKmFee}</Text><Text style={[styles.value, {color: theme.text}]}>{money(current.travelPerKmFee, t)}</Text></View>
            </>
          ) : (
            <View style={styles.row}><Text style={[styles.small, {color: theme.muted}]}>{t.provider.taxCode}</Text><Text style={[styles.value, {color: theme.text}]}>{current.taxCode ?? t.provider.notSet}</Text></View>
          )}
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  card: {borderWidth: 1, borderRadius: 14, padding: 12, gap: 8},
  head: {flexDirection: "row", alignItems: "center", gap: 10},
  icon: {width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, gap: 3},
  title: {fontSize: 17, fontWeight: "800"},
  section: {fontSize: 13, fontWeight: "800"},
  row: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10},
  small: {fontSize: 11, lineHeight: 16},
  value: {fontSize: 12, fontWeight: "700"},
  service: {borderTopWidth: 1, paddingTop: 7, gap: 3},
  serviceName: {flex: 1, fontSize: 13, fontWeight: "700"},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  pillText: {fontSize: 10, fontWeight: "800"},
});
