import {expect, test} from "@jest/globals";
import {declineReasonLabel, stageLabel, statusStages, statusTone, ticketStatusLabel, ticketTitle} from "../../../../src/screens/assist/ticketLabels";
import {en} from "../../../../src/i18n/en";

test("ticket titles use translated labels", () => {
  expect(ticketTitle({ticketType: "TOW", status: "1"}, en)).toBe("Tow · Pending");
  expect(ticketTitle({ticketType: "MECHANIC", status: "2"}, en)).toBe("Repair · Matched");
  expect(ticketTitle({ticketType: "SOS", status: "4"}, en)).toBe("SOS · Resolved");
});

test("unknown codes fall back without inventing copy", () => {
  expect(ticketTitle({ticketType: "WARP", status: "9"}, en)).toBe("WARP · Pending");
});

test("new statuses resolve to translated labels", () => {
  expect(ticketStatusLabel("6", en)).toBe(en.assist.statusInProgress);
  expect(ticketStatusLabel("7", en)).toBe(en.assist.statusReady);
  expect(ticketStatusLabel("8", en)).toBe(en.assist.statusDeclined);
  expect(statusTone("4")).toBe("done");
  expect(statusTone("7")).toBe("done");
  expect(statusTone("5")).toBe("failed");
  expect(statusTone("8")).toBe("failed");
  expect(statusTone("1")).toBe("active");
  expect(statusTone("6")).toBe("active");
  expect(statusStages("WALK_IN")).toEqual(["1", "2", "6", "7", "4"]);
  expect(statusStages("SOS")).toEqual(["1", "2", "3", "4"]);
  expect(stageLabel("WALK_IN", "2", en)).toBe(en.assist.statusAccepted);
  expect(stageLabel("SOS", "2", en)).toBe(en.assist.statusMatched);
  expect(declineReasonLabel("FULL", en)).toBe(en.assist.declineFull);
  expect(declineReasonLabel("CLOSED", en)).toBe(en.assist.declineClosed);
  expect(declineReasonLabel("PARTS_DELAY", en)).toBe(en.assist.declinePartsDelay);
  expect(declineReasonLabel("OTHER", en)).toBe(en.assist.declineOther);
  expect(declineReasonLabel("BOGUS", en)).toBe(en.assist.declineOther);
});
