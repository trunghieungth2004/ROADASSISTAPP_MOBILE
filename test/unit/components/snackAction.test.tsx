import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {Modal} from "react-native";
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

test("plain snacks render through a modal above overlays", async () => {
  const onHide = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Snack message="Hi" onHide={onHide} />);
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(renderer.root.findAllByType(Modal)).toHaveLength(1);
    expect(renderer.root.findByType(Modal).props.transparent).toBe(true);
    expect(
      renderer.root.findAll((n) => n.props?.pointerEvents === "box-none").length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAll((n) => n.props?.pointerEvents === "none").length,
    ).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("inline snacks skip the modal so map hints stay tappable", async () => {
  const onHide = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <Snack message="Tap the map" onHide={onHide} modal={false} sticky />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
    expect(
      renderer.root.findAll((n) => n.props?.pointerEvents === "box-none").length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAll((n) => n.props?.children === "Tap the map").length,
    ).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("plain snacks auto hide without a press", async () => {
  jest.useFakeTimers();
  const onHide = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(<Snack message="Hi" onHide={onHide} />);
    });
    if (!renderer) throw new Error("render failed");
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  } finally {
    renderer?.unmount();
    jest.useRealTimers();
  }
});
