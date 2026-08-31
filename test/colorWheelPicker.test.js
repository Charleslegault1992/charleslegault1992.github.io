import assert from "node:assert/strict";
import test from "node:test";

import { hexToHsv, hsvToHex } from "../src/ui/colorWheelPicker.js";

test("the color wheel converts primary HSV colors to hexadecimal", () => {
  assert.equal(hsvToHex({ hue: 0, saturation: 1, value: 1 }), "#ff0000");
  assert.equal(hsvToHex({ hue: 120, saturation: 1, value: 1 }), "#00ff00");
  assert.equal(hsvToHex({ hue: 240, saturation: 1, value: 1 }), "#0000ff");
});

test("character colors survive an HSV round trip", () => {
  for (const color of ["#8a552c", "#e7e2da", "#686868", "#6b3f18"]) {
    assert.equal(hsvToHex(hexToHsv(color)), color);
  }
});
