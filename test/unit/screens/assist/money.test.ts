import {expect, test} from "@jest/globals";
import {formatAmountInput, parseAmountInput} from "../../../../src/screens/assist/money";

test("groups digits with thousands separators as they are typed", () => {
  expect(formatAmountInput("10000")).toBe("10,000");
  expect(formatAmountInput("1000000")).toBe("1,000,000");
  expect(formatAmountInput("10,000")).toBe("10,000");
  expect(formatAmountInput("0")).toBe("0");
  expect(formatAmountInput("0007")).toBe("7");
  expect(formatAmountInput("12a3")).toBe("123");
  expect(formatAmountInput("")).toBe("");
  expect(formatAmountInput("abc")).toBe("");
});

test("parses formatted amounts back to integers", () => {
  expect(parseAmountInput("10,000")).toBe(10000);
  expect(parseAmountInput("150000")).toBe(150000);
  expect(parseAmountInput("0")).toBe(0);
  expect(parseAmountInput("")).toBeNull();
  expect(parseAmountInput(",")).toBeNull();
  expect(parseAmountInput("abc")).toBeNull();
});
