import {useState} from "react";
import {Keyboard} from "react-native";
import RideSetupSheet from "./RideSetupSheet";
import Overlay from "../overlay/Overlay";
import {addRideConfig, type ConfigType} from "../../api/vehicles";
import {toMessage} from "../../api/client";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  title: string;
  profileId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function RideSetupDialog({t, theme, token, title, profileId, onClose, onSaved}: Props) {
  const [config, setConfig] = useState<ConfigType>("SOLO");
  const [estWidth, setEstWidth] = useState("");
  const [estHeight, setEstHeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSave(): Promise<void> {
    if (!token || busy) return;
    const width = estWidth.trim() === "" ? undefined : Number(estWidth);
    const height = estHeight.trim() === "" ? undefined : Number(estHeight);
    if ((width !== undefined && (!Number.isFinite(width) || width <= 0)) || (height !== undefined && (!Number.isFinite(height) || height <= 0))) {
      setError(t.vehicle.invalidDims);
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await addRideConfig({profileId, configType: config, estWidth: width, estHeight: height}, token);
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
      title={title}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.vehicle.apply, tone: "primary", busy, onPress: () => void onSave()}]}
    >
      <RideSetupSheet
        t={t}
        theme={theme}
        config={config}
        estWidth={estWidth}
        estHeight={estHeight}
        error={error}
        onConfigChange={setConfig}
        onEstWidthChange={setEstWidth}
        onEstHeightChange={setEstHeight}
      />
    </Overlay>
  );
}
