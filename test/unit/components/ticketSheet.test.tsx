import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {View} from "react-native";
import TicketSheet from "../../../src/screens/assist/TicketSheet";
import {en} from "../../../src/i18n/en";
import {lightTheme} from "../../../src/theme";

jest.mock("../../../src/services/photos", () => ({
  TICKET_PHOTO_MAX: 5,
  isPhotoUploadError: jest.fn(() => false),
  isPhotoPermissionError: jest.fn(() => false),
  pickPhotos: jest.fn(async () => []),
  takePhoto: jest.fn(async () => []),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof TicketSheet>;

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

async function render(overrides?: Partial<Props>) {
  const onAddPhotos = jest.fn();
  const onRemovePhoto = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <TicketSheet
          t={en}
          theme={lightTheme}
          ticketType="TOW"
          note=""
          onNote={() => undefined}
          towDest={null}
          busy={false}
          onSubmit={() => undefined}
          onClose={() => undefined}
          description=""
          onDescription={() => undefined}
          photos={[]}
          photosBusy={false}
          onAddPhotos={onAddPhotos}
          onRemovePhoto={onRemovePhoto}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onAddPhotos, onRemovePhoto};
}

test("offers camera and library, previews thumbnails and removes by index", async () => {
  const {renderer, onAddPhotos, onRemovePhoto} = await render({photos: ["file://a.jpg"]});
  try {
    const camera = renderer.root.find((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function");
    const library = renderer.root.find((n) => n.props?.accessibilityLabel === en.photos.choose && typeof n.props?.onPress === "function");
    await act(async () => {
      camera.props.onPress();
      library.props.onPress();
    });
    expect(onAddPhotos).toHaveBeenNthCalledWith(1, "camera");
    expect(onAddPhotos).toHaveBeenNthCalledWith(2, "library");
    const thumbs = renderer.root.findAll((n) => n.props?.source?.uri === "file://a.jpg");
    expect(thumbs.length).toBeGreaterThan(0);
    expect(flatStyle(thumbs[0].props.style)).toMatchObject({width: 72, height: 72});
    const remove = renderer.root.find((n) => n.props?.accessibilityLabel === en.common.delete && typeof n.props?.onPress === "function");
    await act(async () => {
      remove.props.onPress();
    });
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("the photo block sits below the drop-off search", async () => {
  const {renderer} = await render({towDest: <View testID="tow-dest" />, photos: ["file://a.jpg"]});
  try {
    const all = renderer.root.findAll(() => true, {deep: true});
    const destIndex = all.findIndex((n) => n.props?.testID === "tow-dest");
    const photoIndex = all.findIndex((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function");
    expect(destIndex).toBeGreaterThanOrEqual(0);
    expect(photoIndex).toBeGreaterThanOrEqual(0);
    expect(destIndex).toBeLessThan(photoIndex);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("source buttons hide at the cap and all thumbnails stay visible", async () => {
  const five = ["a", "b", "c", "d", "e"].map((k) => `file://${k}.jpg`);
  const {renderer} = await render({photos: five});
  try {
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function")).toHaveLength(0);
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.photos.choose && typeof n.props?.onPress === "function")).toHaveLength(0);
    expect(renderer.root.findAll((n) => typeof n.props?.source?.uri === "string").length).toBeGreaterThanOrEqual(5);
    expect(renderer.root.findAll((n) => n.props?.children === `${en.assist.photos} (5/5)`).length).toBeGreaterThan(0);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("a photo upload failure offers retry or sending without photos", async () => {
  const onRetryPhotos = jest.fn();
  const onSubmitWithoutPhotos = jest.fn();
  const {renderer} = await render({
    photos: ["file://a.jpg"],
    photoError: en.photos.uploadFailed,
    onRetryPhotos,
    onSubmitWithoutPhotos,
  });
  try {
    expect(renderer.root.findAll((n) => n.props?.children === en.photos.uploadFailed).length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.request && typeof n.props?.onPress === "function")).toHaveLength(0);
    const retry = renderer.root.find((n) => n.props?.accessibilityLabel === en.common.retry && typeof n.props?.onPress === "function");
    const send = renderer.root.find((n) => n.props?.accessibilityLabel === en.photos.sendWithout && typeof n.props?.onPress === "function");
    await act(async () => {
      retry.props.onPress();
      send.props.onPress();
    });
    expect(onRetryPhotos).toHaveBeenCalledWith();
    expect(onSubmitWithoutPhotos).toHaveBeenCalledWith();
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});
