import {expect, jest, test, beforeEach, afterAll} from "@jest/globals";
import * as Notifications from "expo-notifications";
import {ensurePushConfigured, setNavForeground} from "../../../src/services/push";

type Behavior = {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};

type Handler = (n: unknown) => Promise<Behavior>;

function capturedHandler(): Handler {
  const mock = Notifications.setNotificationHandler as unknown as jest.Mock;
  const arg = mock.mock.calls.at(-1)?.[0] as {handleNotification: Handler} | undefined;
  if (!arg) throw new Error("handler not captured");
  return arg.handleNotification;
}

function notification(data: Record<string, string | boolean>): unknown {
  return {request: {content: {data}}};
}

beforeEach(() => {
  ensurePushConfigured();
  setNavForeground(false);
});

afterAll(() => {
  setNavForeground(false);
});

test("banners a routine dispatch when not navigating", async () => {
  const handler = capturedHandler();
  await expect(handler(notification({ticketId: "t1"}))).resolves.toMatchObject({
    shouldShowBanner: true,
    shouldPlaySound: true,
  });
});

test("stays quiet for a routine dispatch during navigation", async () => {
  setNavForeground(true);
  const handler = capturedHandler();
  await expect(handler(notification({ticketId: "t1"}))).resolves.toMatchObject({
    shouldShowBanner: false,
    shouldPlaySound: false,
  });
});

test("breaks through navigation for an urgent dispatch", async () => {
  setNavForeground(true);
  const handler = capturedHandler();
  await expect(handler(notification({ticketId: "t1", urgent: "true"}))).resolves.toMatchObject({
    shouldShowBanner: true,
    shouldPlaySound: true,
  });
  await expect(handler(notification({ticketId: "t1", urgent: true}))).resolves.toMatchObject({
    shouldShowBanner: true,
  });
});

test("hazard pushes stay suppressed during navigation", async () => {
  setNavForeground(true);
  const handler = capturedHandler();
  await expect(handler(notification({flagId: "f1", type: "FLOOD"}))).resolves.toMatchObject({
    shouldShowBanner: false,
  });
});
