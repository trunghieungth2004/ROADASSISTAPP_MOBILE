import {jest} from "@jest/globals";
jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const stub = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  return {
    MapView: stub("MapView"),
    Map: stub("Map"),
    Camera: stub("Camera"),
    PointAnnotation: stub("PointAnnotation"),
    ShapeSource: stub("ShapeSource"),
    GeoJSONSource: stub("GeoJSONSource"),
    Layer: stub("Layer"),
    Marker: stub("Marker"),
    SymbolLayer: stub("SymbolLayer"),
    LineLayer: stub("LineLayer"),
    FillLayer: stub("FillLayer"),
    Images: stub("Images"),
  };
});

jest.mock("expo-location", () => ({
  Accuracy: {Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6},
  requestForegroundPermissionsAsync: jest.fn(async () => ({status: "granted"})),
  getForegroundPermissionsAsync: jest.fn(async () => ({status: "granted"})),
  getCurrentPositionAsync: jest.fn(async () => ({coords: {latitude: 10.7, longitude: 106.6}})),
  getLastKnownPositionAsync: jest.fn(async () => null),
  hasServicesEnabledAsync: jest.fn(async () => true),
  watchPositionAsync: jest.fn(async () => ({remove: jest.fn()})),
}));

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPermissionsAsync: jest.fn(async () => ({status: "granted"})),
  requestPermissionsAsync: jest.fn(async () => ({status: "granted"})),
  getExpoPushTokenAsync: jest.fn(async () => ({data: "ExponentPushToken[test]"})),
  setNotificationHandler: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => undefined), remove: jest.fn(), volume: 0, loop: false})),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
}));

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true]),
  loadAsync: jest.fn(async () => undefined),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ""),
}));

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => undefined),
}));
