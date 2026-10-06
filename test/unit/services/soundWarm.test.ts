import {expect, jest, test} from "@jest/globals";
import {playEventSound, warmAudio} from "../../../src/services/sound";

const mockSeekTo = jest.fn(async () => undefined);
const mockCreate = jest.fn(() => ({play: jest.fn(), pause: jest.fn(), seekTo: mockSeekTo, remove: jest.fn(), volume: 0, loop: false}));

jest.mock("expo-audio", () => ({
  createAudioPlayer: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

test("warm builds one seeking player per sound", async () => {
  mockCreate.mockClear();
  mockSeekTo.mockClear();
  await warmAudio();
  expect(mockCreate).toHaveBeenCalledTimes(4);
  expect(mockSeekTo).toHaveBeenCalledTimes(4);
  mockCreate.mockClear();
  await playEventSound("hazard");
  expect(mockCreate).not.toHaveBeenCalled();
});
