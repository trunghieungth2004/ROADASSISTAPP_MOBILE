import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {ScrollView} from "react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import EstimateSheet from "../../../../src/screens/assist/EstimateSheet";
import {en} from "../../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof EstimateSheet>;

async function render(overrides?: Partial<Props>) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <EstimateSheet t={en} ticketLabel="Tow" status="2" busy={false} error={null} onSubmit={onSubmit} onClose={onClose} {...overrides} />
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

function noteInput(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((n) => n.props?.placeholder === en.assist.estimateNotePlaceholder && typeof n.props?.onChangeText === "function")[0];
}

function submitAction(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.sendEstimate && typeof n.props?.onPress === "function")[0];
}

test("the header carries the status pill beside the title and the body does not scroll", async () => {
  const {renderer} = await render();
  try {
    const all = texts(renderer);
    const title = `${en.assist.estimateTitle} · Tow`;
    expect(all).toContain(title);
    expect(all).toContain(en.assist.statusMatched);
    expect(all).not.toContain(`${title} · ${en.assist.statusMatched}`);
    const nodes = renderer.root.findAll((n) => typeof n.props?.children === "string");
    const titleIndex = nodes.findIndex((n) => n.props.children === title);
    const pillIndex = nodes.findIndex((n) => n.props.children === en.assist.statusMatched);
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(pillIndex).toBeGreaterThan(titleIndex);
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("the amount field groups thousands and submits the parsed integer", async () => {
  const {renderer, onSubmit} = await render();
  try {
    await act(async () => {
      amountInput(renderer)?.props.onChangeText("150000");
      noteInput(renderer)?.props.onChangeText("Pads + labor");
    });
    expect(amountInput(renderer)?.props.value).toBe("150,000");
    await act(async () => {
      submitAction(renderer)?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toBe(150000);
    expect(onSubmit.mock.calls[0][1]).toBe("Pads + labor");
  } finally {
    renderer.unmount();
  }
});

test("an empty amount blocks submit with the invalid-amount hint", async () => {
  const {renderer, onSubmit} = await render();
  try {
    await act(async () => {
      submitAction(renderer)?.props.onPress();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain(en.provider.invalidAmount);
  } finally {
    renderer.unmount();
  }
});

test("a resend prefills the previous amount and note", async () => {
  const {renderer} = await render({initialAmount: 150000, initialNote: "Pads"});
  try {
    expect(amountInput(renderer)?.props.value).toBe("150,000");
    expect(noteInput(renderer)?.props.value).toBe("Pads");
  } finally {
    renderer.unmount();
  }
});

test("a server error shows inside the sheet", async () => {
  const {renderer} = await render({error: "Estimate failed."});
  try {
    expect(texts(renderer)).toContain("Estimate failed.");
  } finally {
    renderer.unmount();
  }
});

test("the submit action swaps to a spinner while busy", async () => {
  const {renderer} = await render({busy: true});
  try {
    expect(texts(renderer)).not.toContain(en.assist.sendEstimate);
    expect(submitAction(renderer)?.props.disabled).toBe(true);
  } finally {
    renderer.unmount();
  }
});
