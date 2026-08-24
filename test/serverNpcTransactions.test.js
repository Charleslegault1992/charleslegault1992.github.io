import assert from "node:assert/strict";
import test from "node:test";

import { createSpeakToNpcAction } from "../src/actions/gameplayActions.js";
import { createItemInstance } from "../src/items/itemFactory.js";
import { getPlayerGoldAmount } from "../src/inventory/inventoryTransactions.js";
import { createAuthoritativeWorldRuntime } from "../server/authoritativeWorldRuntime.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";

const speak = (runtime, session, player, text) =>
  runtime.dispatchAction(session, createSpeakToNpcAction(text, player.uid, 0));

test("server NPC sales and bank deposits commit complete transactions", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let now = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => now });
  const session = {};
  session.playerUid = runtime.connectClient(session, {
    accountId: "trade",
    characterId: "merchant",
    language: "fr",
  }).playerUid;
  const player = runtime.getPlayer(session.playerUid);
  const ben = [...runtime.getWorldEntities().npcs.values()].find((npc) => npc.npcId === "ben");
  const charles = [...runtime.getWorldEntities().npcs.values()].find((npc) => npc.npcId === "charles");
  const bag = createItemInstance("bag", 1);
  bag.content[0] = createItemInstance("apple", 2);
  player.equipment.backpack = bag;
  Object.assign(player, { x: ben.x, y: ben.y, z: ben.z });

  assert.equal(speak(runtime, session, player, "salut").success, true);
  const buyMenu = speak(runtime, session, player, "achat");
  const buyMenuReply = buyMenu.events.find((event) => event.type === "npc-spoke");
  assert.equal(buyMenuReply.text, "Quelle categorie veux-tu acheter?");
  assert.ok(buyMenuReply.suggestions.includes("Provisions"));
  const suppliesMenu = speak(runtime, session, player, "provisions");
  const suppliesMenuReply = suppliesMenu.events.find((event) => event.type === "npc-spoke");
  assert.equal(suppliesMenuReply.text, "Quel article dans Provisions veux-tu acheter?");
  assert.ok(suppliesMenuReply.suggestions.includes("Pomme"));
  const armorMenu = speak(runtime, session, player, "armures");
  const armorMenuReply = armorMenu.events.find((event) => event.type === "npc-spoke");
  assert.ok(armorMenuReply.suggestions.includes("Armure de cuir"));
  const armorConfirmation = speak(runtime, session, player, "Armure de cuir");
  assert.match(armorConfirmation.events.find((event) => event.type === "npc-spoke").text, /Armure de cuir/);
  assert.equal(speak(runtime, session, player, "non").success, true);
  const saleConfirmation = speak(runtime, session, player, "vendre 2 pommes");
  assert.equal(saleConfirmation.success, true);
  assert.match(saleConfirmation.events.find((event) => event.type === "npc-spoke").text, /2 Pommes/);
  const sale = speak(runtime, session, player, "oui");
  assert.equal(sale.success, true);
  assert.equal(getPlayerGoldAmount(player), 2);
  assert.equal(bag.content.some((item) => item?.itemId === "apple"), false);

  Object.assign(player, { x: charles.x, y: charles.y, z: charles.z });
  now += 61000;
  runtime.update(now);
  assert.equal(speak(runtime, session, player, "salut").success, true);
  assert.equal(speak(runtime, session, player, "deposer tout").success, true);
  const deposit = speak(runtime, session, player, "oui");

  assert.equal(deposit.success, true);
  assert.equal(getPlayerGoldAmount(player), 0);
  assert.equal(player.bank.goldBalance, 2);
});
