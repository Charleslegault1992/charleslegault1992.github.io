import { clamp } from "../core/mathUtils.js";
import { keysPressed, resetMovementKeys } from "../player/playerNavigationController.js";
import { mobileJoystick, mobileJoystickKnob, mobileJoystickZone } from "./domRefs.js";

export const createMobileJoystickController = ({ state, diagonalHoldMs, cancelPlayerNavigation }) => {
  const resetDiagonalHold = () => {
    if (state.joystickDiagonalTimeoutId !== null) {
      clearTimeout(state.joystickDiagonalTimeoutId);
    }
    state.joystickDiagonalCandidate = null;
    state.joystickDiagonalReady = false;
    state.joystickDiagonalTimeoutId = null;
  };

  const reset = () => {
    state.joystickPointerId = null;
    state.joystickWasMoving = false;
    resetDiagonalHold();
    state.joystickClientX = null;
    state.joystickClientY = null;
    state.joystickCenterX = null;
    state.joystickCenterY = null;
    state.joystickMaxDistance = null;
    state.joystickDeadZone = null;
    resetMovementKeys();
    if (mobileJoystickKnob) {
      mobileJoystickKnob.style.transform = "translate3d(0px, 0px, 0px)";
    }
    if (mobileJoystick) {
      mobileJoystick.style.removeProperty("top");
      mobileJoystick.style.removeProperty("bottom");
      mobileJoystick.style.removeProperty("left");
    }
    mobileJoystick?.classList.remove("mobile-joystick-diagonal-pending", "mobile-joystick-diagonal-ready");
  };

  const placeAtPointer = (clientX, clientY) => {
    if (!mobileJoystickZone || !mobileJoystick || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    const zoneRect = mobileJoystickZone.getBoundingClientRect();
    const joystickWidth = mobileJoystick.offsetWidth;
    const joystickHeight = mobileJoystick.offsetHeight;
    const left = clamp(clientX - zoneRect.left - joystickWidth / 2, 0, zoneRect.width - joystickWidth);
    const top = clamp(clientY - zoneRect.top - joystickHeight / 2, 0, zoneRect.height - joystickHeight);
    mobileJoystick.style.left = `${left}px`;
    mobileJoystick.style.top = `${top}px`;
    mobileJoystick.style.bottom = "auto";
    state.joystickCenterX = zoneRect.left + left + joystickWidth / 2;
    state.joystickCenterY = zoneRect.top + top + joystickHeight / 2;
    state.joystickMaxDistance = joystickWidth * 0.32;
    state.joystickDeadZone = state.joystickMaxDistance * 0.3;
  };

  const updateFromPointer = (clientX, clientY) => {
    if (!mobileJoystick || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    const centerX = state.joystickCenterX;
    const centerY = state.joystickCenterY;
    const maxDistance = state.joystickMaxDistance;
    const deadZone = state.joystickDeadZone;
    if (![centerX, centerY, maxDistance, deadZone].every(Number.isFinite)) {
      return;
    }
    const rawDeltaX = clientX - centerX;
    const rawDeltaY = clientY - centerY;
    const rawDistance = Math.hypot(rawDeltaX, rawDeltaY);
    const distanceScale = rawDistance > maxDistance ? maxDistance / rawDistance : 1;
    const deltaX = rawDeltaX * distanceScale;
    const deltaY = rawDeltaY * distanceScale;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);
    const dominantAxisDistance = Math.max(absoluteDeltaX, absoluteDeltaY);
    const secondaryAxisDistance = Math.min(absoluteDeltaX, absoluteDeltaY);
    const diagonalRatio = dominantAxisDistance > 0 ? secondaryAxisDistance / dominantAxisDistance : 0;
    let diagonalCandidate = null;

    if (dominantAxisDistance > deadZone && diagonalRatio >= 0.72) {
      const horizontalDirection = deltaX < 0 ? "left" : "right";
      const verticalDirection = deltaY < 0 ? "up" : "down";
      diagonalCandidate = `${horizontalDirection}:${verticalDirection}`;
    }

    state.joystickClientX = clientX;
    state.joystickClientY = clientY;
    if (diagonalCandidate !== state.joystickDiagonalCandidate) {
      resetDiagonalHold();
      state.joystickClientX = clientX;
      state.joystickClientY = clientY;
      if (diagonalCandidate) {
        state.joystickDiagonalCandidate = diagonalCandidate;
        state.joystickDiagonalTimeoutId = setTimeout(() => {
          if (state.joystickPointerId === null || state.joystickDiagonalCandidate !== diagonalCandidate) {
            return;
          }
          state.joystickDiagonalReady = true;
          state.joystickDiagonalTimeoutId = null;
          navigator.vibrate?.(8);
          updateFromPointer(state.joystickClientX, state.joystickClientY);
        }, diagonalHoldMs);
      }
    }

    const shouldMoveDiagonally = diagonalCandidate !== null && state.joystickDiagonalReady;
    mobileJoystick.classList.toggle(
      "mobile-joystick-diagonal-pending",
      diagonalCandidate !== null && !shouldMoveDiagonally,
    );
    mobileJoystick.classList.toggle("mobile-joystick-diagonal-ready", shouldMoveDiagonally);

    resetMovementKeys();
    if (dominantAxisDistance > deadZone) {
      if (shouldMoveDiagonally || absoluteDeltaX > absoluteDeltaY) {
        keysPressed.left = deltaX < 0;
        keysPressed.right = deltaX > 0;
      }
      if (shouldMoveDiagonally || absoluteDeltaY > absoluteDeltaX) {
        keysPressed.up = deltaY < 0;
        keysPressed.down = deltaY > 0;
      }
    }

    const isMoving = keysPressed.left || keysPressed.right || keysPressed.up || keysPressed.down;
    if (isMoving && !state.joystickWasMoving) {
      cancelPlayerNavigation();
    }
    state.joystickWasMoving = isMoving;
    if (mobileJoystickKnob) {
      mobileJoystickKnob.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0px)`;
    }
  };

  return { placeAtPointer, reset, resetDiagonalHold, updateFromPointer };
};
