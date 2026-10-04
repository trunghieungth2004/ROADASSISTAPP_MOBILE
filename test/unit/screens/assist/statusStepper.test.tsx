import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import StatusStepper from "../../../../src/screens/assist/StatusStepper";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";

async function render(ticketType: string, status: string, declineReason?: string | null) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<StatusStepper t={en} theme={lightTheme} ticketType={ticketType} status={status} declineReason={declineReason ?? null} />);
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function shownLabels(renderer: ReturnType<typeof create>): (string | undefined)[] {
  return renderer.root.findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children as string);
}

test("walk-in shows five stages with accepted at matched", async () => {
  const renderer = await render("WALK_IN", "6");
  try {
    const labels = shownLabels(renderer);
    for (const label of [en.assist.statusPending, en.assist.statusAccepted, en.assist.statusInProgress, en.assist.statusReady, en.assist.statusResolved]) {
      expect(labels).toContain(label);
    }
    expect(labels).not.toContain(en.assist.statusArrived);
  } finally {
    renderer.unmount();
  }
});

test("sos shows the arrive stage instead", async () => {
  const renderer = await render("SOS", "2");
  try {
    const labels = shownLabels(renderer);
    expect(labels).toContain(en.assist.statusArrived);
    expect(labels).not.toContain(en.assist.statusInProgress);
    expect(labels).not.toContain(en.assist.statusAccepted);
  } finally {
    renderer.unmount();
  }
});

test("declined short-circuits to a flat line with the reason", async () => {
  const renderer = await render("WALK_IN", "8", en.assist.declineFull);
  try {
    const labels = shownLabels(renderer);
    expect(labels).toContain(en.assist.statusDeclined);
    expect(labels).toContain(en.assist.declineFull);
    expect(labels).not.toContain(en.assist.statusPending);
  } finally {
    renderer.unmount();
  }
});
