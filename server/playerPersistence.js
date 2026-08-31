import { normalizePlayerPvpState } from "../src/combat/playerPvpState.js";
import { allocateItemUid, observeExistingItemUid } from "../src/state/uidAllocator.js";

const PLAYER_SCALAR_FIELDS = [
  "name",
  "appearanceId",
  "hp",
  "maxHp",
  "mana",
  "maxMana",
  "sanity",
  "maxSanity",
  "level",
  "speed",
  "experience",
  "classId",
  "carriedWeight",
  "capacity",
  "combatMode",
  "direction",
  "x",
  "y",
  "z",
  "oldX",
  "oldY",
];

const PLAYER_OBJECT_FIELDS = [
  "appearanceParts",
  "appearanceColors",
  "spawn",
  "bank",
  "skills",
  "spellbook",
  "spellEffects",
  "cooldowns",
  "progress",
  "equipment",
  "pvp",
];

export const hydratePlayerFromPersistence = (player, snapshot) => {
  if (!player || !snapshot || typeof snapshot !== "object") {
    return false;
  }
  for (const field of PLAYER_SCALAR_FIELDS) {
    if (field in snapshot) {
      player[field] = snapshot[field];
    }
  }
  for (const field of PLAYER_OBJECT_FIELDS) {
    if (snapshot[field] && typeof snapshot[field] === "object") {
      player[field] = structuredClone(snapshot[field]);
    }
  }
  if (!(snapshot.pvp && typeof snapshot.pvp === "object") && typeof snapshot.pvpEnabled === "boolean") {
    player.pvp.enabled = snapshot.pvpEnabled;
  }
  player.pvp = normalizePlayerPvpState(player.pvp);
  player.renderX = player.x;
  player.renderY = player.y;
  player.moveStartTime = 0;
  player.moveDuration = 0;
  return true;
};

const collectItemTree = (item, items) => {
  if (!item || !Array.isArray(items)) {
    return;
  }
  items.push(item);
  if (Array.isArray(item.content)) {
    for (const contentItem of item.content) {
      collectItemTree(contentItem, items);
    }
  }
};

export const collectItemTreeUids = (item, itemUids) => {
  if (!item || !(itemUids instanceof Set)) {
    return itemUids;
  }
  if (Number.isSafeInteger(item.uid) && item.uid > 0) {
    itemUids.add(item.uid);
  }
  if (Array.isArray(item.content)) {
    for (const contentItem of item.content) {
      collectItemTreeUids(contentItem, itemUids);
    }
  }
  return itemUids;
};

export const ensureUniquePlayerItemUids = (player, occupiedItemUids) => {
  if (!player?.equipment || !(occupiedItemUids instanceof Set)) {
    return false;
  }

  const playerItems = [];
  for (const equipmentItem of Object.values(player.equipment)) {
    collectItemTree(equipmentItem, playerItems);
  }

  for (const itemUid of occupiedItemUids) {
    observeExistingItemUid(itemUid);
  }
  for (const item of playerItems) {
    observeExistingItemUid(item.uid);
  }

  let didChange = false;
  const assignedItemUids = new Set(occupiedItemUids);
  for (const item of playerItems) {
    if (!Number.isSafeInteger(item.uid) || item.uid <= 0 || assignedItemUids.has(item.uid)) {
      let nextUid = allocateItemUid();
      while (assignedItemUids.has(nextUid)) {
        nextUid = allocateItemUid();
      }
      item.uid = nextUid;
      didChange = true;
    }
    assignedItemUids.add(item.uid);
  }
  return didChange;
};
