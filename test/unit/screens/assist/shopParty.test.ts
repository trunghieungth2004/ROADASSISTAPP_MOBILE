import {expect, test} from "@jest/globals";
import {providerFromParty} from "../../../../src/screens/assist/shopParty";
import type {ProviderService} from "../../../../src/api/providers";

const services: ProviderService[] = [
  {
    code: "AAA",
    name: "AAA",
    displayPrice: 123456,
    quoteRequired: false,
  },
];

test("party conversion preserves shop services", () => {
  expect(providerFromParty({
    id: "shop1",
    name: "103",
    kind: "SHOP",
    lat: 10.7,
    lng: 106.7,
    services,
  }, null)).toMatchObject({
    id: "shop1",
    kind: "SHOP",
    services,
  });
});

test("party conversion keeps the fallback coordinates", () => {
  expect(providerFromParty({
    id: "shop1",
    name: "103",
    kind: "SHOP",
    services,
  }, {lat: 10.8, lng: 106.8})).toMatchObject({
    lat: 10.8,
    lng: 106.8,
  });
});
