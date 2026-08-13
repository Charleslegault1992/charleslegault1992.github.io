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
  player.renderX = player.x;
  player.renderY = player.y;
  player.moveStartTime = 0;
  player.moveDuration = 0;
  return true;
};
