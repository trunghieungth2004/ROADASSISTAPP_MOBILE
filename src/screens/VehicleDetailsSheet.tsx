import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Alert, Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../components/ui/AppText";
import Overlay, {type OverlayAction} from "../components/overlay/Overlay";
import VehicleEditDialog from "../components/vehicles/VehicleEditDialog";
import WarrantyClaimDialog from "./bills/WarrantyClaimDialog";
import ShopDetailSheet from "./assist/ShopDetailSheet";
import type {Provider} from "../api/providers";
import {toMessage} from "../api/client";
import {
  listProfiles,
  removeProfile,
  vehicleHistory,
  type VehicleHistory,
  type VehicleHistoryLine,
  type VehicleProfile,
} from "../api/vehicles";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {themeForMode, type AppTheme} from "../theme";
import {vehicleIcon} from "./route/routeGeo";
import {vehicleMeta, vehicleTypeName} from "../components/vehicles/vehicleMeta";
import {billDateLabel} from "./bills/billLabels";

type Props = {
  profileId: string;
  onClose: () => void;
  onChanged?: () => void;
};

function claimLabel(status: string, t: ReturnType<typeof useStrings>["t"]): string {
  if (status === "OPEN") return t.vehicle.claimOpen;
  if (status === "DECLINED") return t.vehicle.claimDeclined;
  if (status === "REBOOKED") return t.vehicle.claimRebooked;
  if (status === "COMPLETED") return t.vehicle.claimCompleted;
  if (status === "RESOLVED") return t.vehicle.claimResolved;
  return status;
}

function warrantyLine(line: VehicleHistoryLine, t: ReturnType<typeof useStrings>["t"], theme: AppTheme) {
  const until = line.warrantyUntil === null ? null : Date.parse(line.warrantyUntil);
  const active = until !== null && Number.isFinite(until) && until > Date.now();
  const claim = line.claim;
  return (
    <View key={line.lineId} style={[styles.line, {borderColor: theme.divider}]}>
      <View style={styles.row}>
        <Text style={[styles.lineName, {color: theme.text}]} numberOfLines={2}>{line.name}</Text>
        <Text style={[styles.amount, {color: theme.text}]}>{`${line.amount.toLocaleString()} VND`}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.small, {color: theme.muted}]}>
          {line.warrantyUntil ? `${t.bills.warranty}: ${billDateLabel(line.warrantyUntil)}` : ""}
        </Text>
        {claim ? (
          <View style={[styles.pill, {backgroundColor: claim.status === "DECLINED" ? theme.danger : theme.muted}]}>
            <Text style={styles.pillText}>{claimLabel(claim.status, t)}</Text>
          </View>
        ) : active ? (
          <View style={[styles.pill, {backgroundColor: theme.primary}]}>
            <Text style={styles.pillText}>{t.vehicle.warrantyActive}</Text>
          </View>
        ) : line.warrantyUntil ? (
          <Text style={[styles.small, {color: theme.muted}]}>{t.flag.expired}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function VehicleDetailsSheet({profileId, onClose, onChanged}: Props) {
  const {t} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, activateVehicle, refresh} = useProfile();
  const {mode} = useThemeMode();
  const theme = themeForMode(mode);
  const [profile, setProfile] = useState<VehicleProfile | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [claimFor, setClaimFor] = useState<{ticketId: string; lineId: string; name: string} | null>(null);
  const [claimPickerFor, setClaimPickerFor] = useState<{ticketId: string; lines: VehicleHistoryLine[]} | null>(null);
  const [shopFor, setShopFor] = useState<Provider | null>(null);
  const [activeBusy, setActiveBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const [profiles, vehicle] = await Promise.all([
        listProfiles(token),
        vehicleHistory(profileId, token),
      ]);
      setProfile(profiles.find((row) => row.id === profileId) ?? null);
      setHistory(vehicle);
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, profileId]);

  useEffect(() => {
    void load();
  }, [load]);
  const isActive = activeVehicle?.id === profileId;
  const actions: OverlayAction[] = [];
  if (profile) {
    if (!isActive) {
      actions.push({
        label: t.vehicle.setActive,
        tone: "primary",
        busy: activeBusy,
        onPress: () => void onActivate(),
      });
    }
    actions.push({
      label: t.vehicle.edit,
      tone: "neutral",
      outline: true,
      iconOnly: true,
      icon: <MaterialIcons name="edit" size={20} color={theme.text} />,
      onPress: () => setEditOpen(true),
    });
    actions.push({
      label: t.common.delete,
      tone: "danger",
      outline: true,
      iconOnly: true,
      icon: <MaterialIcons name="delete-outline" size={20} color={theme.danger} />,
      onPress: () => onDelete(),
    });
  }

  async function onActivate(): Promise<void> {
    if (!token || activeBusy) return;
    setActiveBusy(true);
    try {
      await activateVehicle(profileId);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setActiveBusy(false);
    }
  }

  function onClaim(ticketId: string, lines: VehicleHistoryLine[]): void {
    if (lines.length === 1) {
      setClaimFor({ticketId, lineId: lines[0].lineId, name: lines[0].name});
      return;
    }
    setClaimPickerFor({ticketId, lines});
  }

  function onDelete(): void {
    if (!token) return;
    Alert.alert(t.vehicle.removeTitle, t.vehicle.removeMessage, [
      {text: t.common.cancel, style: "cancel"},
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () => {
          void removeProfile(profileId, token)
            .then(() => {
              void refresh();
              onChanged?.();
              onClose();
            })
            .catch((err: unknown) => setError(toMessage(err)));
        },
      },
    ]);
  }

  return (
    <>
      <Overlay
        visible
        variant="sheet"
        title={profile?.label || t.vehicle.details}
        closeLabel={t.common.close}
        onClose={onClose}
        actions={actions}
        actionLayout="ticket"
        scrollable
      >
        {loading && profile === null ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {error ? <Text style={[styles.small, {color: theme.danger}]}>{error}</Text> : null}
        {profile ? (
          <View style={styles.body}>
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.head}>
                <View style={[styles.icon, {backgroundColor: `${theme.primary}22`}]}>
                  <MaterialCommunityIcons name={vehicleIcon(profile.type)} size={28} color={theme.primary} />
                </View>
                <View style={styles.headText}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, {color: theme.text}]}>{profile.label || vehicleTypeName(profile.type, t)}</Text>
                    {isActive ? <View style={[styles.activePill, {backgroundColor: theme.primary}]}><Text style={styles.activeText}>{t.vehicle.active}</Text></View> : null}
                  </View>
                  <Text style={[styles.small, {color: theme.muted}]}>{[profile.plate, vehicleTypeName(profile.type, t), vehicleMeta(profile.baseWidth, profile.baseHeight)].filter((value) => typeof value === "string" && value !== "").join(" · ")}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <Text style={[styles.section, {color: theme.text}]}>{t.vehicle.history}</Text>
              {history === null ? <Text style={[styles.small, {color: theme.muted}]}>{t.vehicle.loading}</Text> : null}
              {history !== null && history.items.length === 0 ? <Text style={[styles.small, {color: theme.muted}]}>{t.vehicle.historyEmpty}</Text> : null}
              {history?.items.map((item) => {
                const activeLines = item.lines.filter((line) => {
                  if (line.claim !== null) return false;
                  const until = line.warrantyUntil === null ? null : Date.parse(line.warrantyUntil);
                  return until !== null && Number.isFinite(until) && until > Date.now();
                });
                const provider = item.provider ?? null;
                return (
                  <View key={item.ticketId} style={[styles.historyItem, {borderColor: theme.divider}]}>
                    <View style={styles.row}>
                      <Pressable
                        style={styles.historyHead}
                        onPress={() => provider ? setShopFor(provider) : undefined}
                        disabled={provider === null}
                        accessibilityRole={provider ? "button" : undefined}
                        accessibilityLabel={provider?.name ?? item.providerName ?? item.ticketType}
                      >
                        <Text style={[styles.historyDate, {color: theme.text}]}>{billDateLabel(item.serviceDate)}</Text>
                        <View style={styles.shopLinkRow}>
                          <MaterialIcons name="storefront" size={13} color={theme.primary} />
                          <Text style={[styles.shopLink, {color: theme.primary}]} numberOfLines={1}>
                            {provider?.name ?? item.providerName ?? item.ticketType}
                          </Text>
                          
                        </View>
                      </Pressable>
                      <Text style={[styles.amount, {color: theme.text}]}>{`${item.total.toLocaleString()} VND`}</Text>
                    </View>
                    {item.lines.map((line) => warrantyLine(line, t, theme))}
                    {activeLines.length > 0 ? (
                      <Pressable
                        style={[styles.claimBtn, {borderColor: theme.primary}]}
                        onPress={() => onClaim(item.ticketId, activeLines)}
                        accessibilityRole="button"
                        accessibilityLabel={t.bills.claimWarranty}
                      >
                        <MaterialIcons name="verified-user" size={15} color={theme.primary} />
                        <Text style={[styles.claimText, {color: theme.primary}]}>{t.bills.claimWarranty}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </Overlay>
      {editOpen && profile ? (
        <VehicleEditDialog
          t={t}
          theme={theme}
          token={token}
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void load();
            onChanged?.();
          }}
        />
      ) : null}
      <Overlay
        visible={claimPickerFor !== null}
        variant="dialog"
        title={t.bills.claimWarranty}
        closeLabel={t.common.close}
        onClose={() => setClaimPickerFor(null)}
        actions={[]}
      >
        <View style={styles.body}>
          {(claimPickerFor?.lines ?? []).map((line) => (
            <Pressable
              key={line.lineId}
              style={[styles.optionRow, {borderColor: theme.border}]}
              onPress={() => {
                const ticketId = claimPickerFor?.ticketId ?? "";
                setClaimPickerFor(null);
                if (ticketId !== "") setClaimFor({ticketId, lineId: line.lineId, name: line.name});
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.lineName, {color: theme.text, flex: 1}]}>{line.name}</Text>
              
            </Pressable>
          ))}
        </View>
      </Overlay>
      {shopFor ? (
        <ShopDetailSheet
          t={t}
          shop={shopFor}
          openLabel={shopFor.accepting === false ? t.shop.closed : t.shop.open}
          openColor={shopFor.accepting === false ? theme.danger : theme.primary}
          serviceChannel="ASSIST"
          onClose={() => setShopFor(null)}
        />
      ) : null}
      <WarrantyClaimDialog
        visible={claimFor !== null}
        ticketId={claimFor?.ticketId ?? ""}
        line={claimFor}
        token={token}
        theme={theme}
        t={t}
        onClose={() => setClaimFor(null)}
        onFiled={async () => {
          setClaimFor(null);
          await load();
          onChanged?.();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  loader: {marginTop: 24},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 10},
  head: {flexDirection: "row", alignItems: "center", gap: 12},
  icon: {width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, gap: 4},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {fontSize: 20, fontWeight: "800", flexShrink: 1},
  activePill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  activeText: {color: "#fff", fontSize: 10, fontWeight: "800"},
  section: {fontSize: 13, fontWeight: "800"},
  historyItem: {borderTopWidth: 1, paddingTop: 8, gap: 6},
  historyHead: {flex: 1, gap: 3},
  historyDate: {fontSize: 13, fontWeight: "700"},
  shopLinkRow: {flexDirection: "row", alignItems: "center", gap: 3},
  shopLink: {fontSize: 12, fontWeight: "700", flexShrink: 1},
  claimBtn: {borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6},
  claimText: {fontSize: 12, fontWeight: "700"},
  optionRow: {borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 8},
  line: {borderTopWidth: 1, paddingTop: 6, gap: 3},
  row: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  lineName: {flex: 1, fontSize: 13, fontWeight: "600"},
  amount: {fontSize: 13, fontWeight: "700"},
  small: {fontSize: 11, lineHeight: 16},
  link: {fontSize: 12, fontWeight: "700"},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
});
