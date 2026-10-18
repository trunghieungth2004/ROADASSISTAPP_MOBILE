import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import PhotoViewer from "../../../src/components/ui/PhotoViewer";
import {en} from "../../../src/i18n/en";

test("shows the photo and closes via the cancel button", async () => {
  const onClose = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<PhotoViewer uri="file:///photo.jpg" closeLabel={en.common.cancel} onClose={onClose} />);
  });
  if (!renderer) throw new Error("render failed");
  const view = renderer;
  try {
    const image = view.root.findAll((n) => n.props?.source?.uri === "file:///photo.jpg");
    expect(image.length).toBeGreaterThan(0);
    const cancel = view.root
      .findAll((n) => n.props?.accessibilityLabel === en.common.cancel && typeof n.props?.onPress === "function")
      .pop();
    await act(async () => {
      cancel?.props.onPress?.();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      view.unmount();
    });
  }
});

test("renders no photo while closed", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<PhotoViewer uri={null} closeLabel={en.common.cancel} onClose={() => undefined} />);
  });
  if (!renderer) throw new Error("render failed");
  const view = renderer;
  try {
    expect(view.root.findAll((n) => typeof n.props?.source?.uri === "string")).toHaveLength(0);
  } finally {
    await act(async () => {
      view.unmount();
    });
  }
});
