import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View} from "react-native";
import {useAppMode} from "../context/ThemeContext";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect} from "@react-navigation/native";
import * as Location from "expo-location";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import Overlay from "../components/overlay/Overlay";
import {flagOverlayActions} from "./hazards/flagActions";
import {hazardKind} from "../components/flags/hazardStyle";
import {flagStatusColor, flagStatusLabel} from "../components/flags/flagStatus";
import FlagDetailSheet from "../components/flags/FlagDetailSheet";
import StatusRow from "../components/ui/StatusRow";
import {Fab} from "../components/ui/Fab";
import {snackBottom} from "../components/ui/snackOffset";
import {isStaleForRefresh} from "../components/ui/feedback";
import {drainHazardLaunch, ensurePushConfigured, subscribeHazardPush, type HazardPushData} from "../services/push";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import type {Flag} from "../api/flags";
import {bustFlagCaches, confirmFlag, denyFlag, unflag} from "../api/flags";
import {loadDeniedIds, loadVotedIds, markDenied, markVoted} from "../storage/votedFlags";
import {toMessage} from "../api/client";
import {flagTypeLabel} from "../i18n/labels";
import {distBetween} from "./navigation/navUtils";
import HazardMapView from "./hazards/HazardMapView";
import HazardRow from "./hazards/HazardRow";
import {filterFlags, HAZARD_FILTERS, type HazardFilter} from "./hazards/hazardFilter";
import {useMyFlags} from "./hazards/useMyFlags";
import {useNearbyFlags} from "./hazards/useNearbyFlags";
import ChatSheet from "./assist/ChatSheet";

export default function HazardScreen() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const mine = useMyFlags(token);
  const [tab, setTab] = useState<"mine" | "nearby">("mine");
  const [showMap, setShowMap] = useState(false);
  const [filter, setFilter] = useState<HazardFilter>("ALL");
  const [selected, setSelected] = useState<Flag | null>(null);
  const [chatFlag, setChatFlag] = useState<Flag | null>(null);
  const [focus, setFocus] = useState<{lat: number; lng: number; n: number} | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [pos, setPos] = useState<{lat: number; lng: number} | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());
  const nearby = useNearbyFlags(token, pos, tab === "nearby");
  const focusN = useRef(0);
  const lastRefreshRef = useRef(0);
  const refreshMine = mine.refresh;
  const refreshNearby = nearby.refresh;
  const removeMineLocal = mine.removeLocal;
  const removeNearbyLocal = nearby.removeLocal;
  const clearMineError = mine.clearError;
  const clearNearbyError = nearby.clearError;
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (isStaleForRefresh(lastRefreshRef.current, now)) {
        lastRefreshRef.current = now;
        if (tab === "nearby") refreshNearby();
        else refreshMine();
      }
    }, [tab, refreshMine, refreshNearby]),
  );
  useEffect(() => {
    let alive = true;
    setVotedIds(new Set());
    setDeniedIds(new Set());
    void (async () => {
      try {
        const [v, d] = await Promise.all([loadVotedIds(uid), loadDeniedIds(uid)]);
        if (!alive) return;
        setVotedIds(v);
        setDeniedIds(d);
      } catch {
        return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);
  useEffect(() => {
    void ensurePushConfigured();
    const onHazard = (data: HazardPushData): void => {
      if (token) bustFlagCaches(token);
      if (data.removed) {
        removeMineLocal(data.flagId);
        removeNearbyLocal(data.flagId);
        setSelected((cur) => (cur?.id === data.flagId ? null : cur));
      }
      lastRefreshRef.current = Date.now();
      refreshMine();
      refreshNearby();
    };
    void drainHazardLaunch().then((drained) => {
      if (drained) onHazard(drained);
    });
    return subscribeHazardPush(onHazard, "hazards");
  }, [refreshMine, refreshNearby, removeMineLocal, removeNearbyLocal]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const last = await Location.getLastKnownPositionAsync({maxAge: 300000, requiredAccuracy: 200});
        if (alive && last) setPos({lat: last.coords.latitude, lng: last.coords.longitude});
      } catch {
        return;
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const activeFlags = tab === "nearby" ? nearby.flags : mine.flags;
  const activeError = tab === "nearby" ? nearby.error : mine.error;
  const clearActiveError = tab === "nearby" ? clearNearbyError : clearMineError;
  const activeRefreshing = tab === "nearby" ? nearby.refreshing : mine.refreshing;
  const activeLoading = tab === "nearby" ? nearby.loading : mine.loading;
  const visible = useMemo(() => filterFlags(activeFlags, filter), [activeFlags, filter]);
  function centerOn(flag: Flag): void {
    focusN.current += 1;
    setFocus({lat: flag.lat, lng: flag.lng, n: focusN.current});
  }
  function openFlag(flag: Flag): void {
    centerOn(flag);
    setSelected(flag);
  }
  async function onConfirm(flagId: string): Promise<void> {
    if (!token || voteBusy) return;
    setVoteBusy(true);
    try {
      await confirmFlag(flagId, token);
      await markVoted(uid, flagId);
      setVotedIds((prev) => new Set(prev).add(flagId));
      setSelected(null);
      refreshMine();
      refreshNearby();
    } catch (err) {
      setSnack(toMessage(err));
    } finally {
      setVoteBusy(false);
    }
  }
  async function onDeny(flagId: string): Promise<void> {
    if (!token || voteBusy) return;
    setVoteBusy(true);
    try {
      await denyFlag(flagId, token);
      await markDenied(uid, flagId);
      setDeniedIds((prev) => new Set(prev).add(flagId));
      setSelected(null);
      refreshMine();
      refreshNearby();
    } catch (err) {
      setSnack(toMessage(err));
    } finally {
      setVoteBusy(false);
    }
  }
  async function onRemove(flagId: string): Promise<void> {
    if (!token || voteBusy) return;
    const target = selected?.id === flagId ?
      selected :
      mine.flags.find((f) => f.id === flagId) ??
        nearby.flags.find((f) => f.id === flagId);
    if (target?.status === "3") {
      setSnack(t.flag.lockedRemoveDenied);
      return;
    }
    setVoteBusy(true);
    try {
      await unflag(flagId, token);
      mine.removeLocal(flagId);
      nearby.removeLocal(flagId);
      setSelected(null);
      setSnack(t.flag.removedMsg);
      refreshMine();
      refreshNearby();
    } catch (err) {
      setSnack(toMessage(err));
    } finally {
      setVoteBusy(false);
    }
  }
  async function locate(): Promise<void> {
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setSnack(t.nav.locationDenied);
        return;
      }
      const current = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
      setPos({lat: current.coords.latitude, lng: current.coords.longitude});
    } catch (err) {
      setSnack(toMessage(err));
    }
  }
  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, {color: theme.text}]}>{tab === "nearby" ? t.hazards.nearby : t.hazards.myReports}</Text>
          <Fab theme={theme} size={40} label={showMap ? t.hazards.hideMap : t.hazards.showMap} onPress={() => setShowMap((v) => !v)}>
            <MaterialIcons name={showMap ? "list" : "map"} size={20} color={theme.primary} />
          </Fab>
        </View>
        <View style={styles.tabRow}>
          {(["mine", "nearby"] as const).map((id) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                style={[styles.tab, {borderColor: theme.border, backgroundColor: active ? theme.primary : theme.paper}]}
                onPress={() => setTab(id)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
              >
                <Text style={{color: active ? "#fff" : theme.text, fontWeight: "700"}}>{id === "nearby" ? t.hazards.nearby : t.hazards.myReports}</Text>
              </Pressable>
            );
          })}
        </View>
        {showMap ? (
          <View style={[styles.mapPanel, {borderColor: theme.border}]}>
            <HazardMapView flags={visible} focus={focus} onPickFlag={setSelected} />
          </View>
        ) : null}
        <View style={styles.pillRow}>
          {HAZARD_FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                style={[styles.pill, {borderColor: theme.border, backgroundColor: active ? theme.primary : theme.paper}]}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
              >
                <Text style={{color: active ? "#fff" : theme.text, fontWeight: "700"}}>{f === "ALL" ? t.hazards.all : flagTypeLabel(f, t)}</Text>
              </Pressable>
            );
          })}
        </View>
        {activeLoading ? (
          <StatusRow theme={theme} text={t.hazards.loading} />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(f) => f.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={activeRefreshing} onRefresh={tab === "nearby" ? refreshNearby : refreshMine} tintColor={theme.primary} />}
            ListEmptyComponent={tab === "nearby" && !pos ? (
              <Pressable onPress={() => void locate()} accessibilityRole="button">
                <Text style={[styles.hint, {color: theme.primary}]}>{t.hazards.locationNeeded}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.hint, {color: theme.muted}]}>{tab === "nearby" ? t.hazards.nearbyEmpty : t.hazards.myEmpty}</Text>
            )}
            renderItem={({item}) => (
              <HazardRow
                t={t}
                theme={theme}
                lang={lang}
                flag={item}
                distanceM={pos ? distBetween(pos, {lat: item.lat, lng: item.lng}) : null}
                onOpen={openFlag}
                onCenter={(f) => {
                  setShowMap(true);
                  centerOn(f);
                }}
              />
            )}
          />
        )}
      </View>
      {activeError ? (
        <Snack message={activeError} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={clearActiveError} />
      ) : (
        <Snack message={snack} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setSnack(null)} />
      )}
      {selected ? (
        <Overlay
          visible
          variant="dialog"
          scrollable={false}
          title={flagTypeLabel(selected.type, t)}
          leading={<MaterialIcons name={hazardKind(selected.type).icon} size={22} color={hazardKind(selected.type).color} />}
          right={
            <View style={[styles.statusChip, {backgroundColor: flagStatusColor(selected.status)}]}>
              <Text style={styles.statusText}>{flagStatusLabel(selected.status, t)}</Text>
            </View>
          }
          closeLabel={t.common.cancel}
          onClose={() => setSelected(null)}
          actions={flagOverlayActions(
            selected.id,
            selected.status,
            uid != null && selected.reporterId === uid,
            votedIds.has(selected.id) || selected.voteDirection === "up",
            deniedIds.has(selected.id) || selected.voteDirection === "down",
            voteBusy,
            {confirm: t.flag.confirm, deny: t.flag.deny, remove: t.flag.remove},
            {onConfirm: (id) => void onConfirm(id), onDeny: (id) => void onDeny(id), onRemove: (id) => void onRemove(id)},
          )}
        >
          <FlagDetailSheet
            t={t}
            flag={selected}
            isOwn={uid != null && selected.reporterId === uid}
            onChat={(flag) => setChatFlag(flag)}
          />
        </Overlay>
      ) : null}
      {chatFlag && token ? (
        <ChatSheet
          t={t}
          token={token}
          uid={uid}
          scope="HAZARD"
          refId={chatFlag.id}
          title={flagTypeLabel(chatFlag.type, t)}
          onClose={() => setChatFlag(null)}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, padding: 16, gap: 12},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 20, fontWeight: "700"},
  tabRow: {flexDirection: "row", gap: 8},
  tab: {flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center"},
  mapPanel: {height: 260, borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  pillRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14},
  list: {gap: 8, paddingBottom: 8},
  hint: {fontSize: 12},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
});
