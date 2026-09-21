import type {RefObject} from "react";
import {useRef} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type PanResponderInstance} from "react-native";
import {AppText as Text} from "../../components/AppText";
import {Camera, CircleLayer, Images, LineLayer, MapView, ShapeSource, SymbolLayer, type CameraRef} from "@maplibre/maplibre-react-native";
import {maptilerStyleUrl} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {RouteOption} from "../../api/routes";
import {HCMC_CENTER, PILL_LIFT_PX, type DragTarget, type Point, type SearchField, type Stop} from "./types";
import {fmtDist, midOf, pillPointAbove, pointFeature} from "./routeGeo";

type Props = {
  t: Strings;
  theme: AppTheme;
  cameraRef: RefObject<CameraRef | null>;
  routes: RouteOption[];
  selectedIndex: number;
  result: RouteOption | null;
  origin: Point | null;
  dest: Point | null;
  gps: Point | null;
  stops: Stop[];
  dragPos: Point | null;
  selectedMid: [number, number] | null;
  mapZoom: number;
  pillBgActive: string;
  dragging: DragTarget | null;
  dragPan: PanResponderInstance;
  pickingFor: SearchField | null;
  pickBusy: boolean;
  onMapPress: (e: unknown) => void;
  onRegionChange: (e: unknown) => void;
  onRegionDid: (e: unknown) => void;
  onSelectIndex: (i: number) => void;
  onCancelPick: () => void;
};

export default function RouteMapView(props: Props) {
  const {t, theme} = props;
  const touchRef = useRef({stamp: 0});
  const guardedPress = (e: unknown): void => {
    if (Date.now() - touchRef.current.stamp < 600) return;
    props.onMapPress(e);
  };
  return (
    <>
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={(e) => {
          if (e.nativeEvent.touches.length > 1) touchRef.current = {stamp: Date.now()};
        }}
      >
      <MapView style={StyleSheet.absoluteFill} mapStyle={maptilerStyleUrl} logoEnabled={false} attributionEnabled={false} onPress={(e: unknown) => guardedPress(e)} onRegionIsChanging={(e: unknown) => props.onRegionChange(e)} onRegionDidChange={(e: unknown) => props.onRegionDid(e)}>
        <Camera ref={props.cameraRef} centerCoordinate={HCMC_CENTER} zoomLevel={13} />
        <Images images={{
          "a-dot": require("../../../assets/map/a-dot.png"),
          "b-dot": require("../../../assets/map/b-dot.png"),
          "stop-dot": require("../../../assets/map/stop-dot.png"),
          "pill-active-light": require("../../../assets/map/pill-active-light.png"),
          "pill-active-dark": require("../../../assets/map/pill-active-dark.png"),
          "pill-idle": require("../../../assets/map/pill-idle.png"),
          "handle2-dot": require("../../../assets/map/handle2-dot.png"),
        }} />
        {props.routes.map((r, i) => i === props.selectedIndex ? null : (
          <ShapeSource key={`route-${i}`} id={`route-${i}`} shape={{type: "Feature", geometry: r.geometry, properties: {}}}><LineLayer id={`routeLine-${i}`} belowLayerID="Ferry labels" style={{lineColor: "#94a3b8", lineWidth: 3, lineOpacity: 0.6, lineCap: "round", lineJoin: "round"}} /></ShapeSource>
        ))}
        {props.result ? <ShapeSource id="route-casing" shape={{type: "Feature", geometry: props.result.geometry, properties: {}}}><LineLayer id="routeLine-casing" belowLayerID="Ferry labels" style={{lineColor: theme.primary, lineWidth: 9, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} /></ShapeSource> : null}
        {props.result ? <ShapeSource id="route" shape={{type: "Feature", geometry: props.result.geometry, properties: {}}}><LineLayer id="routeLine" belowLayerID="Ferry labels" style={{lineColor: theme.primary, lineWidth: 4, lineOpacity: 0.8, lineCap: "round", lineJoin: "round"}} /></ShapeSource> : null}
        {props.origin ? <ShapeSource id="marker-a" shape={pointFeature(props.origin.lng, props.origin.lat)}><SymbolLayer id="marker-a-icon" style={{iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></ShapeSource> : null}
        {props.dest ? <ShapeSource id="marker-b" shape={pointFeature(props.dest.lng, props.dest.lat)}><SymbolLayer id="marker-b-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></ShapeSource> : null}
        {props.gps ? (
          <ShapeSource id="gps-dot" shape={pointFeature(props.gps.lng, props.gps.lat)}>
            <CircleLayer id="gps-dot-circle" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
          </ShapeSource>
        ) : null}
        {props.stops.map((s, i) => (
          <ShapeSource key={`stop-${s.lat},${s.lng},${i}`} id={`stop-${s.lat},${s.lng},${i}`} shape={pointFeature(s.lng, s.lat)}>
            <SymbolLayer id={`stop-icon-${s.lat},${s.lng},${i}`} style={{iconImage: "stop-dot", iconSize: 0.3, iconAllowOverlap: true, iconIgnorePlacement: true}} />
            <SymbolLayer id={`stop-label-${s.lat},${s.lng},${i}`} style={{textField: String(i + 1), textSize: 12, textColor: "#ffffff", textAnchor: "center", textAllowOverlap: true, textIgnorePlacement: true}} />
          </ShapeSource>
        ))}
        {props.result ? (() => {
          const mid = midOf(props.result.geometry.coordinates);
          if (!mid) return null;
          const label = `${fmtDist(props.result.distanceMeters / 1000)} ${t.route.km} · ${fmtDist(props.result.durationSeconds / 60)} ${t.route.min}`;
          const pp = pillPointAbove(mid, props.mapZoom, PILL_LIFT_PX);
          return (
            <ShapeSource key="pill-selected" id="pill-selected" shape={pointFeature(pp[0], pp[1])}>
              <SymbolLayer id="pill-selected" style={{iconImage: props.pillBgActive, iconSize: 1, iconAnchor: "center", iconTextFit: "both", iconTextFitPadding: [9, 18, 9, 18], textField: label, textSize: 15, textColor: "#ffffff", textAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true, textAllowOverlap: true, textIgnorePlacement: true}} />
            </ShapeSource>
          );
        })() : null}
        {props.result && (props.dragPos ?? props.selectedMid) ? (
          <ShapeSource id="reshape-handle" shape={pointFeature((props.dragPos ? props.dragPos.lng : props.selectedMid![0]), (props.dragPos ? props.dragPos.lat : props.selectedMid![1]))}>
            <SymbolLayer id="reshape-handle-icon" style={{iconImage: "handle2-dot", iconSize: 0.33, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </ShapeSource>
        ) : null}
      </MapView>
      </View>
      {props.routes.length > 1 ? (
        <View style={styles.topBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topBarContent}>
            {props.routes.map((r, i) => (
              <Pressable key={i} style={[styles.pill, {backgroundColor: i === props.selectedIndex ? theme.primary : theme.paper, borderColor: theme.border}]} onPress={() => props.onSelectIndex(i)}>
                <Text style={{color: i === props.selectedIndex ? "#fff" : theme.text, fontWeight: "700"}}>{i + 1} · {(r.distanceMeters / 1000).toFixed(1)} {t.route.km} · {Math.round(r.durationSeconds / 60)} {t.route.min}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {props.dragging ? <View style={StyleSheet.absoluteFill} {...props.dragPan.panHandlers} /> : null}
      {props.dragging ? (
        <View style={styles.dragHint} pointerEvents="none">
          <Text style={styles.dragHintText}>{t.route.dragHint}</Text>
        </View>
      ) : null}
      {props.pickingFor ? (
        <Pressable style={[styles.pickChipTop, {backgroundColor: theme.paper, borderColor: theme.primary, top: props.routes.length > 1 ? 64 : 12}]} onPress={props.onCancelPick}>
          {props.pickBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary, fontWeight: "700"}}>{t.route.pickOnMap} · {props.pickingFor === "origin" ? "A" : props.pickingFor === "destination" ? "B" : "+"}</Text>}
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {position: "absolute", top: 12, left: 0, right: 0, alignItems: "center"},
  topBarContent: {paddingHorizontal: 12, gap: 8},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14},
  dragHint: {position: "absolute", top: 64, left: 0, right: 0, alignItems: "center"},
  dragHintText: {backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, overflow: "hidden"},
  pickChipTop: {position: "absolute", left: 12, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, zIndex: 10, elevation: 4},
});
