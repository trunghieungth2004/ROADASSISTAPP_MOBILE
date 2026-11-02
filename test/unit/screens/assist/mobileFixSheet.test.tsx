import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import MobileFixSheet from "../../../../src/screens/assist/MobileFixSheet";
import {en} from "../../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof MobileFixSheet>;

async function render(overrides?: Partial<Props>) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <MobileFixSheet
          t={en}
          ticketLabel="SOS"
          status="3"
          busy={false}
          error={null}
          initialAmount={null}
          onSubmit={onSubmit}
          onClose={onClose}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onSubmit, onClose};
}

function action(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root.findAll((n) =>
    n.props?.accessibilityLabel === label &&
    typeof n.props?.onPress === "function")[0];
}

test("mobile fix can submit an itemized total", async () => {
  const {renderer, onSubmit} = await render();
  try {
    await act(async () => {
      action(renderer, en.provider.addItem)?.props.onPress();
    });
    const name = renderer.root.findAll((n) =>
      n.props?.placeholder === en.provider.itemName &&
      typeof n.props?.onChangeText === "function")[0];
    const qty = renderer.root.findAll((n) =>
      n.props?.placeholder === en.provider.qty &&
      typeof n.props?.onChangeText === "function")[0];
    const price = renderer.root.findAll((n) =>
      n.props?.placeholder === en.provider.unitPrice &&
      typeof n.props?.onChangeText === "function")[0];
    await act(async () => {
      name?.props.onChangeText("Patch");
      qty?.props.onChangeText("2");
      price?.props.onChangeText("25000");
    });
    await act(async () => {
      action(renderer, en.assist.mobileFixSave)?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith(50000, [
      {name: "Patch", qty: 2, unitPrice: 25000},
    ]);
  } finally {
    renderer.unmount();
  }
});

test("mobile fix still accepts a single amount", async () => {
  const {renderer, onSubmit} = await render({initialAmount: 50000});
  try {
    await act(async () => {
      action(renderer, en.assist.mobileFixSave)?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith(50000, undefined);
  } finally {
    renderer.unmount();
  }
});
