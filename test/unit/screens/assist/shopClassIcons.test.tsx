import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import ShopClassIcons, {classIconLabel, servesBike, servesCar} from "../../../../src/screens/assist/ShopClassIcons";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";

test("absent classes serve both", () => {
  expect(servesBike({vehicleClasses: null})).toBe(true);
  expect(servesCar({vehicleClasses: null})).toBe(true);
  expect(servesBike({})).toBe(true);
  expect(servesCar({})).toBe(true);
  expect(classIconLabel({}, en)).toBe(en.shop.bothClasses);
});

test("single classes serve one side", () => {
  expect(servesBike({vehicleClasses: ["SOLO_BIKE"]})).toBe(true);
  expect(servesCar({vehicleClasses: ["SOLO_BIKE"]})).toBe(false);
  expect(servesBike({vehicleClasses: ["CAR"]})).toBe(false);
  expect(servesCar({vehicleClasses: ["CAR"]})).toBe(true);
  expect(classIconLabel({vehicleClasses: ["CAR"]}, en)).toBe(en.shop.vehicleCar);
  expect(classIconLabel({vehicleClasses: ["SOLO_BIKE"]}, en)).toBe(en.shop.vehicleBike);
});

test("icons match the served classes", async () => {
  async function glyphs(classes: string[] | null) {
    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(<ShopClassIcons theme={lightTheme} shop={{vehicleClasses: classes}} label="x" />);
    });
    if (!renderer) throw new Error("render failed");
    const names = renderer.root.findAll((n) => typeof n.props?.name === "string").map((n) => n.props.name as string).filter((v, i, a) => a.indexOf(v) === i);
    renderer.unmount();
    return names;
  }
  expect(await glyphs(null)).toEqual(["motorbike", "car"]);
  expect(await glyphs(["SOLO_BIKE"])).toEqual(["motorbike"]);
  expect(await glyphs(["CAR"])).toEqual(["car"]);
});
