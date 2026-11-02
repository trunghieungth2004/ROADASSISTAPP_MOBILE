import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import SePayCheckoutSheet from "../../../../src/screens/assist/SePayCheckoutSheet";
import {en} from "../../../../src/i18n/en";

jest.mock("../../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

async function render(onSuccess = jest.fn(), onCancel = jest.fn(), onFailure = jest.fn()) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <SePayCheckoutSheet
          t={en}
          url="https://api.example.com/payments/sepay/checkout/p1?token=t"
          status="9"
          busy={false}
          error={null}
          onClose={() => undefined}
          onSuccess={onSuccess}
          onCancel={onCancel}
          onFailure={onFailure}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

test("renders the SePay page in an in-app webview", async () => {
  const renderer = await render();
  try {
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    expect(webview.props.source).toEqual({
      uri: "https://api.example.com/payments/sepay/checkout/p1?token=t",
    });
    expect(webview.props.originWhitelist).toEqual(["*"]);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("intercepts the SePay success redirect", async () => {
  const onSuccess = jest.fn();
  const renderer = await render(onSuccess);
  try {
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    act(() => {
      expect(webview.props.onShouldStartLoadWithRequest({
        url: "https://roadassistapp-c2e37.web.app/?payment=success",
      })).toBe(false);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("intercepts the SePay cancellation redirect", async () => {
  const onCancel = jest.fn();
  const renderer = await render(jest.fn(), onCancel);
  try {
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    act(() => {
      expect(webview.props.onShouldStartLoadWithRequest({
        url: "https://roadassistapp-c2e37.web.app/?payment=cancel",
      })).toBe(false);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("uses the signed local form when checkout fields are provided", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <SePayCheckoutSheet
          t={en}
          url="https://api.example.com/payments/sepay/checkout/p1?token=t"
          checkout={{
            action: "https://pay.sepay.vn/v1/checkout/init",
            method: "POST",
            fields: {merchant: "M1", signature: "S1"},
          }}
          status="9"
          busy={false}
          error={null}
          onClose={() => undefined}
          onSuccess={() => undefined}
          onCancel={() => undefined}
          onFailure={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  const mounted = renderer;
  try {
    const webview = mounted.root.findByProps({testID: "sepay-webview"});
    expect(webview.props.source.baseUrl).toBe("https://pay.sepay.vn/v1/checkout/init");
    expect(webview.props.source.html).toContain('action="https://pay.sepay.vn/v1/checkout/init"');
    expect(webview.props.source.html).toContain('name="merchant" value="M1"');
  } finally {
    await act(async () => {
      mounted.unmount();
    });
  }
});
