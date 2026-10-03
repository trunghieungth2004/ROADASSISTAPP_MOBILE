import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {NavSessionProvider, useNavSession, type NavSession} from "../../../src/context/NavSessionContext";

const session: NavSession = {
  route: {source: "test", geometry: {type: "LineString", coordinates: [[106.6, 10.7]]}, distanceMeters: 100, durationSeconds: 60},
  dest: {lat: 10.8, lng: 106.7},
  stops: [],
  seed: {lat: 10.7, lng: 106.6},
};

function Probe({onValue}: {onValue: (v: ReturnType<typeof useNavSession>) => void}) {
  onValue(useNavSession());
  return null;
}

test("nav session starts and clears", async () => {
  let current: ReturnType<typeof useNavSession> | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <NavSessionProvider>
        <Probe onValue={(v) => { current = v; }} />
      </NavSessionProvider>,
    );
  });
  expect(current?.session).toBeNull();
  act(() => {
    current?.start(session);
  });
  expect(current?.session).toEqual(session);
  act(() => {
    current?.clear();
  });
  expect(current?.session).toBeNull();
  renderer?.unmount();
});

test("starting a new session replaces the previous one", async () => {
  let current: ReturnType<typeof useNavSession> | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <NavSessionProvider>
        <Probe onValue={(v) => { current = v; }} />
      </NavSessionProvider>,
    );
  });
  const next: NavSession = {...session, dest: {lat: 11, lng: 107}};
  act(() => {
    current?.start(session);
  });
  act(() => {
    current?.start(next);
  });
  expect(current?.session).toEqual(next);
  renderer?.unmount();
});
