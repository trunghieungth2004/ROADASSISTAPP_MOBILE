import {expect, test} from "@jest/globals";
import {ticketTitle} from "../../../../src/screens/assist/ticketLabels";
import {en} from "../../../../src/i18n/en";

test("ticket titles use translated labels", () => {
  expect(ticketTitle({ticketType: "TOW", status: "1"}, en)).toBe("Tow · Pending");
  expect(ticketTitle({ticketType: "MECHANIC", status: "2"}, en)).toBe("Repair · Matched");
  expect(ticketTitle({ticketType: "SOS", status: "4"}, en)).toBe("SOS · Resolved");
});

test("unknown codes fall back without inventing copy", () => {
  expect(ticketTitle({ticketType: "WARP", status: "9"}, en)).toBe("WARP · Pending");
});
