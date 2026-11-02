import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import ChatSheet from "../../../../src/screens/assist/ChatSheet";
import {en} from "../../../../src/i18n/en";
import * as chatApi from "../../../../src/api/chat";

jest.mock("../../../../src/api/chat", () => ({
  openChat: jest.fn(async () => ({})),
  chatMessages: jest.fn(async () => []),
  sendChatMessage: jest.fn(),
}));
jest.mock("../../../../src/services/photos", () => ({
  takePhoto: jest.fn(async () => []),
  uploadPhotoPaths: jest.fn(async () => []),
  resolvePhotoUrl: jest.fn(async () => ""),
}));
jest.mock("../../../../src/components/ui/PhotoThumb", () => ({
  __esModule: true,
  default: () => null,
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

test("terminal ticket chat is read-only", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChatSheet
          t={en}
          token="token"
          uid="u1"
          scope="TICKET"
          refId="t1"
          title="SOS"
          ticketType="SOS"
          status="15"
          otherName="Fix Shop"
          readOnly
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    const texts = renderer.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string);
    expect(texts).toContain(en.chat.closed);
    expect(texts).toContain(en.assist.statusUnfixable);
    expect(texts).toContain(en.assist.typeSos);
    expect(texts).not.toContain(en.chat.placeholder);
    expect(chatApi.openChat).toHaveBeenCalledWith("TICKET", "t1", "token", undefined);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

test("quote decision system events are localized", async () => {
  jest.mocked(chatApi.chatMessages).mockResolvedValue([
    {id: "m1", senderUid: "system", senderName: null, text: "Quote sent", photoUrls: [], kind: "SYSTEM", event: "QUOTE_SENT", createdAt: "2026-01-01T00:01:00.000Z"},
    {id: "m2", senderUid: "system", senderName: null, text: "Quote approved", photoUrls: [], kind: "SYSTEM", event: "QUOTE_APPROVED", createdAt: "2026-01-01T00:02:00.000Z"},
    {id: "m3", senderUid: "system", senderName: null, text: "Fix declined", photoUrls: [], kind: "SYSTEM", event: "MOBILE_FIX_DECLINED", createdAt: "2026-01-01T00:03:00.000Z"},
  ] as never);
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChatSheet
          t={en}
          token="token"
          uid="u1"
          scope="TICKET"
          refId="t1"
          title="Quote"
          ticketType="WALK_IN"
          status="9"
          otherName="Fix Shop"
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  if (!renderer) throw new Error("render failed");
  try {
    const texts = renderer.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string);
    expect(texts).toContain(en.assist.quoteSent);
    expect(texts).toContain(en.assist.quoteApproved);
    expect(texts).toContain(en.assist.fixQuoteDeclined);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});
