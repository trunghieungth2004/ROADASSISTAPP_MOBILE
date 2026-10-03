import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import NavigationScreen from "../../../src/screens/NavigationScreen";
import DiagnosticsScreen from "../../../src/screens/DiagnosticsScreen";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: null, uid: null, loaded: true}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

jest.mock("../../../src/context/NavSessionContext", () => {
  const actual = jest.requireActual("../../../src/context/NavSessionContext") as typeof import("../../../src/context/NavSessionContext");
  return {
    ...actual,
    useNavSession: () => ({session: null, start: () => undefined, clear: () => undefined}),
  };
});

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({goBack: mockGoBack, setOptions: mockSetOptions}),
}));

test("navigation route renders nothing without a session", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<NavigationScreen />);
  });
  expect(renderer?.toJSON()).toBeNull();
  renderer?.unmount();
});

test("diagnostics route sets its navigator title", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<DiagnosticsScreen />);
  });
  expect(renderer?.toJSON()).not.toBeNull();
  expect(mockSetOptions).toHaveBeenCalledWith({title: en.more.diagnostics});
  renderer?.unmount();
});
