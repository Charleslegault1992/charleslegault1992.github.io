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
  assert.ok(buyMenuReply.suggestions.includes("Contenants"));
  const suppliesMenu = speak(runtime, session, player, "provisions");
  const suppliesMenuReply = suppliesMenu.events.find((event) => event.type === "npc-spoke");
  assert.equal(suppliesMenuReply.text, "Quel article dans Provisions veux-tu acheter?");
  assert.ok(suppliesMenuReply.suggestions.includes("Pomme"));
  const bagsMenu = speak(runtime, session, player, "contenants");
  const bagsMenuReply = bagsMenu.events.find((event) => event.type === "npc-spoke");
  assert.equal(bagsMenuReply.text, "Quel article dans Contenants veux-tu acheter?");
  assert.ok(bagsMenuReply.suggestions.includes("Sac"));
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

test("Kay heals to half health and limits free bags to five per server day", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let now = Date.UTC(2026, 7, 24, 12);
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => now });
  const session = {};
  session.playerUid = runtime.connectClient(session, {
    accountId: "support",
    characterId: "newcomer",
    language: "fr",
  }).playerUid;
  const player = runtime.getPlayer(session.playerUid);
  const kay = [...runtime.getWorldEntities().npcs.values()].find((npc) => npc.npcId === "kay");
  Object.assign(player, { x: kay.x, y: kay.y, z: kay.z, hp: 10, maxHp: 101 });

  const greeting = speak(runtime, session, player, "salut");
  assert.equal(greeting.success, true);
  assert.deepEqual(
    greeting.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Services", "A propos", "Bye"],
  );
  const services = speak(runtime, session, player, "services");
  assert.deepEqual(
    services.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Soin", "Sac", "Retour"],
  );
  const heal = speak(runtime, session, player, "soin");
  assert.equal(heal.success, true);
  assert.equal(player.hp, 51);
  assert.equal(heal.events.some((event) => event.type === "npc-heal-completed"), true);
  assert.deepEqual(
    heal.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Soin", "Sac", "Retour"],
  );

  const rootMenu = speak(runtime, session, player, "retour");
  assert.deepEqual(
    rootMenu.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Services", "A propos", "Bye"],
  );
  const aboutMenu = speak(runtime, session, player, "a propos");
  assert.deepEqual(
    aboutMenu.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Nom", "Job", "Retour"],
  );
  const nameReply = speak(runtime, session, player, "nom");
  assert.deepEqual(
    nameReply.events.find((event) => event.type === "npc-spoke").suggestions,
    ["Nom", "Job", "Retour"],
  );

  for (let count = 1; count <= 5; count++) {
    player.equipment.backpack = null;
    const bagResult = speak(runtime, session, player, "sac");
    assert.equal(bagResult.success, true);
    assert.equal(player.equipment.backpack?.itemId, "bag");
    assert.equal(player.progress.dailyNpcRewardsByNpcId.kay.count, count);
  }

  player.equipment.backpack = null;
  const limitedResult = speak(runtime, session, player, "sac");
  assert.equal(limitedResult.success, true);
  assert.equal(player.equipment.backpack, null);
  assert.match(limitedResult.events.find((event) => event.type === "npc-spoke").text, /demain/i);

  now += 24 * 60 * 60 * 1000;
  runtime.update(now);
  assert.equal(speak(runtime, session, player, "salut").success, true);
  const nextDayResult = speak(runtime, session, player, "sac");
  assert.equal(nextDayResult.success, true);
  assert.equal(player.equipment.backpack?.itemId, "bag");
  assert.equal(player.progress.dailyNpcRewardsByNpcId.kay.count, 1);
});

test("Kev offers every spell and enforces magic level before charging gold", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => 1000 });
  const session = {};
  session.playerUid = runtime.connectClient(session, {
    accountId: "magic",
    characterId: "student",
    language: "fr",
  }).playerUid;
  const player = runtime.getPlayer(session.playerUid);
  const kev = [...runtime.getWorldEntities().npcs.values()].find((npc) => npc.npcId === "kev");
  const bag = createItemInstance("bag", 1);
  bag.content[0] = createItemInstance("goldCoin", 100);
  player.equipment.backpack = bag;
  Object.assign(player, { x: kev.x, y: kev.y, z: kev.z });

  assert.equal(speak(runtime, session, player, "salut").success, true);
  const spellMenu = speak(runtime, session, player, "sorts");
  const spellMenuReply = spellMenu.events.find((event) => event.type === "npc-spoke");
  assert.equal(spellMenuReply.suggestions.length, 6);
  assert.match(spellMenuReply.text, /ML 5/);

  const blockedLesson = speak(runtime, session, player, "Soin du poison");
  assert.match(blockedLesson.events.find((event) => event.type === "npc-spoke").text, /niveau de magie 2/i);
  assert.equal(getPlayerGoldAmount(player), 100);
  assert.equal(player.spellbook.learnedSpellIds.includes("purgaVenenum"), false);

  player.skills.magic.level = 2;
  const lessonConfirmation = speak(runtime, session, player, "Soin du poison");
  assert.match(lessonConfirmation.events.find((event) => event.type === "npc-spoke").text, /80 pieces/i);
  const learned = speak(runtime, session, player, "oui");

  assert.equal(learned.success, true);
  assert.equal(getPlayerGoldAmount(player), 20);
  assert.equal(player.spellbook.learnedSpellIds.includes("purgaVenenum"), true);
});

test("Dave changes class at level 12 and Jenny keeps raid travel unavailable", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => 1000 });
  const session = {};
  session.playerUid = runtime.connectClient(session, {
    accountId: "services",
    characterId: "adventurer",
    language: "fr",
  }).playerUid;
  const player = runtime.getPlayer(session.playerUid);
  const npcs = [...runtime.getWorldEntities().npcs.values()];
  const dave = npcs.find((npc) => npc.npcId === "dave");
  const jenny = npcs.find((npc) => npc.npcId === "jenny");

  assert.ok(dave);
  assert.ok(jenny);
  Object.assign(player, { x: dave.x, y: dave.y, z: dave.z, level: 11 });
  assert.equal(speak(runtime, session, player, "salut").success, true);
  const blocked = speak(runtime, session, player, "chevalier");
  assert.match(blocked.events.find((event) => event.type === "npc-spoke").text, /niveau 12/i);
  assert.equal(player.classId, "noClass");

  player.level = 12;
  const confirmation = speak(runtime, session, player, "chevalier");
  assert.match(confirmation.events.find((event) => event.type === "npc-spoke").text, /devenir Chevalier/i);
  const changed = speak(runtime, session, player, "oui");
  assert.equal(player.classId, "knight");
  assert.equal(changed.events.some((event) => event.type === "npc-class-changed"), true);

  Object.assign(player, { x: jenny.x, y: jenny.y, z: jenny.z });
  runtime.update(62000);
  assert.equal(speak(runtime, session, player, "salut").success, true);
  const raids = speak(runtime, session, player, "raids");
  assert.match(raids.events.find((event) => event.type === "npc-spoke").text, /arrivent bientot/i);
  assert.equal(player.z, jenny.z);
});

test("Amanda sells localized food through the authoritative inventory transaction", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => 1000 });
  const session = {};
  session.playerUid = runtime.connectClient(session, {
    accountId: "food",
    characterId: "hungry",
    language: "fr",
  }).playerUid;
  const player = runtime.getPlayer(session.playerUid);
  const amanda = [...runtime.getWorldEntities().npcs.values()].find((npc) => npc.npcId === "amanda");
  const bag = createItemInstance("bag", 1);
  bag.content[0] = createItemInstance("goldCoin", 20);
  player.equipment.backpack = bag;
  Object.assign(player, { x: amanda.x, y: amanda.y, z: amanda.z });

  assert.ok(amanda);
  assert.equal(speak(runtime, session, player, "salut").success, true);
  const menu = speak(runtime, session, player, "achat");
  assert.deepEqual(menu.events.find((event) => event.type === "npc-spoke").suggestions, ["Nourriture"]);
  const confirmation = speak(runtime, session, player, "2 carottes");
  assert.match(confirmation.events.find((event) => event.type === "npc-spoke").text, /2 Carottes.*8 pieces/i);
  const purchase = speak(runtime, session, player, "oui");

  assert.equal(purchase.success, true);
  assert.equal(getPlayerGoldAmount(player), 12);
  assert.equal(bag.content.some((item) => item?.itemId === "carrot" && item.quantity === 2), true);
});
