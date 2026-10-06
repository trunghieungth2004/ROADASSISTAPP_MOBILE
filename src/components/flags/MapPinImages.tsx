import {Images} from "@maplibre/maplibre-react-native";

export default function FlagPinImages() {
  return (
    <Images
      images={{
        "flag-0": require("../../../assets/map/hazards/flag-0.png"),
        "flag-1": require("../../../assets/map/hazards/flag-1.png"),
        "flag-2": require("../../../assets/map/hazards/flag-2.png"),
        "flag-3": require("../../../assets/map/hazards/flag-3.png"),
        "pin-accident-1": require("../../../assets/map/hazards/pin-accident-1.png"),
        "pin-accident-2": require("../../../assets/map/hazards/pin-accident-2.png"),
        "pin-accident-3": require("../../../assets/map/hazards/pin-accident-3.png"),
        "pin-flood-1": require("../../../assets/map/hazards/pin-flood-1.png"),
        "pin-flood-2": require("../../../assets/map/hazards/pin-flood-2.png"),
        "pin-flood-3": require("../../../assets/map/hazards/pin-flood-3.png"),
        "pin-obstruction-1": require("../../../assets/map/hazards/pin-obstruction-1.png"),
        "pin-obstruction-2": require("../../../assets/map/hazards/pin-obstruction-2.png"),
        "pin-obstruction-3": require("../../../assets/map/hazards/pin-obstruction-3.png"),
      }}
    />
  );
}
