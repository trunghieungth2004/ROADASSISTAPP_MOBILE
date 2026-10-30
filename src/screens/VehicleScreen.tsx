import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View} from "react-native";
import {useAppMode} from "../context/ThemeContext";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {listProfiles, removeProfile, type VehicleProfile} from "../api/vehicles";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import StatusRow from "../components/ui/StatusRow";
import Overlay from "../components/overlay/Overlay";
import {snackBottom} from "../components/ui/snackOffset";
import VehicleCreateDialog from "../components/vehicles/VehicleCreateDialog";
import RideSetupDialog from "../components/vehicles/RideSetupDialog";
import {vehicleMeta, vehicleTypeName} from "../components/vehicles/vehicleMeta";
import {vehicleIcon} from "./route/routeGeo";

export default function VehicleScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, activateVehicle, refresh} = useProfile();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<VehicleProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBusy, setActiveBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [setupFor, setSetupFor] = useState<VehicleProfile | null>(null);
  const [removeFor, setRemoveFor] = useState<VehicleProfile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<void> => {
      if (!token) {
        setProfiles([]);
        return;
      }
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        setProfiles(await listProfiles(token));
        await refresh();
      } catch (err) {
        setError(toMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, refresh],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  async function onActivate(id: string): Promise<void> {
    if (!token || activeBusy) return;
    setActiveBusy(true);
    setError(null);
    try {
      await activateVehicle(id);
      setNotice(t.vehicle.activeSaved);
      await reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setActiveBusy(false);
    }
  }
  async function onRemove(): Promise<void> {
    if (!token || !removeFor || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await removeProfile(removeFor.id, token);
      setRemoveFor(null);
      setNotice(t.vehicle.removed);
      await reload();
      await refresh();
    } catch (err) {
      setRemoveError(toMessage(err));
    } finally {
      setRemoveBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <View style={[styles.wrapper, {backgroundColor: theme.background}]}>
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.text}]}>{t.vehicle.title}</Text>
          <Pressable style={[styles.addBtn, {backgroundColor: theme.primary}]} onPress={() => setCreateOpen(true)} accessibilityRole="button" accessibilityLabel={t.vehicle.create}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>{t.vehicle.create}</Text>
          </Pressable>
        </View>
        {loading ? (
          <StatusRow theme={theme} text={t.vehicle.loading} />
        ) : (
          <FlatList
            contentContainerStyle={styles.container}
            data={profiles}
            keyExtractor={(p) => p.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload("refresh")} tintColor={theme.primary} />}
            ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.vehicle.empty}</Text>}
            renderItem={({item: p}) => (
              <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                <View style={styles.cardRow}>
                  <Pressable style={styles.body} onPress={() => setSetupFor(p)} accessibilityRole="button">
                    <MaterialCommunityIcons name={vehicleIcon(p.type)} size={24} color={theme.primary} />
                    <View style={styles.cardText}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, {color: theme.text}]}>{vehicleTypeName(p.type, t)}</Text>
                        {activeVehicle?.id === p.id ? (
                          <View style={[styles.statusChip, {backgroundColor: theme.primary}]}>
                            <Text style={styles.statusChipText}>{t.vehicle.active}</Text>
                          </View>
                        ) : null}
                        {(p.providerLinks ?? []).map((link) => (
                          <View key={link.id} style={[styles.statusChip, {backgroundColor: theme.muted}]}>
                            <Text style={styles.statusChipText}>{link.kind === "TOW" ? t.roles.tow : link.kind === "MOBILE_SHOP" ? t.roles.mobileShop : t.roles.shop}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={[styles.cardSub, {color: theme.muted}]}>{vehicleMeta(p.baseWidth, p.baseHeight)}</Text>
                    </View>
                  </Pressable>
                  {activeVehicle?.id !== p.id ? (
                    <Pressable style={[styles.smallBtn, {borderColor: theme.primary}, activeBusy && styles.disabled]} disabled={activeBusy} onPress={() => void onActivate(p.id)} accessibilityRole="button" accessibilityLabel={t.vehicle.setActive}>
                      <Text style={[styles.smallBtnText, {color: theme.primary}]}>{t.vehicle.setActive}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.iconBtn, {borderColor: theme.danger}]} onPress={() => { setRemoveFor(p); setRemoveError(null); }} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                    <MaterialIcons name="delete-outline" size={18} color={theme.danger} />
                  </Pressable>
                </View>

              </View>
            )}
          />
        )}
      </View>
      {error ? (
        <Snack message={error} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
      {removeFor ? (
        <Overlay
          visible
          variant="dialog"
          title={t.vehicle.removeTitle}
          closeLabel={t.common.cancel}
          onClose={() => setRemoveFor(null)}
          actionLayout="confirm"
          actions={[
            {label: t.common.delete, tone: "danger", busy: removeBusy, onPress: () => void onRemove()},
            {label: t.common.cancel, tone: "neutral", outline: true, group: "secondary", onPress: () => setRemoveFor(null)},
          ]}
        >
          <Text style={{color: theme.text}}>{t.vehicle.removeMessage}</Text>
          {removeFor.providerLinks && removeFor.providerLinks.length > 0 ? (
            <Text style={{color: theme.danger}}>
              {t.vehicle.removeProviderWarning.replace("{n}", String(removeFor.providerLinks.length))}
            </Text>
          ) : null}
          {removeError ? <Text style={{color: theme.danger}}>{removeError}</Text> : null}
        </Overlay>
      ) : null}
      {createOpen ? (
        <VehicleCreateDialog
          t={t}
          theme={theme}
          token={token}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice(t.vehicle.added);
            void reload();
          }}
        />
      ) : null}
      {setupFor ? (
        <RideSetupDialog
          t={t}
          theme={theme}
          token={token}
          title={`${t.vehicle.rideSetup} · ${vehicleTypeName(setupFor.type, t)}`}
          profileId={setupFor.id}
          onClose={() => setSetupFor(null)}
          onSaved={() => {
            setSetupFor(null);
            setNotice(t.vehicle.rideSaved);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  header: {padding: 16, paddingBottom: 4, gap: 12},
  title: {fontSize: 20, fontWeight: "700"},
  addBtn: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, padding: 12},
  addBtnText: {color: "#fff", fontWeight: "700"},
  container: {padding: 16, gap: 8},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8},
  cardRow: {flexDirection: "row", alignItems: "center", gap: 8},
  body: {flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0},
  cardText: {flex: 1, minWidth: 0, gap: 2},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 8},
  cardTitle: {fontSize: 15, fontWeight: "700"},
  statusChip: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  statusChipText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  cardSub: {fontSize: 12},
  smallBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  smallBtnText: {fontSize: 12, fontWeight: "600"},
  iconBtn: {width: 34, height: 34, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center"},
  hint: {textAlign: "center", marginTop: 24},
  disabled: {opacity: 0.6},
});
