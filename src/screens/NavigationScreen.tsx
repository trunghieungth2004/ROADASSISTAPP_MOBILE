import {useCallback, useEffect, useRef, useState} from "react";
import {BackHandler, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useKeepAwake} from "expo-keep-awake";
import {useAuth} from "../context/AuthContext";
import type {RouteOption} from "../api/routes";
import {confirmFlag, denyFlag, getFlag, submitFlag, unflag, type Flag} from "../api/flags";
import {toMessage} from "../api/client";
import {markDenied, markVoted} from "../storage/votedFlags";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {useNavVoice} from "./navigation/useNavVoice";
import {useNavTracking} from "./navigation/useNavTracking";
import {distBetween, formatDist, turnLabel} from "./navigation/navUtils";
import {clearNavShade, updateNavShade} from "../services/navShade";
import NavMapView from "./navigation/NavMapView";
import NavHeader from "./navigation/NavHeader";
import TurnListSheet from "./navigation/TurnListSheet";
import FlagDetailSheet from "../components/FlagDetailSheet";
import {hazardKind} from "../components/hazardStyle";
import {flagTypeLabel} from "../i18n/labels";
import {ensurePushConfigured, notifyHazardHeadsUp, setNavForeground, subscribeHazardPush, type HazardPushData} from "../services/push";
import {playEventSound} from "../services/sound";
import Snack from "../components/Snack";
import FlagSheet, {type FlagReport} from "../components/FlagSheet";

type Props = {
  t: Strings;
  lang: string;
  token: string;
  initialRoute: RouteOption;
  dest: {lat: number; lng: number};
  seed: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  width?: number;
  vehicleType?: string;
  onExit: () => void;
};

export default function NavigationScreen({t, lang, token, initialRoute, dest, seed, stops, width, vehicleType, onExit}: Props) {
  useKeepAwake();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const voice = useNavVoice(lang, () => {
    setVoiceError(t.nav.voiceUnavailable);
    if (voiceErrorTimer.current) clearTimeout(voiceErrorTimer.current);
    voiceErrorTimer.current = setTimeout(() => setVoiceError(null), 6000);
  });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useNavTracking({token, lang, t, dest, stops, width, vehicleType, initialRoute, seed, speak: voice.speak, resolveVoice: voice.resolveVoice});
  const startCoord = initialRoute.geometry.coordinates[0];
  const initialCenter: [number, number] = startCoord ? [startCoord[0], startCoord[1]] : [seed.lng, seed.lat];
  const [listOpen, setListOpen] = useState(false);
  const [reportAt, setReportAt] = useState<{lat: number; lng: number} | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [flagsKey, setFlagsKey] = useState(0);
  const [topCards, setTopCards] = useState<{flag: Flag; addedAt: number}[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [headerH, setHeaderH] = useState(0);
  const CARD_TTL_MS = 30000;
  const MAX_TOP_CARDS = 3;
  const {uid} = useAuth();
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const autoIdRef = useRef<string | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const votedRef = useRef(votedIds);
  votedRef.current = votedIds;
  const deniedRef = useRef(deniedIds);
  deniedRef.current = deniedIds;
  const posRef = useRef(nav.pos);
  posRef.current = nav.pos;
  const openManualFlag = useCallback((flag: Flag): void => {
    autoIdRef.current = null;
    setAutoOpened(false);
    setSelectedFlag(flag);
  }, []);
  const closeFlag = (): void => {
    autoIdRef.current = null;
    setAutoOpened(false);
    setSelectedFlag(null);
  };
  const onAutoFlag = (flag: Flag | null): void => {
    if (flag) {
      autoIdRef.current = flag.id;
      setAutoOpened(true);
      setSelectedFlag(flag);
    } else if (selectedFlag?.id === autoIdRef.current) {
      autoIdRef.current = null;
      setAutoOpened(false);
      setSelectedFlag(null);
    }
  };
  async function onConfirmFlag(flagId: string) {
    setFlagBusy(true);
    try {
      const res = await confirmFlag(flagId, token);
      void markVoted(flagId);
      setVotedIds((prev) => new Set(prev).add(flagId));
      closeFlag();
      setFlagsKey((k) => k + 1);
      const changed = await nav.rerouteForConfirm();
      voice.speak(changed ? t.flag.rerouted : res.alreadyVoted ? t.flag.alreadyVoted : t.flag.confirmedMsg);
    } catch (err) {
      voice.speak(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onDenyFlag(flagId: string) {
    setFlagBusy(true);
    try {
      const res = await denyFlag(flagId, token);
      void markDenied(flagId);
      setDeniedIds((prev) => new Set(prev).add(flagId));
      closeFlag();
      setFlagsKey((k) => k + 1);
      voice.speak(res.alreadyVoted ? t.flag.alreadyDenied : t.flag.deniedMsg);
    } catch (err) {
      voice.speak(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onSubmitReport(report: FlagReport) {
    if (!reportAt) return;
    setReportBusy(true);
    try {
      await submitFlag({type: report.type, lat: reportAt.lat, lng: reportAt.lng, radiusMeters: report.radiusMeters, note: report.note}, token);
      setReportAt(null);
      setFlagsKey((k) => k + 1);
      voice.speak(t.flag.reported);
    } catch (err) {
      voice.speak(toMessage(err));
    } finally {
      setReportBusy(false);
    }
  }
  async function onRemoveFlag(flagId: string) {
    setFlagBusy(true);
    try {
      await unflag(flagId, token);
      closeFlag();
      setFlagsKey((k) => k + 1);
      voice.speak(t.flag.removedMsg);
    } catch (err) {
      voice.speak(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function showAlertForFlag(flagId: string): Promise<void> {
    const key = tokenRef.current;
    console.log(`[push] nav handle ${flagId.slice(0, 8)}`);
    if (!key) {
      console.log("[push] nav skipped no-key");
      return;
    }
    let flag: Flag;
    try {
      flag = await getFlag(flagId, key);
      console.log(`[push] nav fetched ${flag.status}`);
    } catch (err) {
      setFetchError(toMessage(err));
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
      return;
    }
    const me = uidRef.current;
    setFlagsKey((k) => k + 1);
    if (me != null && flag.reporterId === me) {
      console.log("[push] nav skipped own");
      return;
    }
    if (votedRef.current.has(flag.id) || deniedRef.current.has(flag.id)) {
      console.log("[push] nav skipped voted");
      return;
    }
    const confirmedPush = flag.status === "2" || flag.status === "3";
    if (!confirmedPush) {
      const changed = await nav.refreshRouteQuiet();
      console.log(`[push] nav refreshed changed=${changed}`);
    }
    let rerouted = false;
    if (confirmedPush) rerouted = await nav.rerouteForConfirm();
    const p = posRef.current;
    const dist = p ? formatDist(distBetween(p, {lat: flag.lat, lng: flag.lng}), t.route.km, t.nav.m) : null;
    const now = Date.now();
    setTopCards((prev) => [{flag, addedAt: now}, ...prev.filter((c) => c.flag.id !== flag.id)].slice(0, MAX_TOP_CARDS));
    console.log("[push] nav card shown");
    if (confirmedPush) {
      voice.speak(t.nav.hazardSpotted);
      voice.speak(rerouted ? t.nav.hazardConfirmedRerouted : t.flag.confirmedMsg);
      void notifyHazardHeadsUp(t.nav.hazardAlertConfirmed, rerouted ? t.nav.hazardConfirmedRerouted : t.flag.confirmedMsg);
    } else {
      voice.speak(t.nav.hazardSpotted);
      const detail = dist ? t.nav.hazardAhead.replace("{d}", dist) : t.nav.hazardAlertTitle;
      voice.speak(detail);
      void playEventSound("hazard");
      void notifyHazardHeadsUp(t.nav.hazardAlertTitle, detail);
    }
  }
  const onRemovedPush = (flagId: string): void => {
    setTopCards((prev) => prev.filter((c) => c.flag.id !== flagId));
    if (selectedFlag?.id === flagId) closeFlag();
    setFlagsKey((k) => k + 1);
    void nav.refreshRouteQuiet();
    voice.speak(t.flag.clearedMsg);
  };
  const pace = nav.route.distanceMeters > 0 ? nav.route.durationSeconds / nav.route.distanceMeters : 0;
  const remaining = nav.progress?.remainingMeters ?? nav.route.distanceMeters;
  const progressM = nav.progress?.progressMeters ?? 0;
  const focusedWarning = nav.hazardFocus ? nav.flagWarnings[nav.hazardFocus.idx] ?? null : null;
  let nearestWarning = focusedWarning;
  if (!nearestWarning) {
    let bestToGo = Number.POSITIVE_INFINITY;
    for (const w of nav.flagWarnings) {
      const toGo = w.distanceMeters - progressM;
      if (toGo > 0 && toGo < bestToGo) {
        bestToGo = toGo;
        nearestWarning = w;
      }
    }
  }
  const cardToGo = nearestWarning ? Math.max(0, nearestWarning.distanceMeters - progressM) : 0;
  const cardKind = hazardKind(nearestWarning?.type);
  const showVotes = !!nearestWarning &&
    !votedIds.has(nearestWarning.flagId) &&
    !deniedIds.has(nearestWarning.flagId) &&
    cardToGo <= 300;
  const etaMin = Math.max(1, Math.round((remaining * pace) / 60));
  const frac = nav.route.distanceMeters > 0 ? Math.min(1, (nav.progress?.progressMeters ?? 0) / nav.route.distanceMeters) : 0;
  const shadeRef = useRef({at: 0, frac: -1, turn: ""});
  useEffect(() => {
    const turnKey = nav.next ? `${nav.next.kind}|${nav.next.street ?? ""}` : nav.arrived ? "arrived" : "";
    const now = Date.now();
    const prev = shadeRef.current;
    if (now - prev.at < 20000 && turnKey === prev.turn && Math.abs(frac - prev.frac) < 0.03) return;
    shadeRef.current = {at: now, frac, turn: turnKey};
    const title = nav.next
      ? `${turnLabel(t.nav.turns as Record<string, string>, t.nav.turns.other, nav.next.kind)} · ${formatDist(nav.next.toGo, t.route.km, t.nav.m)}`
      : t.nav.arrived;
    const body = `${t.nav.eta} ${etaMin} ${t.route.min} · ${formatDist(remaining, t.route.km, t.nav.m)}`;
    void updateNavShade(title, body, frac);
  }, [nav.next, frac, remaining, etaMin, nav.arrived, t]);
  useEffect(() => () => {
    void clearNavShade();
  }, []);
  useEffect(() => {
    ensurePushConfigured();
    setNavForeground(true);
    const unsub = subscribeHazardPush((data: HazardPushData) => {
      if (data.removed) {
        console.log(`[push] nav cleared ${data.flagId.slice(0, 8)}`);
        onRemovedPush(data.flagId);
        return;
      }
      void showAlertForFlag(data.flagId);
    }, "nav");
    return () => {
      setNavForeground(false);
      unsub();
    };
  }, []);
  useEffect(() => {
    if (topCards.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNowTs(now);
      setTopCards((prev) => prev.filter((c) => now - c.addedAt < CARD_TTL_MS));
    }, 1000);
    return () => clearInterval(timer);
  }, [topCards.length]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (reportAt) {
        setReportAt(null);
        return true;
      }
      if (selectedFlag) {
        closeFlag();
        return true;
      }
      if (listOpen) {
        setListOpen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [listOpen, selectedFlag, reportAt]);
  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <NavMapView
        theme={theme}
        route={nav.route}
        pos={nav.pos}
        initialCenter={initialCenter}
        arrowRotate={nav.arrowRotate}
        cameraRef={nav.cameraRef}
        traveled={nav.traveled}
        remaining={nav.remaining}
        highlight={nav.preview?.highlight ?? nav.hazardFocus?.highlight ?? null}
        flagsPos={nav.pos}
        flagsToken={token}
        flagsKey={flagsKey}
        flagsUid={uid}
        flagsVoted={votedIds}
        flagsDenied={deniedIds}
        flagsSuppressAuto={listOpen || reportAt !== null}
        flagsArrived={nav.arrived}
        onPickFlag={openManualFlag}
        onAutoFlag={onAutoFlag}
        onRegionChanging={nav.onRegionChanging}
        onRegionDid={nav.onRegionDid}
      />
      <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <NavHeader
          t={t}
          theme={theme}
          topPad={insets.top + 12}
          next={nav.next}
          arrived={nav.arrived}
          rerouting={nav.rerouting}
          hasPos={nav.pos !== null}
          onExit={onExit}
          onOpenList={() => setListOpen(true)}
        />
      </View>
      {topCards.length > 0 ? (
        <View style={[styles.topStack, {top: headerH + 8}]} pointerEvents="box-none">
          {topCards.map((c) => {
            const kind = hazardKind(c.flag.type);
            const p = nav.pos;
            const toGo = p ? distBetween(p, {lat: c.flag.lat, lng: c.flag.lng}) : null;
            const remain = Math.max(0, CARD_TTL_MS - (nowTs - c.addedAt)) / CARD_TTL_MS;
            return (
              <Pressable key={c.flag.id} style={[styles.topCard, {backgroundColor: theme.paper, borderColor: kind.color}]} onPress={() => nav.focusAt(c.flag.lat, c.flag.lng)} accessibilityRole="button" accessibilityLabel={t.nav.hazardFocus}>
                <MaterialIcons name={kind.icon} size={22} color={kind.color} />
                <View style={styles.hazardText}>
                  <Text style={[styles.hazardTitle, {color: theme.text}]}>{flagTypeLabel(c.flag.type, t)}{toGo !== null ? ` · ${formatDist(toGo, t.route.km, t.nav.m)}` : ""}</Text>
                  <View style={[styles.ttlTrack, {backgroundColor: theme.border}]}>
                    <View style={[styles.ttlFill, {backgroundColor: kind.color, width: `${Math.round(remain * 100)}%`}]} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={[styles.speedSlot, {bottom: insets.bottom + 16}]}>
        <View style={[styles.speedCircle, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Text style={[styles.speedNumber, {color: theme.text}]}>{nav.speedKmh ?? "–"}</Text>
          <Text style={[styles.speedUnit, {color: theme.muted}]}>{t.nav.kmh}</Text>
        </View>
      </View>
      <View style={[styles.bottomStack, {bottom: insets.bottom + 12}]}>
        {nearestWarning ? (
          <View style={[styles.hazardCard, {backgroundColor: theme.paper, borderColor: cardKind.color}]}>
            <Pressable style={styles.hazardMain} onPress={nav.cycleHazard} accessibilityRole="button" accessibilityLabel={t.nav.hazardFocus}>
              <MaterialIcons name={cardKind.icon} size={24} color={cardKind.color} />
              <View style={styles.hazardText}>
                <Text style={[styles.hazardTitle, {color: theme.text}]}>{flagTypeLabel(nearestWarning.type ?? "", t)} · {formatDist(cardToGo, t.route.km, t.nav.m)}</Text>
                {nearestWarning.note ? <Text style={[styles.hazardNote, {color: theme.muted}]} numberOfLines={1}>{nearestWarning.note}</Text> : null}
              </View>
            </Pressable>
            <View style={[styles.voteRow, {opacity: showVotes ? 1 : 0}]}>
              <Pressable style={[styles.voteBtn, {backgroundColor: theme.primary}]} disabled={!showVotes || flagBusy} onPress={() => nearestWarning && void onConfirmFlag(nearestWarning.flagId)} accessibilityRole="button" accessibilityLabel={t.flag.confirm}>
                <MaterialIcons name="check" size={20} color="#fff" />
              </Pressable>
              <Pressable style={[styles.voteBtn, {borderColor: theme.danger, borderWidth: 1}]} disabled={!showVotes || flagBusy} onPress={() => nearestWarning && void onDenyFlag(nearestWarning.flagId)} accessibilityRole="button" accessibilityLabel={t.flag.deny}>
                <MaterialIcons name="close" size={20} color={theme.danger} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={[styles.bottomBar, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <Text style={[styles.remaining, {color: theme.text}]}>{formatDist(remaining, t.route.km, t.nav.m)}</Text>
          <Text style={[styles.eta, {color: theme.muted}]}>{t.nav.eta} {etaMin} {t.route.min}</Text>
          <View style={[styles.bar, {backgroundColor: theme.border}]}>
            <View style={[styles.barFill, {backgroundColor: theme.primary, width: `${Math.round(frac * 100)}%`}]} />
          </View>
        </View>
      </View>
      <View style={[styles.fabCol, {bottom: insets.bottom + 16}]}>
        {nav.hazardCount > 0 ? (
          <Pressable style={[styles.fab, {backgroundColor: nav.hazardFocus ? theme.primary : theme.paper, borderColor: nav.hazardFocus ? theme.primary : theme.border}]} onPress={nav.cycleHazard} accessibilityRole="button" accessibilityLabel={t.nav.hazardFocus}>
            <Text style={[styles.hazardNumber, {color: nav.hazardFocus ? "#fff" : theme.primary}]}>{nav.hazardCount}</Text>
          </Pressable>
        ) : null}
        {!nav.following ? (
          <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}, nav.recentering && styles.disabled]} disabled={nav.recentering} onPress={nav.onRecenter} accessibilityRole="button" accessibilityLabel={t.nav.recenter}>
            <MaterialIcons name="my-location" size={22} color={theme.primary} />
          </Pressable>
        ) : (
          <View style={[styles.fab, {borderColor: theme.border, opacity: 0.4}]}>
            <MaterialIcons name="my-location" size={22} color={theme.muted} />
          </View>
        )}
        <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={voice.toggleMute} accessibilityRole="button" accessibilityLabel={voice.muted ? t.nav.unmute : t.nav.mute}>
          <MaterialIcons name={voice.muted ? "volume-off" : "volume-up"} size={22} color={theme.primary} />
        </Pressable>
      </View>
      <Pressable style={[styles.fab, styles.reportFab, {backgroundColor: theme.paper, borderColor: theme.border, top: insets.top + 88}, !nav.pos && styles.disabled]} disabled={!nav.pos} onPress={() => nav.pos && setReportAt({lat: nav.pos.lat, lng: nav.pos.lng})} accessibilityRole="button" accessibilityLabel={t.flag.reportTitle}>
        <MaterialIcons name="add-alert" size={22} color={nav.pos ? theme.primary : theme.muted} />
      </Pressable>
      {nav.error ? (
        <Snack message={nav.error} severity="error" sticky bottom={insets.bottom + 180} dangerColor={theme.danger} onHide={nav.clearError} />
      ) : (
        <Snack message={voiceError ?? fetchError ?? nav.notice} bottom={insets.bottom + 180} onHide={() => {}} />
      )}
      {listOpen ? (
        <TurnListSheet
          t={t}
          theme={theme}
          bottomPad={insets.bottom + 12}
          steps={nav.steps}
          stepProg={nav.stepProg}
          streets={nav.streets}
          progress={nav.progress}
          remainingMeters={nav.progress?.remainingMeters ?? nav.route.distanceMeters}
          onClose={() => setListOpen(false)}
          onPreviewStep={(i) => {
            setListOpen(false);
            nav.previewStep(i);
          }}
        />
      ) : null}
      {reportAt ? (
        <View style={styles.centerRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportAt(null)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <FlagSheet t={t} lat={reportAt.lat} lng={reportAt.lng} busy={reportBusy} centered onClose={() => setReportAt(null)} onSubmit={(r) => void onSubmitReport(r)} />
          </View>
        </View>
      ) : null}
      {selectedFlag ? (
        <View style={[styles.autoCard, {backgroundColor: theme.paper, borderColor: theme.border, bottom: insets.bottom + 12}]} pointerEvents="box-none">
          <FlagDetailSheet
            t={t}
            flag={selectedFlag}
            isOwn={uid != null && selectedFlag.reporterId === uid}
            busy={flagBusy}
            voted={votedIds.has(selectedFlag.id)}
            denied={deniedIds.has(selectedFlag.id)}
            onClose={closeFlag}
            onConfirm={(id) => void onConfirmFlag(id)}
            onDeny={(id) => void onDenyFlag(id)}
            onRemove={(id) => void onRemoveFlag(id)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  autoCard: {position: "absolute", left: 12, right: 12, bottom: 0},
  sheetRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)"},
  centerRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)"},
  centerWrap: {width: "100%", paddingHorizontal: 24},
  disabled: {opacity: 0.6},
  sheetWrap: {width: "100%"},
  bottomStack: {position: "absolute", left: 88, right: 76, gap: 8},
  bottomBar: {borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, gap: 4, alignItems: "center"},
  hazardCard: {borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, gap: 8},
  hazardMain: {flexDirection: "row", alignItems: "center", gap: 10},
  voteRow: {flexDirection: "row", gap: 8, height: 40, alignItems: "center", justifyContent: "center"},
  voteBtn: {width: 64, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  topStack: {position: "absolute", left: 12, right: 12, gap: 8},
  topCard: {flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16},
  ttlTrack: {height: 4, borderRadius: 2, overflow: "hidden", marginTop: 6},
  ttlFill: {height: 4, borderRadius: 2},
  hazardText: {flex: 1, minWidth: 0, gap: 2},
  hazardTitle: {fontSize: 15, fontWeight: "700"},
  hazardNote: {fontSize: 12},
  speedSlot: {position: "absolute", left: 12, alignItems: "center"},
  speedCircle: {width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  speedNumber: {fontSize: 20, fontWeight: "700", textAlign: "center"},
  speedUnit: {fontSize: 10, textAlign: "center"},
  remaining: {fontSize: 20, fontWeight: "700", textAlign: "center"},
  eta: {fontSize: 13, textAlign: "center"},
  bar: {height: 6, borderRadius: 3, overflow: "hidden", alignSelf: "stretch"},
  barFill: {height: 6, borderRadius: 3},
  fabCol: {position: "absolute", right: 12, gap: 8, alignItems: "center"},
  fab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  reportFab: {position: "absolute", left: 12},
  hazardNumber: {fontSize: 20, fontWeight: "700", textAlign: "center"},
});
