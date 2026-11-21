import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {en} from "../../../src/i18n/en";
import ServiceEditSheet from "../../../src/components/providers/ServiceEditSheet";
import type {ServiceDraft} from "../../../src/components/providers/useProviderDraft";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const service: ServiceDraft = {
  code: "OIL",
  name: "Oil change",
  price: "80000",
  quoteRequired: false,
  category: "OTHER",
  warrantyDays: "0",
  warrantyParts: "LABOR_ONLY",
  channels: ["ASSIST"],
  vehicleClasses: ["SOLO_BIKE"],
};

test("service modal saves edited values and offers delete for existing rows", async () => {
  const onSave = jest.fn();
  const onRemove = jest.fn();
  const onClose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ServiceEditSheet
          t={en}
          kind="SHOP"
          service={service}
          vehicleClasses={["SOLO_BIKE", "CAR"]}
          towType="CAR"
          bookingEnabled={false}
          existing
          onSave={onSave}
          onRemove={onRemove}
          onClose={onClose}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  const tree = renderer;
  try {
    const save = tree.root.find((node) =>
      node.props?.accessibilityLabel === en.provider.serviceSave &&
      typeof node.props?.onPress === "function");
    await act(async () => {
      save.props.onPress();
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: "Oil change",
      price: "80000",
      channels: ["ASSIST"],
    }));
    const labels = tree.root
      .findAll((node) => typeof node.props?.accessibilityLabel === "string")
      .map((node) => node.props.accessibilityLabel as string);
    const removeIndex = labels.indexOf(en.provider.serviceRemove);
    const cancelIndex = labels.lastIndexOf(en.common.cancel);
    const saveIndex = labels.lastIndexOf(en.provider.serviceSave);
    expect(removeIndex).toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeLessThan(cancelIndex);
    expect(cancelIndex).toBeLessThan(saveIndex);
  } finally {
    await act(async () => {
      tree.unmount();
    });
  }
});
