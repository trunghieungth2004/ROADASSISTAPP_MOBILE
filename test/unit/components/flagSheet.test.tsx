import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import FlagSheet, {useFlagDraft, type FlagDraftState} from "../../../src/components/flags/FlagSheet";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/services/photos", () => ({
  takePhoto: jest.fn(async () => ["file://shot.jpg"]),
  pickPhotos: jest.fn(async () => ["file://pick.jpg"]),
  isPhotoPermissionError: jest.fn(() => false),
}));

function Probe({onDraft}: {onDraft: (d: FlagDraftState) => void}) {
  onDraft(useFlagDraft(en));
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
      s = create(<FlagSheet t={en} draft={draft as FlagDraftState} />);
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

test("type row shows all types and selects directly", async () => {
  let draft: FlagDraftState | undefined;
  let probe: ReturnType<typeof create> | undefined;
  await act(async () => {
    probe = create(<Probe onDraft={(d) => { draft = d; }} />);
  });
  if (!probe || !draft) throw new Error("mount failed");
  async function sheetFor(d: FlagDraftState) {
    let s: ReturnType<typeof create> | undefined;
    await act(async () => {
      s = create(<FlagSheet t={en} draft={d} />);
    });
    if (!s) throw new Error("render failed");
    return s;
  }
  const optionsOf = (sheet: ReturnType<typeof create>) =>
    sheet.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState?.checked !== undefined && n.findAll((m) => typeof m.props?.name === "string").length > 0);
  try {
    const first = await sheetFor(draft);
    expect(optionsOf(first)).toHaveLength(3);
    const accident = optionsOf(first).find((n) => n.props.accessibilityLabel === en.flag.accident);
    expect(accident?.props.accessibilityState?.checked).toBe(false);
    await act(async () => {
      await accident?.props.onPress();
    });
    first.unmount();
    const second = await sheetFor(draft as FlagDraftState);
    const current = optionsOf(second).find((n) => n.props.accessibilityState?.checked === true);
    expect(current?.props.accessibilityLabel).toBe(en.flag.accident);
    await act(async () => {
      second.unmount();
    });
  } finally {
    await act(async () => {
      probe?.unmount();
    });
  }
});

test("no note field and five radius chips in one row", async () => {
  const {renderer, sheet} = await render();
  try {
    const note = sheet.root.findAll((n) => n.props?.placeholder === undefined && n.props?.maxLength === 280).find((n) => typeof n.props?.onChangeText === "function");
    expect(note).toBeUndefined();
    const texts = sheet.root.findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children as string);
    expect(texts).toContain(en.flag.type);
    const radiusLabel = sheet.root.findAll((n) => Array.isArray(n.props?.children) && n.props.children.join("") === `${en.flag.radius} (m)`);
    expect(radiusLabel.length).toBeGreaterThan(0);
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
      s = create(<FlagSheet t={en} draft={d} />);
    });
    if (!s) throw new Error("render failed");
    return s;
  }
  const optionsOf = (sheet: ReturnType<typeof create>) =>
    sheet.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState?.checked !== undefined && n.findAll((m) => typeof m.props?.name === "string").length > 0);
  try {
    const first = await sheetFor(draft);
    const obstruction = optionsOf(first).find((n) => n.props.accessibilityLabel === en.flag.obstruction);
    await act(async () => {
      await obstruction?.props.onPress();
    });
    first.unmount();
    const second = await sheetFor(draft as FlagDraftState);
    const current = optionsOf(second).find((n) => n.props.accessibilityState?.checked === true);
    expect(current?.props.accessibilityLabel).toBe(en.flag.obstruction);
    await act(async () => {
      second.unmount();
    });
  } finally {
    await act(async () => {
      probe?.unmount();
    });
  }
});

test("camera tile takes a shot directly and previews the strip", async () => {
  let draft: FlagDraftState | undefined;
  let probe: ReturnType<typeof create> | undefined;
  await act(async () => {
    probe = create(<Probe onDraft={(d) => { draft = d; }} />);
  });
  if (!probe || !draft) throw new Error("mount failed");
  let sheet: ReturnType<typeof create> | undefined;
  await act(async () => {
    sheet = create(<FlagSheet t={en} draft={draft as FlagDraftState} />);
  });
  if (!sheet) throw new Error("render failed");
  try {
    const addTile = sheet.root.find((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function");
    await act(async () => {
      await addTile.props.onPress();
    });
    expect(draft?.photoUris).toEqual(["file://shot.jpg"]);
    await act(async () => {
      sheet?.update(<FlagSheet t={en} draft={draft as FlagDraftState} />);
    });
    const strips = sheet.root.findAll((n) => n.props?.source?.uri === "file://shot.jpg");
    expect(strips.length).toBeGreaterThan(0);
    expect(flatStyle(strips[0].props.style)).toMatchObject({width: "100%", height: 48});
    const remove = sheet.root.find((n) => n.props?.accessibilityLabel === en.common.delete && typeof n.props?.onPress === "function");
    await act(async () => {
      remove.props.onPress();
    });
    expect(draft?.photoUris).toEqual([]);
  } finally {
    await act(async () => {
      sheet?.unmount();
      probe?.unmount();
    });
  }
});

test("add tile disappears at the three-photo cap", async () => {
  const draft: FlagDraftState = {
    type: "FLOOD",
    radiusMeters: 50,
    note: "",
    photoUris: ["a.jpg", "b.jpg", "c.jpg"],
    photoError: null,
    setType: () => undefined,
    setRadiusMeters: () => undefined,
    setNote: () => undefined,
    addPhoto: async () => undefined,
    removePhoto: () => undefined,
    build: () => ({type: "FLOOD", radiusMeters: 50}),
  };
  let sheet: ReturnType<typeof create> | undefined;
  await act(async () => {
    sheet = create(<FlagSheet t={en} draft={draft} />);
  });
  if (!sheet) throw new Error("render failed");
  try {
    expect(sheet.root.findAll((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function")).toHaveLength(0);
    expect(sheet.root.findAll((n) => n.props?.source?.uri === "a.jpg").length).toBeGreaterThan(0);
  } finally {
    await act(async () => {
      sheet?.unmount();
    });
  }
});
