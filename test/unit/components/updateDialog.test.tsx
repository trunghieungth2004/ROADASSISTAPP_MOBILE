import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import UpdateDialog from "../../../src/components/UpdateDialog";
import {en} from "../../../src/i18n/en";
import {downloadAndInstall} from "../../../src/services/appUpdate";

jest.mock("../../../src/services/appUpdate", () => {
  const actual = jest.requireActual("../../../src/services/appUpdate") as Record<string, unknown>;
  return {...actual, downloadAndInstall: jest.fn()};
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const release = {tag: "v0.2.0", notes: "Fixes and speed", apkUrl: "https://example.com/app.apk"};

async function renderDialog(props?: {onSkip?: () => void; onClose?: () => void}) {
  const onSkip = props?.onSkip ?? jest.fn();
  const onClose = props?.onClose ?? jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <UpdateDialog t={en} release={release} onSkip={onSkip} onClose={onClose} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onSkip, onClose};
}

function actionLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" && typeof n.props?.onPress === "function")
    .map((n) => n.props.accessibilityLabel as string);
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

test("dialog shows version, notes, and three exits", async () => {
  const {renderer, onSkip, onClose} = await renderDialog();
  try {
    expect(texts(renderer)).toContain("Fixes and speed");
    expect(actionLabels(renderer)).toContain(en.more.updateDownload);
    expect(actionLabels(renderer)).toContain(en.more.updateSkip);
    const skip = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.updateSkip)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await skip?.props.onPress();
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

test("download shows progress then closes", async () => {
  const mockDownload = jest.mocked(downloadAndInstall);
  mockDownload.mockImplementation(async (url: string, onProgress: (f: number) => void) => {
    url;
    onProgress(0.5);
  });
  const {renderer, onClose} = await renderDialog();
  try {
    const download = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.updateDownload)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await download?.props.onPress();
    });
    expect(mockDownload).toHaveBeenCalledWith("https://example.com/app.apk", expect.any(Function));
    expect(texts(renderer)).toContain("50%");
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("failed download offers retry and settings", async () => {
  const mockDownload = jest.mocked(downloadAndInstall);
  mockDownload.mockRejectedValueOnce(new Error("nope"));
  const {renderer} = await renderDialog();
  try {
    const download = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.updateDownload)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await download?.props.onPress();
    });
    expect(texts(renderer)).toContain(en.more.updateFailed);
    expect(actionLabels(renderer)).toContain(en.more.updateOpenSettings);
    mockDownload.mockImplementation(async () => undefined);
    const retry = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.updateDownload)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await retry?.props.onPress();
    });
    expect(texts(renderer)).not.toContain(en.more.updateFailed);
  } finally {
    renderer.unmount();
  }
});
