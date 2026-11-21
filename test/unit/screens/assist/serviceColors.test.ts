import {expect, test} from "@jest/globals";
import {serviceColor} from "../../../../src/screens/assist/serviceColors";

test("service types keep their semantic colors", () => {
  expect(serviceColor("SOS")).toBe("#be123c");
  expect(serviceColor("TOW")).toBe("#0284c7");
  expect(serviceColor("WALK_IN")).toBe("#15803d");
  expect(serviceColor("MECHANIC")).toBe("#15803d");
  expect(serviceColor("BOOKING")).toBe("#7c3aed");
  expect(serviceColor("UNKNOWN")).toBe("#64748b");
});
