import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import WarrantyTicketSheet from "../../../src/screens/warranty/WarrantyTicketSheet";
import {en} from "../../../src/i18n/en";
import type {DispatchTicket} from "../../../src/api/dispatch";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1"}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {useStrings: () => ({t: mockedEn, lang: "en"})};
});

jest.mock("../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

jest.mock("../../../src/screens/assist/RecordDetailSheet", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, "ticket-modal"),
  };
});

const mockGetTicket = jest.fn(async () => ({
  id: "t1",
  userId: "u1",
  ticketType: "MECHANIC",
  lat: 10.7,
  lng: 106.6,
  status: "4",
} as DispatchTicket));
jest.mock("../../../src/api/dispatch", () => ({
  getTicket: (...args: unknown[]) =>
    (mockGetTicket as (...a: unknown[]) => Promise<DispatchTicket>)(...args),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test("loads the ticket and renders the read-only ticket modal", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyTicketSheet ticketId="t1" onClose={() => undefined} />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    expect(texts(renderer)).toContain("ticket-modal");
    expect(mockGetTicket).toHaveBeenCalledWith("t1", "tok");
  } finally {
    renderer.unmount();
  }
});

test("shows the fetch error when the ticket cannot be opened", async () => {
  mockGetTicket.mockRejectedValueOnce(new Error("ticket unavailable"));
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WarrantyTicketSheet ticketId="t2" onClose={() => undefined} />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    expect(texts(renderer)).toContain("ticket unavailable");
    expect(texts(renderer)).toContain(en.assist.viewTicket);
  } finally {
    renderer.unmount();
  }
});
