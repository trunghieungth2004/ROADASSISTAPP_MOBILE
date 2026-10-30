import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import ShopDetailSheet from "../../../../src/screens/assist/ShopDetailSheet";
import {en} from "../../../../src/i18n/en";
import type {Provider} from "../../../../src/api/providers";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function mobileShop(): Provider {
  return {
    id: "mobile-1",
    kind: "MOBILE_SHOP",
    name: "Mobile One",
    lat: 10.71,
    lng: 106.61,
    status: "ACTIVE",
    accepting: true,
    openNow: true,
    distance: 300,
  } as Provider;
}

async function render(shop: Provider, onImHere: (() => void) | null = null) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ShopDetailSheet
          t={en}
          shop={shop}
          openLabel={en.shop.open}
          openColor="#16a34a"
          walkBusy={false}
          navBusy={false}
          imHereBusy={false}
          jobs={null}
          reviews={null}
          onReport={jest.fn()}
          onWalkHere={jest.fn()}
          onRouteFromHere={jest.fn()}
          onImHere={onImHere}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function actionLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.accessibilityLabel === "string" && node.props?.accessibilityRole === "button")
    .map((node) => node.props.accessibilityLabel as string);
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

test("provider detail uses the mobile shop icon", async () => {
  const renderer = await render(mobileShop());
  try {
    const icons = renderer.root.findAll(
      (node) => node.props?.name === "build",
    );
    expect(icons.length).toBeGreaterThan(0);
    const storefronts = renderer.root.findAll(
      (node) => node.props?.name === "storefront",
    );
    expect(storefronts).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("off-duty shop hides I'm here and shows the off-duty hint", async () => {
  const renderer = await render({...mobileShop(), accepting: false}, jest.fn());
  try {
    expect(actionLabels(renderer)).not.toContain(en.assist.imHere);
    expect(texts(renderer)).toContain(en.assist.shopOffDuty);
  } finally {
    renderer.unmount();
  }
});

test("on-duty shop shows I'm here without the off-duty hint", async () => {
  const renderer = await render(mobileShop(), jest.fn());
  try {
    expect(actionLabels(renderer)).toContain(en.assist.imHere);
    expect(texts(renderer)).not.toContain(en.assist.shopOffDuty);
  } finally {
    renderer.unmount();
  }
});
