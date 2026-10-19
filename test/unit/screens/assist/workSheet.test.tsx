import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {ScrollView} from "react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import WorkSheet from "../../../../src/screens/assist/WorkSheet";
import {en} from "../../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof WorkSheet>;

async function render(overrides?: Partial<Props>) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WorkSheet t={en} ticketLabel="Walk-in" mode="quote" status="2" busy={false} error={null} onSubmit={onSubmit} onClose={onClose} {...overrides} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onSubmit, onClose};
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

function amountInput(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((n) => n.props?.placeholder === "0" && typeof n.props?.onChangeText === "function")[0];
}

function invoiceInput(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((n) => n.props?.placeholder === en.provider.invoicePlaceholder && typeof n.props?.onChangeText === "function")[0];
}

function submitAction(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function")[0];
}

test("the header carries the status pill beside the title and the body does not scroll", async () => {
  const {renderer} = await render();
  try {
    const all = texts(renderer);
    const title = `${en.assist.sendQuote} · Walk-in`;
    expect(all).toContain(title);
    expect(all).toContain(en.assist.statusMatched);
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("quote mode groups the amount and submits the parsed integer", async () => {
  const {renderer, onSubmit} = await render();
  try {
    await act(async () => {
      amountInput(renderer)?.props.onChangeText("150000");
    });
    expect(amountInput(renderer)?.props.value).toBe("150,000");
    await act(async () => {
      submitAction(renderer, en.assist.sendQuote)?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({workType: "", amount: 150000, invoiceRef: ""});
  } finally {
    renderer.unmount();
  }
});

test("quote mode blocks submit without an amount", async () => {
  const {renderer, onSubmit} = await render();
  try {
    await act(async () => {
      submitAction(renderer, en.assist.sendQuote)?.props.onPress();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain(en.provider.invalidAmount);
  } finally {
    renderer.unmount();
  }
});

test("done mode records work type and invoice without an amount", async () => {
  const {renderer, onSubmit} = await render({mode: "done", initialWorkType: "Tire change"});
  try {
    expect(amountInput(renderer)).toBeUndefined();
    await act(async () => {
      invoiceInput(renderer)?.props.onChangeText("INV-1042");
    });
    await act(async () => {
      submitAction(renderer, en.provider.saveWork)?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({workType: "Tire change", amount: null, invoiceRef: "INV-1042"});
  } finally {
    renderer.unmount();
  }
});

test("a server error shows inside the sheet", async () => {
  const {renderer} = await render({error: "Quote failed."});
  try {
    expect(texts(renderer)).toContain("Quote failed.");
  } finally {
    renderer.unmount();
  }
});

test("the submit action swaps to a spinner while busy", async () => {
  const {renderer} = await render({busy: true});
  try {
    expect(texts(renderer)).not.toContain(en.assist.sendQuote);
    expect(submitAction(renderer, en.assist.sendQuote)?.props.disabled).toBe(true);
  } finally {
    renderer.unmount();
  }
});
