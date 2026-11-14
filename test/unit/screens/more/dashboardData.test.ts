import {expect, test} from "@jest/globals";
import {en} from "../../../../src/i18n/en";
import {buildCasesSummary} from "../../../../src/screens/more/dashboardData";
import type {EligibleAppeals} from "../../../../src/api/appeals";
import type {ReceivedRatings} from "../../../../src/api/ratings";

test("cases combine rider and provider activity without a mode", () => {
  const received = {
    rider: {avg: 4.5, count: 2},
    providers: [{id: "shop1", name: "Fix Shop", avg: 4, count: 3}],
  } as unknown as ReceivedRatings;
  const eligible = {
    ratings: [{}, {}],
    reports: [{}],
    disputes: [{}],
  } as unknown as EligibleAppeals;
  const cases = buildCasesSummary({received, eligible, t: en});
  expect(cases.hasCases).toBe(true);
  expect(cases.summary).toContain(`${en.more.ratingAsRider} 4.5 (2)`);
  expect(cases.summary).toContain(`${en.more.dashboardProvider} 4.0 (3)`);
  expect(cases.summary).toContain(`${en.more.appealSubjectRating} 2`);
  expect(cases.summary).toContain(`${en.more.appealSubjectReport} 1`);
  expect(cases.summary).toContain(`${en.more.appealSubjectDispute} 1`);
});

test("empty cases stay hidden", () => {
  const cases = buildCasesSummary({
    received: null,
    eligible: {ratings: [], reports: [], disputes: []},
    t: en,
  });
  expect(cases.hasCases).toBe(false);
  expect(cases.summary).toBe("");
});
