import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import StatusCard from "../../../../src/screens/assist/detail/StatusCard";
import type {FeedTicket} from "../../../../src/api/dispatch";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

function ticket(patch: Partial<FeedTicket>): FeedTicket {
  return {
    id: "t1",
    ticketType: "SOS",
    status: "9",
    direction: "out",
    lat: 10.7,
    lng: 106.6,
    ...patch,
  } as FeedTicket;
}

async function render(ticketValue: FeedTicket) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <StatusCard t={en} theme={lightTheme} ticket={ticketValue} />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function dotColors(renderer: ReturnType<typeof create>): unknown[] {
  return renderer.root
    .findAll((node) => {
      const style = flatStyle(node.props?.style);
      return style.width === 9 && style.height === 9;
    })
    .map((node) => flatStyle(node.props.style).backgroundColor);
}

test("an SOS quote uses the purple quote dot", async () => {
  const renderer = await render(ticket({
    status: "9",
    statusHistory: [
      {status: "1", at: "2026-01-01T00:00:00.000Z", by: "u1"},
      {status: "2", at: "2026-01-01T00:01:00.000Z", by: "op1"},
      {status: "3", at: "2026-01-01T00:02:00.000Z", by: "u1"},
      {status: "9", at: "2026-01-01T00:03:00.000Z", by: "op1"},
    ],
  }));
  try {
    const colors = dotColors(renderer);
    expect(colors.at(-1)).toBe("#8b5cf6");
    expect(colors).not.toContain(lightTheme.danger);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("a reset SOS shows only the current pending dot", async () => {
  const renderer = await render(ticket({
    status: "1",
    statusHistory: [
      {status: "1", at: "2026-01-01T00:00:00.000Z", by: "u1"},
      {status: "2", at: "2026-01-01T00:01:00.000Z", by: "op1"},
      {status: "3", at: "2026-01-01T00:02:00.000Z", by: "u1"},
      {status: "9", at: "2026-01-01T00:03:00.000Z", by: "op1"},
      {status: "1", at: "2026-01-01T00:04:00.000Z", by: "u1"},
    ],
  }));
  try {
    expect([...new Set(dotColors(renderer))]).toEqual(["#f59e0b"]);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});
