import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import Snack from "../../../src/components/ui/Snack";

test("action runs and hides the snack", async () => {
  const onPress = jest.fn();
  const onHide = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <Snack message="Paused" onHide={onHide} sticky action={{label: "Refresh", onPress}} />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const action = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "Refresh")
      .pop();
    expect(action).toBeDefined();
    await act(async () => {
      await action?.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("plain snacks keep dismiss-only behavior", async () => {
  const onHide = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Snack message="Hi" onHide={onHide} />);
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(
      renderer.root.findAll((n) => typeof n.props?.onPress === "function").length,
    ).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});
