import assert from "node:assert/strict";
import test from "node:test";

import { createServerFieldEffectSystem } from "../server/serverFieldEffectSystem.js";
import { createSpatialEntityStore } from "../server/spatialEntityStore.js";

const createFieldSystemFixture = ({ decayStage = 0 } = {}) => {
  const groundEffects = createSpatialEntityStore();
  const monsters = createSpatialEntityStore();
  const player = { uid: "player:test", x: 64, y: 128, z: 0, hp: 100, statusEffects: {} };
  const players = new Map([[player.uid, player]]);
  groundEffects.add({
    uid: 1,
    groundEffectId: "fireField",
    x: player.x,
    y: player.y,
    z: player.z,
    decayStage,
    isPermanent: false,
    ownerUid: null,
  });
  const damageTicks = [];
  const system = createServerFieldEffectSystem({
    groundEffects,
    players,
    monsters,
    applyDamageTick: ({ entity, damage, damageType }) => {
      entity.hp -= damage;
      damageTicks.push({ damage, damageType });
      return { success: true, events: [] };
    },
  });
  return { player, system, damageTicks };
};

test("a dangerous field applies decreasing damage over time", () => {
  const { player, system, damageTicks } = createFieldSystemFixture();
  assert.equal(system.applyFieldAtEntity(player, "player", 1000), true);

  for (let now = 3000; now <= 13000; now += 2000) {
    system.update(now);
  }

  assert.deepEqual(damageTicks.map((tick) => tick.damage), [12, 10, 8, 6, 4, 2]);
  assert.equal(player.hp, 58);
  assert.equal(player.statusEffects.burning.active, false);
});

test("the second field stage is weaker and the last stage is harmless", () => {
  const weaker = createFieldSystemFixture({ decayStage: 1 });
  assert.equal(weaker.system.applyFieldAtEntity(weaker.player, "player", 0), true);
  weaker.system.update(2000);
  assert.equal(weaker.damageTicks[0].damage, 6);

  const harmless = createFieldSystemFixture({ decayStage: 2 });
  assert.equal(harmless.system.applyFieldAtEntity(harmless.player, "player", 0), false);
  harmless.system.update(2000);
  assert.deepEqual(harmless.damageTicks, []);
});

test("a cure removes its matching status immediately", () => {
  const { player, system } = createFieldSystemFixture();
  system.applyFieldAtEntity(player, "player", 0);
  assert.equal(system.removeStatusEffect(player, "burning"), true);
  system.update(2000);
  assert.equal(player.hp, 100);
});
