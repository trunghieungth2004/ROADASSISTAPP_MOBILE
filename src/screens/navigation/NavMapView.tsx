import type {RefObject} from "react";
import {StyleSheet} from "react-native";
import {Camera, Images, Layer, Map, GeoJSONSource, type CameraRef} from "@maplibre/maplibre-react-native";
import {maptilerStyleUrl} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {RouteOption} from "../../api/routes";
import type {Flag} from "../../api/flags";
import NavFlags from "./NavFlags";

type Props = {
  theme: AppTheme;
  route: RouteOption;
  pos: {lat: number; lng: number} | null;
  initialCenter: [number, number];
  arrowRotate: number;
  cameraRef: RefObject<CameraRef | null>;
  traveled: [number, number][];
  remaining: [number, number][];
  highlight: [number, number][] | null;
  flagsPos: {lat: number; lng: number} | null;
  flagsToken: string | null;
  flagsKey: number;
  flagsUid: string | null;
  flagsVoted: Set<string>;
  flagsDenied: Set<string>;
  flagsSuppressAuto: boolean;
  flagsArrived: boolean;
  onPickFlag: (flag: Flag) => void;
  onAutoFlag: (flag: Flag | null) => void;
  onRegionChanging: (e: unknown) => void;
  onRegionDid: () => void;
};

export default function NavMapView(props: Props) {
  const {theme} = props;
  const coords = props.route.geometry.coordinates;
  const b = coords.length > 0 ? coords[coords.length - 1] : null;
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={maptilerStyleUrl ?? "https://demotiles.maplibre.org/style.json"}
      logo={false}
      attribution={false}
      androidView="texture"
      onRegionIsChanging={(e: unknown) => props.onRegionChanging(e)}
      onRegionDidChange={() => props.onRegionDid()}
    >
      <Camera ref={props.cameraRef} initialViewState={{center: props.initialCenter, zoom: 13}} />
        <Images images={{"nav-arrow": require("../../../assets/map/nav-arrow.png"), "b-dot": require("../../../assets/map/b-dot.png"), "flag-0": require("../../../assets/map/flag-0.png"), "flag-1": require("../../../assets/map/flag-1.png"), "flag-2": require("../../../assets/map/flag-2.png"), "flag-3": require("../../../assets/map/flag-3.png")}} />
      {props.pos ? (
        <GeoJSONSource id="nav-puck" data={{type: "Feature", geometry: {type: "Point", coordinates: [props.pos.lng, props.pos.lat]}, properties: {}}}>
          <Layer
            type="symbol"
            id="nav-puck-arrow"
            style={{iconImage: "nav-arrow", iconSize: 0.42, iconAnchor: "center", iconRotate: props.arrowRotate, iconRotationAlignment: "map", iconAllowOverlap: true, iconIgnorePlacement: true}}
          />
        </GeoJSONSource>
      ) : null}
        <GeoJSONSource id="nav-route-casing" data={{type: "Feature", geometry: props.route.geometry, properties: {}}}>
          <Layer type="line" id="nav-route-line-casing" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 11, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} />
        </GeoJSONSource>
        {props.traveled.length > 1 ? (
          <GeoJSONSource id="nav-traveled" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.traveled}, properties: {}}}>
            <Layer type="line" id="nav-traveled-line" beforeId="Ferry labels" style={{lineColor: "#94a3b8", lineWidth: 5, lineOpacity: 0.7, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
        {props.remaining.length > 1 ? (
          <GeoJSONSource id="nav-route" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.remaining}, properties: {}}}>
            <Layer type="line" id="nav-route-line" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 5, lineOpacity: 0.9, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
        {props.highlight && props.highlight.length > 1 ? (
          <GeoJSONSource id="nav-highlight-casing" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.highlight}, properties: {}}}>
            <Layer type="line" id="nav-highlight-casing-line" beforeId="Ferry labels" style={{lineColor: "#ffffff", lineWidth: 9, lineOpacity: 1, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
        {props.highlight && props.highlight.length > 1 ? (
          <GeoJSONSource id="nav-highlight" data={{type: "Feature", geometry: {type: "LineString", coordinates: props.highlight}, properties: {}}}>
            <Layer type="line" id="nav-highlight-line" beforeId="Ferry labels" style={{lineColor: "#f59e0b", lineWidth: 5, lineOpacity: 1, lineCap: "round", lineJoin: "round"}} />
          </GeoJSONSource>
        ) : null}
      {b ? (
        <GeoJSONSource id="nav-b" data={{type: "Feature", geometry: {type: "Point", coordinates: [b[0], b[1]]}, properties: {}}}>
          <Layer type="symbol" id="nav-b-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
        </GeoJSONSource>
      ) : null}
        <NavFlags pos={props.flagsPos} token={props.flagsToken} refreshKey={props.flagsKey} uid={props.flagsUid} votedIds={props.flagsVoted} deniedIds={props.flagsDenied} suppressAuto={props.flagsSuppressAuto} arrived={props.flagsArrived} onPick={props.onPickFlag} onAutoFlag={props.onAutoFlag} />
    </Map>
  );
}
