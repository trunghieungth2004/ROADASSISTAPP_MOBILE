import {useCallback, useEffect, useRef, useState} from "react";
import {BackHandler, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useKeepAwake} from "expo-keep-awake";
import {useAuth} from "../context/AuthContext";
import type {RouteOption} from "../api/routes";
import {confirmFlag, denyFlag, submitFlag, unflag, type Flag} from "../api/flags";
import {toMessage} from "../api/client";
import {markDenied, markVoted} from "../storage/votedFlags";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {useNavVoice} from "./navigation/useNavVoice";
import {useNavTracking} from "./navigation/useNavTracking";
import {formatDist} from "./navigation/navUtils";
import NavMapView from "./navigation/NavMapView";
import NavHeader from "./navigation/NavHeader";
import TurnListSheet from "./navigation/TurnListSheet";
import FlagDetailSheet from "../components/FlagDetailSheet";
import FlagSheet, {type FlagReport} from "../components/FlagSheet";

type Props = {
  t: Strings;
  lang: string;
  token: string;
  initialRoute: RouteOption;
  dest: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  width?: number;
  vehicleType?: string;
  onExit: () => void;
};

export default function NavigationScreen({t, lang, token, initialRoute, dest, stops, width, vehicleType, onExit}: Props) {
  useKeepAwake();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const voice = useNavVoice(lang);
  const nav = useNavTracking({token, lang, t, dest, stops, width, vehicleType, initialRoute, speak: voice.speak, resolveVoice: voice.resolveVoice});
  const [listOpen, setListOpen] = useState(false);
  const [reportAt, setReportAt] = useState<{lat: number; lng: number} | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const autoIdRef = useRef<string | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());
  const [flagsKey, setFlagsKey] = useState(0);
  const {uid} = useAuth();
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
  const pace = nav.route.distanceMeters > 0 ? nav.route.durationSeconds / nav.route.distanceMeters : 0;
  const remaining = nav.progress?.remainingMeters ?? nav.route.distanceMeters;
  const etaMin = Math.max(1, Math.round((remaining * pace) / 60));
  const frac = nav.route.distanceMeters > 0 ? Math.min(1, (nav.progress?.progressMeters ?? 0) / nav.route.distanceMeters) : 0;
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
        arrowRotate={nav.arrowRotate}
        cameraRef={nav.cameraRef}
        traveled={nav.traveled}
        remaining={nav.remaining}
        highlight={nav.preview?.highlight ?? null}
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
      <NavHeader
        t={t}
        theme={theme}
        topPad={insets.top + 12}
        next={nav.next}
        arrived={nav.arrived}
        rerouting={nav.rerouting}
        hasPos={nav.pos !== null}
        error={nav.error}
        notice={nav.notice}
        onExit={onExit}
        onOpenList={() => setListOpen(true)}
      />
      <View style={[styles.bottomBar, {backgroundColor: theme.paper, borderColor: theme.border, bottom: insets.bottom + 12}]}>
        <Text style={[styles.remaining, {color: theme.text}]}>{formatDist(remaining, t.route.km, t.nav.m)}</Text>
        <Text style={[styles.eta, {color: theme.muted}]}>{t.nav.eta} {etaMin} {t.route.min}</Text>
        <View style={[styles.bar, {backgroundColor: theme.border}]}>
          <View style={[styles.barFill, {backgroundColor: theme.primary, width: `${Math.round(frac * 100)}%`}]} />
        </View>
      </View>
      <View style={[styles.fabCol, {bottom: insets.bottom + 16}]}>
        <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}, !nav.pos && styles.disabled]} disabled={!nav.pos} onPress={() => nav.pos && setReportAt({lat: nav.pos.lat, lng: nav.pos.lng})} accessibilityRole="button" accessibilityLabel={t.flag.reportTitle}>
          <MaterialIcons name="add-alert" size={22} color={nav.pos ? theme.primary : theme.muted} />
        </Pressable>
        {!nav.following ? (
          <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={nav.onRecenter} accessibilityRole="button" accessibilityLabel={t.nav.recenter}>
            <MaterialIcons name="my-location" size={22} color={theme.primary} />
          </Pressable>
        ) : null}
        <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={voice.toggleMute} accessibilityRole="button" accessibilityLabel={voice.muted ? t.nav.unmute : t.nav.mute}>
          <MaterialIcons name={voice.muted ? "volume-off" : "volume-up"} size={22} color={theme.primary} />
        </Pressable>
      </View>
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
  bottomBar: {position: "absolute", left: 64, right: 64, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, gap: 4, alignItems: "center"},
  remaining: {fontSize: 20, fontWeight: "700", textAlign: "center"},
  eta: {fontSize: 13, textAlign: "center"},
  bar: {height: 6, borderRadius: 3, overflow: "hidden", alignSelf: "stretch"},
  barFill: {height: 6, borderRadius: 3},
  fabCol: {position: "absolute", right: 12, gap: 8},
  fab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
});
