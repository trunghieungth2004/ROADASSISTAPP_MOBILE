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

test("a declined mobile fix is marked as a quote decline", async () => {
  const ticket = {
    id: "sos1",
    userId: "rider1",
    ticketType: "SOS",
    lat: 10.7,
    lng: 106.6,
    status: "1",
    direction: "in",
    formerAssignedShopIds: ["mobile1"],
    formerAssignment: true,
    formerAssignmentKind: "MOBILE_SHOP",
    otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
  } as FeedTicket;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <TicketRow
        t={en}
        theme={lightTheme}
        ticket={ticket}
        kind="MOBILE_SHOP"
        onPress={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const texts = renderer.root
      .findAll((node) => typeof node.props?.children === "string")
      .map((node) => node.props.children as string);
    expect(texts).toContain(en.assist.formerFixDeclinedPill);
    expect(texts).not.toContain(en.assist.formerAssignmentPill);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

test("an SOS record row uses the mobile-shop wrench on the rider side", async () => {
  const ticket = {
    id: "sos1",
    userId: "rider1",
    ticketType: "SOS",
    lat: 10.7,
    lng: 106.6,
    status: "1",
    direction: "out",
    otherParty: {id: "mobile1", name: "Mobile Fix", kind: "MOBILE_SHOP"},
  } as FeedTicket;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <TicketRow
        t={en}
        theme={lightTheme}
        ticket={ticket}
        kind={null}
        onPress={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(renderer.root.findAll((node) => node.props?.name === "build").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node) => node.props?.name === "person")).toHaveLength(0);
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
