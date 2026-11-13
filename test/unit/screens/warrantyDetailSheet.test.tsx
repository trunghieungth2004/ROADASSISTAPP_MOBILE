import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import WarrantyDetailSheet from "../../../src/screens/warranty/WarrantyDetailSheet";
import {en} from "../../../src/i18n/en";
import type {WarrantyClaim} from "../../../src/api/warranty";
import {lightTheme} from "../../../src/theme";
import type {WarrantyDetailInput} from "../../../src/screens/warranty/warrantyDetail";

jest.mock("../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const claim = {
  id: "wc1",
  ticketId: "t1",
  lineId: "l1",
  serviceCode: "TIRE",
  serviceName: "Flat tire",
  category: "FLAT_TIRE",
  providerId: "shop1",
  providerName: "Fix Shop",
  lineAmount: 100000,
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  status: "DECLINED",
  reason: "Patch failed",
  photoUrls: [],
  shopResponse: "Wear and tear",
  respondedAt: "2026-11-02T00:00:00.000Z",
  createdAt: "2026-11-01T00:00:00.000Z",
  linkedTicketId: null,
  refundAmount: null,
  warrantyDays: 30,
  warrantyParts: "LABOR_ONLY",
} as WarrantyClaim;

const detail: WarrantyDetailInput = {
  ticketId: "t1",
  lineId: "l1",
  serviceName: "Flat tire",
  serviceCode: "TIRE",
  category: "FLAT_TIRE",
  amount: 100000,
  qty: 1,
  unitPrice: 100000,
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  warrantyDays: 30,
  warrantyParts: "LABOR_ONLY",
  serviceDate: "2026-10-01T00:00:00.000Z",
  purchaseDate: "2026-10-01T00:00:00.000Z",
  providerName: "Fix Shop",
  vehicleLabel: "Honda Wave",
  vehiclePlate: "59-X1 123.45",
  claim,
};

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test("shows service, warranty and claim details", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyDetailSheet
          t={en}
          theme={lightTheme}
          detail={detail}
          providerView={false}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const all = texts(renderer);
    expect(all).toContain(en.vehicle.warrantyDetail);
    expect(all).toContain("Flat tire");
    expect(all).toContain("Fix Shop");
    expect(all).toContain("Honda Wave · 59-X1 123.45");
    expect(all).toContain("30");
    expect(all).toContain(en.provider.warrantyLabor);
    expect(all).toContain(en.vehicle.claimReason);
    expect(all).toContain("Patch failed");
    expect(all).toContain(en.vehicle.claimResponse);
    expect(all).toContain("Wear and tear");
    expect(all).toContain(en.bills.total);
    expect(all).toContain("100,000 VND");
    expect(all).not.toContain(en.payments.title);
  } finally {
    renderer.unmount();
  }
});

test("offers ticket and payment secondary actions", async () => {
  const onOpenTicket = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyDetailSheet
          t={en}
          theme={lightTheme}
          detail={detail}
          providerView={false}
          onClose={() => undefined}
          onOpenTicket={onOpenTicket}
        />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const ticketAction = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.assist.viewTicket &&
      typeof node.props?.onPress === "function")[0];
    const paymentAction = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.payments.detailTitle &&
      typeof node.props?.onPress === "function")[0];
    expect(ticketAction).toBeDefined();
    expect(paymentAction).toBeDefined();
    await act(async () => {
      ticketAction?.props.onPress();
    });
    expect(onOpenTicket).toHaveBeenCalledWith("t1");
  } finally {
    renderer.unmount();
  }
});

test("offers a claim action for active coverage without a claim", async () => {
  const onClaim = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyDetailSheet
          t={en}
          theme={lightTheme}
          detail={{...detail, claim: null}}
          providerView={false}
          onClose={() => undefined}
          onClaim={onClaim}
        />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const action = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.bills.claimWarranty &&
      typeof node.props?.onPress === "function")[0];
    await act(async () => {
      action?.props.onPress();
    });
    expect(onClaim).toHaveBeenCalledWith(expect.objectContaining({
      ticketId: "t1",
      lineId: "l1",
    }));
  } finally {
    renderer.unmount();
  }
});
