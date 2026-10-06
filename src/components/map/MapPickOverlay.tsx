import {useEffect, useMemo, useRef, useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {Camera, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {formatPoint, reverseLabel} from "../../api/places";
import {toMessage} from "../../api/client";
import {getFix} from "../../services/geo";
import {darkTheme, lightTheme} from "../../theme";
import {bundledMapStyle} from "../../map/style";
import MapStyleVeil from "./MapStyleVeil";
import {useStyleVeil} from "./useStyleVeil";
import {HCMC_CENTER} from "../../screens/route/types";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  lang: string;
  title: string;
  initial: {lat: number; lng: number} | null;
  onPick: (lat: number, lng: number, label: string) => void;
  onClose: () => void;
};

function readCenter(e: unknown): [number, number] | null {
  const center = (e as {nativeEvent?: {center?: unknown}}).nativeEvent?.center;
  if (!Array.isArray(center) || center.length < 2) return null;
  const [lng, lat] = center;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return [lng, lat];
}

export default function MapPickOverlay({t, lang, title, initial, onPick, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const mapStyle = useMemo(() => bundledMapStyle(scheme === "dark" ? "dark" : "light") ?? "https://demotiles.maplibre.org/style.json", [scheme]);
  const {veiled, onStyleLoaded} = useStyleVeil(scheme);
  const cameraRef = useRef<CameraRef | null>(null);
  const [center, setCenter] = useState<[number, number]>(initial ? [initial.lng, initial.lat] : HCMC_CENTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initial) return;
    let alive = true;
    void getFix()
      .then((fix) => {
        if (!alive) return;
        setCenter([fix.lng, fix.lat]);
        void cameraRef.current?.setStop({center: [fix.lng, fix.lat], zoom: 15, duration: 800});
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  async function confirm(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const label = await reverseLabel(center[1], center[0], lang);
      onPick(center[1], center[0], label);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[styles.screen, {backgroundColor: theme.background, paddingTop: insets.top + 12}]}>
      <View style={styles.header}>
        <Pressable style={[styles.closeBtn, {backgroundColor: theme.danger}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Pressable>
        <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
      </View>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <View style={styles.mapWrap}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          androidView="texture"
          onRegionDidChange={(e: unknown) => {
            const next = readCenter(e);
            if (next) setCenter(next);
          }}
          onDidFinishLoadingStyle={onStyleLoaded}
        >
          <Camera ref={cameraRef} initialViewState={{center, zoom: 15}} />
        </Map>
        <MapStyleVeil visible={veiled} backgroundColor={theme.background} />
        <View style={styles.crosshair} pointerEvents="none">
          <MaterialIcons name="place" size={40} color={theme.primary} />
        </View>
      </View>
      <View style={[styles.footer, {paddingBottom: insets.bottom + 12}]}>
        <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(center[1], center[0])}</Text>
        <Pressable
          style={[styles.confirm, {backgroundColor: theme.primary}, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void confirm()}
          accessibilityRole="button"
          accessibilityLabel={t.provider.useThisLocation}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{t.provider.useThisLocation}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, paddingHorizontal: 12, gap: 8},
  header: {flexDirection: "row", gap: 8, alignItems: "center"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  title: {fontSize: 16, fontWeight: "700", flex: 1},
  error: {fontSize: 13},
  mapWrap: {flex: 1, borderRadius: 16, overflow: "hidden", position: "relative"},
  crosshair: {position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center"},
  footer: {gap: 8},
  coords: {fontSize: 12, textAlign: "center"},
  confirm: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  confirmText: {color: "#fff", fontWeight: "700"},
});
