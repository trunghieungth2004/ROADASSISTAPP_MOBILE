import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import DelaySheet from "../../../../src/screens/assist/DelaySheet";
import {en} from "../../../../src/i18n/en";
import type {FeedTicket} from "../../../../src/api/dispatch";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function ticket(direction: "in" | "out"): FeedTicket {
  return {
    id: "t1",
    userId: "rider1",
    ticketType: "SOS",
    status: "2",
    direction,
    lat: 10.7,
    lng: 106.6,
  } as FeedTicket;
}

function texts(root: ReactTestInstance): string[] {
  return root.findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

async function render(direction: "in" | "out") {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <DelaySheet
          t={en}
          ticket={ticket(direction)}
          busy={false}
          error={null}
          onSubmit={jest.fn()}
          onClear={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

test("riders get rider-side delay reasons", async () => {
  const renderer = await render("out");
  try {
    const shown = texts(renderer.root);
    expect(shown).toContain(en.assist.holdTraffic);
    expect(shown).not.toContain(en.assist.holdRider);
    expect(shown).not.toContain(en.assist.holdParts);
  } finally {
    renderer.unmount();
  }
});

test("providers get provider-side delay reasons", async () => {
  const renderer = await render("in");
  try {
    const shown = texts(renderer.root);
    expect(shown).toContain(en.assist.holdParts);
    expect(shown).toContain(en.assist.holdRider);
    expect(shown).not.toContain(en.assist.holdTraffic);
  } finally {
    renderer.unmount();
  }
});
