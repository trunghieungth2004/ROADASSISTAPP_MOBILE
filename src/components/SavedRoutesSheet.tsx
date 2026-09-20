import {useEffect, useState} from "react";
import {ActivityIndicator, FlatList, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {deleteSavedRoute, listSavedRoutes, renameSavedRoute, type SavedRouteSummary} from "../api/routes";
import {toMessage} from "../api/client";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
type Props = {t: Strings; token: string | null; onOpen: (routeId: string) => void; onClose: () => void};
export default function SavedRoutesSheet({t, token, onOpen, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<SavedRouteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listSavedRoutes(token)
      .then((list) => {
        if (alive) setRoutes(list);
      })
      .catch((err) => {
        if (alive) setError(toMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);
  async function onRename(routeId: string) {
    if (!token || name.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await renameSavedRoute(routeId, name.trim(), token);
      setRoutes((prev) => prev.map((r) => (r.id === routeId ? {...r, name: name.trim()} : r)));
      setRenamingId(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(routeId: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSavedRoute(routeId, token);
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: insets.bottom + 12}]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{t.saved.title}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
      {loading ? <Text style={{color: theme.muted}}>{t.route.searching}</Text> : null}
      {!loading && routes.length === 0 && !error ? <Text style={{color: theme.muted}}>{t.saved.empty}</Text> : null}
      <FlatList
        style={styles.list}
        data={routes}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({item: r}) => (
          <View style={styles.rowWrap}>
            {renamingId === r.id ? (
              <View style={styles.renameRow}>
                <TextInput style={[styles.renameInput, {borderColor: theme.border, color: theme.text}]} value={name} onChangeText={setName} maxLength={120} autoFocus placeholder={t.saved.name} placeholderTextColor={theme.muted} />
                <Pressable disabled={busy || name.trim().length === 0} onPress={() => void onRename(r.id)} accessibilityRole="button" accessibilityLabel={t.common.save}>
                  <MaterialIcons name="check" size={22} color={theme.primary} />
                </Pressable>
                <Pressable disabled={busy} onPress={() => setRenamingId(null)} accessibilityRole="button" accessibilityLabel={t.common.close}>
                  <MaterialIcons name="close" size={22} color={theme.muted} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowName, {color: theme.text}]} numberOfLines={1}>{r.name ?? `${r.originLat.toFixed(3)},${r.originLng.toFixed(3)} → ${r.destLat.toFixed(3)},${r.destLng.toFixed(3)}`}</Text>
                  <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={1}>
                    {r.distanceMeters != null ? `${(r.distanceMeters / 1000).toFixed(r.distanceMeters < 10000 ? 1 : 0)} ${t.route.km} · ` : ""}
                    {r.durationSeconds != null ? `${Math.round(r.durationSeconds / 60)} ${t.route.min} · ` : ""}
                    {(r.stops?.length ?? 0) > 0 ? `${r.stops?.length} · ` : ""}
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                  </Text>
                </View>
                {busy ? <ActivityIndicator size="small" color={theme.primary} /> : null}
                <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}]} disabled={busy} onPress={() => onOpen(r.id)}>
                  <Text style={styles.actionBtnText}>{t.saved.load}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.border}]} disabled={busy} onPress={() => { setRenamingId(r.id); setName(r.name ?? ""); }}>
                  <Text style={[styles.actionBtnText, {color: theme.text}]}>{t.saved.rename}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.danger}]} disabled={busy} onPress={() => void onDelete(r.id)}>
                  <Text style={[styles.actionBtnText, {color: theme.danger}]}>{t.saved.delete}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "85%"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  list: {flexGrow: 0},
  rowWrap: {paddingVertical: 6},
  row: {flexDirection: "row", alignItems: "center", gap: 6},
  rowMain: {flex: 1, minWidth: 0, gap: 2},
  rowName: {fontSize: 14, fontWeight: "600"},
  rowMeta: {fontSize: 12},
  actionBtn: {borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10},
  actionBtnOutline: {borderWidth: 1, backgroundColor: "transparent"},
  actionBtnText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  renameRow: {flexDirection: "row", alignItems: "center", gap: 8},
  renameInput: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
});
