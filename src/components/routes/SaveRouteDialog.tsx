import {useState} from "react";
import SaveRouteSheet from "./SaveRouteSheet";
import Overlay from "../overlay/Overlay";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {suggestRouteName} from "../../screens/route/routeSummary";

type Props = {
  t: Strings;
  theme: AppTheme;
  originText: string;
  destText: string;
  distanceM: number;
  durationSec: number;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string | undefined) => void;
};

export default function SaveRouteDialog(props: Props) {
  const {t, theme} = props;
  const [name, setName] = useState(() => suggestRouteName(props.originText, props.destText));
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.route.saveRoute}
      closeLabel={t.common.cancel}
      onClose={props.onClose}
      scrollable={false}
      actions={[{label: t.common.save, tone: "primary", busy: props.busy, onPress: () => props.onSave(name.trim() || undefined)}]}
    >
      <SaveRouteSheet
        t={t}
        theme={theme}
        originText={props.originText}
        destText={props.destText}
        distanceM={props.distanceM}
        durationSec={props.durationSec}
        name={name}
        onNameChange={setName}
      />
    </Overlay>
  );
}
