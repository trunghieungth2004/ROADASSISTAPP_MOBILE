import {useCallback, useState} from "react";
import {Pressable, StyleSheet, Switch, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect} from "@react-navigation/native";
import {setVolunteerAvailability, volunteerHeartbeat} from "../api/users";
import {pingProviderLocation, updateProvider, type Provider} from "../api/providers";
import {capturePosition, lastBeat, markBeat} from "../services/locationBeats";
import {switchEnabled} from "./more/providerUi";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";

type Props = {
  providers: Provider[];
  onProvidersChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

export default function DutySection({providers, onProvidersChanged, onNotice, onError}: Props) {
  const {t} = useStrings();
  const {token} = useAuth();
  const {user, refresh} = useProfile();
  const {mode} = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [volBusy, setVolBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => {
    setTick((n) => n + 1);
  }, []));
  const isVolunteer = (user?.services ?? []).includes("VOLUNTEER");
  const volunteerOn = user?.volunteerAvailable === true;
  const towDuty = providers.filter((p) => p.kind === "TOW");
  const shopDuty = providers.filter((p) => p.kind === "SHOP");
  const towOn = towDuty.some((p) => p.accepting !== false);
  const shopOn = shopDuty.some((p) => p.accepting !== false);
  void tick;
  const towBeat = lastBeat("tower");
  const towFresh = towBeat !== null && Date.now() - towBeat < 15 * 60 * 1000;
  async function onVolunteerToggle(next: boolean): Promise<void> {
    if (!token || volBusy) return;
    setVolBusy(true);
    try {
      await setVolunteerAvailability({available: next}, token);
      await refresh();
      if (next && token) {
        const pos = await capturePosition();
        if (pos) {
          await volunteerHeartbeat(pos.lat, pos.lng, token);
          markBeat("volunteer");
        }
      }
      onNotice(t.more.saved);
    } catch (err) {
      onError(toMessage(err));
    } finally {
      setVolBusy(false);
    }
  }
  async function onDutyToggle(kind: "TOW" | "SHOP", next: boolean): Promise<void> {
    if (!token || providerBusy) return;
    setProviderBusy(true);
    try {
      const targets = providers.filter((p) => p.kind === kind && switchEnabled(p, false));
      if (targets.length === 0) {
        onNotice(kind === "TOW" ? t.more.dutyTowOff : t.more.dutyShopOff);
        return;
      }
      for (const target of targets) {
        await updateProvider({providerId: target.id, accepting: next}, token);
      }
      onProvidersChanged();
      if (next && kind === "TOW") {
        const pos = await capturePosition();
        if (pos) {
          await pingProviderLocation(pos.lat, pos.lng, token);
          markBeat("tower");
        }
      }
      setTick((n) => n + 1);
      onNotice(t.more.saved);
    } catch (err) {
      onError(toMessage(err));
    } finally {
      setProviderBusy(false);
    }
  }
  if (!isVolunteer && towDuty.length === 0 && shopDuty.length === 0) return null;
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      {isVolunteer ? (
        <Pressable style={styles.listRow} onPress={() => void onVolunteerToggle(!volunteerOn)} accessibilityRole="switch" accessibilityState={{checked: volunteerOn}} accessibilityLabel={t.more.volTitle}>
          <MaterialIcons name="volunteer-activism" size={20} color={theme.primary} />
          <View style={styles.permText}>
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.volTitle}</Text>
          </View>
          <View style={[styles.permPill, {backgroundColor: volunteerOn ? theme.primary : theme.divider}]}>
            <Text style={styles.permPillText}>{volunteerOn ? t.more.permOn : t.more.permOff}</Text>
          </View>
          <View pointerEvents="none">
            <Switch value={volunteerOn} onValueChange={(v) => void onVolunteerToggle(v)} disabled={volBusy} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" />
          </View>
        </Pressable>
      ) : null}
      {isVolunteer && towDuty.length > 0 ? <View style={[styles.divider, {backgroundColor: theme.divider}]} /> : null}
      {towDuty.length > 0 ? (
        <Pressable style={styles.listRow} onPress={() => void onDutyToggle("TOW", !towOn)} accessibilityRole="switch" accessibilityState={{checked: towOn}} accessibilityLabel={t.more.dutyTow}>
          <MaterialIcons name="local-shipping" size={20} color={theme.primary} />
          <View style={styles.permText}>
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.dutyTow}</Text>
            <Text style={[styles.permHint, {color: theme.muted}]}>{!towOn ? t.more.dutyTowOff : towFresh ? t.more.dutyTowOn : t.more.dutyWaiting}</Text>
          </View>
          <View style={[styles.permPill, {backgroundColor: towOn ? theme.primary : theme.divider}]}><Text style={styles.permPillText}>{towOn ? t.more.permOn : t.more.permOff}</Text></View>
          <View pointerEvents="none"><Switch value={towOn} onValueChange={(v) => void onDutyToggle("TOW", v)} disabled={providerBusy} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View>
        </Pressable>
      ) : null}
      {(isVolunteer || towDuty.length > 0) && shopDuty.length > 0 ? <View style={[styles.divider, {backgroundColor: theme.divider}]} /> : null}
      {shopDuty.length > 0 ? (
        <Pressable style={styles.listRow} onPress={() => void onDutyToggle("SHOP", !shopOn)} accessibilityRole="switch" accessibilityState={{checked: shopOn}} accessibilityLabel={t.more.dutyShop}>
          <MaterialIcons name="storefront" size={20} color={theme.primary} />
          <View style={styles.permText}>
            <Text style={[styles.listText, {color: theme.text}]}>{t.more.dutyShop}</Text>
            <Text style={[styles.permHint, {color: theme.muted}]}>{shopOn ? t.more.dutyShopOn : t.more.dutyShopOff}</Text>
          </View>
          <View style={[styles.permPill, {backgroundColor: shopOn ? theme.primary : theme.divider}]}><Text style={styles.permPillText}>{shopOn ? t.more.permOn : t.more.permOff}</Text></View>
          <View pointerEvents="none"><Switch value={shopOn} onValueChange={(v) => void onDutyToggle("SHOP", v)} disabled={providerBusy} trackColor={{false: theme.divider, true: theme.primary}} thumbColor="#ffffff" /></View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  listRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  listText: {flex: 1, fontSize: 15, fontWeight: "500"},
  permText: {flex: 1, minWidth: 0, gap: 2},
  permHint: {fontSize: 12},
  permPill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  permPillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  divider: {height: 1, marginHorizontal: 16},
});
