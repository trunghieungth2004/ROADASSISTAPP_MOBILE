import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {listProfiles, type VehicleProfile} from "../api/vehicles";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import StatusRow from "../components/ui/StatusRow";
import {snackBottom} from "../components/ui/snackOffset";
import VehicleCreateDialog from "../components/vehicles/VehicleCreateDialog";
import RideSetupDialog from "../components/vehicles/RideSetupDialog";
import {vehicleMeta, vehicleTypeName} from "../components/vehicles/vehicleMeta";
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
                      </View>
                      <Text style={[styles.cardSub, {color: theme.muted}]}>{vehicleMeta(p.baseWidth, p.baseHeight)}</Text>
                    </View>
                  </Pressable>
                  {activeVehicle?.id !== p.id ? (
                    <Pressable style={[styles.smallBtn, {borderColor: theme.primary}, activeBusy && styles.disabled]} disabled={activeBusy} onPress={() => void onActivate(p.id)} accessibilityRole="button" accessibilityLabel={t.vehicle.setActive}>
                      <Text style={[styles.smallBtnText, {color: theme.primary}]}>{t.vehicle.setActive}</Text>
                    </Pressable>
                  ) : null}
                </View>

              </View>
            )}
          />
        )}
      </View>
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
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
  hint: {textAlign: "center", marginTop: 24},
  disabled: {opacity: 0.6},
});
