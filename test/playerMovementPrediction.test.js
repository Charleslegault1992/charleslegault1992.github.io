import assert from "node:assert/strict";
import test from "node:test";

import { createMovePlayerAction } from "../src/actions/gameplayActions.js";
import { createPlayerMovementPrediction } from "../src/network/playerMovementPrediction.js";

const createMove = (fromX, toX) =>
  createMovePlayerAction({
    fromX,
    fromY: 0,
    fromZ: 0,
    toX,
    toY: 0,
    direction: "right",
    isNavigationMovement: false,
    requestedAt: 1,
  });

test("movement prediction replays only unacknowledged actions", () => {
  const prediction = createPlayerMovementPrediction();
  const first = createMove(0, 64);
  const second = createMove(64, 128);
  prediction.enqueue(first);
  prediction.enqueue(second);

  assert.equal(prediction.reconcile({ x: 0, y: 0, z: 0 }).x, 128);
  assert.equal(prediction.reconcile({ x: 64, y: 0, z: 0 }, first.requestId).x, 128);
  assert.deepEqual(prediction.getPendingRequestIds(), [second.requestId]);
});

test("a rejected predicted movement is removed before replay", () => {
  const prediction = createPlayerMovementPrediction();
  const movement = createMove(0, 64);
  prediction.enqueue(movement);
  prediction.reject(movement.requestId);

  assert.equal(prediction.reconcile({ x: 0, y: 0, z: 0 }).x, 0);
});

test("movement prediction keeps the local movement animation timing", () => {
  const prediction = createPlayerMovementPrediction();
  const movement = createMove(0, 64);
  prediction.enqueue(movement);

  const predictedPlayer = prediction.reconcile({ x: 0, y: 0, z: 0, level: 50, speed: 1 });

  assert.equal(predictedPlayer.oldX, 0);
  assert.equal(predictedPlayer.x, 64);
  assert.equal(predictedPlayer.moveStartTime, movement.payload.requestedAt);
  assert.equal(predictedPlayer.moveDuration, 149);
});

test("movement prediction reports when a pending chain can no longer be replayed", () => {
  const prediction = createPlayerMovementPrediction();
  const first = createMove(0, 64);
  const second = createMove(64, 128);
  prediction.enqueue(first);
  prediction.enqueue(second);
  prediction.reject(first.requestId);

  const predictionState = prediction.reconcileWithState({ x: 0, y: 0, z: 0 });

  assert.equal(predictionState.player.x, 0);
  assert.equal(predictionState.appliedActionCount, 0);
  assert.deepEqual(prediction.getPendingRequestIds(), [second.requestId]);
});
