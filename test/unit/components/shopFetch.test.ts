import {expect, jest, test, beforeEach} from "@jest/globals";
import {searchProviders} from "../../../src/api/providers";
import {fetchShopPlaces} from "../../../src/components/place-search/shopMerge";

jest.mock("../../../src/api/providers", () => ({
  searchProviders: jest.fn(),
}));

const mockedSearch = jest.mocked(searchProviders);

beforeEach(() => {
  mockedSearch.mockReset();
  mockedSearch.mockResolvedValue([
    {id: "tow1", name: "Near Haul", lat: 10.71, lng: 106.61, kind: "TOW", status: "ACTIVE"},
    {id: "shop1", name: "Near Fix", lat: 10.72, lng: 106.62, kind: "SHOP", status: "ACTIVE"},
  ]);
});

test("tow drop-off search asks for shops and drops towers", async () => {
  const out = await fetchShopPlaces("near", "tok", {lat: 10.7, lng: 106.6}, undefined, 20000, true);
  expect(mockedSearch).toHaveBeenCalledWith(
    10.7,
    106.6,
    "near",
    "tok",
    expect.objectContaining({kind: "SHOP", radiusMeters: 20000}),
  );
  expect(out.map((s) => s.id)).toEqual(["shop1"]);
});

test("browse search keeps every kind without a kind filter", async () => {
  const out = await fetchShopPlaces("near", "tok", {lat: 10.7, lng: 106.6});
  expect(mockedSearch).toHaveBeenCalledWith(
    10.7,
    106.6,
    "near",
    "tok",
    {},
  );
  expect(out.map((s) => s.id).sort()).toEqual(["shop1", "tow1"]);
});
