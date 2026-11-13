import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View} from "react-native";
import {useAppMode} from "../context/ThemeContext";
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
import VehicleDetailsSheet from "./VehicleDetailsSheet";
import {vehicleMeta, vehicleTypeName} from "../components/vehicles/vehicleMeta";
import {vehicleIcon} from "./route/routeGeo";

export default function VehicleScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, refresh} = useProfile();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<VehicleProfile[]>([]);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
              <Pressable
                style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}
                onPress={() => setDetailFor(p.id)}
                accessibilityRole="button"
                accessibilityLabel={p.label || vehicleTypeName(p.type, t)}
              >
                <MaterialCommunityIcons name={vehicleIcon(p.type)} size={26} color={theme.primary} />
                <View style={styles.cardText}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, {color: theme.text}]} numberOfLines={1}>{p.label || p.plate || t.vehicle.myVehicle}</Text>
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
                  <Text style={[styles.cardSub, {color: theme.muted}]}>
                    {[p.plate, vehicleMeta(p.baseWidth, p.baseHeight)].filter((value) => typeof value === "string" && value !== "").join(" · ")}
                  </Text>
                </View>
                
              </Pressable>
            )}
          />
        )}
      </View>
      {error ? (
        <Snack message={error} severity="error" bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
      {detailFor ? (
        <VehicleDetailsSheet
          profileId={detailFor}
          onClose={() => setDetailFor(null)}
          onChanged={() => void reload()}
        />
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
  card: {borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10},
  cardText: {flex: 1, minWidth: 0, gap: 3},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  cardTitle: {fontSize: 15, fontWeight: "700"},
  statusChip: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  statusChipText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  cardSub: {fontSize: 12},
  hint: {textAlign: "center", marginTop: 24},
});
