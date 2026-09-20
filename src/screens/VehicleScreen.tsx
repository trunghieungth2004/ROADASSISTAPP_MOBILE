import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {addRideConfig, createProfile, listProfiles, setTowVehicle, VEHICLE_DEFAULT_WIDTH, type VehicleProfile, type VehicleType} from "../api/vehicles";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
const TYPES: VehicleType[] = ["SCOOTER", "CUB", "MANUAL", "CAR", "VAN", "TRUCK"];
export default function VehicleScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, activateVehicle, refresh} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [profiles, setProfiles] = useState<VehicleProfile[]>([]);
  const [type, setType] = useState<VehicleType>("SCOOTER");
  const [width, setWidth] = useState("0.7");
  const [height, setHeight] = useState("1.1");
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useCallback(async () => { if (!token) return; try { setProfiles(await listProfiles(token)); await refresh(); } catch (err) { setError(toMessage(err)); } }, [token, refresh]);
  useEffect(() => { void reload(); }, [reload]);
  async function onAdd() {
    if (!token) return;
    setBusy(true); setError(null);
    try { const created = await createProfile({type, baseWidth: Number(width), baseHeight: Number(height)}, token); await addRideConfig({profileId: created.id, configType: "SOLO"}, token); setNotice(t.vehicle.added); setDialogOpen(false); await reload(); } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  function onTypeChange(next: VehicleType) {
    setType(next);
    setWidth(String(VEHICLE_DEFAULT_WIDTH[next] ?? 0.7));
    setHeight(next === "CAR" ? "1.5" : "1.1");
  }
  async function onTow(p: VehicleProfile) { if (!token) return; try { const designate = p.type === "VAN" ? "VAN" : p.type === "TRUCK" ? "TRUCK" : "CAR"; await setTowVehicle(p.id, p.towVehicleType ? null : designate, token); await reload(); } catch (err) { setError(toMessage(err)); } }
  return (
    <ScreenContainer>
      <View style={[styles.wrapper, {backgroundColor: theme.background}]}>
        <FlatList contentContainerStyle={styles.container} data={profiles} keyExtractor={(p) => p.id} ListHeaderComponent={<View style={styles.header}><Text style={[styles.title, {color: theme.text}]}>{t.vehicle.title}</Text>{error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}{notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}</View>} renderItem={({item: p}) => (
          <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.cardRow}><View style={styles.cardText}><Text style={[styles.cardTitle, {color: theme.text}]}>{p.type} · {p.baseWidth}×{p.baseHeight}m{activeVehicle?.id === p.id ? ` · ${t.vehicle.active}` : ""}{p.towVehicleType ? ` · ${p.towVehicleType}` : ""}</Text><Text style={[styles.cardSub, {color: theme.muted}]}>{t.vehicle.width}: {p.baseWidth} m</Text></View>{activeVehicle?.id !== p.id ? <Pressable style={[styles.smallBtn, {borderColor: theme.primary}]} onPress={() => void activateVehicle(p.id).then(reload)}><Text style={[styles.smallBtnText, {color: theme.primary}]}>{t.vehicle.setActive}</Text></Pressable> : null}</View>
            {p.type === "CAR" || p.type === "VAN" || p.type === "TRUCK" ? <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onTow(p)}><Text style={[styles.chipText, {color: theme.primary}]}>{p.towVehicleType ? t.vehicle.towClear : t.vehicle.towDesignate}</Text></Pressable> : null}
          </View>
        )} ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.vehicle.empty}</Text>} />
        <Pressable style={[styles.fab, {backgroundColor: theme.primary}]} onPress={() => setDialogOpen(true)}><MaterialIcons name="add" size={24} color="#fff" /></Pressable>
        <Modal visible={dialogOpen} transparent animationType="fade" onRequestClose={() => setDialogOpen(false)}>
          <View style={styles.modalOverlay}><View style={[styles.modalCard, {backgroundColor: theme.paper}]}><Text style={[styles.modalTitle, {color: theme.text}]}>{t.vehicle.create}</Text><Text style={[styles.fieldLabel, {color: theme.text}]}>{t.vehicle.type}</Text><View style={styles.row}>{TYPES.map((vt) => (<Pressable key={vt} style={[styles.chip, {borderColor: theme.primary}, type === vt && {backgroundColor: theme.primary}]} onPress={() => onTypeChange(vt)}><Text style={[styles.chipText, {color: type === vt ? "#fff" : theme.primary}]}>{t.vehicle.types[vt as keyof typeof t.vehicle.types] ?? vt}</Text></Pressable>))}</View><Text style={[styles.fieldLabel, {color: theme.text}]}>{t.vehicle.widthMeters}</Text><TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={width} onChangeText={setWidth} keyboardType="numeric" /><Text style={[styles.fieldLabel, {color: theme.text}]}>{t.vehicle.height}</Text><TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={height} onChangeText={setHeight} keyboardType="numeric" /><View style={styles.modalActions}><Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => setDialogOpen(false)}><Text style={{color: theme.text}}>{t.common.close}</Text></Pressable><Pressable style={[styles.primary, {backgroundColor: theme.primary, opacity: busy ? 0.6 : 1}]} disabled={busy} onPress={() => void onAdd()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.common.save}</Text>}</Pressable></View></View></View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  wrapper: {flex: 1},
  container: {padding: 16, gap: 8},
  header: {gap: 8, marginBottom: 8},
  title: {fontSize: 20, fontWeight: "700"},
  error: {fontSize: 13},
  notice: {fontSize: 13},
  row: {flexDirection: "row", gap: 6, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10},
  chipText: {fontSize: 12, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  primary: {borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center"},
  primaryText: {color: "#fff", fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8},
  cardRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  cardText: {flex: 1, gap: 2},
  cardTitle: {fontWeight: "700", fontSize: 14},
  cardSub: {fontSize: 12},
  smallBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 10},
  smallBtnText: {fontSize: 12, fontWeight: "600"},
  hint: {textAlign: "center", marginTop: 24},
  fab: {position: "absolute", right: 16, bottom: 72, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: {width: 0, height: 2}},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  fieldLabel: {fontSize: 13, fontWeight: "600", marginBottom: -6},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 4},
});
