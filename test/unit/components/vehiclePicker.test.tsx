import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import VehiclePickerSheet from "../../../src/components/vehicles/VehiclePickerSheet";
import {lightTheme} from "../../../src/theme";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/api/vehicles", () => ({
  listProfiles: async () => [],
}));

async function render(onAddVehicle?: () => void) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <VehiclePickerSheet t={en} theme={lightTheme} token="tok" activeId={null} onPick={() => undefined} onAddVehicle={onAddVehicle} />,
    );
    for (let i = 0; i < 4; i++) await new Promise<void>((r) => setImmediate(r));
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function labels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

test("empty picker guides to the vehicle tab", async () => {
  const onAdd = jest.fn();
  const renderer = await render(onAdd);
  try {
    const text = labels(renderer);
    expect(text).toContain(en.vehicle.empty);
    expect(text).toContain(en.route.vehicleCta);
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.create).find((n) => typeof n.props?.onPress === "function");
    expect(btn).toBeDefined();
    await act(async () => {
      await btn?.props.onPress();
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("empty picker shows no button without a handler", async () => {
  const renderer = await render(undefined);
  try {
    expect(labels(renderer)).toContain(en.vehicle.empty);
    const btns = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.vehicle.create);
    expect(btns).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});
