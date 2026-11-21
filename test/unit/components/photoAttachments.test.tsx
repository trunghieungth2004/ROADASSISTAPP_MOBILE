import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {en} from "../../../src/i18n/en";
import {photoUploadMessage, usePhotoDraft, type PhotoDraft} from "../../../src/components/ui/PhotoAttachments";
import {isPhotoPermissionError, pickPhotos, takePhoto} from "../../../src/services/photos";

jest.mock("../../../src/services/photos", () => ({
  TICKET_PHOTO_MAX: 5,
  isPhotoPermissionError: jest.fn((err: unknown) =>
    err instanceof Error && err.message === "photo-permission"),
  isPhotoUploadError: jest.fn((err: unknown) =>
    err instanceof Error && err.message === "photo-too-large-10"),
  pickPhotos: jest.fn(async () => ["file://library.jpg"]),
  takePhoto: jest.fn(async () => ["file://camera.jpg"]),
}));

function Probe({onDraft}: {onDraft: (draft: PhotoDraft) => void}) {
  onDraft(usePhotoDraft({t: en, max: 2}));
  return null;
}

async function mountDraft() {
  const draft: {current: PhotoDraft | null} = {current: null};
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<Probe onDraft={(value) => { draft.current = value; }} />);
  });
  if (!renderer || !draft.current) throw new Error("mount failed");
  return {draft, renderer};
}

test("draft adds from camera or library up to the limit", async () => {
  const {draft, renderer} = await mountDraft();
  try {
    await act(async () => {
      await draft.current?.add("camera");
    });
    expect(takePhoto).toHaveBeenCalled();
    expect(draft.current?.photos).toEqual(["file://camera.jpg"]);
    await act(async () => {
      await draft.current?.add("library");
    });
    expect(pickPhotos).toHaveBeenCalledWith(2, 1);
    expect(draft.current?.photos).toEqual(["file://camera.jpg", "file://library.jpg"]);
    await act(async () => {
      await draft.current?.add("camera");
    });
    expect(draft.current?.photos).toHaveLength(2);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("permission errors use the matching message", async () => {
  const {draft, renderer} = await mountDraft();
  jest.mocked(takePhoto).mockRejectedValueOnce(new Error("photo-permission"));
  try {
    await act(async () => {
      await draft.current?.add("camera");
    });
    expect(isPhotoPermissionError).toHaveBeenCalled();
    expect(draft.current?.error).toBe(en.photos.cameraDenied);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("upload errors map to the shared upload message", () => {
  expect(photoUploadMessage(new Error("photo-too-large-10"), en)).toBe(en.photos.uploadFailed);
  expect(photoUploadMessage(new Error("server exploded"), en)).toBe("server exploded");
});
