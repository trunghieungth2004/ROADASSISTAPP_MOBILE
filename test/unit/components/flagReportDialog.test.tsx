import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestRenderer} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import FlagReportDialog from "../../../src/components/flags/FlagReportDialog";
import {en} from "../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function submitAction(renderer: ReactTestRenderer) {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === en.flag.submit)
    .find((n) => typeof n.props?.onPress === "function");
}

test("double-tapping submit fires one report and locks the button while in flight", async () => {
  let resolveSubmit: (() => void) | undefined;
  const onSubmit = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      }),
  );
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <FlagReportDialog t={en} onClose={() => undefined} onSubmit={onSubmit} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  const view = renderer;
  try {
    const action = submitAction(view);
    expect(action).toBeDefined();
    await act(async () => {
      action?.props.onPress();
      action?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitAction(view)?.props.disabled).toBe(true);
    await act(async () => {
      resolveSubmit?.();
    });
    expect(submitAction(view)?.props.disabled).toBe(false);
  } finally {
    act(() => {
      view.unmount();
    });
  }
});
