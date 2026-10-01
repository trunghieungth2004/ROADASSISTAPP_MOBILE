import {useRef} from "react";
import {ActivityIndicator, StyleSheet, View} from "react-native";
import {Camera, GeoJSONSource, Images, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import type {RefObject} from "react";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Fab} from "../../components/Fab";
import StyledLayer from "../../components/StyledLayer";
import {maptilerStyleUrlFor} from "../../map/style";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {DispatchTicket} from "../../api/dispatch";
import {HCMC_CENTER, type Point} from "../route/types";
import {pointFeature} from "../route/routeGeo";

type Props = {
  t: Strings;
  lang: string;
  theme: AppTheme;
  cameraRef: RefObject<CameraRef | null>;
  gps: Point | null;
  at: Point | null;
  dest: Point | null;
  mine: DispatchTicket[];
  nearby: DispatchTicket[];
  picking: boolean;
  pickBusy: boolean;
  onMapPress: (e: unknown) => void;
  onMapReady: () => void;
  onPickTicket: (id: string) => void;
  onCancelPick: () => void;
};

export default function AssistMapView(props: Props) {
  const {t, theme} = props;
  const insets = useSafeAreaInsets();
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
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={maptilerStyleUrlFor(props.lang) ?? "https://demotiles.maplibre.org/style.json"}
          logo={false}
          attribution={false}
          androidView="texture"
          onPress={(e: unknown) => guardedPress(e)}
          onDidFinishLoadingStyle={() => props.onMapReady()}
        >
          <Camera ref={props.cameraRef} initialViewState={{center: HCMC_CENTER, zoom: 13}} />
          <Images
            images={{
              "a-dot": require("../../../assets/map/a-dot.png"),
              "b-dot": require("../../../assets/map/b-dot.png"),
              "pin-preview": require("../../../assets/map/pin-preview.png"),
            }}
          />
          {props.gps ? (
            <GeoJSONSource id="assist-gps" data={pointFeature(props.gps.lng, props.gps.lat)}>
              <StyledLayer type="circle" id="assist-gps-dot" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
            </GeoJSONSource>
          ) : null}
          {props.at ? (
            <GeoJSONSource id="assist-at" data={pointFeature(props.at.lng, props.at.lat)}>
              <StyledLayer type="symbol" id="assist-at-icon" style={{iconImage: "pin-preview", iconSize: 0.5, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
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
        </Map>
      </View>
      {props.picking ? (
        <Fab theme={theme} variant="danger" size={36} label={t.common.close} onPress={props.onCancelPick} style={{position: "absolute", left: 12, top: insets.top + 12, zIndex: 10, elevation: 4}}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Fab>
      ) : null}
      {props.picking && props.pickBusy ? (
        <View style={[styles.pickResolving, {top: insets.top + 56}]} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pickResolving: {position: "absolute", left: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 10, elevation: 4},
});
