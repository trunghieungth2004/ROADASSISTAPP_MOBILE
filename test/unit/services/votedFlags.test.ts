import {beforeEach, expect, test} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {loadDeniedIds, loadVotedIds, markDenied, markVoted} from "../../../src/storage/votedFlags";

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("vote history is scoped to the signed-in uid", async () => {
  await markVoted("user-a", "flag-1");
  await markDenied("user-a", "flag-2");
  await markVoted("user-b", "flag-3");

  await expect(loadVotedIds("user-a")).resolves.toEqual(new Set(["flag-1"]));
  await expect(loadDeniedIds("user-a")).resolves.toEqual(new Set(["flag-2"]));
  await expect(loadVotedIds("user-b")).resolves.toEqual(new Set(["flag-3"]));
  await expect(loadDeniedIds("user-b")).resolves.toEqual(new Set());
});

test("a missing uid never reads or writes another user's history", async () => {
  await markVoted("user-a", "flag-1");
  await markVoted(null, "flag-2");
  await markDenied(null, "flag-3");

  await expect(loadVotedIds(null)).resolves.toEqual(new Set());
  await expect(loadDeniedIds(null)).resolves.toEqual(new Set());
  await expect(loadVotedIds("user-a")).resolves.toEqual(new Set(["flag-1"]));
});
