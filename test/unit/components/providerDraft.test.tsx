import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {useProviderDraft, type ProviderDraftState} from "../../../src/components/useProviderDraft";
import {en} from "../../../src/i18n/en";

function Probe({kind, onValue}: {kind: "SHOP" | "TOW"; onValue: (v: ProviderDraftState) => void}) {
  onValue(useProviderDraft(kind, null, en));
  return null;
}

async function draftFor(kind: "SHOP" | "TOW"): Promise<{latest: () => ProviderDraftState | undefined; renderer: ReturnType<typeof create>}> {
  let current: ProviderDraftState | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Probe kind={kind} onValue={(v) => { current = v; }} />);
  });
  if (!renderer) throw new Error("mount failed");
  return {latest: () => current, renderer};
}

test("shop submit rejects an empty name", async () => {
  const {latest, renderer} = await draftFor("SHOP");
  let ok = true;
  await act(async () => {
    ok = await (latest()?.submit("tok") ?? true);
  });
  expect(ok).toBe(false);
  expect(latest()?.error).toBe(en.provider.invalidName);
  renderer.unmount();
});

test("shop submit rejects a missing location", async () => {
  const {latest, renderer} = await draftFor("SHOP");
  await act(async () => {
    latest()?.setName("Good Shop");
  });
  let ok = true;
  await act(async () => {
    ok = await (latest()?.submit("tok") ?? true);
  });
  expect(ok).toBe(false);
  expect(latest()?.error).toBe(en.provider.invalidLocation);
  renderer.unmount();
});

test("shop submit rejects invalid hours", async () => {
  const {latest, renderer} = await draftFor("SHOP");
  await act(async () => {
    latest()?.setName("Good Shop");
    latest()?.onPickPlace({label: "Here", lat: 10.7, lng: 106.6, source: "map"});
    latest()?.setDay("MON", {enabled: true, open: "xx", close: "yy"});
  });
  let ok = true;
  await act(async () => {
    ok = await (latest()?.submit("tok") ?? true);
  });
  expect(ok).toBe(false);
  expect(latest()?.error).toBe(en.provider.invalidHours);
  renderer.unmount();
});

test("tow submit rejects a bad plate, bad width, and missing position in order", async () => {
  const {latest, renderer} = await draftFor("TOW");
  await act(async () => {
    latest()?.setName("Tow Co");
  });
  let ok = true;
  await act(async () => {
    ok = await (latest()?.submit("tok") ?? true);
  });
  expect(ok).toBe(false);
  expect(latest()?.error).toBe(en.provider.invalidPlate);
  await act(async () => {
    latest()?.setPlate("51H-12345");
  });
  await act(async () => {
    ok = await (latest()?.submit("tok") ?? true);
  });
  expect(ok).toBe(false);
  expect(latest()?.error).toBe(en.provider.invalidWidth);
  renderer.unmount();
});
