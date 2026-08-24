import assert from "node:assert/strict";
import test from "node:test";

const createClassList = () => ({
  add() {},
  remove() {},
  toggle() {},
});

const zone = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
};
const joystick = {
  classList: createClassList(),
  offsetWidth: 120,
  offsetHeight: 120,
  style: {
    removeProperty() {},
  },
};
const knob = {
  style: {},
};

globalThis.document = {
  querySelector(selector) {
    if (selector === "#mobile-joystick-zone") return zone;
    if (selector === "#mobile-joystick") return joystick;
    if (selector === "#mobile-joystick-knob") return knob;
    return null;
  },
  querySelectorAll() {
    return [];
  },
};

const { createMobileJoystickController } = await import("../src/ui/mobileJoystickController.js");
const { keysPressed } = await import("../src/player/playerNavigationController.js");

test("changing between cardinal and diagonal input keeps joystick geometry usable", () => {
  const state = {
    joystickPointerId: 1,
    joystickWasMoving: false,
    joystickDiagonalCandidate: null,
    joystickDiagonalReady: false,
    joystickDiagonalTimeoutId: null,
    joystickClientX: null,
    joystickClientY: null,
    joystickCenterX: null,
    joystickCenterY: null,
    joystickMaxDistance: null,
    joystickDeadZone: null,
  };
  const controller = createMobileJoystickController({
    state,
    diagonalHoldMs: 500,
    cancelPlayerNavigation() {},
  });

  controller.placeAtPointer(100, 100);
  controller.updateFromPointer(130, 100);
  assert.equal(keysPressed.right, true);

  controller.updateFromPointer(130, 130);
  assert.equal(Number.isFinite(state.joystickCenterX), true);
  assert.equal(Number.isFinite(state.joystickCenterY), true);

  controller.updateFromPointer(100, 130);
  assert.equal(keysPressed.down, true);
  assert.equal(keysPressed.left || keysPressed.right, false);

  controller.reset();
});
