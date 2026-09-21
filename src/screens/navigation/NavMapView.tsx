import type {RefObject} from "react";
import {StyleSheet} from "react-native";
import {Camera, Images, LineLayer, MapView, ShapeSource, SymbolLayer, type CameraRef} from "@maplibre/maplibre-react-native";
import {maptilerStyleUrl} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {RouteOption} from "../../api/routes";
import {NAV_HOME} from "./navUtils";

type Props = {
  theme: AppTheme;
  route: RouteOption;
  pos: {lat: number; lng: number} | null;
  arrowRotate: number;
  cameraRef: RefObject<CameraRef | null>;
  traveled: [number, number][];
  remaining: [number, number][];
  highlight: [number, number][] | null;
  onRegionChanging: (e: unknown) => void;
  onRegionDid: () => void;
};

export default function NavMapView(props: Props) {
  const {theme} = props;
  const coords = props.route.geometry.coordinates;
  const a = coords.length > 0 ? coords[0] : null;
  const b = coords.length > 0 ? coords[coords.length - 1] : null;
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      mapStyle={maptilerStyleUrl}
      logoEnabled={false}
      attributionEnabled={false}
      onRegionIsChanging={(e: unknown) => props.onRegionChanging(e)}
      onRegionDidChange={() => props.onRegionDid()}
    >
      <Camera ref={props.cameraRef} centerCoordinate={NAV_HOME} zoomLevel={13} />
      <Images images={{"nav-arrow": require("../../../assets/map/nav-arrow.png"), "a-dot": require("../../../assets/map/a-dot.png"), "b-dot": require("../../../assets/map/b-dot.png")}} />
      {props.pos ? (
        <ShapeSource id="nav-puck" shape={{type: "Feature", geometry: {type: "Point", coordinates: [props.pos.lng, props.pos.lat]}, properties: {}}}>
          <SymbolLayer
            id="nav-puck-arrow"
            style={{iconImage: "nav-arrow", iconSize: 0.42, iconAnchor: "center", iconRotate: props.arrowRotate, iconRotationAlignment: "map", iconAllowOverlap: true, iconIgnorePlacement: true}}
          />
        </ShapeSource>
      ) : null}
        <ShapeSource id="nav-route-casing" shape={{type: "Feature", geometry: props.route.geometry, properties: {}}}>
          <LineLayer id="nav-route-line-casing" belowLayerID="Ferry labels" style={{lineColor: theme.primary, lineWidth: 11, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} />
        </ShapeSource>
        {props.traveled.length > 1 ? (
          <ShapeSource id="nav-traveled" shape={{type: "Feature", geometry: {type: "LineString", coordinates: props.traveled}, properties: {}}}>
            <LineLayer id="nav-traveled-line" belowLayerID="Ferry labels" style={{lineColor: "#94a3b8", lineWidth: 5, lineOpacity: 0.7, lineCap: "round", lineJoin: "round"}} />
          </ShapeSource>
        ) : null}
        {props.remaining.length > 1 ? (
          <ShapeSource id="nav-route" shape={{type: "Feature", geometry: {type: "LineString", coordinates: props.remaining}, properties: {}}}>
            <LineLayer id="nav-route-line" belowLayerID="Ferry labels" style={{lineColor: theme.primary, lineWidth: 5, lineOpacity: 0.9, lineCap: "round", lineJoin: "round"}} />
          </ShapeSource>
        ) : null}
        {props.highlight && props.highlight.length > 1 ? (
          <ShapeSource id="nav-highlight" shape={{type: "Feature", geometry: {type: "LineString", coordinates: props.highlight}, properties: {}}}>
            <LineLayer id="nav-highlight-line" style={{lineColor: theme.primary, lineWidth: 9, lineOpacity: 0.45, lineCap: "round", lineJoin: "round"}} />
          </ShapeSource>
        ) : null}
      {a ? (
        <ShapeSource id="nav-a" shape={{type: "Feature", geometry: {type: "Point", coordinates: [a[0], a[1]]}, properties: {}}}>
          <SymbolLayer id="nav-a-icon" style={{iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
        </ShapeSource>
      ) : null}
      {b ? (
        <ShapeSource id="nav-b" shape={{type: "Feature", geometry: {type: "Point", coordinates: [b[0], b[1]]}, properties: {}}}>
          <SymbolLayer id="nav-b-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
        </ShapeSource>
      ) : null}
    </MapView>
  );
}
