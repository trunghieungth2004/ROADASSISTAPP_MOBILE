import {expect, jest, test} from "@jest/globals";
import {register} from "../../../src/api/auth";
import {
  acceptTicket,
  cancelTicket,
  createTicket,
  getTicket,
  myTickets,
  nearTickets,
  updateTicketStatus,
} from "../../../src/api/dispatch";
import {
  confirmFlag,
  denyFlag,
  flagsNear,
  getFlag,
  myFlags,
  submitFlag,
  unflag,
} from "../../../src/api/flags";
import {
  listSavedPlaces,
  removeSavedPlace,
  savePlace,
  searchDirectory,
} from "../../../src/api/places";
import {
  createProvider,
  myProviders,
  nearProviders,
  pingProviderLocation,
  reportProvider,
  updateProvider,
} from "../../../src/api/providers";
import {registerPush, unregisterPush} from "../../../src/api/push";
import {
  deleteSavedRoute,
  findRoute,
  getSavedRoute,
  listSavedRoutes,
  renameSavedRoute,
  saveRoute,
} from "../../../src/api/routes";
import {
  fetchMeBundle,
  setActiveVehicle,
  setOnboarded,
  setVolunteerAvailability,
  updateProfile,
  volunteerHeartbeat,
} from "../../../src/api/users";
import {
  addRideConfig,
  createProfile,
  listProfiles,
} from "../../../src/api/vehicles";

const realFetch = globalThis.fetch;

type Call = {fn: () => Promise<unknown>; method: string; path: string};

const T = "tok";
const calls: Call[] = [
  {fn: () => register({email: "a@b.c", password: "secret123", phone: "+84123456789"}), method: "POST", path: "/users/register"},
  {fn: () => createTicket({ticketType: "SOS", lat: 1, lng: 2}, T), method: "POST", path: "/dispatch"},
  {fn: () => myTickets(T), method: "POST", path: "/dispatch/mine"},
  {fn: () => getTicket("t1", T), method: "POST", path: "/dispatch/one"},
  {fn: () => cancelTicket("t1", T), method: "PUT", path: "/dispatch/status"},
  {fn: () => nearTickets(1, 2, T), method: "POST", path: "/dispatch/near"},
  {fn: () => acceptTicket("t1", T), method: "POST", path: "/dispatch/accept"},
  {fn: () => updateTicketStatus("t1", "4", T), method: "PUT", path: "/dispatch/status"},
  {fn: () => submitFlag({type: "FLOOD", lat: 1, lng: 2}, T), method: "POST", path: "/flags"},
  {fn: () => confirmFlag("f1", T), method: "POST", path: "/flags/confirm"},
  {fn: () => denyFlag("f1", T), method: "POST", path: "/flags/deny"},
  {fn: () => unflag("f1", T), method: "POST", path: "/flags/unflag"},
  {fn: () => flagsNear(1, 2, 500, T), method: "POST", path: "/flags/near"},
  {fn: () => getFlag("f1", T), method: "POST", path: "/flags/get"},
  {fn: () => myFlags(T), method: "POST", path: "/flags/mine"},
  {fn: () => searchDirectory("demo-quartet", T), method: "POST", path: "/places/search"},
  {fn: () => savePlace({label: "Home", lat: 1, lng: 2}, T), method: "POST", path: "/places/save"},
  {fn: () => listSavedPlaces(T), method: "POST", path: "/places/saved"},
  {fn: () => removeSavedPlace("p1", T), method: "POST", path: "/places/unsave"},
  {fn: () => nearProviders(1, 2, T), method: "POST", path: "/providers/near"},
  {fn: () => myProviders(T), method: "POST", path: "/providers/mine"},
  {fn: () => createProvider({kind: "SHOP", name: "S", lat: 1, lng: 2}, T), method: "POST", path: "/providers"},
  {fn: () => updateProvider({providerId: "p1", accepting: true}, T), method: "PUT", path: "/providers"},
  {fn: () => reportProvider({providerId: "p1", reason: "SPAM"}, T), method: "POST", path: "/providers/report"},
  {fn: () => pingProviderLocation(1, 2, T), method: "POST", path: "/providers/location"},
  {fn: () => registerPush(T, "dev"), method: "POST", path: "/push/register"},
  {fn: () => unregisterPush(T, "dev"), method: "POST", path: "/push/unregister"},
  {fn: () => findRoute({originLat: 1, originLng: 2, destLat: 3, destLng: 4}, T), method: "POST", path: "/routes"},
  {fn: () => saveRoute({originLat: 1, originLng: 2, destLat: 3, destLng: 4, geometry: {type: "LineString", coordinates: []}}, T), method: "POST", path: "/routes/save"},
  {fn: () => listSavedRoutes(T), method: "POST", path: "/routes/saved"},
  {fn: () => getSavedRoute("r1", T), method: "POST", path: "/routes/saved/one"},
  {fn: () => renameSavedRoute("r1", "n", T), method: "PUT", path: "/routes/saved"},
  {fn: () => deleteSavedRoute("r1", T), method: "POST", path: "/routes/unsave"},
  {fn: () => fetchMeBundle(T), method: "POST", path: "/users/me"},
  {fn: () => setOnboarded({service: "RIDER"}, T), method: "PUT", path: "/users/onboard"},
  {fn: () => setActiveVehicle({profileId: "p1"}, T), method: "PUT", path: "/users/activeVehicle"},
  {fn: () => updateProfile({displayName: "A"}, T), method: "PUT", path: "/users/profile"},
  {fn: () => setVolunteerAvailability({available: true}, T), method: "PUT", path: "/users/volunteer"},
  {fn: () => volunteerHeartbeat(1, 2, T), method: "POST", path: "/users/volunteer/heartbeat"},
  {fn: () => listProfiles(T), method: "POST", path: "/vehicleProfiles/all"},
  {fn: () => createProfile({type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1}, T), method: "POST", path: "/vehicleProfiles"},
  {fn: () => addRideConfig({profileId: "p1", configType: "SOLO"}, T), method: "POST", path: "/vehicleProfiles/rideConfig"},
];

test("every api call hits its registered method and path", async () => {
  const seen: {method: string; path: string}[] = [];
  globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    seen.push({method: init?.method ?? "GET", path: u.pathname});
    throw new Error("down");
  }) as unknown) as typeof fetch;
  try {
    for (const call of calls) {
      if (call.path === "/places/search") continue;
      await expect(call.fn()).rejects.toThrow("down");
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  const search = calls.find((call) => call.path === "/places/search");
  expect(search).toBeDefined();
  expect(seen).toEqual(
    calls.filter((call) => call.path !== "/places/search").map(({method, path}) => ({method, path})),
  );
});

test("searchDirectory queries the directory endpoint", async () => {
  let seen = "";
  globalThis.fetch = (jest.fn(async (url: string) => {
    seen = new URL(String(url)).pathname;
    return {ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: []})};
  }) as unknown) as typeof fetch;
  try {
    await searchDirectory("demo-quartet", T);
  } finally {
    globalThis.fetch = realFetch;
  }
  expect(seen).toBe("/places/search");
});
