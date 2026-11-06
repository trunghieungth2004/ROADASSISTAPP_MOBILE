import {expect, test} from "@jest/globals";
import {channelsOf, hasBookingService, hasChannel} from "../../../src/services/serviceChannels";

const service = (channels?: Array<"BOOKING" | "ASSIST">) => ({
  code: "OIL",
  name: "Oil",
  displayPrice: 100000,
  quoteRequired: false,
  ...(channels !== undefined ? {channels} : {}),
});

test("legacy services belong to both channels", () => {
  expect(channelsOf(service())).toEqual(["BOOKING", "ASSIST"]);
  expect(hasChannel(service(), "BOOKING")).toBe(true);
  expect(hasChannel(service(), "ASSIST")).toBe(true);
});

test("explicit channels are respected", () => {
  expect(hasChannel(service(["ASSIST"]), "BOOKING")).toBe(false);
  expect(hasBookingService([service(["ASSIST"])])).toBe(false);
  expect(hasBookingService([service(["ASSIST"]), service(["BOOKING"])]))
    .toBe(true);
});
