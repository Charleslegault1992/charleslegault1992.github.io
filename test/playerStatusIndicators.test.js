import assert from "node:assert/strict";
import test from "node:test";

import {
  getActivePlayerStatusIndicators,
  PLAYER_STATUS_INDICATOR,
} from "../src/player/playerStatusIndicators.js";

test("player status indicators contain only active authoritative states", () => {
  const now = 1000;
  const player = {
    pvp: { skullType: "white", skullExpiresAt: now + 5000 },
    combatLogoutExpiresAt: now + 120000,
    statusEffects: {
      poison: { expiresAt: now + 2000 },
      fire: { expiresAt: now - 1 },
    },
  };

  assert.deepEqual(getActivePlayerStatusIndicators(player, now, { isInProtectionZone: true }), [
    PLAYER_STATUS_INDICATOR.whiteSkull,
    PLAYER_STATUS_INDICATOR.poison,
    PLAYER_STATUS_INDICATOR.combat,
    PLAYER_STATUS_INDICATOR.protection,
  ]);
});

test("expired player status indicators disappear", () => {
  const now = 1000;
  const player = {
    pvp: { skullType: "red", skullExpiresAt: now },
    combatLogoutExpiresAt: now,
    statusEffects: {
      poison: { expiresAt: now },
      burning: { expiresAt: now },
    },
  };

  assert.deepEqual(getActivePlayerStatusIndicators(player, now), []);
});
