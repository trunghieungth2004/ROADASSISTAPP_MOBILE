import {useEffect, useRef} from "react";
import {StyleSheet, View} from "react-native";
import {Camera, Map, type CameraRef} from "@maplibre/maplibre-react-native";
import {maptilerStyleUrlFor} from "../../map/style";
import type {Flag} from "../../api/flags";
import FlagMapLayers from "../../components/FlagMapLayers";
import FlagPinImages from "../../components/MapPinImages";
import {HCMC_CENTER} from "../route/types";
import {shouldAutoFit} from "../route/cameraIntent";

type Props = {
  lang: string;
  flags: Flag[];
  focus: {lat: number; lng: number; n: number} | null;
  onPickFlag: (flag: Flag) => void;
};

export default function HazardMapView(props: Props) {
  const cameraRef = useRef<CameraRef | null>(null);
  const pendingRef = useRef<{lat: number; lng: number} | null>(null);
  const fittedRef = useRef(false);
  function drainPending(): void {
    const pending = pendingRef.current;
    const cam = cameraRef.current;
    if (!pending || !cam) return;
    pendingRef.current = null;
    void cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 600});
  }
  useEffect(() => {
    if (!props.focus) return;
    pendingRef.current = {lat: props.focus.lat, lng: props.focus.lng};
    drainPending();
  }, [props.focus]);
  useEffect(() => {
    if (!shouldAutoFit({focusPending: pendingRef.current !== null, flagCount: props.flags.length, fitted: fittedRef.current})) return;
    fittedRef.current = true;
    const lats = props.flags.map((f) => f.lat);
    const lngs = props.flags.map((f) => f.lng);
    if (props.flags.length === 1 || (Math.min(...lngs) === Math.max(...lngs) && Math.min(...lats) === Math.max(...lats))) {
      void cameraRef.current?.setStop({center: [lngs[0] ?? HCMC_CENTER[0], lats[0] ?? HCMC_CENTER[1]], zoom: 14, duration: 600});
      return;
    }
    void cameraRef.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], {
      padding: {top: 40, right: 40, bottom: 40, left: 40},
      duration: 600,
    });
  }, [props.flags]);
  const initial: [number, number] = props.flags.length > 0 ? [props.flags[0]?.lng ?? HCMC_CENTER[0], props.flags[0]?.lat ?? HCMC_CENTER[1]] : HCMC_CENTER;
  return (
    <View style={styles.clip}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={maptilerStyleUrlFor(props.lang) ?? "https://demotiles.maplibre.org/style.json"}
        logo={false}
        attribution={false}
        androidView="texture"
        onDidFinishLoadingStyle={drainPending}
      >
        <Camera ref={cameraRef} initialViewState={{center: initial, zoom: 12}} />
        <FlagPinImages />
        <FlagMapLayers flags={props.flags} onPick={props.onPickFlag} />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {flex: 1, overflow: "hidden"},
});
