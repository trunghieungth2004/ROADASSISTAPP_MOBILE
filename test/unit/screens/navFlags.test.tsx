import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import NavFlags from "../../../src/screens/navigation/NavFlags";
import {clearApiCache} from "../../../src/services/cache";
import type {Flag} from "../../../src/api/flags";

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const stub = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  return {
    Map: stub("Map"),
    Camera: stub("Camera"),
    GeoJSONSource: stub("GeoJSONSource"),
    Layer: stub("Layer"),
    Images: stub("Images"),
  };
});

const realFetch = globalThis.fetch;

function envelope(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data}),
  } as Response;
}

function wireFlag(raw: Partial<Flag> & {id: string}): Flag {
  return {
    type: "FLOOD",
    lat: 10.7,
    lng: 106.6,
    status: "1",
    ...raw,
  };
}

const VOTED = new Set<string>();
const DENIED = new Set<string>();

type FlagsProps = React.ComponentProps<typeof NavFlags>;

function baseProps(overrides?: Partial<FlagsProps>): FlagsProps {
  return {
    pos: {lat: 10.7, lng: 106.6},
    token: "tok",
    refreshKey: 0,
    forceKey: 0,
    seedFlags: [],
    uid: "u1",
    votedIds: VOTED,
    deniedIds: DENIED,
    suppressAuto: false,
    arrived: false,
    onPick: () => undefined,
    onAutoFlag: () => undefined,
    ...overrides,
  };
}

function dotIds(renderer: ReturnType<typeof create>, sourceId: string): string[] {
  const nodes = renderer.root.findAll(
    (n: ReactTestInstance) => String(n.type) === "GeoJSONSource" && (n.props as {id?: string}).id === sourceId,
  );
  const ids: string[] = [];
  for (const n of nodes) {
    const data = (n.props as {data?: {features?: {properties?: {id?: string}}[]}}).data;
    for (const f of data?.features ?? []) {
      if (typeof f.properties?.id === "string") ids.push(f.properties.id);
    }
  }
  return ids;
}

test("fetches on mount and throttles small moves on refreshKey", async () => {
  clearApiCache();
  const spy = jest.fn(async () => envelope([]));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(<NavFlags {...baseProps()} />);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer?.update(<NavFlags {...baseProps({pos: {lat: 10.7004, lng: 106.6}, refreshKey: 1})} />);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    renderer?.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("forceKey bypasses the move and heartbeat gate", async () => {
  clearApiCache();
  const spy = jest.fn(async () => envelope([]));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(<NavFlags {...baseProps()} />);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    clearApiCache();
    await act(async () => {
      renderer?.update(<NavFlags {...baseProps({pos: {lat: 10.7004, lng: 106.6}, refreshKey: 1, forceKey: 1})} />);
    });
    expect(spy).toHaveBeenCalledTimes(2);
  } finally {
    renderer?.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("seeded flags merge with push entries winning on id collision", async () => {
  clearApiCache();
  const fetched = [wireFlag({id: "f1", status: "1", lat: 10.7, lng: 106.6})];
  const spy = jest.fn(async () => envelope(fetched));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <NavFlags
          {...baseProps({
            seedFlags: [wireFlag({id: "f1", status: "2"}), wireFlag({id: "f9", status: "1", lat: 10.71, lng: 106.61})],
          })}
        />,
      );
    });
    const r = renderer as ReturnType<typeof create>;
    expect(dotIds(r, "flag-dot-pin-flood-2")).toEqual(expect.arrayContaining(["f1"]));
    expect(dotIds(r, "flag-dot-pin-flood-1")).not.toContain("f1");
    const allDots = [...dotIds(r, "flag-dot-pin-flood-2"), ...dotIds(r, "flag-dot-pin-flood-1")];
    expect(allDots.filter((id) => id === "f1")).toHaveLength(1);
    expect(allDots).toContain("f9");
  } finally {
    renderer?.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});
