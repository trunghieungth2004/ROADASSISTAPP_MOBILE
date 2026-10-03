import {StyleSheet, View} from "react-native";
import {Camera, GeoJSONSource, Images, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import type {RefObject} from "react";
import {useState} from "react";
import StyledLayer from "../../components/StyledLayer";
import {bundledMapStyle} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {DispatchTicket} from "../../api/dispatch";
import type {Provider} from "../../api/providers";
import type {RouteOption} from "../../api/routes";
import {HCMC_CENTER, type Point} from "../route/types";
import {pointFeature} from "../route/routeGeo";

type Props = {
  theme: AppTheme;
  cameraRef: RefObject<CameraRef | null>;
  gps: Point | null;
  dest: Point | null;
  mine: DispatchTicket[];
  nearby: DispatchTicket[];
  shops: Provider[];
  selectedShop: Provider | null;
  walkRoute: RouteOption | null;
  onMapReady: () => void;
  onPickTicket: (id: string) => void;
  onPickShop: (id: string) => void;
};

export default function AssistMapView(props: Props) {
  const [mapStyle] = useState(() => bundledMapStyle() ?? "https://demotiles.maplibre.org/style.json");
  const {theme} = props;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        androidView="texture"
        onDidFinishLoadingStyle={() => props.onMapReady()}
      >
        <Camera ref={props.cameraRef} initialViewState={{center: HCMC_CENTER, zoom: 13}} />
        <Images
          images={{
            "a-dot": require("../../../assets/map/a-dot.png"),
            "b-dot": require("../../../assets/map/b-dot.png"),
          }}
        />
        {props.walkRoute ? <GeoJSONSource id="assist-walk-casing" data={{type: "Feature", geometry: props.walkRoute.geometry, properties: {}}}><StyledLayer type="line" id="assist-walk-casing-line" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 9, lineOpacity: 0.3, lineCap: "round", lineJoin: "round"}} /></GeoJSONSource> : null}
        {props.walkRoute ? <GeoJSONSource id="assist-walk" data={{type: "Feature", geometry: props.walkRoute.geometry, properties: {}}}><StyledLayer type="line" id="assist-walk-line" beforeId="Ferry labels" style={{lineColor: theme.primary, lineWidth: 4, lineOpacity: 0.8, lineCap: "round", lineJoin: "round"}} /></GeoJSONSource> : null}
        {props.gps ? (
          <GeoJSONSource id="assist-gps" data={pointFeature(props.gps.lng, props.gps.lat)}>
            <StyledLayer type="circle" id="assist-gps-dot" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
          </GeoJSONSource>
        ) : null}
        {props.dest ? (
          <GeoJSONSource id="assist-dest" data={pointFeature(props.dest.lng, props.dest.lat)}>
            <StyledLayer type="symbol" id="assist-dest-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
        ) : null}
        {props.mine.map((ticket) => (
          <GeoJSONSource
            key={`assist-mine-${ticket.id}`}
            id={`assist-mine-${ticket.id}`}
            data={pointFeature(ticket.lng, ticket.lat)}
            onPress={() => props.onPickTicket(ticket.id)}
          >
            <StyledLayer type="symbol" id={`assist-mine-icon-${ticket.id}`} style={{iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
        ))}
        {props.nearby.map((ticket) => (
          <GeoJSONSource
            key={`assist-near-${ticket.id}`}
            id={`assist-near-${ticket.id}`}
            data={pointFeature(ticket.lng, ticket.lat)}
            onPress={() => props.onPickTicket(ticket.id)}
          >
            <StyledLayer
              type="circle"
              id={`assist-near-dot-${ticket.id}`}
              style={{circleRadius: 10, circleColor: "#f59e0b", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}}
            />
          </GeoJSONSource>
        ))}
        {props.shops.filter((shop) => shop.id !== props.selectedShop?.id).map((shop) => (
          <GeoJSONSource
            key={`assist-shop-${shop.id}`}
            id={`assist-shop-${shop.id}`}
            data={pointFeature(shop.lng, shop.lat)}
            onPress={() => props.onPickShop(shop.id)}
          >
            <StyledLayer
              type="circle"
              id={`assist-shop-dot-${shop.id}`}
              style={{circleRadius: 8, circleColor: theme.primary, circleStrokeColor: "#ffffff", circleStrokeWidth: 3}}
            />
          </GeoJSONSource>
        ))}
        {props.selectedShop ? (
          <GeoJSONSource id="assist-shop-sel" data={pointFeature(props.selectedShop.lng, props.selectedShop.lat)}>
            <StyledLayer type="symbol" id="assist-shop-sel-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  );
}
