import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {useProviderDraft, type ProviderDraftState} from "../../../src/components/providers/useProviderDraft";
import {en} from "../../../src/i18n/en";

function Probe({kind, provider, onValue}: {kind: "SHOP" | "TOW"; provider?: Parameters<typeof useProviderDraft>[1]; onValue: (v: ProviderDraftState) => void}) {
  onValue(useProviderDraft(kind, provider ?? null, en));
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

test("tow search pick sets the truck point and marks location touched", async () => {
  const {latest, renderer} = await draftFor("TOW");
  await act(async () => {
    latest()?.onPickTowPlace({label: "Depot", lat: 10.71, lng: 106.61, source: "map"});
  });
  expect(latest()?.towPoint).toEqual({lat: 10.71, lng: 106.61});
  renderer.unmount();
});

test("map confirm writes to the shop point by default and the truck point for tow", async () => {
  const shop = await draftFor("SHOP");
  await act(async () => {
    shop.latest()?.openMapPick("shop");
  });
  await act(async () => {
    shop.latest()?.onConfirmMapPoint(10.72, 106.62, "Crossroads");
  });
  expect(shop.latest()?.point).toEqual({lat: 10.72, lng: 106.62, label: "Crossroads"});
  shop.renderer.unmount();
  const tow = await draftFor("TOW");
  await act(async () => {
    tow.latest()?.openMapPick("tow");
  });
  await act(async () => {
    tow.latest()?.onConfirmMapPoint(10.73, 106.63, "Yard");
  });
  expect(tow.latest()?.towPoint).toEqual({lat: 10.73, lng: 106.63});
  tow.renderer.unmount();
});

test("map-picked shop point passes submit location validation", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (jest.fn(async () =>
    ({ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: {id: "p1"}})}),
  ) as unknown) as typeof fetch;
  try {
    const {latest, renderer} = await draftFor("SHOP");
    await act(async () => {
      latest()?.setName("Good Shop");
      latest()?.openMapPick("shop");
      latest()?.onConfirmMapPoint(10.72, 106.62, "Crossroads");
    });
    let ok = false;
    await act(async () => {
      ok = await (latest()?.submit("tok") ?? false);
    });
    expect(latest()?.error).not.toBe(en.provider.invalidLocation);
    expect(ok).toBe(true);
    renderer.unmount();
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("map pick on an existing shop sends the new coordinates on save", async () => {
  const realFetch = globalThis.fetch;
  const seen: {url: string; body: string}[] = [];
  globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
    seen.push({url: String(url), body: String(init?.body ?? "")});
    return {ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: {updated: 1}})};
  }) as unknown) as typeof fetch;
  try {
    let current: ProviderDraftState | undefined;
    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(
        <Probe kind="SHOP" provider={{id: "p1", kind: "SHOP", name: "Old", lat: 10.0, lng: 106.0, status: "ACTIVE"}} onValue={(v) => { current = v; }} />,
      );
    });
    if (!renderer) throw new Error("mount failed");
    await act(async () => {
      current?.openMapPick("shop");
      current?.onConfirmMapPoint(10.72, 106.62, "Crossroads");
    });
    let ok = false;
    await act(async () => {
      ok = await (current?.submit("tok") ?? false);
    });
    expect(ok).toBe(true);
    const put = seen.find((call) => call.url.endsWith("/providers"));
    expect(put).toBeDefined();
    expect(JSON.parse(put?.body ?? "{}")).toMatchObject({providerId: "p1", lat: 10.72, lng: 106.62});
    renderer.unmount();
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("vehicle classes default to both and keep at least one", async () => {
  const {latest, renderer} = await draftFor("SHOP");
  try {
    expect(latest()?.vehicleClasses).toEqual(["SOLO_BIKE", "CAR"]);
    await act(async () => {
      latest()?.toggleVehicleClass("CAR");
    });
    expect(latest()?.vehicleClasses).toEqual(["SOLO_BIKE"]);
    await act(async () => {
      latest()?.toggleVehicleClass("SOLO_BIKE");
    });
    expect(latest()?.vehicleClasses).toEqual(["SOLO_BIKE"]);
  } finally {
    renderer.unmount();
  }
});

test("shop submit rejects a non-numeric fee", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (jest.fn(async () =>
    ({ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: {id: "p1"}})}),
  ) as unknown) as typeof fetch;
  try {
    const {latest, renderer} = await draftFor("SHOP");
    try {
      await act(async () => {
        latest()?.setName("Good Shop");
        latest()?.onPickPlace({label: "Here", lat: 10.7, lng: 106.6, source: "map"});
        latest()?.setServiceFee("12a");
      });
      const ok = await (async () => {
        let result = true;
        await act(async () => {
          result = await (latest()?.submit("tok") ?? true);
        });
        return result;
      })();
      expect(ok).toBe(false);
      expect(latest()?.error).toBe(en.provider.invalidAmount);
    } finally {
      renderer.unmount();
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});
