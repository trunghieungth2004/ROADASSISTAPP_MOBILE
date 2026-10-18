import {useRef, useState} from "react";
import FlagSheet, {useFlagDraft, type FlagReport} from "./FlagSheet";
import Overlay from "../overlay/Overlay";
import type {Strings} from "../../i18n/en";

type Props = {
  t: Strings;
  onClose: () => void;
  onSubmit: (report: FlagReport) => Promise<void> | void;
};

export default function FlagReportDialog({t, onClose, onSubmit}: Props) {
  const draft = useFlagDraft(t);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  async function submit(): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit(draft.build());
    } finally {
      busyRef.current = false;
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
      scrollable={false}
      actions={[{label: t.flag.submit, tone: "primary", busy, onPress: () => void submit()}]}
    >
      <FlagSheet t={t} draft={draft} />
    </Overlay>
  );
}
