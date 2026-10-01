import {useEffect, useRef, useState} from "react";
import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "./AppText";
import {Camera, GeoJSONSource, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import {maptilerStyleUrlFor} from "../map/style";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {HCMC_CENTER} from "../screens/route/types";
import {pointFeature} from "../screens/route/routeGeo";
import StyledLayer from "./StyledLayer";

type Props = {
  t: Strings;
  lang: string;
  initial: {lat: number; lng: number} | null;
  onPick: (point: {lat: number; lng: number}) => void;
  onClose: () => void;
};

function coordOf(e: unknown): {lat: number; lng: number} | null {
  const geometry = (e as {geometry?: {coordinates?: unknown}})?.geometry;
  const coords = geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") return null;
  return {lng: coords[0], lat: coords[1]};
}

export default function MapPointPicker({t, lang, initial, onPick, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const cameraRef = useRef<CameraRef | null>(null);
  const [point, setPoint] = useState<{lat: number; lng: number} | null>(initial);
  useEffect(() => {
    if (initial) void cameraRef.current?.setStop({center: [initial.lng, initial.lat], zoom: 15, duration: 600});
  }, []);
  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <Map
        style={styles.map}
        mapStyle={maptilerStyleUrlFor(lang) ?? "https://demotiles.maplibre.org/style.json"}
        logo={false}
        attribution={false}
        androidView="texture"
        onPress={(e: unknown) => {
          const next = coordOf(e);
          if (next) setPoint(next);
        }}
      >
        <Camera ref={cameraRef} initialViewState={{center: initial ? [initial.lng, initial.lat] : HCMC_CENTER, zoom: 13}} />
        {point ? (
          <GeoJSONSource id="pick-point" data={pointFeature(point.lng, point.lat)}>
            <StyledLayer type="circle" id="pick-point-circle" style={{circleRadius: 10, circleColor: theme.primary, circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
          </GeoJSONSource>
        ) : null}
      </Map>
      <View style={[styles.bar, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <Pressable style={[styles.btn, {borderColor: theme.border}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <Text style={{color: theme.text}}>{t.common.close}</Text>
        </Pressable>
        <Pressable style={[styles.btn, {backgroundColor: theme.primary}, !point && styles.disabled]} disabled={!point} onPress={() => point && onPick(point)} accessibilityRole="button" accessibilityLabel={t.common.save}>
          <Text style={{color: "#fff", fontWeight: "700"}}>{t.common.save}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  map: {flex: 1},
  bar: {flexDirection: "row", gap: 8, borderTopWidth: 1, padding: 12},
  btn: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
});
