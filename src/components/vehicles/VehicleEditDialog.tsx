import {useState} from "react";
import {Keyboard} from "react-native";
import Overlay from "../overlay/Overlay";
import {toMessage} from "../../api/client";
import {normalizeVehicleType, updateProfile, type VehicleProfile} from "../../api/vehicles";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import VehicleCreateSheet from "./VehicleCreateSheet";

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  profile: VehicleProfile;
  onClose: () => void;
  onSaved: () => void;
};

export default function VehicleEditDialog({t, theme, token, profile, onClose, onSaved}: Props) {
  const [label, setLabel] = useState(profile.label ?? "");
  const [plate, setPlate] = useState(profile.plate ?? "");
  const [width, setWidth] = useState(String(profile.baseWidth));
  const [height, setHeight] = useState(String(profile.baseHeight));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(): Promise<void> {
    if (!token || busy) return;
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0.3 || w > 3 || h < 0.5 || h > 3) {
      setError(t.vehicle.invalidDims);
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        profileId: profile.id,
        label: label.trim(),
        plate: plate.trim(),
        baseWidth: w,
        baseHeight: h,
      }, token);
      onSaved();
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
      title={t.vehicle.editTitle}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.common.save, tone: "primary", busy, onPress: () => void onSave()}]}
    >
      <VehicleCreateSheet
        t={t}
        theme={theme}
        type={normalizeVehicleType(profile.type) ?? "BIKE"}
        width={width}
        height={height}
        label={label}
        plate={plate}
        error={error}
        onLabelChange={setLabel}
        onPlateChange={setPlate}
        onTypeChange={() => undefined}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        showType={false}
      />
    </Overlay>
  );
}
