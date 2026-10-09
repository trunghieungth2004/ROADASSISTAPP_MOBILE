import {useMemo, useRef} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {Camera, GeoJSONSource, Images, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import type {RouteOption} from "../../api/routes";
import {darkTheme, lightTheme} from "../../theme";
import {bundledMapStyle} from "../../map/style";
import StyledLayer from "../../components/map/StyledLayer";
import MapStyleVeil from "../../components/map/MapStyleVeil";
import {useStyleVeil} from "../../components/map/useStyleVeil";
import {boundsOf} from "../route/routeGeo";
import {pointFeature} from "../route/routeGeo";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  summary: string;
  route: RouteOption;
  origin: {lat: number; lng: number};
  pickup: {lat: number; lng: number};
  dest: {lat: number; lng: number} | null;
  busy: boolean;
  onAccept: () => void;
  onClose: () => void;
};

export default function TowRoutePreview({t, summary, route, origin, pickup, dest, busy, onAccept, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const mapStyle = useMemo(() => bundledMapStyle(scheme === "dark" ? "dark" : "light") ?? "https://demotiles.maplibre.org/style.json", [scheme]);
  const {veiled, onStyleLoaded} = useStyleVeil(scheme);
  const cameraRef = useRef<CameraRef | null>(null);
  const bounds = useMemo(
    () => boundsOf([origin, pickup, ...(dest ? [dest] : [])].map((p) => [p.lng, p.lat] as [number, number])),
    [origin, pickup, dest],
  );
  function onMapReady(): void {
    onStyleLoaded();
    if (bounds) {
      void cameraRef.current?.fitBounds([bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]], {
        padding: {top: 80, right: 40, bottom: 200, left: 40},
        duration: 600,
      });
    }
  }
  return (
    <View style={[styles.screen, {backgroundColor: theme.background, paddingTop: insets.top + 12}]}>
      <View style={styles.header}>
        <Pressable style={[styles.closeBtn, {backgroundColor: theme.danger}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Pressable>
        <Text style={[styles.title, {color: theme.text}]}>{t.assist.towRoutePreview}</Text>
      </View>
      <View style={styles.mapWrap}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          androidView="texture"
          onDidFinishLoadingStyle={onMapReady}
        >
          <Camera ref={cameraRef} initialViewState={{center: [pickup.lng, pickup.lat], zoom: 13}} />
          <Images
            images={{
              "ticket-dot": require("../../../assets/map/route/ticket-dot.png"),
              "b-dot": require("../../../assets/map/route/b-dot.png"),
            }}
          />
          <GeoJSONSource id="tow-preview-line-casing" data={{type: "Feature", geometry: route.geometry, properties: {}}}>
            <StyledLayer type="line" id="tow-preview-line-casing-line" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 9, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
          <GeoJSONSource id="tow-preview-line" data={{type: "Feature", geometry: route.geometry, properties: {}}}>
            <StyledLayer type="line" id="tow-preview-line-line" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 4, lineOpacity: 0.8, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
          <GeoJSONSource id="tow-preview-origin" data={pointFeature(origin.lng, origin.lat)}>
            <StyledLayer type="circle" id="tow-preview-origin-dot" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
          </GeoJSONSource>
          <GeoJSONSource id="tow-preview-pickup" data={pointFeature(pickup.lng, pickup.lat)}>
            <StyledLayer type="symbol" id="tow-preview-pickup-icon" style={{iconImage: "ticket-dot", iconSize: 0.33, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
          {dest ? (
            <GeoJSONSource id="tow-preview-dest" data={pointFeature(dest.lng, dest.lat)}>
              <StyledLayer type="symbol" id="tow-preview-dest-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
            </GeoJSONSource>
          ) : null}
        </Map>
        <MapStyleVeil visible={veiled} backgroundColor={theme.background} />
      </View>
      <View style={[styles.footer, {paddingBottom: insets.bottom + 12}]}>
        <Text style={[styles.summary, {color: theme.text}]}>{summary}</Text>
        <Pressable
          style={[styles.accept, {backgroundColor: theme.primary}, busy && styles.disabled]}
          disabled={busy}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={t.assist.accept}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>{t.assist.accept}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  header: {flexDirection: "row", gap: 8, alignItems: "center"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  title: {fontSize: 16, fontWeight: "700", flex: 1},
  mapWrap: {flex: 1, borderRadius: 16, overflow: "hidden", position: "relative"},
  footer: {gap: 8},
  summary: {fontSize: 13, fontWeight: "600", textAlign: "center"},
  accept: {borderRadius: 8, padding: 12, alignItems: "center"},
  acceptText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
