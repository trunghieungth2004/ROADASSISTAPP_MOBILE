import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import ShopsSection from "../../../../src/screens/assist/ShopsSection";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";
import type {Provider} from "../../../../src/api/providers";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function shop(): Provider {
  return {
    id: "s1",
    kind: "SHOP",
    name: "Good Shop",
    lat: 10.71,
    lng: 106.61,
    status: "ACTIVE",
    accepting: true,
    openNow: true,
    distance: 330,
  } as Provider;
}

type Props = React.ComponentProps<typeof ShopsSection>;

async function render(overrides?: Partial<Props>) {
  const onOpenSearch = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ShopsSection
          t={en}
          theme={lightTheme}
          query=""
          onOpenSearch={onOpenSearch}
          mapSel={null}
          onClearMapSel={() => undefined}
          onNavigateMapSel={() => undefined}
          onRegisterShop={() => undefined}
          radiusLabel="500 m"
          onCycleRadius={() => undefined}
          shopLoading={false}
          emptyShops={false}
          shopSel={null}
          walkRoute={null}
          walkBusy={false}
          navBusy={false}
          onClearShop={() => undefined}
          onNavigate={() => undefined}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onOpenSearch};
}

function hasText(renderer: ReturnType<typeof create>, text: string): boolean {
  return renderer.root.findAll((n) => n.props?.children === text).length > 0;
}

test("search field opens fullscreen search", async () => {
  const {renderer, onOpenSearch} = await render();
  try {
    const field = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === en.shop.searchPlaceholder)
      .pop();
    expect(field).toBeDefined();
    await act(async () => {
      await field?.props.onPress();
    });
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("map selection shows navigate and register actions", async () => {
  const onNavigateMapSel = jest.fn();
  const onRegisterShop = jest.fn();
  const {renderer} = await render({
    mapSel: {label: "Repair Pro", lat: 10.72, lng: 106.62},
    onNavigateMapSel,
    onRegisterShop,
  });
  try {
    expect(hasText(renderer, "Repair Pro")).toBe(true);
    await act(async () => {
      await renderer.root
        .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === en.common.routeFromHere)
        .pop()?.props.onPress();
    });
    expect(onNavigateMapSel).toHaveBeenCalledTimes(1);
    await act(async () => {
      await renderer.root
        .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === en.shop.claimShop)
        .pop()?.props.onPress();
    });
    expect(onRegisterShop).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});
