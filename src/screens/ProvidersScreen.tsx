import {useCallback, useState} from "react";
import {Keyboard, Pressable, ScrollView, StyleSheet, Switch, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {missingKinds, providerPill, providerRowSubtitle, switchEnabled} from "./more/providerUi";
import {myProviders, updateProvider, type Provider} from "../api/providers";
import ProviderFormDialog from "../components/providers/ProviderFormDialog";

export default function ProvidersScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {mode} = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerCreate, setProviderCreate] = useState<"SHOP" | "TOW" | "MOBILE_SHOP" | null>(null);
  const [providerEdit, setProviderEdit] = useState<Provider | null>(null);
  const loadProviders = useCallback(async (): Promise<void> => {
    if (!token) {
      setProviders([]);
      return;
    }
    try {
      setProviders(await myProviders(token));
    } catch (err) {
      setProviderError(toMessage(err));
    }
  }, [token]);
  useFocusEffect(useCallback(() => {
    void loadProviders();
  }, [loadProviders]));
  async function onProviderToggle(provider: Provider, next: boolean): Promise<void> {
    if (!token || providerBusy) return;
    setProviderBusy(true);
    setProviderError(null);
    try {
      await updateProvider({providerId: provider.id, accepting: next}, token);
      await loadProviders();
      setNotice(t.more.saved);
    } catch (err) {
      setProviderError(toMessage(err));
    } finally {
      setProviderBusy(false);
    }
  }
  const missing = missingKinds(providers);
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.text}]}>{t.provider.title}</Text>
          {missing.shop || missing.tow || missing.mobileShop ? (
            <View style={styles.headerBtns}>
              {missing.mobileShop ? (
                <Pressable style={[styles.addBtn, {backgroundColor: theme.primary}]} onPress={() => setProviderCreate("MOBILE_SHOP")} accessibilityRole="button" accessibilityLabel={t.provider.addMobileShop}>
                  <MaterialIcons name="build" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>{t.provider.addMobileShop}</Text>
                </Pressable>
              ) : null}
              {missing.shop ? (
                <Pressable style={[styles.addBtn, {backgroundColor: theme.primary}]} onPress={() => setProviderCreate("SHOP")} accessibilityRole="button" accessibilityLabel={t.provider.addShop}>
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>{t.provider.addShop}</Text>
                </Pressable>
              ) : null}
              {missing.tow ? (
                <Pressable style={[styles.addBtn, {backgroundColor: theme.primary}]} onPress={() => setProviderCreate("TOW")} accessibilityRole="button" accessibilityLabel={t.provider.registerTow}>
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>{t.provider.registerTow}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          {providers.map((provider, index) => {
            const pill = providerPill(provider, t);
            const pillBg = pill.tone === "on" ? theme.primary : pill.tone === "alert" ? theme.danger : theme.divider;
            const pillFg = pill.tone === "off" ? theme.text : "#fff";
            const note = provider.suspended === true && typeof provider.suspendedReason === "string" && provider.suspendedReason ?
              provider.suspendedReason :
              provider.status === "DENIED" && typeof provider.reviewNote === "string" && provider.reviewNote ?
                provider.reviewNote :
                null;
            return (
              <View key={provider.id}>
                {index === 0 ? null : <View style={[styles.divider, {backgroundColor: theme.divider}]} />}
                <View style={styles.listRow}>
                  <MaterialIcons name={provider.kind === "TOW" ? "local-shipping" : provider.kind === "MOBILE_SHOP" ? "build" : "storefront"} size={20} color={theme.primary} />
                  <Pressable style={styles.permText} onPress={() => setProviderEdit(provider)} accessibilityRole="button" accessibilityLabel={`${provider.name}, ${pill.label}`}>
                    <Text style={[styles.listText, {color: theme.text}]}>{provider.name}</Text>
                    <Text style={[styles.permHint, {color: theme.muted}]}>{providerRowSubtitle(provider, t)}</Text>
                    {note ? <Text style={[styles.permHint, {color: theme.muted}]}>{note}</Text> : null}
                  </Pressable>
                  <View style={[styles.permPill, {backgroundColor: pillBg}]}>
                    <Text style={[styles.permPillText, {color: pillFg}]}>{pill.label}</Text>
                  </View>
                  <Switch value={provider.accepting !== false} onValueChange={(v) => void onProviderToggle(provider, v)} disabled={!switchEnabled(provider, providerBusy)} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
                </View>
                {provider.kind === "TOW" && provider.status === "DENIED" ? (
                  <View style={styles.providerCtas}>
                    <Pressable style={[styles.permBtn, {borderColor: theme.border}]} onPress={() => setProviderCreate("TOW")} accessibilityRole="button" accessibilityLabel={t.provider.reapplyTow}>
                      <Text style={[styles.permBtnText, {color: theme.primary}]}>{t.provider.reapplyTow}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {providerCreate ? (
          <ProviderFormDialog t={t} token={token} kind={providerCreate} provider={null} onClose={() => { Keyboard.dismiss(); setProviderCreate(null); }} onSaved={() => { setProviderCreate(null); setNotice(t.provider.saved); void loadProviders(); }} />
        ) : null}
        {providerEdit ? (
          <ProviderFormDialog t={t} token={token} kind={providerEdit.kind} provider={providerEdit} onClose={() => { Keyboard.dismiss(); setProviderEdit(null); }} onSaved={() => { setProviderEdit(null); setNotice(t.provider.saved); void loadProviders(); }} />
        ) : null}
      </ScrollView>
      {providerError ? (
        <Snack message={providerError} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setProviderError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12},
  header: {gap: 12},
  title: {fontSize: 20, fontWeight: "700"},
  headerBtns: {flexDirection: "row", gap: 8},
  addBtn: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, padding: 12},
  addBtnText: {color: "#fff", fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  permText: {flex: 1, minWidth: 0, gap: 2},
  permHint: {fontSize: 12},
  permPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  permPillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  permBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  permBtnText: {fontSize: 13, fontWeight: "700"},
  divider: {height: 1, marginHorizontal: 16},
  providerCtas: {flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14},
});
