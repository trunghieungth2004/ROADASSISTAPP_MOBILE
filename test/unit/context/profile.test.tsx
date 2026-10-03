import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestRenderer} from "react-test-renderer";
import {ProfileProvider, useProfile, type ProfileState} from "../../../src/context/ProfileContext";
import type {MeBundle} from "../../../src/api/users";
import * as usersApi from "../../../src/api/users";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({uid: "u1", token: "tok", loaded: true}),
}));

jest.mock("../../../src/api/users", () => ({
  fetchMeBundle: jest.fn(),
  setActiveVehicle: jest.fn(),
  setOnboarded: jest.fn(),
}));

const mockedFetch = usersApi.fetchMeBundle as jest.MockedFunction<typeof usersApi.fetchMeBundle>;
const mockedActivate = usersApi.setActiveVehicle as jest.MockedFunction<typeof usersApi.setActiveVehicle>;

const BASE = {user: {id: "u1", role: "2", services: ["RIDER"]}, vehicles: [], activeVehicle: null};

function Probe({onValue}: {onValue: (v: ProfileState) => void}) {
  onValue(useProfile());
  return null;
}

async function mountProfile(): Promise<{renderer: ReactTestRenderer; latest: () => ProfileState | undefined}> {
  let current: ProfileState | undefined;
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(
      <ProfileProvider>
        <Probe onValue={(v) => { current = v; }} />
      </ProfileProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  return {renderer, latest: () => current};
}

test("concurrent refreshes resolve to the latest bundle", async () => {
  mockedFetch.mockResolvedValue(BASE);
  const {renderer, latest} = await mountProfile();
  mockedFetch.mockClear();
  let resolveSlow!: (v: MeBundle) => void;
  mockedFetch
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
    .mockImplementationOnce(() => Promise.resolve({...BASE, user: {...BASE.user, services: ["RIDER", "VOLUNTEER"]}}));
  await act(async () => {
    const slow = latest()?.refresh() ?? Promise.resolve(null);
    const fast = latest()?.refresh() ?? Promise.resolve(null);
    resolveSlow({...BASE, user: {...BASE.user, services: ["STALE"]}});
    await Promise.all([slow, fast]);
  });
  expect(mockedFetch).toHaveBeenCalledTimes(2);
  expect(latest()?.bundle).toEqual({...BASE, user: {...BASE.user, services: ["RIDER", "VOLUNTEER"]}});
  renderer.unmount();
  mockedFetch.mockReset();
});

test("activateVehicle falls back to refresh for unknown profiles", async () => {
  mockedFetch.mockResolvedValue({...BASE, vehicles: [{id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1}]});
  mockedActivate.mockResolvedValue({updated: 1, profileId: "ghost"});
  const {renderer, latest} = await mountProfile();
  const callsBefore = mockedFetch.mock.calls.length;
  await act(async () => {
    await latest()?.activateVehicle("ghost");
  });
  expect(mockedFetch.mock.calls.length).toBeGreaterThan(callsBefore);
  renderer.unmount();
  mockedFetch.mockReset();
  mockedActivate.mockReset();
});
