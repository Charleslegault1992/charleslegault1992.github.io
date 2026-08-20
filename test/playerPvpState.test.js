import assert from "node:assert/strict";
import test from "node:test";

import {
  applyUnjustifiedPvpAggression,
  canInitiatePlayerPvpAttack,
  createPlayerPvpState,
  expirePlayerPvpState,
  recordUnjustifiedPlayerKill,
} from "../src/combat/playerPvpState.js";

test("PVP initiation requires attacker mode unless the target has an active skull", () => {
  const now = 1000;
  const attacker = { pvp: createPlayerPvpState() };
  const target = { pvp: createPlayerPvpState() };

  assert.equal(canInitiatePlayerPvpAttack(attacker, target, now), false);
  target.pvp.enabled = true;
  assert.equal(canInitiatePlayerPvpAttack(attacker, target, now), false);
  attacker.pvp.enabled = true;
  assert.equal(canInitiatePlayerPvpAttack(attacker, target, now), true);
  attacker.pvp.enabled = false;
  applyUnjustifiedPvpAggression(target, now);
  assert.equal(canInitiatePlayerPvpAttack(attacker, target, now), true);
});

test("unjustified aggression gives a white skull that expires", () => {
  const player = { pvp: createPlayerPvpState() };
  const startedAt = 1000;

  assert.equal(applyUnjustifiedPvpAggression(player, startedAt), true);
  assert.equal(player.pvp.enabled, true);
  assert.equal(player.pvp.skullType, "white");
  assert.equal(expirePlayerPvpState(player, player.pvp.skullExpiresAt - 1), false);
  assert.equal(expirePlayerPvpState(player, player.pvp.skullExpiresAt), true);
  assert.equal(player.pvp.skullType, "none");
});

test("three unjustified kills inside the rolling window give a red skull", () => {
  const player = { pvp: createPlayerPvpState() };
  const startedAt = 1000;

  recordUnjustifiedPlayerKill(player, startedAt);
  recordUnjustifiedPlayerKill(player, startedAt + 1000);
  assert.equal(player.pvp.skullType, "white");
  recordUnjustifiedPlayerKill(player, startedAt + 2000);

  assert.equal(player.pvp.skullType, "red");
  assert.equal(player.pvp.unjustifiedKillTimestamps.length, 3);
});
