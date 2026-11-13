import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import WarrantyDeclineDialog from "../../../src/screens/warranty/WarrantyDeclineDialog";
import {en} from "../../../src/i18n/en";
import {lightTheme} from "../../../src/theme";

jest.mock("../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function find(renderer: ReturnType<typeof create>, label: string):
ReactTestInstance | undefined {
  return renderer.root.findAll((node) =>
    node.props?.accessibilityLabel === label &&
    typeof node.props?.onPress === "function")[0];
}

test("decline requires a structured reason and note", async () => {
  const onSubmit = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyDeclineDialog
          visible
          serviceName="Brake pads"
          t={en}
          theme={lightTheme}
          busy={false}
          error={null}
          onSubmit={onSubmit}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  const view = renderer;
  try {
    const submit = find(view, en.provider.warrantyDeclineSubmit);
    expect(submit?.props.disabled).toBe(true);
    await act(async () => {
      find(view, en.provider.warrantyDeclineReasons.WEAR_AND_TEAR)
        ?.props.onPress();
    });
    const input = view.root.findAll((node) =>
      node.props?.placeholder === en.provider.warrantyDeclineNotePlaceholder &&
      typeof node.props?.onChangeText === "function")[0];
    await act(async () => {
      input?.props.onChangeText("Wear and tear");
    });
    const ready = find(view, en.provider.warrantyDeclineSubmit);
    expect(ready?.props.disabled).toBe(false);
    await act(async () => {
      ready?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith("WEAR_AND_TEAR", "Wear and tear");
  } finally {
    renderer.unmount();
  }
});
