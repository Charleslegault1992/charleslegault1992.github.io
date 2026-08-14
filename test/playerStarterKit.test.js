import assert from "node:assert/strict";
import test from "node:test";

import { applyPlayerStarterKit } from "../src/player/playerStarterKit.js";
import { createPlayerState } from "../src/state/playerState.js";

test("the starter kit is granted once with the expected equipped items", () => {
  const player = createPlayerState();

  assert.equal(applyPlayerStarterKit(player), true);
  assert.equal(player.equipment.weapon.itemId, "mace");
  assert.equal(player.equipment.ammo.itemId, "torch");
  assert.equal(player.equipment.backpack.itemId, "bag");
  assert.deepEqual(
    player.equipment.backpack.content.map((item) => item.itemId),
    ["apple", "healthPotion", "manaPotion"],
  );
  assert.equal(player.progress.starterKitGranted, true);
  assert.equal(player.carriedWeight > 0, true);

  const firstBackpackUid = player.equipment.backpack.uid;
  assert.equal(applyPlayerStarterKit(player), false);
  assert.equal(player.equipment.backpack.uid, firstBackpackUid);
});

test("an existing equipped character is marked without receiving duplicate items", () => {
  const player = createPlayerState();
  player.equipment.weapon = { uid: 9001, itemId: "sword", quantity: 1 };

  assert.equal(applyPlayerStarterKit(player), true);
  assert.equal(player.equipment.weapon.itemId, "sword");
  assert.equal(player.equipment.backpack, null);
  assert.equal(player.progress.starterKitGranted, true);
});
