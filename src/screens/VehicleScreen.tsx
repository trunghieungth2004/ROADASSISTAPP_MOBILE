import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {listProfiles, setTowVehicle, type VehicleProfile} from "../api/vehicles";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import Snack from "../components/Snack";
import StatusRow from "../components/StatusRow";
import {Fab} from "../components/Fab";
import {snackAbove} from "../components/snackOffset";
import VehicleCreateSheet from "../components/VehicleCreateSheet";
import RideSetupSheet from "../components/RideSetupSheet";
import {vehicleMeta, vehicleTypeName} from "../components/vehicleMeta";
import {vehicleIcon} from "./route/routeGeo";

export default function VehicleScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, activateVehicle, refresh} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<VehicleProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBusy, setActiveBusy] = useState(false);
  const [towBusyId, setTowBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [setupFor, setSetupFor] = useState<VehicleProfile | null>(null);
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
  async function onTow(p: VehicleProfile): Promise<void> {
    if (!token || towBusyId) return;
    setTowBusyId(p.id);
    setError(null);
    try {
      const designate = p.type === "VAN" ? "VAN" : p.type === "TRUCK" ? "TRUCK" : "CAR";
      await setTowVehicle(p.id, p.towVehicleType ? null : designate, token);
      setNotice(t.vehicle.towSaved);
      await reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setTowBusyId(null);
    }
  }
  const canTow = (p: VehicleProfile): boolean => p.type === "CAR" || p.type === "VAN" || p.type === "TRUCK";
  return (
    <ScreenContainer>
      <View style={[styles.wrapper, {backgroundColor: theme.background}]}>
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.text}]}>{t.vehicle.title}</Text>
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
                      </View>
                      <Text style={[styles.cardSub, {color: theme.muted}]}>{vehicleMeta(p.baseWidth, p.baseHeight, p.towVehicleType, t)}</Text>
                    </View>
                  </Pressable>
                  {activeVehicle?.id !== p.id ? (
                    <Pressable style={[styles.smallBtn, {borderColor: theme.primary}, activeBusy && styles.disabled]} disabled={activeBusy} onPress={() => void onActivate(p.id)} accessibilityRole="button" accessibilityLabel={t.vehicle.setActive}>
                      <Text style={[styles.smallBtnText, {color: theme.primary}]}>{t.vehicle.setActive}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {canTow(p) ? (
                  <View style={styles.actionRow}>
                    <Pressable style={[styles.towBtn, {borderColor: theme.primary}, towBusyId !== null && styles.disabled]} disabled={towBusyId !== null} onPress={() => void onTow(p)} accessibilityRole="button">
                      <Text style={[styles.towText, {color: theme.primary}]}>{p.towVehicleType ? t.vehicle.towClear : t.vehicle.towDesignate}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
        <Fab theme={theme} variant="primary" size={56} label={t.vehicle.create} onPress={() => setCreateOpen(true)} style={{position: "absolute", right: 16, bottom: insets.bottom + 72}}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </Fab>
      </View>
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackAbove(insets.bottom, 24)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackAbove(insets.bottom, 24)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
      {createOpen ? (
        <View style={styles.centerRoot}>
          <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <VehicleCreateSheet
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
          </View>
        </View>
      ) : null}
      {setupFor ? (
        <View style={styles.centerRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSetupFor(null)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <RideSetupSheet
              t={t}
              theme={theme}
              token={token}
              profileId={setupFor.id}
              profileType={setupFor.type}
              onClose={() => setSetupFor(null)}
              onSaved={() => {
                setSetupFor(null);
                setNotice(t.vehicle.rideSaved);
              }}
            />
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  header: {padding: 16, paddingBottom: 4},
  title: {fontSize: 20, fontWeight: "700"},
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
  actionRow: {flexDirection: "row", gap: 8},
  towBtn: {flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center"},
  towText: {fontSize: 13, fontWeight: "600"},
  hint: {textAlign: "center", marginTop: 24},
  centerRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)"},
  backdrop: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
  centerWrap: {width: "100%", paddingHorizontal: 24},
  disabled: {opacity: 0.6},
});
