import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {StyleSheet} from "react-native";
import {ClaimCard, CoverageCard, GroupToggle} from "../../../src/screens/warranty/WarrantyCards";
import {en} from "../../../src/i18n/en";
import {lightTheme} from "../../../src/theme";
import type {WarrantyClaim} from "../../../src/api/warranty";
import type {VehicleHistoryItem, VehicleHistoryLine, VehicleProfile} from "../../../src/api/vehicles";

test("the grouping switch toggles between grouped and flat views", async () => {
  const onToggle = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <GroupToggle
        t={en}
        theme={lightTheme}
        grouped
        onToggle={onToggle}
      />,
    );
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const all = () => renderer?.root
      .findAll((node) => typeof node.props?.children === "string")
      .map((node) => node.props.children as string) ?? [];
    expect(all()).toContain(en.vehicle.warrantyGrouped);
    const toggle = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.vehicle.warrantyGroupToggle &&
      typeof node.props?.onPress === "function")[0];
    expect(toggle).toBeDefined();
    await act(async () => {
      toggle?.props.onPress();
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

const profile = {
  id: "p1",
  type: "BIKE",
  baseWidth: 0.7,
  baseHeight: 1.1,
  label: "Honda Wave",
  plate: "59-X1 123.45",
} as VehicleProfile;

const line = {
  lineId: "l1",
  serviceCode: "BRAKE",
  name: "Brake pads",
  category: "BRAKES",
  qty: 1,
  unitPrice: 150000,
  amount: 150000,
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  claim: null,
} as VehicleHistoryLine;

const item = {
  ticketId: "t1",
  ticketType: "MECHANIC",
  serviceDate: "2026-10-01T00:00:00.000Z",
  providerName: "Fix Shop",
  provider: null,
  total: 150000,
  lines: [line],
} as VehicleHistoryItem;

const claim = {
  id: "wc1",
  ticketId: "t1",
  lineId: "l1",
  serviceCode: "BRAKE",
  serviceName: "Brake pads",
  providerId: "shop1",
  lineAmount: 150000,
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  status: "OPEN",
  reason: "Squeaking",
  photoUrls: [],
  createdAt: "2026-11-01T00:00:00.000Z",
  linkedTicketId: null,
  refundAmount: null,
} as WarrantyClaim;

test("the whole coverage card opens details and has no chevron", async () => {
  const onOpen = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <CoverageCard
        t={en}
        theme={lightTheme}
        row={{profile, item, line}}
        claim={null}
        onOpen={onOpen}
        onClaim={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("mount failed");
  try {
    expect(renderer.root.findAll((node) => node.props?.name === "chevron-right"))
      .toHaveLength(0);
    const card = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === "Brake pads" &&
      typeof node.props?.onPress === "function")[0];
    await act(async () => {
      card?.props.onPress();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("provider actions are equal width and keep their own presses", async () => {
  const onOpen = jest.fn();
  const onRespond = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <ClaimCard
        t={en}
        theme={lightTheme}
        claim={claim}
        providerView
        busy={false}
        onOpen={onOpen}
        onRespond={onRespond}
        onDispute={() => undefined}
        onPhoto={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("mount failed");
  try {
    expect(renderer.root.findAll((node) => node.props?.name === "chevron-right"))
      .toHaveLength(0);
    const card = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === claim.serviceName &&
      typeof node.props?.onPress === "function")[0];
    const accept = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.assist.accept &&
      typeof node.props?.onPress === "function")[0];
    const decline = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.provider.decline &&
      typeof node.props?.onPress === "function")[0];
    expect(StyleSheet.flatten(accept?.props.style).flex).toBe(1);
    expect(StyleSheet.flatten(decline?.props.style).flex).toBe(1);
    await act(async () => {
      card?.props.onPress();
      accept?.props.onPress();
      decline?.props.onPress();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenNthCalledWith(1, true);
    expect(onRespond).toHaveBeenNthCalledWith(2, false);
  } finally {
    renderer.unmount();
  }
});
