import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import RequestSection from "../../../../src/screens/assist/RequestSection";
import {vehicleButtonState} from "../../../../src/components/vehicles/vehicleButtonState";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";

test("button state derives from fleet and selection", () => {
  expect(vehicleButtonState(true, true)).toBe("ready");
  expect(vehicleButtonState(true, false)).toBe("unselected");
  expect(vehicleButtonState(false, false)).toBe("empty");
  expect(vehicleButtonState(false, true)).toBe("ready");
});

async function renderButton(vehicleType: string | null, hasVehicles: boolean) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <RequestSection
        t={en}
        theme={lightTheme}
        ticketType={null}
        onTicketType={() => undefined}
        showMechanic
        onOpenTicket={() => undefined}
        vehicleType={vehicleType}
        hasVehicles={hasVehicles}
        onOpenVehicle={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

test("ready button uses a neutral solid border", async () => {
  const renderer = await renderButton("SCOOTER", true);
  try {
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.myVehicle).find((n) => typeof n.props?.onPress === "function");
    expect(btn).toBeDefined();
    const style = flatStyle(btn?.props.style);
    expect(style.borderColor).toBe(lightTheme.border);
    expect(style.borderStyle).not.toBe("dashed");
  } finally {
    renderer.unmount();
  }
});

test("empty fleet shows a dashed border with an add affordance", async () => {
  const renderer = await renderButton(null, false);
  try {
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.create).find((n) => typeof n.props?.onPress === "function");
    expect(btn).toBeDefined();
    expect(flatStyle(btn?.props.style).borderStyle).toBe("dashed");
    await act(async () => {
      await btn?.props.onPress();
    });
  } finally {
    renderer.unmount();
  }
});

test("unselected fleet shows the warning dot", async () => {
  const renderer = await renderButton(null, true);
  try {
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.myVehicle).find((n) => typeof n.props?.onPress === "function");
    expect(btn).toBeDefined();
    const dots = (btn as {findAll: (p: (n: {props?: {style?: unknown}}) => boolean) => {props?: {style?: unknown}}[]}).findAll(
      (n) => flatStyle(n.props?.style).backgroundColor === lightTheme.danger,
    );
    expect(dots.length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("vehicle button opens the picker", async () => {
  const onOpenVehicle = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <RequestSection
        t={en}
        theme={lightTheme}
        ticketType={null}
        onTicketType={() => undefined}
        showMechanic
        onOpenTicket={() => undefined}
        vehicleType="SCOOTER"
        hasVehicles
        onOpenVehicle={onOpenVehicle}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.myVehicle).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await btn?.props.onPress();
    });
    expect(onOpenVehicle).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});
