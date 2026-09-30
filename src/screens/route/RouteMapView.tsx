import type {RefObject} from "react";
import {useEffect, useRef, type MutableRefObject} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type PanResponderInstance} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppText as Text} from "../../components/AppText";
import {Camera, Images, Map, GeoJSONSource, type CameraRef} from "@maplibre/maplibre-react-native";
import StyledLayer from "../../components/StyledLayer";
import {maptilerStyleUrlFor} from "../../map/style";
import FlagPinImages from "../../components/MapPinImages";
import {Fab} from "../../components/Fab";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {RouteOption} from "../../api/routes";
import {HCMC_CENTER, type CamState, type DragTarget, type Point, type SearchField, type Stop} from "./types";
import {pointFeature} from "./routeGeo";
import {pillMeta} from "./routeSummary";
import RouteFlags from "./RouteFlags";
import type {Flag} from "../../api/flags";

type Props = {
  t: Strings;
  lang: string;
  theme: AppTheme;
  cameraRef: RefObject<CameraRef | null>;
  routes: RouteOption[];
  selectedIndex: number;
  result: RouteOption | null;
  origin: Point | null;
  dest: Point | null;
  gps: Point | null;
  flagPoint: Point | null;
  stops: Stop[];
  dragPos: Point | null;
  selectedMid: [number, number] | null;
  hazardHighlight: [number, number][] | null;
  dragging: DragTarget | null;
  dragPan: PanResponderInstance;
  pickingFor: SearchField | null;
  pickBusy: boolean;
  onMapPress: (e: unknown) => void;
  onRegionChange: (e: unknown) => void;
  onRegionDid: (e: unknown) => void;
  onSelectIndex: (i: number) => void;
  onCancelPick: () => void;
  onMapReady: () => void;
  flagCamRef: MutableRefObject<CamState>;
  flagsToken: string | null;
  flagsKey: number;
  onPickFlag: (flag: Flag) => void;
  subscribeRegionDid: (cb: () => void) => () => void;
};

export default function RouteMapView(props: Props) {
  const {t, theme} = props;
  const insets = useSafeAreaInsets();
  const touchRef = useRef({stamp: 0});
  const pillScrollRef = useRef<ScrollView | null>(null);
  const pillX = useRef<number[]>([]);
  const guardedPress = (e: unknown): void => {
    if (Date.now() - touchRef.current.stamp < 600) return;
    props.onMapPress(e);
  };
  useEffect(() => {
    pillScrollRef.current?.scrollTo({x: Math.max(0, (pillX.current[props.selectedIndex] ?? 0) - 24), animated: true});
  }, [props.selectedIndex]);
  return (
    <>
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={(e) => {
          if (e.nativeEvent.touches.length > 1) touchRef.current = {stamp: Date.now()};
        }}
      >
      <Map style={StyleSheet.absoluteFill} mapStyle={maptilerStyleUrlFor(props.lang) ?? "https://demotiles.maplibre.org/style.json"} logo={false} attribution={false} androidView="texture" onPress={(e: unknown) => guardedPress(e)} onRegionIsChanging={(e: unknown) => props.onRegionChange(e)} onRegionDidChange={(e: unknown) => props.onRegionDid(e)} onDidFinishLoadingStyle={() => props.onMapReady()}>
        <Camera ref={props.cameraRef} initialViewState={{center: HCMC_CENTER, zoom: 13}} />
        <Images images={{
          "a-dot": require("../../../assets/map/a-dot.png"),
          "b-dot": require("../../../assets/map/b-dot.png"),
          "stop-dot": require("../../../assets/map/stop-dot.png"),
          "handle2-dot": require("../../../assets/map/handle2-dot.png"),
          "pin-preview": require("../../../assets/map/pin-preview.png"),
        }} />
        <FlagPinImages />
        {props.routes.map((r, i) => i === props.selectedIndex ? null : (
          <GeoJSONSource key={`route-${i}`} id={`route-${i}`} data={{type: "Feature", geometry: r.geometry, properties: {}}}><StyledLayer type="line" id={`routeLine-${i}`} beforeId="Ferry labels" style={{lineColor: "#94a3b8", lineWidth: 3, lineOpacity: 0.6, lineCap: "round", lineJoin: "round"}} /></GeoJSONSource>
        ))}
        {props.result ? <GeoJSONSource id="route-casing" data={{type: "Feature", geometry: props.result.geometry, properties: {}}}><StyledLayer type="line" id="routeLine-casing" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 9, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} /></GeoJSONSource> : null}
        {props.result ? <GeoJSONSource id="route" data={{type: "Feature", geometry: props.result.geometry, properties: {}}}><StyledLayer type="line" id="routeLine" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 4, lineOpacity: 0.8, lineCap: "round", lineJoin: "round"}} /></GeoJSONSource> : null}
        {props.hazardHighlight && props.hazardHighlight.length > 1 ? (
          <GeoJSONSource id="route-hazard-highlight-casing" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.hazardHighlight}, properties: {}}}>
            <StyledLayer type="line" id="route-hazard-highlight-casing-line" beforeId="Ferry labels" style={{lineColor: "#ffffff", lineWidth: 9, lineOpacity: 1, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
        {props.hazardHighlight && props.hazardHighlight.length > 1 ? (
          <GeoJSONSource id="route-hazard-highlight" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.hazardHighlight}, properties: {}}}>
            <StyledLayer type="line" id="route-hazard-highlight-line" beforeId="Ferry labels" style={{lineColor: "#f59e0b", lineWidth: 5, lineOpacity: 1, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
        {props.origin ? <GeoJSONSource id="marker-a" data={pointFeature(props.origin.lng, props.origin.lat)}><StyledLayer type="symbol" id="marker-a-icon" style={{iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></GeoJSONSource> : null}
        {props.dest ? <GeoJSONSource id="marker-b" data={pointFeature(props.dest.lng, props.dest.lat)}><StyledLayer type="symbol" id="marker-b-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></GeoJSONSource> : null}
        {props.gps ? (
          <GeoJSONSource id="gps-dot" data={pointFeature(props.gps.lng, props.gps.lat)}>
            <StyledLayer type="circle" id="gps-dot-circle" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
          </GeoJSONSource>
        ) : null}
        {props.flagPoint ? (
          <GeoJSONSource id="flag-point" data={pointFeature(props.flagPoint.lng, props.flagPoint.lat)}>
            <StyledLayer type="symbol" id="flag-point-icon" style={{iconImage: "pin-preview", iconSize: 0.5, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
        ) : null}
        {props.stops.map((s, i) => (
          <GeoJSONSource key={`stop-${s.lat},${s.lng},${i}`} id={`stop-${s.lat},${s.lng},${i}`} data={pointFeature(s.lng, s.lat)}>
            <StyledLayer type="symbol" id={`stop-icon-${s.lat},${s.lng},${i}`} style={{iconImage: "stop-dot", iconSize: 0.3, iconAllowOverlap: true, iconIgnorePlacement: true}} />
            <StyledLayer type="symbol" id={`stop-label-${s.lat},${s.lng},${i}`} style={{textField: String(i + 1), textSize: 12, textColor: "#ffffff", textAnchor: "center", textAllowOverlap: true, textIgnorePlacement: true}} />
          </GeoJSONSource>
        ))}
        {props.result && (props.dragPos ?? props.selectedMid) ? (
          <GeoJSONSource id="reshape-handle" data={pointFeature((props.dragPos ? props.dragPos.lng : props.selectedMid![0]), (props.dragPos ? props.dragPos.lat : props.selectedMid![1]))}>
            <StyledLayer type="symbol" id="reshape-handle-icon" style={{iconImage: "handle2-dot", iconSize: 0.33, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
        ) : null}
        <RouteFlags camRef={props.flagCamRef} token={props.flagsToken} refreshKey={props.flagsKey} onPick={props.onPickFlag} subscribeRegionDid={props.subscribeRegionDid} />
      </Map>
      </View>
      {props.routes.length > 1 ? (
        <View style={[styles.topBar, {top: insets.top + 12}]}>
          <ScrollView ref={pillScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topBarContent}>
            {props.routes.map((r, i) => {
              const meta = pillMeta(props.routes, i);
              const selected = i === props.selectedIndex;
              return (
                <Pressable
                  key={i}
                  style={[styles.pill, {backgroundColor: selected ? theme.primary : theme.paper, borderColor: theme.border}]}
                  onPress={() => props.onSelectIndex(i)}
                  onLayout={(e) => {
                    pillX.current[i] = e.nativeEvent.layout.x;
                  }}
                >
                  <View style={styles.pillInner}>
                    {meta.hazards > 0 ? (
                      <MaterialIcons name="warning-amber" size={16} color={selected ? "#fff" : "#f59e0b"} />
                    ) : meta.best ? (
                      <MaterialIcons name="check-circle" size={16} color={selected ? "#fff" : theme.primary} />
                    ) : null}
                    <Text style={{color: selected ? "#fff" : theme.text, fontWeight: "700"}}>{i + 1} · {(r.distanceMeters / 1000).toFixed(1)} {t.route.km} · {Math.round(r.durationSeconds / 60)} {t.route.min}{meta.hazards > 0 ? ` · ${meta.hazards}` : ""}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {props.dragging ? <View style={StyleSheet.absoluteFill} {...props.dragPan.panHandlers} /> : null}
      {props.pickingFor ? (
        <Fab theme={theme} variant="danger" size={36} label={t.common.close} onPress={props.onCancelPick} style={{position: "absolute", left: 12, top: insets.top + 12, zIndex: 10, elevation: 4}}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Fab>
      ) : null}
      {props.pickingFor && props.pickBusy ? (
        <View style={[styles.pickResolving, {top: insets.top + 56}]} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {position: "absolute", left: 72, right: 72, alignItems: "center"},
  topBarContent: {paddingHorizontal: 12, gap: 8},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14},
  pillInner: {flexDirection: "row", alignItems: "center", gap: 4},
  pickResolving: {position: "absolute", left: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 10, elevation: 4},
});
