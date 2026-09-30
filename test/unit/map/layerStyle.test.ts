import {expect, test} from "@jest/globals";
import {splitLayerStyle} from "../../../src/map/layerStyle";

test("paint-only styles stay in paint", () => {
  expect(splitLayerStyle({lineColor: "#0284c7", lineWidth: 4, lineOpacity: 0.8})).toEqual({
    paint: {"line-color": "#0284c7", "line-width": 4, "line-opacity": 0.8},
    layout: {},
  });
});

test("layout-only styles stay in layout", () => {
  expect(splitLayerStyle({iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true})).toEqual({
    paint: {},
    layout: {"icon-image": "a-dot", "icon-size": 0.33, "icon-allow-overlap": true},
  });
});

test("line caps and joins are layout, not paint", () => {
  const split = splitLayerStyle({lineColor: "#fff", lineCap: "round", lineJoin: "round", textField: "1", textColor: "#fff"});
  expect(split.layout).toEqual({"line-cap": "round", "line-join": "round", "text-field": "1"});
  expect(split.paint).toEqual({"line-color": "#fff", "text-color": "#fff"});
});
