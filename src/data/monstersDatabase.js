import { SPRITE_SIZE } from "../core/gameConstants.js";

/* ---------- DATABASE - MONSTRES ---------- */

export const monstersDatabase = {
  rat: {
    monsterId: "rat",
    name: "Rat",
    desc: "A small but vicious rat.",
    suffix: "a",
    maxHp: 20,
    experience: 50,
    moveCooldown: 275,
    pathRefreshCooldown: 800,
    atlas: "monsters",
    atlasCol: 0,
    atlasRow: 0,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE,
    drawOffsetX: 0,
    drawOffsetY: 0,
    animationFrames: 3,
    spriteSize: SPRITE_SIZE,
    corpseItemId: "ratCorpse",
    bloodEffectId: "blood",
    combat: {
      attack: 4,
      armor: 1,
      defense: 1,
      blockChance: 3,
      hitChance: 70,
    },
    loot: [
      {
        itemId: "goldCoin",
        chance: 80,
        minQuantity: 1,
        maxQuantity: 4,
      },
      {
        itemId: "cheese",
        chance: 30,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
  spider: {
    monsterId: "spider",
    name: "Spider",
    desc: "A venomous spider.",
    suffix: "a",
    maxHp: 50,
    experience: 75,
    moveCooldown: 250,
    pathRefreshCooldown: 800,
    atlas: "monsters",
    atlasCol: 6,
    atlasRow: 0,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE,
    drawOffsetX: 0,
    drawOffsetY: 0,
    animationFrames: 3,
    spriteSize: SPRITE_SIZE,
    corpseItemId: "spiderCorpse",
    bloodEffectId: "greenBlood",
    combat: {
      attack: 8,
      armor: 2,
      defense: 3,
      blockChance: 8,
      hitChance: 75,
    },
    loot: [
      {
        itemId: "goldCoin",
        chance: 80,
        minQuantity: 1,
        maxQuantity: 7,
      },
      {
        itemId: "sword",
        chance: 20,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
  frog: {
    monsterId: "frog",
    name: "Frog",
    desc: "A small village frog.",
    suffix: "a",
    maxHp: 28,
    experience: 35,
    moveCooldown: 285,
    pathRefreshCooldown: 800,
    atlas: "monsters",
    atlasCol: 0,
    atlasRow: 4,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE,
    drawOffsetX: 0,
    drawOffsetY: 0,
    animationFrames: 3,
    spriteSize: SPRITE_SIZE,
    corpseItemId: "frogCorpse",
    bloodEffectId: "greenBlood",
    combat: {
      attack: 5,
      armor: 1,
      defense: 1,
      blockChance: 3,
      hitChance: 65,
    },
    loot: [
      { itemId: "goldCoin", chance: 60, minQuantity: 1, maxQuantity: 3 },
      { itemId: "chickenLeg", chance: 25, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  wildboar: {
    monsterId: "wildboar",
    name: "Wild Boar",
    desc: "A territorial wild boar.",
    suffix: "a",
    maxHp: 40,
    experience: 65,
    moveCooldown: 265,
    pathRefreshCooldown: 800,
    atlas: "monsters",
    atlasCol: 3,
    atlasRow: 4,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE,
    drawOffsetX: 0,
    drawOffsetY: 0,
    animationFrames: 3,
    spriteSize: SPRITE_SIZE,
    corpseItemId: "wildBoarCorpse",
    bloodEffectId: "blood",
    combat: {
      attack: 7,
      armor: 1,
      defense: 2,
      blockChance: 5,
      hitChance: 70,
    },
    loot: [
      { itemId: "goldCoin", chance: 80, minQuantity: 2, maxQuantity: 6 },
      { itemId: "meat", chance: 40, minQuantity: 1, maxQuantity: 1 },
      { itemId: "ham", chance: 20, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  scorpion: {
    monsterId: "scorpion",
    name: "Scorpion",
    desc: "A dangerous venomous scorpion.",
    suffix: "a",

    maxHp: 70,
    experience: 105,

    moveCooldown: 240,
    pathRefreshCooldown: 800,

    atlas: "monsters",
    atlasCol: 3,
    atlasRow: 0,

    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE,
    drawOffsetX: 0,
    drawOffsetY: 0,

    animationFrames: 3,
    spriteSize: SPRITE_SIZE,

    corpseItemId: "scorpionCorpse",
    bloodEffectId: "greenBlood",

    combat: {
      attack: 11,
      armor: 3,
      defense: 4,
      blockChance: 11,
      hitChance: 80,
    },

    loot: [
      {
        itemId: "goldCoin",
        chance: 100,
        minQuantity: 15,
        maxQuantity: 25,
      },
      {
        itemId: "woodenShield",
        chance: 20,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "wornBoots",
        chance: 20,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "leatherArmor",
        chance: 20,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "wandererHood",
        chance: 20,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "poisonRune",
        chance: 40,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "poisonFieldRune",
        chance: 10,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "shortSword",
        chance: 5,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
  forestGuardianBoss: {
    monsterId: "forestGuardianBoss",
    name: "Forest Guardian",
    desc: "An ancient living tree.",
    suffix: "a",

    maxHp: 140,
    experience: 160,

    moveCooldown: 260,
    pathRefreshCooldown: 600,

    atlas: "bossMonsters",
    atlasCol: 0,
    atlasRow: 0,
    atlasCellSize: 192,
    atlasPadding: 0,

    drawWidth: 192,
    drawHeight: 192,
    drawOffsetX: -64,
    drawOffsetY: -128,

    selectionOffsetX: 64,
    selectionOffsetY: 128,
    selectionWidth: 64,
    selectionHeight: 64,

    interactionHitboxes: [
      {
        offsetX: 64,
        offsetY: 64,
        width: 64,
        height: 64,
      },
      {
        offsetX: 64,
        offsetY: 128,
        width: 64,
        height: 64,
      },
    ],

    animationFrames: 3,
    spriteSize: 192,

    corpseItemId: "forestGuardianBossCorpse",
    bloodEffectId: "greenBlood",

    combat: {
      attack: 17,
      armor: 5,
      defense: 6,
      blockChance: 17,
      hitChance: 85,
    },

    loot: [
      {
        itemId: "goldCoin",
        chance: 100,
        minQuantity: 20,
        maxQuantity: 40,
      },
    ],
  },

  corruptedRootBoss: {
    monsterId: "corruptedRootBoss",
    name: "Corrupted Root",
    desc: "A twisted beast of bark and shadow.",
    suffix: "a",

    maxHp: 280,
    experience: 320,

    moveCooldown: 240,
    pathRefreshCooldown: 600,

    atlas: "bossMonsters",
    atlasCol: 3,
    atlasRow: 0,
    atlasCellSize: 192,
    atlasPadding: 0,

    drawWidth: 192,
    drawHeight: 192,
    drawOffsetX: -64,
    drawOffsetY: -128,

    selectionOffsetX: 64,
    selectionOffsetY: 128,
    selectionWidth: 64,
    selectionHeight: 64,

    interactionHitboxes: [
      {
        offsetX: 64,
        offsetY: 64,
        width: 64,
        height: 64,
      },
      {
        offsetX: 64,
        offsetY: 128,
        width: 64,
        height: 64,
      },
    ],

    animationFrames: 3,
    spriteSize: 192,

    corpseItemId: "corruptedRootBossCorpse",
    bloodEffectId: "blood",

    combat: {
      attack: 34,
      armor: 10,
      defense: 12,
      blockChance: 34,
      hitChance: 90,
    },

    loot: [
      {
        itemId: "goldCoin",
        chance: 100,
        minQuantity: 40,
        maxQuantity: 80,
      },
    ],
  },
};
