import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useKeepAwake} from "expo-keep-awake";
import {useNavigation} from "@react-navigation/native";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useNavSession} from "../context/NavSessionContext";
import Overlay from "../components/overlay/Overlay";
import {flagStatusColor, flagStatusLabel} from "../components/flags/flagStatus";
import type {RouteOption} from "../api/routes";
import {confirmFlag, denyFlag, flagsNear, getFlag, submitFlag, unflag, type Flag} from "../api/flags";
import {toMessage} from "../api/client";
import {markDenied, markVoted} from "../storage/votedFlags";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {useNavVoice} from "./navigation/useNavVoice";
import {useNavTracking} from "./navigation/useNavTracking";
import {distBetween, formatDist, turnLabel} from "./navigation/navUtils";
import {clearNavShade, updateNavShade} from "../services/navShade";
import NavMapView from "./navigation/NavMapView";
import {NAV_NEAR_RADIUS_M} from "./navigation/NavFlags";
import NavHeader from "./navigation/NavHeader";
import TurnListSheet from "./navigation/TurnListSheet";
import {Fab, FabColumn} from "../components/ui/Fab";
import {SNACK_GAP} from "../components/ui/snackOffset";
import FlagDetailSheet from "../components/flags/FlagDetailSheet";
import {hazardKind} from "../components/flags/hazardStyle";
import {flagTypeLabel} from "../i18n/labels";
import {drainHazardLaunch, ensurePushConfigured, notifyHazardHeadsUp, setNavForeground, subscribeHazardPush, type HazardPushData} from "../services/push";
import {playEventSound} from "../services/sound";
import Snack from "../components/ui/Snack";
import {pickFeedback} from "../components/ui/feedback";
import FlagReportDialog from "../components/flags/FlagReportDialog";
import type {FlagReport} from "../components/flags/FlagSheet";
import {flagOverlayActions} from "./hazards/flagActions";

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

export default function NavigationScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {session, clear} = useNavSession();
  const navigation = useNavigation();
  const onExit = useCallback(() => {
    clear();
    navigation.goBack();
  }, [clear, navigation]);
  useEffect(() => {
    if (!session || !token) {
      const timer = setTimeout(() => {
        clear();
        navigation.goBack();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [session, token, clear, navigation]);
  if (!session || !token) return null;
  return (
    <NavigationContent
      t={t}
      lang={lang}
      token={token}
      initialRoute={session.route}
      dest={session.dest}
      seed={session.seed}
      stops={session.stops}
      width={session.width}
      vehicleType={session.vehicleType}
      onExit={onExit}
    />
  );
}

function NavigationContent({t, lang, token, initialRoute, dest, seed, stops, width, vehicleType, onExit}: Props) {
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
  const [confirmSnack, setConfirmSnack] = useState<string | null>(null);
  const confirmSnackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const nav = useNavTracking({token, lang, t, dest, stops, width, vehicleType, initialRoute, seed, speak: voice.speak, resolveVoice: voice.resolveVoice});
  const startCoord = initialRoute.geometry.coordinates[0];
  const initialCenter: [number, number] = startCoord ? [startCoord[0], startCoord[1]] : [seed.lng, seed.lat];
  const [listOpen, setListOpen] = useState(false);
  const [reportAt, setReportAt] = useState<{lat: number; lng: number} | null>(null);
  const [flagsKey, setFlagsKey] = useState(0);
  const [flagsForceKey, setFlagsForceKey] = useState(0);
  const [pushSeeds, setPushSeeds] = useState<{flag: Flag; at: number}[]>([]);
  const SEED_TTL_MS = 300000;
  const SEED_MAX = 12;
  const seedList = useMemo(() => pushSeeds.map((s) => s.flag), [pushSeeds]);
  const [topCards, setTopCards] = useState<{flag: Flag; addedAt: number}[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [headerH, setHeaderH] = useState(0);
  const [bottomH, setBottomH] = useState(0);
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
    setConfirmSnack(t.flag.checkingRoute);
    if (confirmSnackTimer.current) clearTimeout(confirmSnackTimer.current);
    try {
      const res = await confirmFlag(flagId, token);
      void markVoted(flagId);
      setVotedIds((prev) => new Set(prev).add(flagId));
      closeFlag();
      setFlagsKey((k) => k + 1);
      const changed = await nav.rerouteForConfirm();
      setConfirmSnack(changed ? t.flag.rerouted : res.alreadyVoted ? t.flag.alreadyVoted : t.flag.confirmedMsg);
      if (confirmSnackTimer.current) clearTimeout(confirmSnackTimer.current);
      confirmSnackTimer.current = setTimeout(() => setConfirmSnack(null), 6000);
    } catch (err) {
      setConfirmSnack(null);
      setFetchError(toMessage(err));
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
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
      setFetchError(toMessage(err));
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
      voice.speak(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onSubmitReport(report: FlagReport) {
    if (!reportAt) return;
    try {
      await submitFlag({type: report.type, lat: reportAt.lat, lng: reportAt.lng, radiusMeters: report.radiusMeters, note: report.note}, token);
      setReportAt(null);
      setFlagsKey((k) => k + 1);
      voice.speak(t.flag.reported);
      void nav.refreshRouteQuiet();
    } catch (err) {
      setFetchError(toMessage(err));
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
      voice.speak(toMessage(err));
    }
  }
  async function onRemoveFlag(flagId: string) {
    if (selectedFlag?.id === flagId && selectedFlag.status === "3") {
      setFetchError(t.flag.lockedRemoveDenied);
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
      voice.speak(t.flag.lockedRemoveDenied);
      return;
    }
    setFlagBusy(true);
    try {
      await unflag(flagId, token);
      closeFlag();
      dropSeed(flagId);
      setFlagsKey((k) => k + 1);
      voice.speak(t.flag.removedMsg);
    } catch (err) {
      setFetchError(toMessage(err));
      if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
      fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
      voice.speak(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  function dropSeed(flagId: string): void {
    setPushSeeds((prev) => prev.filter((s) => s.flag.id !== flagId));
  }
  function seedFromPush(data: HazardPushData): Flag | null {
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    const seed: Flag = {id: data.flagId, type: data.type ?? "", lat: data.lat, lng: data.lng, status: data.status ?? "1", ...(typeof data.radiusMeters === "number" ? {radiusMeters: data.radiusMeters} : {})};
    const now = Date.now();
    setPushSeeds((prev) => [{flag: seed, at: now}, ...prev.filter((s) => s.flag.id !== seed.id && now - s.at < SEED_TTL_MS)].slice(0, SEED_MAX));
    return seed;
  }
  async function showAlertForFlag(data: HazardPushData): Promise<void> {
    const seed = seedFromPush(data);
    setFlagsForceKey((k) => k + 1);
    void nav.refreshRouteQuiet();
    const key = tokenRef.current;
    if (!key) {
      return;
    }
    if (votedRef.current.has(data.flagId) || deniedRef.current.has(data.flagId)) {
      return;
    }
    const pushConfirmed = data.status === "2" || data.status === "3";
    let flag: Flag | null = seed;
    if (!seed || pushConfirmed) {
      try {
        flag = await getFlag(data.flagId, key);
      } catch (err) {
        if (!aliveRef.current) return;
        setFetchError(toMessage(err));
        if (fetchErrorTimer.current) clearTimeout(fetchErrorTimer.current);
        fetchErrorTimer.current = setTimeout(() => setFetchError(null), 6000);
        return;
      }
      if (!aliveRef.current) return;
    }
    const me = uidRef.current;
    if (!flag) {
      return;
    }
    if (me != null && flag.reporterId === me) {
      return;
    }
    const confirmedPush = flag.status === "2" || flag.status === "3";
    const p = posRef.current;
    const straightToGo = p ? distBetween(p, {lat: flag.lat, lng: flag.lng}) : null;
    const dist = straightToGo !== null ? formatDist(straightToGo, t.route.km, t.nav.m) : null;
    let rerouted = false;
    if (confirmedPush) rerouted = await nav.rerouteForConfirm();
    if (!aliveRef.current) return;
    const now = Date.now();
    setTopCards((prev) => [{flag, addedAt: now}, ...prev.filter((c) => c.flag.id !== flag.id)].slice(0, MAX_TOP_CARDS));
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
    dropSeed(flagId);
    if (selectedFlag?.id === flagId) closeFlag();
    setFlagsKey((k) => k + 1);
    void nav.refreshRouteQuiet();
    voice.speak(t.flag.clearedMsg);
  };
  const routeMeters = nav.route.distanceMeters ?? 0;
  const pace = routeMeters > 0 ? (nav.route.durationSeconds ?? 0) / routeMeters : 0;
  const remaining = nav.progress?.remainingMeters ?? routeMeters;
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
  const votesShownRef = useRef(false);
  useEffect(() => {
    if (showVotes && !votesShownRef.current) void playEventSound("confirm");
    votesShownRef.current = showVotes;
  }, [showVotes]);
  const etaMin = Math.max(1, Math.round((remaining * pace) / 60));
  const frac = routeMeters > 0 ? Math.min(1, (nav.progress?.progressMeters ?? 0) / routeMeters) : 0;
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
    const voice = voiceErrorTimer.current;
    const fetch = fetchErrorTimer.current;
    const confirm = confirmSnackTimer.current;
    return () => {
      if (voice) clearTimeout(voice);
      if (fetch) clearTimeout(fetch);
      if (confirm) clearTimeout(confirm);
      aliveRef.current = false;
    };
  }, []);
  useEffect(() => {
    ensurePushConfigured();
    setNavForeground(true);
    void flagsNear(seed.lat, seed.lng, NAV_NEAR_RADIUS_M, token).catch(() => undefined);
    const onHazard = (data: HazardPushData): void => {
      if (data.removed) {
        onRemovedPush(data.flagId);
        return;
      }
      void showAlertForFlag(data);
    };
    void drainHazardLaunch().then((drained) => {
      if (drained) onHazard(drained);
    });
    const unsub = subscribeHazardPush(onHazard, "nav");
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
        flagsForceKey={flagsForceKey}
        flagsSeeds={seedList}
        flagsUid={uid}
        flagsVoted={votedIds}
        flagsDenied={deniedIds}
        flagsSuppressAuto={listOpen || reportAt !== null}
        flagsArrived={nav.arrived}
        onPickFlag={openManualFlag}
        onAutoFlag={onAutoFlag}
        onRegionChanging={nav.onRegionChanging}
      />
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
        onHeight={setHeaderH}
      />
      {topCards.length > 0 ? (
        <View style={[styles.topStack, {top: headerH + 8}]} pointerEvents="box-none">
          {topCards.map((c) => {
            const kind = hazardKind(c.flag.type);
            const matched = nav.flagWarnings.find((w) => w.flagId === c.flag.id) ?? null;
            const p = nav.pos;
            const toGo = matched
              ? Math.max(0, matched.distanceMeters - progressM)
              : p ? distBetween(p, {lat: c.flag.lat, lng: c.flag.lng}) : null;
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
      <View style={[styles.bottomStack, {bottom: insets.bottom + 12}]} onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}>
        {nearestWarning ? (
          <View style={[styles.hazardCard, {backgroundColor: theme.paper, borderColor: cardKind.color}]}>
            <View style={[styles.voteSide, {opacity: showVotes ? 1 : 0}]}>
              <Pressable style={[styles.voteMini, {backgroundColor: theme.primary}]} disabled={!showVotes || flagBusy} onPress={() => nearestWarning && void onConfirmFlag(nearestWarning.flagId)} accessibilityRole="button" accessibilityLabel={t.flag.confirm}>
                <MaterialIcons name="check" size={18} color="#fff" />
              </Pressable>
            </View>
            <Pressable style={styles.hazardCenter} onPress={nav.cycleHazard} accessibilityRole="button" accessibilityLabel={t.nav.hazardFocus}>
              <View style={styles.hazardTypeRow}>
                <MaterialIcons name={cardKind.icon} size={22} color={cardKind.color} />
                <Text style={[styles.hazardTitle, {color: theme.text}]}>{flagTypeLabel(nearestWarning.type ?? "", t)}</Text>
              </View>
              <Text style={[styles.hazardDist, {color: theme.muted}]}>{formatDist(cardToGo, t.route.km, t.nav.m)}</Text>
              {nearestWarning.note ? <Text style={[styles.hazardNote, {color: theme.muted}]} numberOfLines={1}>{nearestWarning.note}</Text> : null}
            </Pressable>
            <View style={[styles.voteSide, {opacity: showVotes ? 1 : 0}]}>
              <Pressable style={[styles.voteMini, {borderColor: theme.danger, borderWidth: 1}]} disabled={!showVotes || flagBusy} onPress={() => nearestWarning && void onDenyFlag(nearestWarning.flagId)} accessibilityRole="button" accessibilityLabel={t.flag.deny}>
                <MaterialIcons name="close" size={18} color={theme.danger} />
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
      <FabColumn bottom={insets.bottom + 16}>
        {nav.hazardCount > 0 ? (
          <Fab theme={theme} variant={nav.hazardFocus ? "primary" : "paper"} label={t.nav.hazardFocus} onPress={nav.cycleHazard}>
            <Text style={[styles.hazardNumber, {color: nav.hazardFocus ? "#fff" : theme.primary}]}>{nav.hazardCount}</Text>
          </Fab>
        ) : null}
        {!nav.following ? (
          <Fab theme={theme} label={t.nav.recenter} disabled={nav.recentering} onPress={nav.onRecenter}>
            <MaterialIcons name="my-location" size={22} color={theme.primary} />
          </Fab>
        ) : (
          <Fab theme={theme} variant="muted" label={t.nav.recenter}>
            <MaterialIcons name="my-location" size={22} color={theme.muted} />
          </Fab>
        )}
        <Fab theme={theme} label={voice.muted ? t.nav.unmute : t.nav.mute} onPress={voice.toggleMute}>
          <MaterialIcons name={voice.muted ? "volume-off" : "volume-up"} size={22} color={theme.primary} />
        </Fab>
      </FabColumn>
      <Fab theme={theme} label={t.flag.reportTitle} disabled={!nav.pos} onPress={() => nav.pos && setReportAt({lat: nav.pos.lat, lng: nav.pos.lng})} style={{position: "absolute", left: 12, top: insets.top + 88}}>
        <MaterialIcons name="add-alert" size={22} color={nav.pos ? theme.primary : theme.muted} />
      </Fab>
      {nav.error ?? voiceError ?? fetchError ? (
        <Snack message={nav.error ?? voiceError ?? fetchError} severity="error" sticky bottom={bottomH + insets.bottom + SNACK_GAP * 2} dangerColor={theme.danger} onHide={() => { nav.clearError(); setVoiceError(null); setFetchError(null); }} />
      ) : (
        <Snack message={confirmSnack ?? nav.notice} severity={pickFeedback(confirmSnack ? "success" : "neutral")} bottom={bottomH + insets.bottom + SNACK_GAP * 2} onHide={() => {}} />
      )}
      {listOpen ? (
        <Overlay visible variant="sheet" title={formatDist(remaining, t.route.km, t.nav.m)} closeLabel={t.common.cancel} onClose={() => setListOpen(false)}>
          <TurnListSheet
            t={t}
            theme={theme}
            steps={nav.steps}
            stepProg={nav.stepProg}
            streets={nav.streets}
            progress={nav.progress}
            onPreviewStep={(i) => {
              setListOpen(false);
              nav.previewStep(i);
            }}
          />
        </Overlay>
      ) : null}
      {reportAt ? (
        <FlagReportDialog t={t} lat={reportAt.lat} lng={reportAt.lng} onClose={() => setReportAt(null)} onSubmit={(r) => void onSubmitReport(r)} />
      ) : null}
      {selectedFlag ? (
        <Overlay
          visible
          variant="dialog"
          title={flagTypeLabel(selectedFlag.type, t)}
          leading={<MaterialIcons name={hazardKind(selectedFlag.type).icon} size={22} color={hazardKind(selectedFlag.type).color} />}
          right={
            <View style={[styles.statusChip, {backgroundColor: flagStatusColor(selectedFlag.status)}]}>
              <Text style={styles.statusText}>{flagStatusLabel(selectedFlag.status, t)}</Text>
            </View>
          }
          closeLabel={t.common.cancel}
          onClose={closeFlag}
          actions={flagOverlayActions(
            selectedFlag.id,
            selectedFlag.status,
            uid != null && selectedFlag.reporterId === uid,
            votedIds.has(selectedFlag.id),
            deniedIds.has(selectedFlag.id),
            flagBusy,
            {confirm: t.flag.confirm, deny: t.flag.deny, remove: t.flag.remove},
            {onConfirm: (id) => void onConfirmFlag(id), onDeny: (id) => void onDenyFlag(id), onRemove: (id) => void onRemoveFlag(id)},
          )}
        >
          <FlagDetailSheet
            t={t}
            flag={selectedFlag}
            isOwn={uid != null && selectedFlag.reporterId === uid}
          />
        </Overlay>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  bottomStack: {position: "absolute", left: 88, right: 76, gap: 8},
  bottomBar: {borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, gap: 4, alignItems: "center"},
  hazardCard: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12},
  hazardCenter: {flex: 1, alignItems: "center", gap: 2, minWidth: 0},
  hazardTypeRow: {flexDirection: "row", alignItems: "center", gap: 6},
  hazardDist: {fontSize: 14, textAlign: "center"},
  voteSide: {width: 36, alignItems: "center", justifyContent: "center"},
  voteMini: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  topStack: {position: "absolute", left: 88, right: 76, gap: 8},
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
  hazardNumber: {fontSize: 20, fontWeight: "700", textAlign: "center"},
});
