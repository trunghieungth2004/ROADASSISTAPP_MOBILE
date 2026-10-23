import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {Text} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {ThemeProvider, useAppMode, useThemeMode} from "../../src/context/ThemeContext";

function Probe() {
  const mode = useAppMode();
  const {toggle} = useThemeMode();
  return <Text testID="mode" onPress={toggle}>{mode}</Text>;
}

function ModeOnly() {
  return <Text testID="mode">{useAppMode()}</Text>;
}

function modeOf(renderer: ReturnType<typeof create>): string {
  return renderer.root.findByProps({testID: "mode"}).props.children;
}

test("useAppMode reflects the stored preference", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce("dark");
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  });
  expect(modeOf(renderer!)).toBe("dark");
});

test("toggling updates context consumers", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce("light");
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  });
  expect(modeOf(renderer!)).toBe("light");
  await act(async () => {
    renderer!.root.findByProps({testID: "mode"}).props.onPress();
  });
  expect(modeOf(renderer!)).toBe("dark");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("roadassist.theme", "dark");
});

test("useAppMode works without a provider", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<ModeOnly />);
  });
  expect(["light", "dark"]).toContain(modeOf(renderer!));
});
