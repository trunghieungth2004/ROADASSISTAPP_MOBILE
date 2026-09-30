import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect} from "@react-navigation/native";
import * as Location from "expo-location";
import ScreenContainer from "../components/ScreenContainer";
import Snack from "../components/Snack";
import FlagDetailSheet from "../components/FlagDetailSheet";
import StatusRow from "../components/StatusRow";
import {Fab} from "../components/Fab";
import {snackAbove} from "../components/snackOffset";
import {isStaleForRefresh} from "../components/feedback";
import {ensurePushConfigured, subscribeHazardPush, type HazardPushData} from "../services/push";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import type {Flag} from "../api/flags";
import {flagTypeLabel} from "../i18n/labels";
import {distBetween} from "./navigation/navUtils";
import HazardMapView from "./hazards/HazardMapView";
import HazardRow from "./hazards/HazardRow";
import {filterFlags, HAZARD_FILTERS, type HazardFilter} from "./hazards/hazardFilter";
import {useMyFlags} from "./hazards/useMyFlags";

export default function HazardScreen() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const mine = useMyFlags(token);
  const [showMap, setShowMap] = useState(false);
  const [filter, setFilter] = useState<HazardFilter>("ALL");
  const [selected, setSelected] = useState<Flag | null>(null);
  const [focus, setFocus] = useState<{lat: number; lng: number; n: number} | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [pos, setPos] = useState<{lat: number; lng: number} | null>(null);
  const focusN = useRef(0);
  const lastRefreshRef = useRef(0);
  const refreshMine = mine.refresh;
  const removeMineLocal = mine.removeLocal;
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (isStaleForRefresh(lastRefreshRef.current, now)) {
        lastRefreshRef.current = now;
        refreshMine();
      }
    }, [refreshMine]),
  );
  useEffect(() => {
    ensurePushConfigured();
    return subscribeHazardPush((data: HazardPushData) => {
      if (data.removed) {
        removeMineLocal(data.flagId);
        setSelected((cur) => (cur?.id === data.flagId ? null : cur));
      }
      lastRefreshRef.current = Date.now();
      refreshMine();
    }, "hazards");
  }, [refreshMine, removeMineLocal]);
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
  const visible = useMemo(() => filterFlags(mine.flags, filter), [mine.flags, filter]);
  function centerOn(flag: Flag): void {
    focusN.current += 1;
    setFocus({lat: flag.lat, lng: flag.lng, n: focusN.current});
  }
  function openFlag(flag: Flag): void {
    centerOn(flag);
    setSelected(flag);
  }
  async function onRemove(flagId: string): Promise<void> {
    const target = mine.flags.find((f) => f.id === flagId);
    if (target?.status === "3") {
      setSnack(t.flag.lockedRemoveDenied);
      return;
    }
    const ok = await mine.remove(flagId);
    if (ok) {
      setSelected(null);
      setSnack(t.flag.removedMsg);
    }
  }
  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, {color: theme.text}]}>{t.hazards.myReports}</Text>
          <Fab theme={theme} size={40} label={showMap ? t.hazards.hideMap : t.hazards.showMap} onPress={() => setShowMap((v) => !v)}>
            <MaterialIcons name={showMap ? "list" : "map"} size={20} color={theme.primary} />
          </Fab>
        </View>
        {showMap ? (
          <View style={[styles.mapPanel, {borderColor: theme.border}]}>
            <HazardMapView lang={lang} flags={visible} focus={focus} onPickFlag={setSelected} />
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
        {mine.loading ? (
          <StatusRow theme={theme} text={t.hazards.loading} />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(f) => f.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={mine.refreshing} onRefresh={mine.refresh} tintColor={theme.primary} />}
            ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.hazards.myEmpty}</Text>}
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
      {mine.error ? (
        <Snack message={mine.error} severity="error" sticky bottom={snackAbove(insets.bottom, 24)} dangerColor={theme.danger} onHide={mine.clearError} />
      ) : (
        <Snack message={snack} severity="confirm" bottom={snackAbove(insets.bottom, 24)} accentColor={theme.primary} onHide={() => setSnack(null)} />
      )}
      {selected ? (
        <View style={[styles.sheetRoot, {bottom: insets.bottom + 12}]} pointerEvents="box-none">
          <View style={styles.sheetWrap}>
            <FlagDetailSheet
              t={t}
              flag={selected}
              isOwn={uid != null && selected.reporterId === uid}
              busy={mine.busyId !== null}
              voted={false}
              denied={false}
              onClose={() => setSelected(null)}
              onConfirm={() => {}}
              onDeny={() => {}}
              onRemove={(id) => void onRemove(id)}
            />
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, padding: 16, gap: 12},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 20, fontWeight: "700"},
  mapPanel: {height: 260, borderWidth: 1, borderRadius: 16, overflow: "hidden"},
  pillRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14},
  list: {gap: 8, paddingBottom: 8},
  hint: {fontSize: 12},
  sheetRoot: {position: "absolute", left: 12, right: 12, bottom: 12},
  sheetWrap: {width: "100%"},
});
