import {act, create} from "react-test-renderer";
import {expect, jest, test} from "@jest/globals";
import MapSurface from "../../../src/components/map/MapSurface";
import {en} from "../../../src/i18n/en";

jest.mock("@maplibre/maplibre-react-native", () => ({
  Map: ({children}: {children?: React.ReactNode}) => <>{children}</>,
}));

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

test("shows the fallback when the map probe fails and clears it on retry", async () => {
  let ok = false;
  const probe = jest.fn(async () => ok);
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <MapSurface mapStyle={{version: 8, sources: {}, layers: []}} probe={probe} />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(texts(renderer)).toContain(en.map.unavailableTitle);
    ok = true;
    const retry = renderer.root.findAll(
      (node) => node.props?.accessibilityLabel === en.common.retry,
    ).find((node) => typeof node.props?.onPress === "function");
    expect(retry).toBeDefined();
    await act(async () => {
      await retry?.props.onPress();
    });
    expect(texts(renderer)).not.toContain(en.map.unavailableTitle);
    expect(probe).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});
