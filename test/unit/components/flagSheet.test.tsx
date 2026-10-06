import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import FlagSheet, {useFlagDraft, type FlagDraftState} from "../../../src/components/flags/FlagSheet";
import {lightTheme} from "../../../src/theme";
import {en} from "../../../src/i18n/en";

function Probe({onDraft}: {onDraft: (d: FlagDraftState) => void}) {
  onDraft(useFlagDraft());
  return null;
}

async function render() {
  let draft: FlagDraftState | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Probe onDraft={(d) => { draft = d; }} />);
  });
  if (!renderer || !draft) throw new Error("mount failed");
  const sheet = await (async () => {
    let s: ReturnType<typeof create> | undefined;
    await act(async () => {
      s = create(<FlagSheet t={en} lat={10.7} lng={106.6} draft={draft as FlagDraftState} />);
    });
    if (!s) throw new Error("render failed");
    return s;
  })();
  return {draft: draft as FlagDraftState, renderer, sheet };
}

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

test("type dropdown expands, selects, and collapses", async () => {
  const {renderer, sheet} = await render();
  try {
    const options = () => sheet.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState?.checked !== undefined && n.findAll((m) => typeof m.props?.name === "string").length > 0);
    expect(options()).toHaveLength(0);
    expect(sheet.root.findAll((n) => n.props?.children === en.flag.accident).length).toBe(0);
    const header = sheet.root.findAll((n) => n.props?.accessibilityState?.expanded !== undefined).find((n) => typeof n.props?.onPress === "function");
    expect(header).toBeDefined();
    await act(async () => {
      await header?.props.onPress();
    });
    expect(options()).toHaveLength(3);
    const accident = options().find((n) =>
      n.findAll((m) => m.props?.children === en.flag.accident).length > 0,
    );
    expect(accident?.props.accessibilityState?.checked).toBe(false);
    await act(async () => {
      await accident?.props.onPress();
    });
    expect(options()).toHaveLength(0);
    expect(sheet.root.findAll((n) => n.props?.children === en.flag.flood).length).toBeGreaterThan(0);
    expect(sheet.root.findAll((n) => n.props?.children === en.flag.accident).length).toBe(0);
  } finally {
    await act(async () => {
      sheet.unmount();
      renderer.unmount();
    });
  }
});

test("note field and five big radius chips", async () => {
  const {renderer, sheet} = await render();
  try {
    const note = sheet.root.findAll((n) => n.props?.placeholder === undefined && n.props?.maxLength === 280).find((n) => typeof n.props?.onChangeText === "function");
    expect(note).toBeDefined();
    expect(note?.props.multiline).toBe(true);
    const chips = [25, 50, 100, 200, 250].map((r) =>
      sheet.root.findAll((n) => n.props?.children === r || n.props?.children === String(r)),
    );
    for (const hit of chips) expect(hit.length).toBeGreaterThan(0);
    const pressables = sheet.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.style !== undefined);
    const minHeights = pressables.map((n) => flatStyle(n.props.style).minHeight).filter((h) => typeof h === "number");
    expect(Math.min(...(minHeights as number[]))).toBeGreaterThanOrEqual(44);
  } finally {
    await act(async () => {
      sheet.unmount();
      renderer.unmount();
    });
  }
});

test("reselected type stays checked on reopen", async () => {
  let draft: FlagDraftState | undefined;
  let probe: ReturnType<typeof create> | undefined;
  await act(async () => {
    probe = create(<Probe onDraft={(d) => { draft = d; }} />);
  });
  if (!probe || !draft) throw new Error("mount failed");
  async function sheetFor(d: FlagDraftState) {
    let s: ReturnType<typeof create> | undefined;
    await act(async () => {
      s = create(<FlagSheet t={en} lat={10.7} lng={106.6} draft={d} />);
    });
    if (!s) throw new Error("render failed");
    return s;
  }
  const optionsOf = (sheet: ReturnType<typeof create>) =>
    sheet.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState?.checked !== undefined && n.findAll((m) => typeof m.props?.name === "string").length > 0);
  const headerOf = (sheet: ReturnType<typeof create>) =>
    sheet.root.findAll((n) => n.props?.accessibilityState?.expanded !== undefined).find((n) => typeof n.props?.onPress === "function");
  try {
    const first = await sheetFor(draft);
    await act(async () => {
      await headerOf(first)?.props.onPress();
    });
    const obstruction = optionsOf(first).find((n) =>
      n.findAll((m) => m.props?.children === en.flag.obstruction).length > 0,
    );
    await act(async () => {
      await obstruction?.props.onPress();
    });
    first.unmount();
    const second = await sheetFor(draft as FlagDraftState);
    await act(async () => {
      await headerOf(second)?.props.onPress();
    });
    const current = optionsOf(second).find((n) => n.props?.accessibilityState?.checked === true);
    expect(current?.findAll((m) => m.props?.children === en.flag.obstruction).length).toBeGreaterThan(0);
    await act(async () => {
      second.unmount();
    });
  } finally {
    await act(async () => {
      probe?.unmount();
    });
  }
});
