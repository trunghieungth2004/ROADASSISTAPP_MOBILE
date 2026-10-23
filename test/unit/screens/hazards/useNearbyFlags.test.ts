import {act, renderHook, waitFor} from "@testing-library/react-native";
import {expect, jest, test} from "@jest/globals";
import {flagsNear, type Flag} from "../../../../src/api/flags";
import {useNearbyFlags} from "../../../../src/screens/hazards/useNearbyFlags";

jest.mock("../../../../src/api/flags", () => ({
  flagsNear: jest.fn(),
}));

jest.mock("../../../../src/api/client", () => ({
  toMessage: (err: unknown) => String(err),
}));

const flag = {
  id: "f1",
  type: "FLOOD",
  status: "1",
  lat: 10.7,
  lng: 106.6,
} as Flag;

test("nearby flags load only while the tab is active", async () => {
  jest.mocked(flagsNear).mockResolvedValue([flag]);
  const {result, rerender} = await renderHook(
    ({active}: {active: boolean}) =>
      useNearbyFlags("tok", {lat: 10.7, lng: 106.6}, active),
    {initialProps: {active: false}},
  );
  expect(flagsNear).not.toHaveBeenCalled();
  await rerender({active: true});
  await waitFor(() => expect(result.current.flags).toEqual([flag]));
  expect(flagsNear).toHaveBeenCalledWith(10.7, 106.6, 2000, "tok");
  await act(() => result.current.removeLocal("f1"));
  expect(result.current.flags).toEqual([]);
});

test("nearby flags clear when the tab closes", async () => {
  jest.mocked(flagsNear).mockResolvedValue([flag]);
  const {result, rerender} = await renderHook(
    ({active}: {active: boolean}) =>
      useNearbyFlags("tok", {lat: 10.7, lng: 106.6}, active),
    {initialProps: {active: true}},
  );
  await waitFor(() => expect(result.current.flags).toEqual([flag]));
  await rerender({active: false});
  await waitFor(() => expect(result.current.flags).toEqual([]));
});
