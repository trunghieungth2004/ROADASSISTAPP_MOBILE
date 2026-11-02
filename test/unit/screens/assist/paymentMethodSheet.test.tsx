import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {ScrollView} from "react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PaymentMethodSheet from "../../../../src/screens/assist/PaymentMethodSheet";
import {en} from "../../../../src/i18n/en";

jest.mock("../../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

test("payment choice is a small non-scrolling popup", async () => {
  const onChoose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaymentMethodSheet
          t={en}
          amount={150000}
          status="9"
          busy={false}
          error={null}
          onChoose={onChoose}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
    const cash = renderer.root.findAll((n) =>
      n.props?.accessibilityLabel === en.bills.payCash &&
      typeof n.props?.onPress === "function")[0];
    const sepay = renderer.root.findAll((n) =>
      n.props?.accessibilityLabel === en.bills.paySepay &&
      typeof n.props?.onPress === "function")[0];
    expect(cash).toBeDefined();
    expect(sepay).toBeDefined();
    await act(async () => {
      await cash?.props.onPress();
    });
    expect(onChoose).toHaveBeenCalledWith("CASH");
    await act(async () => {
      await sepay?.props.onPress();
    });
    expect(onChoose).toHaveBeenCalledWith("SEPAY");
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});
