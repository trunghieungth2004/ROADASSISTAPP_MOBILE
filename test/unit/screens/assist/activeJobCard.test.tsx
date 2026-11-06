import {expect, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import ActiveJobCard from "../../../../src/screens/assist/ActiveJobCard";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";
import type {FeedTicket} from "../../../../src/api/dispatch";

function ticket(hold: FeedTicket["hold"]): FeedTicket {
  return {
    id: "t1",
    userId: "rider1",
    ticketType: "TOW",
    status: "2",
    direction: "out",
    lat: 10.7,
    lng: 106.6,
    hold,
  } as FeedTicket;
}

function texts(root: ReactTestInstance): string[] {
  return root.findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

async function render(value: FeedTicket) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <ActiveJobCard
        t={en}
        theme={lightTheme}
        ticket={value}
        title={en.assist.activeJob}
        line="Tow Co"
        icon="tow"
        tone={lightTheme.primary}
        onPress={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

test("an active job card shows its delay", async () => {
  const renderer = await render(ticket({
    reason: "TRAFFIC",
    note: null,
    etaAt: new Date(Date.now() + 3600000).toISOString(),
    by: "rider1",
    at: new Date().toISOString(),
  }));
  try {
    const shown = texts(renderer.root);
    expect(shown.some((text) =>
      text.includes(en.assist.delayActive) &&
      text.includes(en.assist.holdTraffic) &&
      text.includes(en.assist.holdUntil))).toBe(true);
  } finally {
    renderer.unmount();
  }
});

test("an active job card without a delay has no delay strip", async () => {
  const renderer = await render(ticket(null));
  try {
    expect(texts(renderer.root)).not.toContain(en.assist.delayActive);
  } finally {
    renderer.unmount();
  }
});
