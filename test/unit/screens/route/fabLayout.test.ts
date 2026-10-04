import {expect, test} from "@jest/globals";
import {FAB_GAP, FAB_SIZE, rightColumnBottom} from "../../../../src/screens/route/fabLayout";

test("route fabs share one size", () => {
  expect(FAB_SIZE).toBe(48);
  expect(FAB_GAP).toBe(8);
});

test("column sits one gap above the locate row at any card height", () => {
  for (const cardH of [0, 120, 420]) {
    const locateTop = 12 + cardH + FAB_GAP + FAB_SIZE;
    expect(rightColumnBottom(cardH) - locateTop).toBe(FAB_GAP);
  }
});
