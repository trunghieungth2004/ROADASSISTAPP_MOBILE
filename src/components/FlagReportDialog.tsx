import {useState} from "react";
import FlagSheet, {useFlagDraft, type FlagReport} from "./FlagSheet";
import Overlay from "./overlay/Overlay";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  lat: number;
  lng: number;
  onClose: () => void;
  onSubmit: (report: FlagReport) => Promise<void> | void;
};

export default function FlagReportDialog({t, lat, lng, onClose, onSubmit}: Props) {
  const draft = useFlagDraft();
  const [busy, setBusy] = useState(false);
  async function submit(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(draft.build());
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.flag.reportTitle}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.flag.submit, tone: "primary", busy, onPress: () => void submit()}]}
    >
      <FlagSheet t={t} lat={lat} lng={lng} draft={draft} />
    </Overlay>
  );
}
