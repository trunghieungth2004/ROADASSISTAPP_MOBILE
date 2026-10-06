import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import AssistSectionTabs from "../../../../src/screens/assist/AssistSectionTabs";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";

async function render(tabs: {id: string; label: string}[], selected: string, onChange: (id: string) => void) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<AssistSectionTabs theme={lightTheme} tabs={tabs} selected={selected} onChange={onChange} />);
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

const TABS = [
  {id: "request", label: en.assist.sectionRequest},
  {id: "records", label: en.assist.sectionRecords},
];

test("tabs expose tab roles with selected state", async () => {
  const renderer = await render(TABS, "request", () => undefined);
  try {
    const tabs = renderer.root.findAll((n) => n.props?.accessibilityRole === "tab" && typeof n.props?.onPress === "function");
    expect(tabs).toHaveLength(2);
    const selected = tabs.filter((n) => n.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.props.accessibilityLabel).toBe(en.assist.sectionRequest);
  } finally {
    renderer.unmount();
  }
});

test("tapping a tab reports its id", async () => {
  const onChange = jest.fn();
  const renderer = await render(TABS, "request", onChange);
  try {
    const records = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.sectionRecords);
    const pressable = records.find((n) => typeof n.props?.onPress === "function");
    expect(pressable).toBeDefined();
    await act(async () => {
      await pressable?.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith("records");
  } finally {
    renderer.unmount();
  }
});

test("renders a subset of tabs", async () => {
  const renderer = await render(TABS.slice(0, 2), "records", () => undefined);
  try {
    const tabs = renderer.root.findAll((n) => n.props?.accessibilityRole === "tab" && typeof n.props?.onPress === "function");
    expect(tabs).toHaveLength(2);
  } finally {
    renderer.unmount();
  }
});
