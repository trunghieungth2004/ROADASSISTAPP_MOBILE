import {StyleSheet, View, useColorScheme} from "react-native";
import {Camera, GeoJSONSource, Images, Map, Marker, type CameraRef} from "@maplibre/maplibre-react-native";
import type {RefObject} from "react";
import {useMemo} from "react";
import StyledLayer from "../../components/map/StyledLayer";
import {bundledMapStyle} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {DispatchTicket} from "../../api/dispatch";
import type {Provider} from "../../api/providers";
import type {RouteOption} from "../../api/routes";
import {HCMC_CENTER, type Point} from "../route/types";
import {pointFeature} from "../route/routeGeo";
import ShopPill from "./ShopPill";
import MapStyleVeil from "../../components/map/MapStyleVeil";
import {useStyleVeil} from "../../components/map/useStyleVeil";

type Props = {
  theme: AppTheme;
  cameraRef: RefObject<CameraRef | null>;
  gps: Point | null;
  dest: Point | null;
  nearby: DispatchTicket[];
  shops: Provider[];
  selectedShop: Provider | null;
  pillTextForShop: (shop: Provider) => string | null;
  walkRoute: RouteOption | null;
  onMapReady: () => void;
  onPickShop: (id: string) => void;
};

export default function AssistMapView(props: Props) {
  const scheme = useColorScheme();
  const mapStyle = useMemo(() => bundledMapStyle(scheme === "dark" ? "dark" : "light") ?? "https://demotiles.maplibre.org/style.json", [scheme]);
  const {theme} = props;
  const {veiled, onStyleLoaded} = useStyleVeil(scheme);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        androidView="texture"
        onDidFinishLoadingStyle={() => { props.onMapReady(); onStyleLoaded(); }}
      >
        <Camera ref={props.cameraRef} initialViewState={{center: HCMC_CENTER, zoom: 13}} />
        <Images
          images={{
            "a-dot": require("../../../assets/map/route/a-dot.png"),
            "ticket-dot": require("../../../assets/map/route/ticket-dot.png"),
            "b-dot": require("../../../assets/map/route/b-dot.png"),
            "shop-pin": require("../../../assets/map/shops/shop-pin.png"),
            "shop-pin-closed": require("../../../assets/map/shops/shop-pin-closed.png"),
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
        {props.nearby.map((ticket) => (
          <GeoJSONSource
            key={`assist-near-${ticket.id}`}
            id={`assist-near-${ticket.id}`}
            data={pointFeature(ticket.lng, ticket.lat)}
          >
            <StyledLayer
              type="circle"
              id={`assist-near-dot-${ticket.id}`}
              style={{circleRadius: 10, circleColor: "#f59e0b", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}}
            />
          </GeoJSONSource>
        ))}
        {props.shops.filter((shop) => shop.id !== props.selectedShop?.id).map((shop) => (
          <>
          <GeoJSONSource
            key={`assist-shop-${shop.id}`}
            id={`assist-shop-${shop.id}`}
            data={pointFeature(shop.lng, shop.lat)}
            onPress={() => props.onPickShop(shop.id)}
          >
            <StyledLayer
              type="symbol"
              id={`assist-shop-icon-${shop.id}`}
              style={{iconImage: shop.openNow === false ? "shop-pin-closed" : shop.openNow === true ? "shop-pin" : "shop-pin-unknown", iconSize: 0.5, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}}
            />
          </GeoJSONSource>
          {props.pillTextForShop(shop) ? (
            <Marker
              key={`assist-shop-pill-${shop.id}`}
              id={`assist-shop-pill-${shop.id}`}
              lngLat={[shop.lng, shop.lat]}
              anchor="bottom"
              offset={[0, -20]}
            >
              <ShopPill theme={props.theme} label={props.pillTextForShop(shop) as string} selected={false} onPress={() => props.onPickShop(shop.id)} />
            </Marker>
          ) : null}
          </>
        ))}
        {props.selectedShop ? (
          <>
          <GeoJSONSource id="assist-shop-sel" data={pointFeature(props.selectedShop.lng, props.selectedShop.lat)}>
            <StyledLayer
              type="symbol"
              id="assist-shop-sel-icon"
              style={{iconImage: props.selectedShop.openNow === false ? "shop-pin-closed" : props.selectedShop.openNow === true ? "shop-pin" : "shop-pin-unknown", iconSize: 0.6, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}}
            />
          </GeoJSONSource>
          {(() => {
            const sel = props.selectedShop;
            const label = sel ? props.pillTextForShop(sel) : null;
            if (!sel || !label) return null;
            return (
              <Marker
                key="assist-shop-sel-label"
                id="assist-shop-sel-label"
                lngLat={[sel.lng, sel.lat]}
                anchor="bottom"
                offset={[0, -24]}
              >
                <ShopPill theme={props.theme} label={label} selected onPress={() => props.onPickShop(sel.id)} />
              </Marker>
            );
          })()}
          </>
        ) : null}
      </Map>
      <MapStyleVeil visible={veiled} backgroundColor={theme.background} />
    </View>
  );
}
