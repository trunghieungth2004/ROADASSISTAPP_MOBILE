import {useState} from "react";
import {Keyboard} from "react-native";
import VehicleCreateSheet from "./VehicleCreateSheet";
import Overlay from "../overlay/Overlay";
import {addRideConfig, createProfile, VEHICLE_DEFAULT_WIDTH, type VehicleType} from "../../api/vehicles";
import {toMessage} from "../../api/client";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function VehicleCreateDialog({t, theme, token, onClose, onCreated}: Props) {
  const [type, setType] = useState<VehicleType>("SCOOTER");
  const [width, setWidth] = useState("0.7");
  const [height, setHeight] = useState("1.1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function onTypeChange(next: VehicleType): void {
    setType(next);
    setWidth(String(VEHICLE_DEFAULT_WIDTH[next] ?? 0.7));
    setHeight(next === "CAR" ? "1.5" : "1.1");
  }
  async function onSave(): Promise<void> {
    if (!token || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      const created = await createProfile({type, baseWidth: Number(width), baseHeight: Number(height)}, token);
      await addRideConfig({profileId: created.id, configType: "SOLO"}, token);
      onCreated();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.vehicle.create}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.common.save, tone: "primary", busy, onPress: () => void onSave()}]}
    >
      <VehicleCreateSheet
        t={t}
        theme={theme}
        type={type}
        width={width}
        height={height}
        error={error}
        onTypeChange={onTypeChange}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
      />
    </Overlay>
  );
}
