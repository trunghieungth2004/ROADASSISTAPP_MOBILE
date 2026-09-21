import {useEffect, useState} from "react";
import {BackHandler, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useKeepAwake} from "expo-keep-awake";
import type {RouteOption} from "../api/routes";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {useNavVoice} from "./navigation/useNavVoice";
import {useNavTracking} from "./navigation/useNavTracking";
import {formatDist} from "./navigation/navUtils";
import NavMapView from "./navigation/NavMapView";
import NavHeader from "./navigation/NavHeader";
import TurnListSheet from "./navigation/TurnListSheet";

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
  const pace = nav.route.distanceMeters > 0 ? nav.route.durationSeconds / nav.route.distanceMeters : 0;
  const remaining = nav.progress?.remainingMeters ?? nav.route.distanceMeters;
  const etaMin = Math.max(1, Math.round((remaining * pace) / 60));
  const frac = nav.route.distanceMeters > 0 ? Math.min(1, (nav.progress?.progressMeters ?? 0) / nav.route.distanceMeters) : 0;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (listOpen) {
        setListOpen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [listOpen]);
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  bottomBar: {position: "absolute", left: 64, right: 64, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, gap: 4, alignItems: "center"},
  remaining: {fontSize: 20, fontWeight: "700", textAlign: "center"},
  eta: {fontSize: 13, textAlign: "center"},
  bar: {height: 6, borderRadius: 3, overflow: "hidden", alignSelf: "stretch"},
  barFill: {height: 6, borderRadius: 3},
  fabCol: {position: "absolute", right: 12, gap: 8},
  fab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
});
