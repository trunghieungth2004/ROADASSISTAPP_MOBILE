import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import TicketRow from "../../../src/screens/assist/TicketRow";
import type {FeedTicket} from "../../../src/api/dispatch";
import {en} from "../../../src/i18n/en";
import {lightTheme} from "../../../src/theme";

test("a former tower row is marked cancelled by you", async () => {
  const ticket = {
    id: "t1",
    userId: "rider1",
    ticketType: "TOW",
    lat: 10.7,
    lng: 106.6,
    status: "2",
    direction: "in",
    assignedShopId: "tow2",
    formerAssignedShopIds: ["tow1"],
    formerAssignment: true,
    otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
  } as FeedTicket;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <TicketRow
        t={en}
        theme={lightTheme}
        ticket={ticket}
        kind="SHOP"
        onPress={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const texts = renderer.root
      .findAll((node) => typeof node.props?.children === "string")
      .map((node) => node.props.children as string);
    expect(texts).toContain(en.assist.formerAssignmentPill);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

test("a TOW record row uses the tow-truck icon even in a shop context", async () => {
  const ticket = {
    id: "t1",
    userId: "rider1",
    ticketType: "TOW",
    lat: 10.7,
    lng: 106.6,
    status: "1",
    direction: "in",
    assignedShopId: "tow1",
    destinationShopId: "shop1",
    otherParty: {id: "tow1", name: "Tow Co", kind: "TOW"},
  } as FeedTicket;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <TicketRow
        t={en}
        theme={lightTheme}
        ticket={ticket}
        kind="SHOP"
        onPress={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const towIcons = renderer.root.findAll(
      (node) => node.props?.name === "tow-truck",
    );
    const shopIcons = renderer.root.findAll(
      (node) => node.props?.name === "storefront",
    );
    expect(towIcons.length).toBeGreaterThan(0);
    expect(shopIcons).toHaveLength(0);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});
