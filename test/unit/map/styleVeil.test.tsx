import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {useStyleVeil} from "../../../src/components/map/useStyleVeil";
import MapStyleVeil from "../../../src/components/map/MapStyleVeil";
import {useEffect} from "react";

function Probe({scheme, onApi}: {scheme: "light" | "dark"; onApi: (api: {veiled: boolean; onStyleLoaded: () => void}) => void}) {
  const api = useStyleVeil(scheme);
  useEffect(() => {
    onApi(api);
  }, [api, onApi]);
  return null;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test("veil stays down on first load and covers scheme switches", async () => {
  let api: {veiled: boolean; onStyleLoaded: () => void} | null = null;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Probe scheme="light" onApi={(a) => { api = a; }} />);
    await flush();
  });
  if (!renderer || !api) throw new Error("mount failed");
  try {
    expect((api as {veiled: boolean}).veiled).toBe(false);
    await act(async () => {
      (api as {onStyleLoaded: () => void}).onStyleLoaded();
      await flush();
    });
    await act(async () => {
      renderer?.update(<Probe scheme="dark" onApi={(a) => { api = a; }} />);
      await flush();
    });
    expect((api as {veiled: boolean}).veiled).toBe(true);
    await act(async () => {
      (api as {onStyleLoaded: () => void}).onStyleLoaded();
      await flush();
    });
    expect((api as {veiled: boolean}).veiled).toBe(false);
  } finally {
    renderer.unmount();
  }
});

test("veil renders while visible and unmounts after load", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<MapStyleVeil visible backgroundColor="#121212" />);
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    expect(renderer.root.findAll((n) => n.props?.pointerEvents === "none").length).toBeGreaterThan(0);
    await act(async () => {
      renderer?.update(<MapStyleVeil visible={false} backgroundColor="#121212" />);
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    await act(async () => {});
    expect(renderer.root.findAll((n) => n.props?.pointerEvents === "none")).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});
