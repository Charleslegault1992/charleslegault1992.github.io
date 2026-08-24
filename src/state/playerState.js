import {
  DEFAULT_CHARACTER_APPEARANCE_COLORS,
  DEFAULT_CHARACTER_APPEARANCE_PARTS,
  normalizeCharacterAppearanceColors,
  normalizeCharacterAppearanceParts,
} from "../characterSaveStore.js";
import { SPELL_HOTKEY_KEYS } from "../core/gameConstants.js";
import { DEFAULT_PLAYER_APPEARANCE_ID } from "../player/playerAppearance.js";
import { spellsDatabase } from "../spellDatabase.js";
import { createPlayerPvpState } from "../combat/playerPvpState.js";

const createDefaultPlayerSpellbook = () => {
  const learnedSpellIds = Object.values(spellsDatabase)
    .filter((spellData) => spellData.learnedByDefault === true)
    .map((spellData) => spellData.spellId);
  const hotkeySpellIds = Array(SPELL_HOTKEY_KEYS.length).fill(null);
  hotkeySpellIds[0] = learnedSpellIds[0] ?? null;
  return {
    learnedSpellIds,
    hotkeySpellIds,
  };
};

export const normalizePlayerSpellbook = (spellbook) => {
  const defaultSpellbook = createDefaultPlayerSpellbook();
  if (!spellbook || !Array.isArray(spellbook.learnedSpellIds) || !Array.isArray(spellbook.hotkeySpellIds)) {
    return defaultSpellbook;
  }

  const learnedSpellIds = [...new Set([...defaultSpellbook.learnedSpellIds, ...spellbook.learnedSpellIds])].filter(
    (spellId) => typeof spellId === "string" && spellId in spellsDatabase,
  );
  const learnedSpellIdSet = new Set(learnedSpellIds);
  const hotkeySpellIds = Array.from({ length: SPELL_HOTKEY_KEYS.length }, (_, index) => {
    const spellId = spellbook.hotkeySpellIds[index];
    return learnedSpellIdSet.has(spellId) ? spellId : null;
  });

  return {
    learnedSpellIds,
    hotkeySpellIds,
  };
};

export const createPlayerState = () => ({
  uid: "local-player",
  x: null,
  y: null,
  oldX: null,
  oldY: null,
  renderX: null,
  renderY: null,
  moveStartTime: 0,
  moveDuration: 0,
  tileStackOrder: 0,
  name: "Charles",
  language: "en",
  appearanceId: DEFAULT_PLAYER_APPEARANCE_ID,
  appearanceParts: normalizeCharacterAppearanceParts(DEFAULT_CHARACTER_APPEARANCE_PARTS),
  appearanceColors: normalizeCharacterAppearanceColors(DEFAULT_CHARACTER_APPEARANCE_COLORS),
  hp: 100,
  maxHp: 100,
  mana: 0,
  maxMana: 0,
  sanity: 0,
  maxSanity: 100,
  level: 0,
  experience: 0,
  classId: "noClass",
  gold: 0,
  bank: {
    goldBalance: 0,
  },
  damage: 5,
  z: 0,
  spawn: {
    z: 0,
    spawnId: "tiro",
  },
  skillTraining: {
    lastEffectiveHitAt: 0,
    shieldingBlockCount: 0,
    shieldingBlockCooldownStartedAt: 0,
  },
  regeneration: {
    nextHealthRegenAt: 0,
    nextManaRegenAt: 0,
    nextSanityDecayAt: 0,
  },
  spellEffects: {
    light: {
      radius: 0,
      expiresAt: 0,
    },
  },
  statusEffects: {},
  cooldowns: {
    item: 0,
    rune: 0,
    spell: 0,
  },
  spellbook: createDefaultPlayerSpellbook(),
  progress: {
    questsById: {},
    rewardClaimsByInteractableId: {},
    minimapExplorationByChunkKey: {},
  },
  skills: {
    magic: {
      level: 0,
      experience: 0,
    },
    fist: {
      level: 1,
      experience: 100,
    },
    sword: {
      level: 1,
      experience: 100,
    },
    mace: {
      level: 1,
      experience: 100,
    },
    axe: {
      level: 1,
      experience: 100,
    },
    distance: {
      level: 1,
      experience: 100,
    },
    shielding: {
      level: 1,
      experience: 100,
    },
  },
  carriedWeight: 0,
  capacity: 350,
  speed: 1,
  direction: "down",
  walkFrame: 1,
  light: 750,
  combatMode: "balanced",
  pvp: createPlayerPvpState(),
  equipment: {
    necklace: null,
    helmet: null,
    armor: null,
    shield: null,
    weapon: null,
    legs: null,
    ammo: null,
    ring: null,
    boots: null,
    backpack: null,
  },
});

export const playerState = createPlayerState();
