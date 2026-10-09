import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import SavedPlacesSheet from "../../../src/components/place-search/SavedPlacesSheet";
import {lightTheme} from "../../../src/theme";
import {en} from "../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function texts(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root.findAll((n) => n.props?.accessibilityLabel === label);
}

test("lists places with delete actions and an add entry", async () => {
  const onDelete = jest.fn();
  const onAdd = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <SavedPlacesSheet
          t={en}
          places={[{id: "p1", userId: "u1", label: "Home", lat: 10.7, lng: 106.6}]}
          loading={false}
          busy={false}
          error={null}
          onAdd={onAdd}
          onDelete={onDelete}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const del = texts(renderer, en.common.delete).find((n) => typeof n.props?.onPress === "function");
    expect(del).toBeDefined();
    await act(async () => {
      await del?.props.onPress();
    });
    expect(onDelete).toHaveBeenCalledWith("p1");
    const add = texts(renderer, en.common.add).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await add?.props.onPress();
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("shows loading and error states", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <SavedPlacesSheet
          t={en}
          places={[]}
          loading
          busy={false}
          error="Nope"
          onAdd={() => undefined}
          onDelete={() => undefined}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(
      renderer.root.findAll((n) => n.props?.children === "Nope").length,
    ).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});
