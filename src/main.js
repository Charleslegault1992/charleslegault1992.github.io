import {
  clearPixiItemUseTargets,
  clearPixiGroundEffectVisuals,
  clearPixiMonsterSelection,
  clearPixiMonsterVisuals,
  clearPixiWorldItemSelection,
  clearPixiWorldItemVisuals,
  drawPixiMinimapRegion,
  initializePixiRenderer,
  loadPixiWorldEntityTextures,
  playPixiItemProjectile,
  playPixiRewardChestEffect,
  playPixiSpellEffect,
  removePixiGroundEffectVisual,
  removePixiNpcVisual,
  removePixiMonsterVisual,
  removePixiWorldItemVisual,
  renderPixiVisibleWorldChunks,
  setPixiMonsterSelected,
  setPixiItemUseTargets,
  setPixiPlayerFrame,
  setPixiWorldItemSelected,
  updatePixiCamera,
  updatePixiMonsterTransform,
  updatePixiNpcTransform,
  updatePixiPlayerTransform,
  updatePixiWorldItemTransform,
  upsertPixiGroundEffectVisual,
  upsertPixiMonsterVisual,
  upsertPixiNpcVisual,
  upsertPixiWorldItemVisual,
} from "./pixiRenderer.js";
import { getWorldMapsDebugSummary, loadWorldMaps } from "./worldLoader.js";
import {
  createCharacterProfile,
  deleteCharacterProfile,
  listCharacterProfiles,
  loadCharacterSaveDocument,
  saveCharacterSnapshot,
  setActiveCharacterId,
} from "./characterSaveStore.js";
import {
  GAME_SFX,
  playGameSfx,
  preloadGameSfx,
  setGameAudioSettings,
  startGameMusic,
  stopGameMusic,
  unlockGameAudio,
} from "./audioManager.js";
import { spellsDatabase } from "./spellDatabase.js";

/* ==================================================== */
//#region     -----  BASE - ELEMENTS HTML  -----
/* ==================================================== */
const panneauGauche = document.querySelector(".jeux-gauche");
const panneauDroite = document.querySelector(".jeux-droite");
const boitePrincipale = document.querySelector("#boite-principal");
const playerMinimap = document.querySelector("#player-minimap");
const minimapCanvas = document.querySelector("#minimap-canvas");
const minimapZoomOutButton = document.querySelector("#minimap-zoom-out");
const minimapZoomInButton = document.querySelector("#minimap-zoom-in");
const minimapCenterButton = document.querySelector("#minimap-center");
const minimapZoomLevel = document.querySelector("#minimap-zoom-level");
const minimapFloorUpButton = document.querySelector("#minimap-floor-up");
const minimapFloorDownButton = document.querySelector("#minimap-floor-down");
const minimapFloorLevel = document.querySelector("#minimap-floor-level");
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const playerQuests = document.querySelector("#player-quests");
const gameOptionsWindow = document.querySelector("#game-options");
const playerSpells = document.querySelector("#player-spells");
const gameWelcome = document.querySelector("#game-welcome");
const gameWelcomePlayButton = document.querySelector("#game-welcome-play");
const gameWelcomeLanguageButtons = document.querySelectorAll("[data-game-language]");
const characterSelector = document.querySelector("#character-selector");
const playerContainers = document.querySelector("#player-containers");
const player = document.querySelector("#player");
const game = document.querySelector("#game");
const boiteJeux = document.querySelector("#boite-jeux");
const nav = document.querySelector(".navbar");
const entete = document.querySelector(".entete-jeux");
const boiteChat = document.querySelector("#boite-chat");
const chat = document.querySelector("#chat");
const chatTabs = document.querySelector("#chat-tabs");
const chatInput = document.querySelector("#chat-input");
const boiteJeuxInner = document.querySelector(".boite-jeux-inner");
const lightCanvas = document.querySelector("#light-canvas");
const fpsCounter = document.querySelector("#fps-counter");
const gameStatusMessage = document.querySelector("#game-status-message");
const mobileGameControls = document.querySelector("#mobile-game-controls");
const mobileJoystick = document.querySelector("#mobile-joystick");
const mobileJoystickKnob = document.querySelector("#mobile-joystick-knob");
const mobilePanelButtons = document.querySelectorAll("[data-mobile-panel]");
const mobileActionButtons = document.querySelectorAll("[data-mobile-action]");
const mobilePanelCloseButton = document.querySelector("#mobile-panel-close");
const mobilePlayerName = document.querySelector("#mobile-player-name");
const mobilePlayerLevel = document.querySelector("#mobile-player-level");
const mobilePlayerHealthFill = document.querySelector("#mobile-player-health-fill");
const mobilePlayerHealthValue = document.querySelector("#mobile-player-health-value");
const mobilePlayerManaFill = document.querySelector("#mobile-player-mana-fill");
const mobilePlayerManaValue = document.querySelector("#mobile-player-mana-value");
const mobilePlayerSanityFill = document.querySelector("#mobile-player-sanity-fill");
const mobilePlayerSanityValue = document.querySelector("#mobile-player-sanity-value");
const mobileTargetHud = document.querySelector("#mobile-target-hud");
const mobileTargetName = document.querySelector("#mobile-target-name");
const mobileTargetValue = document.querySelector("#mobile-target-value");
const mobileTargetHealthFill = document.querySelector("#mobile-target-health-fill");
const mobileItemUseIndicator = document.querySelector("#mobile-item-use-indicator");
const mobileItemUseIcon = document.querySelector("#mobile-item-use-icon");
const mobileItemUseLabel = document.querySelector("#mobile-item-use-label");
const mobileStanceIcon = document.querySelector("#mobile-stance-icon");
const mobileStanceLabel = document.querySelector("#mobile-stance-label");
//#endregion  -----  BASE - ELEMENTS HTML  -----

/* ==================================================== */
//#region     -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----
/* ==================================================== */
/* ---------- BASE - DIMENSIONS ET ATLAS ---------- */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
let GAME_SCALE = 1;
const TILE_SIZE = 64;
const MAX_ITEM_STACK_SIZE = 100;
const MAX_SURFACE_HEIGHT = 160;
const MAX_STEP_HEIGHT = 40;
const WORLD_RENDER_LAYER_SIZE = 100;
const WORLD_RENDER_LAYER_ITEM = 10;
const WORLD_RENDER_LAYER_CREATURE = 50;
const WORLD_RENDER_LAYER_EFFECT = 90;
const PLAYER_SIZE = TILE_SIZE;
const CHUNK_SIZE_TILES = 16;
const MOVE_SPEED = TILE_SIZE;
const MAP_COLS = GAME_WIDTH / TILE_SIZE;
const MAP_ROWS = GAME_HEIGHT / TILE_SIZE;
const SPRITE_SIZE = 64;
const ATLAS_CELL_SIZE = 66;
const ATLAS_PADDING = 1;
const TORCH_FUEL_REFRESH_INTERVAL_MS = 1000;
const TORCH_PLAYER_REVEAL_RADIUS = 64;
const MINIMAP_ZOOM_LEVELS = [3, 4, 6, 8, 12];
const MINIMAP_DEFAULT_CELL_SIZE = 6;
const MINIMAP_DYNAMIC_REFRESH_MS = 150;
const MINIMAP_AUTOWALK_MAX_DISTANCE_TILES = 30;
const MINIMAP_MONSTER_REVEAL_RANGE_TILES = 5;
const MINIMAP_DISCOVERY_RADIUS_X = Math.ceil(MAP_COLS / 2) + 1;
const MINIMAP_DISCOVERY_RADIUS_Y = Math.ceil(MAP_ROWS / 2) + 1;
const SPELL_HOTKEY_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const MOBILE_SPELL_LONG_PRESS_MS = 500;
const MOBILE_SPELL_PRESS_MOVE_TOLERANCE_PX = 12;

/* ---------- BASE - TILES ---------- */

const FLOOR = 0;
const WALL = 1;

/* ---------- BASE - UID ET SELECTION ---------- */

let nextItemInstanceId = 1;
let nextMonsterUid = 1;
let nextGroundEffectUid = 1;
let selectedMonsterUid = null;

/* ---------- BASE - COLLECTIONS MONDE ---------- */
const monsterElementsByUid = new Map();
const monstersByUid = new Map();
const monsterUidByTileKey = new Map();
const monsterUidsByChunkKey = new Map();
const npcElementsByUid = new Map();
const npcsByUid = new Map();
const npcUidByTileKey = new Map();
const npcConversationStatesByUid = new Map();
const worldItemElementsByUid = new Map();
const worldItemsByUid = new Map();
const worldTileStacksByKey = new Map();
const groundEffectsByUid = new Map();
const groundEffectUidByTileKey = new Map();
const activeLitTorchesByUid = new Map();
const renderState = {
  lastCameraX: null,
  lastCameraY: null,
};
const minimapRenderState = {
  context: minimapCanvas?.getContext("2d") ?? null,
  cellSize: MINIMAP_DEFAULT_CELL_SIZE,
  centerCol: null,
  centerRow: null,
  firstCol: null,
  firstRow: null,
  visibleCols: null,
  visibleRows: null,
  isFollowingPlayer: true,
  viewZ: null,
  discoveredTileIndexesByChunkKey: new Map(),
  lastPlayerCol: null,
  lastPlayerRow: null,
  lastZ: null,
  lastViewZ: null,
  lastDiscoveryCol: null,
  lastDiscoveryRow: null,
  lastDiscoveryZ: null,
  lastCenterCol: null,
  lastCenterRow: null,
  lastCellSize: null,
  nextDynamicRenderAt: 0,
  panPointerId: null,
  panStartClientX: null,
  panStartClientY: null,
  panStartCenterCol: null,
  panStartCenterRow: null,
  didPan: false,
};
const decayingItems = [];
const openedContainers = [];
const itemCooldownOverlayElements = new Set();

/* ---------- BASE - PLAYER OBJECT REFERENCE ---------- */
const playerRenderRefs = {
  root: player,
  hp: null,
  floatingText: null,
};

const initializePlayerRenderRefs = () => {
  playerRenderRefs.hp = playerRenderRefs.root?.querySelector(".php-red");
  playerRenderRefs.floatingText = playerRenderRefs.root?.querySelector(".player-floating-text-layer");
};

/* ---------- BASE - ETAT DRAG ---------- */
const dragState = {
  isDragging: false,
  item: null,
  sourceLocationType: null,
  sourceSlotIndex: null,
  sourceEquipmentSlotName: null,
  sourceParentContainerUid: null,
  sourceItemUid: null,
  pendingSourceLocation: null,
  pendingSlotElement: null,
  startScreenX: null,
  startScreenY: null,
};

/* ---------- BASE - SPAWN JOUEUR ---------- */

/* ---------- BASE - CAMERA ET SOURIS ---------- */
const camera = {
  x: 0,
  y: 0,
};

const minChatHeight = 120;

const mousePosition = {
  screenX: null,
  screenY: null,
  gameX: null,
  gameY: null,
  worldX: null,
  worldY: null,
  row: null,
  col: null,
  isInsideMap: false,
};

const pixiWorldRenderState = {
  worldMapsByZ: null,
  currentZ: 0,
  lastPlayerZ: null,
  lastPlayerChunkX: null,
  lastPlayerChunkY: null,
  visibleRadiusChunks: 1,
};
/* ---------- BASE - ETAT ITEM USE ---------- */

const itemUseState = {
  isUsingItem: false,
  source: null,
  item: null,
  useData: null,
  startedAt: null,
};
let gameStatusMessageTimeoutId = null;

const monsterSpawnStateById = new Map();
const monsterSpawnDefinitionsById = new Map();
const monsterRespawnEventHeap = [];
let nextMonsterRespawnEventOrder = 0;

const questUiState = {
  isOpen: false,
};

const spellUiState = {
  isOpen: false,
  selectedSpellId: null,
  mobileAssignHotkeyIndex: null,
};

const GAME_OPTIONS_STORAGE_KEY = "no-name-yet:game-options";
const SUPPORTED_GAME_LANGUAGES = new Set(["en", "fr"]);
const DEFAULT_GAME_OPTIONS = {
  showFps: true,
  showCreatureNames: true,
  showHealthBars: true,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.35,
  sfxVolume: 0.65,
  minimapCellSize: MINIMAP_DEFAULT_CELL_SIZE,
  language: "en",
};

const loadGameOptions = () => {
  try {
    const savedOptions = JSON.parse(localStorage.getItem(GAME_OPTIONS_STORAGE_KEY));
    const options = { ...DEFAULT_GAME_OPTIONS };
    for (const optionKey of ["showFps", "showCreatureNames", "showHealthBars", "musicEnabled", "sfxEnabled"]) {
      if (typeof savedOptions?.[optionKey] === "boolean") {
        options[optionKey] = savedOptions[optionKey];
      }
    }
    for (const volumeKey of ["musicVolume", "sfxVolume"]) {
      if (Number.isFinite(savedOptions?.[volumeKey])) {
        options[volumeKey] = Math.min(Math.max(savedOptions[volumeKey], 0), 1);
      }
    }
    if (SUPPORTED_GAME_LANGUAGES.has(savedOptions?.language)) {
      options.language = savedOptions.language;
    }
    if (MINIMAP_ZOOM_LEVELS.includes(savedOptions?.minimapCellSize)) {
      options.minimapCellSize = savedOptions.minimapCellSize;
    }
    return options;
  } catch {
    return { ...DEFAULT_GAME_OPTIONS };
  }
};

const gameOptionsUiState = {
  isOpen: false,
  values: loadGameOptions(),
};
minimapRenderState.cellSize = gameOptionsUiState.values.minimapCellSize;

const characterSelectorUiState = {
  isOpen: false,
};
const gameRuntimeState = {
  isStarting: false,
  isStarted: false,
  isLoopRunning: false,
  isSwitchingCharacter: false,
  autosaveIntervalId: null,
};
const CHARACTER_AUTOSAVE_INTERVAL_MS = 30000;
const ENTER_GAME_AFTER_RELOAD_SESSION_KEY = "no-name-yet:enter-game-after-reload";

//#endregion  -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----

/* ==================================================== */
//#region     -----  BASE DE DONNEES  -----
/* ==================================================== */
/* ---------- DATABASE - EFFETS DE SOL ---------- */

const GROUND_EFFECT_DECAY_STAGE_MS = 60000;
const groundEffectsDatabase = {
  healthPotionFluid: { atlasCol: 0, atlasRow: 0 },
  blood: { atlasCol: 3, atlasRow: 0 },
  manaPotionFluid: { atlasCol: 6, atlasRow: 0 },
  whiteFluid: { atlasCol: 9, atlasRow: 0 },
  lava: { atlasCol: 12, atlasRow: 0 },
  poison: { atlasCol: 15, atlasRow: 0 },
  greenBlood: { atlasCol: 18, atlasRow: 0 },
  purpleFluid: { atlasCol: 21, atlasRow: 0 },
  antidoteFluid: { atlasCol: 24, atlasRow: 0 },
};

/* ---------- DATABASE - ITEMS ---------- */

const itemsDatabase = {
  apple: {
    itemId: "apple",
    name: "Apple",
    desc: "An apple.",
    type: "food",
    suffix: "an",
    weight: 2,
    stackable: true,
    blockMovement: false,
    use: {
      mode: "direct",
      action: "eat",
      sanity: 4,
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 29,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  cheese: {
    itemId: "cheese",
    name: "Cheese",
    desc: "A piece of cheese.",
    type: "food",
    suffix: "a",
    weight: 3,
    stackable: true,
    blockMovement: false,
    use: {
      mode: "direct",
      action: "eat",
      sanity: 8,
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 20,
          atlasRow: 29,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  box: {
    itemId: "box",
    name: "Box",
    desc: "A big old box.",
    type: "container",
    suffix: "a",
    weight: 80,
    stackable: false,
    blockMovement: false,
    surfaceHeight: 77,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 2,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
        {
          atlasCol: 1,
          atlasRow: 2,
          offsetX: 0,
          offsetY: -SPRITE_SIZE,
          zOffset: 0,
        },
      ],
    },
  },
  smallBox: {
    itemId: "smallBox",
    name: "Small box",
    desc: "A small box.",
    type: "container",
    suffix: "a",
    weight: 50,
    stackable: false,
    blockMovement: false,
    surfaceHeight: 38,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 5,
          atlasRow: 2,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  healthPotion: {
    itemId: "healthPotion",
    name: "Health Potion",
    desc: "Drinking it might give you some benefit.",
    type: "consumable",
    suffix: "a",
    weight: 25,
    stackable: false,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 1,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
    use: {
      mode: "target",
      action: "drinkPotion",
      restoreStat: "hp",
      restoreAmount: 100,
      groundEffectId: "healthPotionFluid",
      emptyItemId: "emptyPotion",
      range: 1,
      cooldownGroup: "item",
    },
  },
  manaPotion: {
    itemId: "manaPotion",
    name: "Mana Potion",
    desc: "A potion filled with restorative mana fluid.",
    type: "consumable",
    suffix: "a",
    weight: 25,
    stackable: false,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [{ atlasCol: 1, atlasRow: 1, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
    use: {
      mode: "target",
      action: "drinkPotion",
      restoreStat: "mana",
      restoreAmount: 100,
      groundEffectId: "manaPotionFluid",
      emptyItemId: "emptyPotion",
      range: 1,
      cooldownGroup: "item",
    },
  },
  emptyPotion: {
    itemId: "emptyPotion",
    name: "Empty Potion",
    desc: "An empty potion bottle.",
    type: "misc",
    suffix: "an",
    weight: 5,
    stackable: false,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [{ atlasCol: 2, atlasRow: 1, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
  },
  torch: {
    itemId: "torch",
    name: "Torch",
    desc: "A torch that can light dark places.",
    type: "lightSource",
    equipmentSlot: ["ammo"],
    suffix: "a",
    weight: 12,
    stackable: false,
    blockMovement: false,
    use: {
      mode: "direct",
      action: "toggleTorch",
    },
    lightSource: {
      fuelDurationMs: 10 * 60 * 1000,
      radiusByStage: [750, 560, 360],
    },
    render: {
      atlas: "items",
      parts: [{ atlasCol: 0, atlasRow: 4, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
  },
  ratCorpse: {
    itemId: "ratCorpse",
    name: "Rat Corpse",
    desc: "A dead rat.",
    type: "corpse",
    suffix: "a",
    weight: 75,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 5,
    decayType: "monster",
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 3,
          atlasRow: 3,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  playerCorpse: {
    itemId: "playerCorpse",
    name: "Player Corpse",
    desc: "A dead player.",
    type: "corpse",
    suffix: "a",
    weight: 75,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 5,
    decayType: "player",
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 3,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  sword: {
    itemId: "sword",
    name: "Sword",
    desc: "An old rusty sword.",
    type: "weapon",
    equipmentSlot: ["weapon"],
    suffix: "a",
    weight: 25,
    stackable: false,
    blockMovement: false,
    combat: {
      weaponType: "sword",
      attack: 8,
      defense: 3,
      skillName: "sword",
      range: 1,
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 20,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  mace: {
    itemId: "mace",
    name: "Mace",
    desc: "A crude and unreliable mace.",
    type: "weapon",
    equipmentSlot: ["weapon"],
    suffix: "a",
    weight: 30,
    stackable: false,
    blockMovement: false,
    combat: {
      weaponType: "mace",
      attack: 6,
      defense: 1,
      skillName: "mace",
      range: 1,
    },
    render: {
      atlas: "items",
      parts: [{ atlasCol: 0, atlasRow: 22, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
  },
  arrow: {
    itemId: "arrow",
    name: "Arrow",
    desc: "A simple arrow.",
    type: "ammunition",
    equipmentSlot: ["shield"],
    suffix: "an",
    weight: 0.5,
    stackable: true,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [{ atlasCol: 0, atlasRow: 18, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
  },
  bow: {
    itemId: "bow",
    name: "Bow",
    desc: "A basic hunting bow.",
    type: "weapon",
    equipmentSlot: ["weapon"],
    suffix: "a",
    weight: 25,
    stackable: false,
    blockMovement: false,
    combat: {
      weaponType: "bow",
      attack: 7,
      skillName: "distance",
      range: 7,
      hitChanceModifier: -10,
      ammunitionItemId: "arrow",
      projectileItemId: "arrow",
    },
    render: {
      atlas: "items",
      parts: [{ atlasCol: 0, atlasRow: 16, offsetX: 0, offsetY: 0, zOffset: 0 }],
    },
  },
  woodenShield: {
    itemId: "woodenShield",
    name: "Wooden Shield",
    desc: "An old wooden shield",
    type: "shield",
    equipmentSlot: ["shield"],
    suffix: "a",
    weight: 35,
    stackable: false,
    blockMovement: false,
    combat: {
      shieldDefense: 14,
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 6,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  leatherArmor: {
    itemId: "leatherArmor",
    name: "Leather Armor",
    desc: "A classic leather armor.",
    type: "armor",
    equipmentSlot: ["armor"],
    suffix: "a",
    weight: 35,
    stackable: false,
    blockMovement: false,
    combat: {
      armor: 5,
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 9,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },

  spiderCorpse: {
    itemId: "spiderCorpse",
    name: "Spider Corpse",
    desc: "A dead spider.",
    type: "corpse",
    suffix: "a",
    weight: 100,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 5,
    decayType: "monster",
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 6,
          atlasRow: 3,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  bag: {
    itemId: "bag",
    name: "Bag",
    desc: "A bag. (Slot: 8)",
    type: "bag",
    equipmentSlot: ["backpack"],
    suffix: "a",
    weight: 15,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 8,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 11,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  goldCoin: {
    itemId: "goldCoin",
    name: "Gold Coin",
    desc: "A gold coin.",
    type: "currency",
    suffix: "a",
    weight: 0.1,
    stackable: true,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 5,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
  fireRune: {
    itemId: "fireRune",
    name: "Fire rune",
    desc: "A rune engraved with fire magic, ready to unleash a burning spell.",
    type: "rune",
    suffix: "a",
    weight: 5,
    stackable: false,
    blockMovement: false,
    use: {
      mode: "target",
      action: "attackRune",
      damage: 6,
      charges: 5,
      range: 7,
      cooldownGroup: "magic",
    },
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 25,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
};

/* ---------- DATABASE - MONSTRES ---------- */

const monstersDatabase = {
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
};

/* ---------- DATABASE - NPCS ---------- */

const npcsDatabase = {
  kay: {
    npcId: "kay",
    name: "Kay",
    desc: "A helpful resident of Tiro.",
    suffix: "a",
    textureUrl: new URL("./assets/images/npc/Kay.png", import.meta.url).href,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE * 2,
    spriteSize: SPRITE_SIZE,
    animationFrames: 4,
    direction: "down",
    maxHp: 100,
    movement: {
      enabled: true,
      roamRadiusTiles: 2,
      intervalMinMs: 10000,
      intervalMaxMs: 20000,
      moveCooldownMs: 350,
    },
    dialogue: {
      en: {
        greeting: "Hello, {playerName}. Welcome to Tiro.",
        greetingSuggestions: ["name", "job", "help", "bye"],
        name: "My name is Kay.",
        job: "I help new adventurers find their way around Tiro.",
        help: "You can ask me about my name or my job.",
        unknown: "I am not sure what you mean.",
        farewell: "Goodbye, {playerName}.",
        rudeDeparture: "Wow, okay... ghosted in person. How rude!",
        timeoutFarewell: "You are not talking anymore? All right, goodbye!",
      },
      fr: {
        greeting: "Salut, {playerName}! Bienvenue a Tiro. Prends tes aises.",
        greetingSuggestions: ["nom", "job", "aide", "bye"],
        name: "Moi, c'est Kay.",
        job: "J'aide les nouveaux aventuriers a se retrouver dans Tiro.",
        help: "Demande-moi mon nom, ma job ou un coup de main.",
        unknown: "Hmm... je te suis pas trop, la.",
        farewell: "A la prochaine, {playerName}! Fais attention a toi.",
        rudeDeparture: "Wow, OK... ghostee en pleine face. C'est rough!",
        timeoutFarewell: "Tu ne parles plus? Bon, je vais prendre ca pour un au revoir!",
      },
    },
  },
  ben: {
    npcId: "ben",
    name: "Ben",
    desc: "A merchant from Tiro.",
    suffix: "a",
    textureUrl: new URL("./assets/images/npc/Ben.png", import.meta.url).href,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE * 2,
    spriteSize: SPRITE_SIZE,
    animationFrames: 4,
    direction: "down",
    maxHp: 100,
    movement: {
      enabled: true,
      roamRadiusTiles: 1,
      intervalMinMs: 12000,
      intervalMaxMs: 22000,
      moveCooldownMs: 350,
    },
    service: {
      type: "itemShop",
      offers: {
        apple: { buyPrice: 3, sellPrice: 1, keywords: ["apple", "pomme"] },
        healthPotion: { buyPrice: 20, sellPrice: 8, keywords: ["health", "vie"] },
        manaPotion: { buyPrice: 20, sellPrice: 8, keywords: ["mana"] },
        torch: { buyPrice: 15, sellPrice: 5, keywords: ["torch", "torche"] },
        mace: { buyPrice: 30, sellPrice: 12, keywords: ["mace", "masse"] },
        sword: { buyPrice: null, sellPrice: 25, keywords: ["sword", "epee"] },
      },
    },
    dialogue: {
      en: {
        greeting: "Hello, {playerName}. I buy and sell useful supplies.",
        greetingSuggestions: ["Buy", "Sell", "Bye"],
        confirmationSuggestions: ["yes", "no"],
        name: "My name is Ben.",
        job: "I trade equipment and supplies.",
        help: "Ask me for a trade, then say buy or sell with an item name.",
        trade: "I sell apples, health potions, mana potions, torches and maces.",
        buyMenu: "What do you want to buy?",
        sellMenu: "What do you want to sell?",
        confirmBuy: "Do you want to buy {quantity} {itemName} for {price} gold?",
        confirmSell: "Do you want to sell {quantity} {itemName} for {price} gold?",
        confirmRequired: "Say yes to confirm or no to cancel.",
        cancelled: "No problem. The deal is cancelled.",
        bought: "Here you go: {quantity} {itemName} for {price} gold.",
        sold: "Deal. I paid {price} gold for {quantity} {itemName}.",
        notEnoughGold: "You do not have enough gold.",
        missingItem: "You do not have that item in your backpack.",
        noRoom: "Make some room in your backpack first.",
        unavailable: "I do not trade that item.",
        unknown: "Say trade, buy or sell and the item you want.",
        farewell: "Goodbye, {playerName}.",
        rudeDeparture: "Leaving mid-deal? In this economy? Wild.",
        timeoutFarewell: "You are not answering? I will close the deal. Goodbye!",
      },
      fr: {
        greeting: "Salut, {playerName}! J'achete et je vends du stock utile.",
        greetingSuggestions: ["Achat", "Vente", "Bye"],
        confirmationSuggestions: ["oui", "non"],
        name: "Moi, c'est Ben.",
        job: "Je vends de l'equipement et des provisions.",
        help: "Demande-moi mes offres, puis dis acheter ou vendre avec le nom de l'objet.",
        trade: "Je vends des pommes, des potions de vie et de mana, des torches et des masses.",
        buyMenu: "Qu'est-ce que tu veux acheter?",
        sellMenu: "Qu'est-ce que tu veux vendre?",
        confirmBuy: "Veux-tu acheter {quantity} {itemName} pour {price} pieces d'or?",
        confirmSell: "Veux-tu vendre {quantity} {itemName} pour {price} pieces d'or?",
        confirmRequired: "Dis oui pour confirmer ou non pour annuler.",
        cancelled: "Pas de trouble. Le deal est annule.",
        bought: "Tiens: {quantity} {itemName} pour {price} pieces d'or.",
        sold: "Vendu. Je te donne {price} pieces d'or pour {quantity} {itemName}.",
        notEnoughGold: "Tu n'as pas assez de pieces d'or.",
        missingItem: "Tu n'as pas cet objet dans ton sac.",
        noRoom: "Fais un peu de place dans ton sac avant.",
        unavailable: "Je ne fais pas d'echange avec cet objet-la.",
        unknown: "Dis offres, acheter ou vendre avec le nom de l'objet.",
        farewell: "A la prochaine, {playerName}!",
        rudeDeparture: "Partir en plein deal? Dans cette economie? Sauvage.",
        timeoutFarewell: "Tu ne reponds plus? Je ferme le deal. Au revoir!",
      },
    },
  },
  kev: {
    npcId: "kev",
    name: "Kev",
    desc: "A teacher of magic.",
    suffix: "a",
    textureUrl: new URL("./assets/images/npc/Kev.png", import.meta.url).href,
    drawWidth: SPRITE_SIZE,
    drawHeight: SPRITE_SIZE * 2,
    spriteSize: SPRITE_SIZE,
    animationFrames: 4,
    direction: "down",
    maxHp: 100,
    movement: {
      enabled: true,
      roamRadiusTiles: 1,
      intervalMinMs: 14000,
      intervalMaxMs: 24000,
      moveCooldownMs: 350,
    },
    service: {
      type: "spellTeacher",
      spellIds: ["cura"],
    },
    dialogue: {
      en: {
        greeting: "Greetings, {playerName}. I can teach you magic.",
        greetingSuggestions: ["Spells", "Bye"],
        confirmationSuggestions: ["yes", "no"],
        name: "I am Kev.",
        job: "I teach spells to adventurers.",
        help: "Ask me about spells, or ask me for healing.",
        spells: "I can teach the Healing Spell for 40 gold.",
        confirmLearn: "Do you want to learn the {spellName} for {price} gold?",
        confirmRequired: "Say yes to learn it or no to cancel.",
        cancelled: "Very well. No lesson today.",
        learned: "You have learned the {spellName}. You can cast it by saying \"{incantation}\".",
        alreadyLearned: "You already know that spell.",
        notEnoughGold: "Come back with {price} gold and I will teach you.",
        unavailable: "I cannot teach that spell.",
        unknown: "Ask me about spells or ask me for healing.",
        farewell: "May your magic guide you, {playerName}.",
        rudeDeparture: "Vanishing mid-lesson? Your manners need more training than your magic.",
        timeoutFarewell: "You are not talking anymore? We will continue another time. Farewell!",
      },
      fr: {
        greeting: "Salut, {playerName}. Je peux t'enseigner la magie.",
        greetingSuggestions: ["Sorts", "Bye"],
        confirmationSuggestions: ["oui", "non"],
        name: "Moi, c'est Kev.",
        job: "J'enseigne des sorts aux aventuriers.",
        help: "Demande-moi mes sorts, ou demande-moi un sort de soin.",
        spells: "Je peux t'apprendre le sort de soin pour 40 pieces d'or.",
        confirmLearn: "Veux-tu apprendre le {spellName} pour {price} pieces d'or?",
        confirmRequired: "Dis oui pour apprendre le sort ou non pour annuler.",
        cancelled: "Comme tu veux. Pas de cours aujourd'hui.",
        learned: "Tu connais maintenant le {spellName}. Tu peux le lancer en disant \"{incantation}\".",
        alreadyLearned: "Tu connais deja ce sort-la.",
        notEnoughGold: "Reviens avec {price} pieces d'or et je vais te l'apprendre.",
        unavailable: "Je ne peux pas t'enseigner ce sort-la.",
        unknown: "Demande-moi mes sorts ou demande-moi un sort de soin.",
        farewell: "Que ta magie te guide, {playerName}.",
        rudeDeparture: "Disparaitre en plein cours? Tes manieres ont plus besoin d'entrainement que ta magie.",
        timeoutFarewell: "Tu ne parles plus? On va reprendre ca une autre fois. Au revoir!",
      },
    },
  },
};

/* ---------- DATABASE - RECOMPENSES ---------- */

const rewardTablesDatabase = {
  tiro_cave_spider_reward: {
    rewardTableId: "tiro_cave_spider_reward",
    items: [
      { itemId: "healthPotion", quantity: 1 },
      { itemId: "sword", quantity: 1 },
      { itemId: "torch", quantity: 1 },
    ],
  },
};

/* ---------- DATABASE - QUETES ---------- */

const QUEST_STATUS = {
  started: "started",
  completed: "completed",
};

const questsDatabase = {
  tiro_cave_spider_treasure: {
    questId: "tiro_cave_spider_treasure",
    name: "Spider Cave Treasure",
    description: "You found the treasure hidden in the spider cave.",
  },
};
//#endregion  -----  BASE DE DONNEES  -----

/* ==================================================== */
//#region     -----  CORE - TIMING ET COOLDOWNS  -----
/* ==================================================== */
/* ---------- TIMING - BOUCLE DE JEU ---------- */

const GAME_LOGIC_STEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 250;
const MAX_LOGIC_STEPS_PER_FRAME = 5;

let previousFrameTime = null;
let accumulatedLogicTime = 0;

let fpsFrameCount = 0;
let fpsLastUpdateTime = 0;
let currentFps = 0;

/* ---------- TIMING - DECAY ---------- */

const DECAY_REFRESH_COOLDOWN_MS = 1000;
let nextDecayRefresh = 0;
let nextGroundEffectDecayRefresh = 0;
let nextTorchFuelRefresh = 0;
let corpseDecayCooldown = {
  player: {
    stage0: 600000,
    stage1: 900000,
    stage2: 1800000,
  },
  monster: {
    stage0: 120000,
    stage1: 180000,
    stage2: 300000,
  },
};

/* ---------- TIMING - JOUEUR ---------- */

let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;

let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;

const SKILL_TRAINING_COOLDOWN_MS = 45000;
const SHIELDING_BLOCK_COOLDOWN_MS = 2000;
const SHIELDING_MAX_BLOCKS_PER_COOLDOWN = 2;
const SKILL_EXPERIENCE_GAIN_PER_TRY = 25;
const SANITY_DECAY_INTERVAL_MS = 6000;

/* ---------- TIMING - MONSTRES ---------- */

const MONSTER_ATTACK_COOLDOWN_MS = 1500;
const MONSTER_RESPAWN_CONFIG = {
  blockedRetryMs: 30000,
  playerBlockRangeX: Math.ceil(MAP_COLS / 2) + 2,
  playerBlockRangeY: Math.ceil(MAP_ROWS / 2) + 2,
  maxEventsPerLogicStep: 20,
};
const MONSTER_AI_STATE = {
  idle: "idle",
  wander: "wander",
  chase: "chase",
  combat: "combat",
  flee: "flee",
};

const MONSTER_AI_CONFIG = {
  wakeRangeX: Math.ceil(MAP_COLS / 2) + 4,
  wakeRangeY: Math.ceil(MAP_ROWS / 2) + 4,
  sleepRangeX: Math.ceil(MAP_COLS / 2) + 8,
  sleepRangeY: Math.ceil(MAP_ROWS / 2) + 8,
  visionX: Math.ceil(MAP_COLS / 2) + 1,
  visionY: Math.ceil(MAP_ROWS / 2) + 1,
  deaggroX: Math.ceil(MAP_COLS / 2) + 5,
  deaggroY: Math.ceil(MAP_ROWS / 2) + 5,
  hearingScanRange: 8,
  maxHearingPathLength: 8,
  maxChasePathLength: 18,
  maxBadPathDurationMs: 2000,
  combatDanceCooldownMinMs: 2000,
  combatDanceCooldownMaxMs: 5300,
  blockedChaseMoveCooldownMinMs: 1000,
  blockedChaseMoveCooldownMaxMs: 1800,
  dynamicPathRefreshCooldownMs: 300,
  aggroCheckCooldownMinMs: 200,
  aggroCheckCooldownMaxMs: 350,
  wanderRadiusTiles: 4,
  idleDurationMinMs: 1200,
  idleDurationMaxMs: 3000,
  wanderStepCooldownMinMs: 450,
  wanderStepCooldownMaxMs: 900,
  wanderStepsMin: 1,
  wanderStepsMax: 3,
};

const MONSTER_AI_CHUNK_RADIUS = Math.ceil(
  Math.max(
    MONSTER_AI_CONFIG.wakeRangeX,
    MONSTER_AI_CONFIG.wakeRangeY,
    MONSTER_AI_CONFIG.sleepRangeX,
    MONSTER_AI_CONFIG.sleepRangeY,
    MONSTER_AI_CONFIG.deaggroX,
    MONSTER_AI_CONFIG.deaggroY,
  ) / CHUNK_SIZE_TILES,
);

/* ---------- TIMING - NPCS ---------- */

const NPC_DIALOGUE_CONFIG = {
  talkRange: 3,
  responseDelayMs: 500,
  lineIntervalMs: 900,
  conversationTimeoutMs: 60000,
  maxQueuedReplies: 8,
};

/* ---------- TIMING - ITEM USE ---------- */

const useCooldown = {
  magic: 2000,
  item: 1000,
};

const nextUseCooldown = {
  magic: 0,
  item: 0,
};
//#endregion  -----  CORE - TIMING ET COOLDOWNS  -----

/* ==================================================== */
//#region     -----  PLAYER - CONFIG SPRITE  -----
/* ==================================================== */
const PLAYER_FRAME_WIDTH = TILE_SIZE;
const PLAYER_FRAME_HEIGHT = TILE_SIZE * 2;
const PLAYER_ANIMATION_FRAMES = 4;
const DEFAULT_PLAYER_APPEARANCE_ID = "male";
const playerAppearancesDatabase = {
  male: {
    appearanceId: "male",
    label: "Boy",
    textureUrl: new URL("./assets/images/joueurs/walkingsheet.png", import.meta.url).href,
  },
  female: {
    appearanceId: "female",
    label: "Girl",
    textureUrl: new URL("./assets/images/joueurs/walkingsheetF.png", import.meta.url).href,
  },
};

const getPlayerAppearanceData = (appearanceId = playerState?.appearanceId) => {
  return playerAppearancesDatabase[appearanceId] ?? playerAppearancesDatabase[DEFAULT_PLAYER_APPEARANCE_ID];
};
//#endregion  -----  PLAYER - CONFIG SPRITE  -----

/* ==================================================== */
//#region     -----  PLAYER  -----
/* ==================================================== */
/* ---------- JOUEUR - DONNEES ---------- */

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

const normalizePlayerSpellbook = (spellbook) => {
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

const playerState = {
  uid: "local-player",
  x: null,
  y: null,
  oldX: null,
  oldY: null,
  renderX: null,
  renderY: null,
  moveStartTime: 0,
  moveDuration: 0,
  name: "Charles",
  appearanceId: DEFAULT_PLAYER_APPEARANCE_ID,
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
};

/* ---------- JOUEUR - SAUVEGARDE ---------- */

const serializeCharacterItem = (item) => {
  if (!item) {
    return null;
  }

  const serializedItem = {
    uid: item.uid,
    itemId: item.itemId,
    quantity: item.quantity,
  };

  if (Number.isInteger(item.charges)) {
    serializedItem.charges = item.charges;
  }
  if (Number.isInteger(item.decayStage)) {
    serializedItem.decayStage = item.decayStage;
  }
  if (Number.isFinite(item.nextDecayAt)) {
    serializedItem.nextDecayAt = item.nextDecayAt;
  }
  if (typeof item.isLit === "boolean") {
    serializedItem.isLit = item.isLit;
  }
  if (Number.isFinite(item.fuelRemainingMs)) {
    serializedItem.fuelRemainingMs = item.fuelRemainingMs;
  }
  if (Array.isArray(item.content)) {
    serializedItem.content = Array.from(item.content, (contentItem) => serializeCharacterItem(contentItem));
  }

  return serializedItem;
};

const createCharacterSaveSnapshot = () => {
  syncActiveTorchFuel(Date.now());

  const skills = {};
  for (const [skillKey, skill] of Object.entries(playerState.skills)) {
    skills[skillKey] = {
      experience: skill.experience,
    };
  }

  const equipment = {};
  for (const [slotName, item] of Object.entries(playerState.equipment)) {
    equipment[slotName] = serializeCharacterItem(item);
  }

  return {
    uid: playerState.uid,
    name: playerState.name,
    appearanceId: playerState.appearanceId,
    classId: playerState.classId,
    position: {
      x: playerState.x,
      y: playerState.y,
      z: playerState.z,
      direction: playerState.direction,
    },
    spawn: {
      z: playerState.spawn.z,
      spawnId: playerState.spawn.spawnId,
    },
    vitals: {
      hp: playerState.hp,
      mana: playerState.mana,
      sanity: playerState.sanity,
    },
    progression: {
      experience: playerState.experience,
      skills,
    },
    spellbook: structuredClone(playerState.spellbook),
    progress: {
      questsById: structuredClone(playerState.progress.questsById),
      rewardClaimsByInteractableId: structuredClone(playerState.progress.rewardClaimsByInteractableId),
      minimapExplorationByChunkKey: serializeMinimapExploration(),
    },
    combatMode: playerState.combatMode,
    equipment,
  };
};

const collectCharacterItemUids = (item, itemUids) => {
  if (!item || !(itemUids instanceof Set)) {
    return;
  }
  itemUids.add(item.uid);
  if (Array.isArray(item.content)) {
    for (const contentItem of item.content) {
      collectCharacterItemUids(contentItem, itemUids);
    }
  }
};

const removeCurrentEquipmentFromDecayTracking = () => {
  const equipmentItemUids = new Set();
  for (const item of Object.values(playerState.equipment)) {
    collectCharacterItemUids(item, equipmentItemUids);
  }
  for (let index = decayingItems.length - 1; index >= 0; index--) {
    if (equipmentItemUids.has(decayingItems[index]?.uid)) {
      decayingItems.splice(index, 1);
    }
  }
  for (const itemUid of equipmentItemUids) {
    activeLitTorchesByUid.delete(itemUid);
  }
};

const restoreCharacterItem = (serializedItem, restoredItemUids) => {
  if (
    !serializedItem ||
    !Number.isInteger(serializedItem.uid) ||
    restoredItemUids.has(serializedItem.uid) ||
    !getItemData(serializedItem.itemId) ||
    !Number.isInteger(serializedItem.quantity) ||
    serializedItem.quantity <= 0
  ) {
    return null;
  }

  const itemData = getItemData(serializedItem.itemId);
  const item = {
    uid: serializedItem.uid,
    itemId: serializedItem.itemId,
    quantity: serializedItem.quantity,
  };

  restoredItemUids.add(item.uid);
  nextItemInstanceId = Math.max(nextItemInstanceId, item.uid + 1);

  if (Number.isInteger(serializedItem.charges)) {
    item.charges = serializedItem.charges;
  }

  if (itemData.lightSource) {
    item.fuelRemainingMs = Number.isFinite(serializedItem.fuelRemainingMs)
      ? clamp(serializedItem.fuelRemainingMs, 0, itemData.lightSource.fuelDurationMs)
      : itemData.lightSource.fuelDurationMs;
    item.isLit = serializedItem.isLit === true && item.fuelRemainingMs > 0;
    item.lastFuelUpdateAt = item.isLit ? Date.now() : 0;
    if (item.isLit) {
      activeLitTorchesByUid.set(item.uid, item);
    }
  }

  if (itemData.container) {
    const serializedContent = Array.isArray(serializedItem.content) ? serializedItem.content : [];
    item.content = Array.from(serializedContent, (contentItem) => restoreCharacterItem(contentItem, restoredItemUids));
  }

  if (itemData.decayType) {
    const decayCooldown = corpseDecayCooldown[itemData.decayType];
    item.decayStage = Number.isInteger(serializedItem.decayStage) ? serializedItem.decayStage : 0;
    item.nextDecayAt = Number.isFinite(serializedItem.nextDecayAt)
      ? serializedItem.nextDecayAt
      : Date.now() + decayCooldown.stage0;
    decayingItems.push(item);
  }

  return item;
};

const applyCharacterSaveSnapshot = (characterSnapshot) => {
  if (!characterSnapshot?.progression || !characterSnapshot?.equipment) {
    return false;
  }

  removeCurrentEquipmentFromDecayTracking();

  playerState.uid = characterSnapshot.uid;
  playerState.name = characterSnapshot.name;
  playerState.appearanceId = getPlayerAppearanceData(characterSnapshot.appearanceId).appearanceId;
  playerState.classId = characterSnapshot.classId;
  playerState.experience = characterSnapshot.progression.experience;
  playerState.spellbook = normalizePlayerSpellbook(characterSnapshot.spellbook);
  playerState.spawn = structuredClone(characterSnapshot.spawn);
  playerState.progress = {
    questsById: structuredClone(characterSnapshot.progress?.questsById ?? {}),
    rewardClaimsByInteractableId: structuredClone(characterSnapshot.progress?.rewardClaimsByInteractableId ?? {}),
    minimapExplorationByChunkKey: structuredClone(characterSnapshot.progress?.minimapExplorationByChunkKey ?? {}),
  };
  hydrateMinimapExploration(playerState.progress.minimapExplorationByChunkKey);
  playerState.combatMode = characterSnapshot.combatMode;

  for (const [skillKey, skill] of Object.entries(playerState.skills)) {
    const savedSkill = characterSnapshot.progression.skills?.[skillKey];
    if (Number.isFinite(savedSkill?.experience)) {
      skill.experience = savedSkill.experience;
    }
    skill.level = getSkillLevelFromExperience(skill.experience);
  }

  const restoredItemUids = new Set();
  for (const slotName of Object.keys(playerState.equipment)) {
    playerState.equipment[slotName] = restoreCharacterItem(characterSnapshot.equipment[slotName], restoredItemUids);
  }

  playerState.level = getLevelFromExperience(playerState.experience);
  syncPlayerDerivedStats();
  playerState.hp = clamp(characterSnapshot.vitals?.hp ?? playerState.maxHp, 0, playerState.maxHp);
  playerState.mana = clamp(characterSnapshot.vitals?.mana ?? playerState.maxMana, 0, playerState.maxMana);
  playerState.sanity = clamp(characterSnapshot.vitals?.sanity ?? 0, 0, playerState.maxSanity);
  resetPlayerRegenerationTimers();
  updatePlayerCarriedWeight();
  return true;
};

const applyCharacterSavePosition = (characterSnapshot, worldMapsByZ) => {
  const position = characterSnapshot?.position;
  const worldMap = worldMapsByZ?.get(position?.z);
  if (!worldMap || !Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    return false;
  }

  const col = position.x / TILE_SIZE;
  const row = position.y / TILE_SIZE;
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !getWorldChunkForTilePosition(worldMap, col, row) ||
    isTiledCollisionAtTile(worldMap, col, row)
  ) {
    return false;
  }

  playerState.z = position.z;
  playerState.direction = position.direction;
  pixiWorldRenderState.currentZ = playerState.z;
  return setPlayerWorldPosition(position.x, position.y);
};

const loadInitialCharacterSnapshot = () => {
  const loadResult = loadCharacterSaveDocument();
  if (!loadResult.success) {
    if (loadResult.reason === "not-initialized" && loadResult.entry) {
      playerState.uid = loadResult.entry.characterId;
      playerState.name = loadResult.entry.name;
      playerState.appearanceId = getPlayerAppearanceData(loadResult.entry.appearanceId).appearanceId;
    }
    return null;
  }

  const characterSnapshot = loadResult.document.character;
  if (!applyCharacterSaveSnapshot(characterSnapshot)) {
    return null;
  }
  return characterSnapshot;
};

const saveCurrentCharacter = () => {
  const saveResult = saveCharacterSnapshot(createCharacterSaveSnapshot());
  showGameStatusMessage(
    saveResult.success ? getGameUiText("characterSaved") : getGameUiText("characterSaveFailed"),
  );
  return saveResult.success;
};

const autosaveCurrentCharacter = () => {
  if (!gameRuntimeState.isStarted || gameRuntimeState.isSwitchingCharacter) {
    return false;
  }
  return saveCharacterSnapshot(createCharacterSaveSnapshot()).success;
};

const startCharacterAutosave = () => {
  if (gameRuntimeState.autosaveIntervalId !== null) {
    return;
  }
  gameRuntimeState.autosaveIntervalId = window.setInterval(() => {
    autosaveCurrentCharacter();
  }, CHARACTER_AUTOSAVE_INTERVAL_MS);
};

/* ---------- JOUEUR - AFFICHAGE ---------- */

const showPlayerName = (name) => {
  const playerName = document.createElement("div");
  playerName.classList.add("name");
  playerName.textContent = `${name}`;
  player.appendChild(playerName);
};

const getDirectionRow = (playerDirection) => {
  if (playerDirection === "down") {
    return 0;
  } else if (playerDirection === "left") {
    return 1;
  } else if (playerDirection === "right") {
    return 2;
  } else if (playerDirection === "up") {
    return 3;
  }
  return 0;
};

const updatePlayerSprite = () => {
  const colonne = playerState.walkFrame;
  const ligne = getDirectionRow(playerState.direction);
  const sourceX = colonne * PLAYER_FRAME_WIDTH;
  const sourceY = ligne * PLAYER_FRAME_HEIGHT;
  setPixiPlayerFrame({
    sourceX,
    sourceY,
    sourceWidth: PLAYER_FRAME_WIDTH,
    sourceHeight: PLAYER_FRAME_HEIGHT,
  });
};

const updatePlayerPosition = () => {
  const surfaceOffsetY = getEntitySurfaceOffsetY(playerState);
  const renderX = playerState.renderX;
  const renderY = playerState.renderY - TILE_SIZE - surfaceOffsetY;
  const zIndex = getWorldRenderZIndex(getEntityRenderSortY(playerState), WORLD_RENDER_LAYER_CREATURE);

  updatePixiPlayerTransform({ x: renderX, y: renderY, zIndex });

  player.style.left = `${renderX - camera.x}px`;
  player.style.top = `${renderY - camera.y}px`;
  player.style.zIndex = zIndex;
};

/* ---------- JOUEUR - SKILLS / EXPERIENCE ---------- */
const normalizeSkillExperienceGain = (experienceGain) => {
  if (!Number.isFinite(experienceGain) || experienceGain <= 0) {
    return 0;
  }
  return Math.max(Math.round(experienceGain), 1);
};

const refreshSkillTrainingTimer = (now) => {
  if (!Number.isInteger(now)) {
    return;
  }
  playerState.skillTraining.lastEffectiveHitAt = now;
};

const isSkillTrainingTimerActive = (now) => {
  if (!Number.isInteger(now)) {
    return false;
  }

  const lastEffectiveHitAt = playerState.skillTraining.lastEffectiveHitAt;
  if (!lastEffectiveHitAt) {
    return false;
  }

  return now - lastEffectiveHitAt <= SKILL_TRAINING_COOLDOWN_MS;
};

const resetShieldingBlockCooldownIfNeeded = (now) => {
  if (playerState.skillTraining.shieldingBlockCooldownStartedAt === 0) {
    playerState.skillTraining.shieldingBlockCooldownStartedAt = now;
    return;
  }
  if (playerState.skillTraining.shieldingBlockCooldownStartedAt + SHIELDING_BLOCK_COOLDOWN_MS <= now) {
    playerState.skillTraining.shieldingBlockCount = 0;
    playerState.skillTraining.shieldingBlockCooldownStartedAt = now;
  }
};

const canUseShieldingBlock = (now) => {
  resetShieldingBlockCooldownIfNeeded(now);
  if (playerState.skillTraining.shieldingBlockCount >= SHIELDING_MAX_BLOCKS_PER_COOLDOWN) {
    return false;
  } else {
    return true;
  }
};

const recordShieldingBlock = (now) => {
  resetShieldingBlockCooldownIfNeeded(now);
  playerState.skillTraining.shieldingBlockCount += 1;
};

const applyShieldingExperienceFromBlockAttempt = (now) => {
  if (!isSkillTrainingTimerActive(now)) {
    return false;
  }
  const baseExp = SKILL_EXPERIENCE_GAIN_PER_TRY;
  const expMultiplier = getSkillExperienceGainMultiplier("shielding");
  const finalExp = normalizeSkillExperienceGain(baseExp * expMultiplier);
  applyExperienceToPlayerSkill("shielding", finalExp);
  return true;
};

/* ---------- JOUEUR - CLASSES ---------- */
const playerClassesDatabase = {
  noClass: {
    classId: "noClass",
    name: "Classless",
    skillExperienceMultipliers: {
      fist: 0.5,
      sword: 0.5,
      mace: 0.5,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.5,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 5,
      mana: 5,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 6000,
      manaAmount: 1,
      manaIntervalMs: 6000,
    },
  },
  knight: {
    classId: "knight",
    name: "Knight",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 1.35,
      mace: 1.35,
      axe: 1.35,
      distance: 0.7,
      shielding: 1.35,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 15,
      mana: 5,
      capacity: 25,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 3000,
      manaAmount: 1,
      manaIntervalMs: 6000,
    },
  },

  archer: {
    classId: "archer",
    name: "Archer",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.7,
      mace: 0.7,
      axe: 0.7,
      distance: 1.35,
      shielding: 0.85,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 10,
      mana: 7,
      capacity: 20,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 4000,
      manaAmount: 1,
      manaIntervalMs: 4000,
    },
  },

  mage: {
    classId: "mage",
    name: "Mage",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.5,
      mace: 0.5,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.5,
      magic: 1.45,
    },
    levelUpGains: {
      hp: 5,
      mana: 30,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 6000,
      manaAmount: 1,
      manaIntervalMs: 3000,
    },
  },

  priest: {
    classId: "priest",
    name: "Priest",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.5,
      mace: 0.7,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.6,
      magic: 1.35,
    },
    levelUpGains: {
      hp: 7,
      mana: 30,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 4000,
      manaAmount: 1,
      manaIntervalMs: 3000,
    },
  },
};

const getPlayerClassData = () => {
  const classId = playerState.classId;
  if (classId in playerClassesDatabase) {
    return playerClassesDatabase[classId];
  }
  return playerClassesDatabase.noClass;
};

const getPlayerClassRegenerationData = () => {
  const classData = getPlayerClassData();
  if (classData?.regeneration) {
    return classData.regeneration;
  }
  return playerClassesDatabase.noClass.regeneration;
};

const getPlayerBaseStats = () => {
  return {
    maxHp: 100,
    maxMana: 0,
    maxSanity: 100,
    capacity: 350,
  };
};

const getPlayerDerivedStats = () => {
  const baseStats = getPlayerBaseStats();
  const classData = getPlayerClassData();
  if (!classData || !baseStats) {
    return baseStats;
  }
  const level = playerState.level;
  const maxHp = baseStats.maxHp + level * classData.levelUpGains.hp;
  const maxMana = baseStats.maxMana + level * classData.levelUpGains.mana;
  const maxSanity = baseStats.maxSanity;
  const capacity = baseStats.capacity + level * classData.levelUpGains.capacity;

  return {
    maxHp,
    maxMana,
    maxSanity,
    capacity,
  };
};

const syncPlayerDerivedStats = () => {
  const playerDerivedStats = getPlayerDerivedStats();
  if (!playerDerivedStats) {
    return;
  }
  playerState.maxHp = playerDerivedStats.maxHp;
  playerState.maxMana = playerDerivedStats.maxMana;
  playerState.maxSanity = playerDerivedStats.maxSanity;
  playerState.capacity = playerDerivedStats.capacity;
  if (playerState.hp > playerState.maxHp) {
    playerState.hp = playerState.maxHp;
  }
  if (playerState.mana > playerState.maxMana) {
    playerState.mana = playerState.maxMana;
  }
  if (playerState.sanity > playerState.maxSanity) {
    playerState.sanity = playerState.maxSanity;
  }
};

const getSkillExperienceGainMultiplier = (skillKey) => {
  const classData = getPlayerClassData();
  if (
    !classData ||
    !("skillExperienceMultipliers" in classData) ||
    !(skillKey in classData.skillExperienceMultipliers)
  ) {
    return 0.2;
  }
  return classData.skillExperienceMultipliers[skillKey];
};

/* ---------- JOUEUR - VIE ET MORT ---------- */

const resetPlayerPositionToSpawn = () => {
  if (!(pixiWorldRenderState?.worldMapsByZ instanceof Map) || !playerState?.spawn) {
    return;
  }

  if (
    !Number.isInteger(playerState.spawn.z) ||
    typeof playerState.spawn.spawnId !== "string" ||
    playerState.spawn.spawnId === ""
  ) {
    return;
  }
  const worldMap = pixiWorldRenderState.worldMapsByZ.get(playerState.spawn.z);
  if (!worldMap) {
    return;
  }
  const playerSpawn = findPlayerSpawnInWorldMap(worldMap, playerState.spawn.spawnId);
  if (!playerSpawn) {
    return;
  }
  playerState.z = playerState.spawn.z;
  pixiWorldRenderState.currentZ = playerState.z;
  applyPlayerSpawn(playerSpawn);
};

const hpRefresh = () => {
  const playerHp = playerRenderRefs.hp;
  if (playerHp) {
    playerHp.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
    playerHp.style.setProperty("--hp-color", getHpColor(playerState.hp, playerState.maxHp));
  }
};

const resetPlayerRegenerationTimers = () => {
  playerState.regeneration.nextHealthRegenAt = 0;
  playerState.regeneration.nextManaRegenAt = 0;
  playerState.regeneration.nextSanityDecayAt = 0;
};

const startPlayerRegenerationTimers = (now) => {
  const regenerationData = getPlayerClassRegenerationData();
  if (!Number.isFinite(now) || !regenerationData) {
    return false;
  }

  playerState.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  playerState.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  playerState.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
  return true;
};

const updatePlayerRegeneration = (now) => {
  if (!Number.isFinite(now) || !playerState.regeneration) {
    return;
  }
  if (playerState.sanity <= 0) {
    playerState.sanity = 0;
    resetPlayerRegenerationTimers();
    return;
  }

  const regenerationData = getPlayerClassRegenerationData();
  if (!regenerationData) {
    return;
  }
  if (
    playerState.regeneration.nextHealthRegenAt === 0 ||
    playerState.regeneration.nextManaRegenAt === 0 ||
    playerState.regeneration.nextSanityDecayAt === 0
  ) {
    startPlayerRegenerationTimers(now);
    return;
  }

  let didVitalChange = false;

  if (now >= playerState.regeneration.nextHealthRegenAt) {
    if (playerState.hp < playerState.maxHp) {
      playerState.hp = Math.min(playerState.hp + regenerationData.healthAmount, playerState.maxHp);
      didVitalChange = true;
    }
    playerState.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  }

  if (now >= playerState.regeneration.nextManaRegenAt) {
    if (playerState.mana < playerState.maxMana) {
      playerState.mana = Math.min(playerState.mana + regenerationData.manaAmount, playerState.maxMana);
      didVitalChange = true;
    }
    playerState.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  }

  if (now >= playerState.regeneration.nextSanityDecayAt) {
    playerState.sanity = Math.max(playerState.sanity - 1, 0);
    didVitalChange = true;
    if (playerState.sanity > 0) {
      playerState.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
    } else {
      resetPlayerRegenerationTimers();
    }
  }

  if (didVitalChange) {
    refreshPlayerVitalsUi();
  }
};

const applyPlayerDeathExperiencePenalty = () => {
  playerState.experience = Math.floor(playerState.experience * 0.9);
  if (playerState.experience < 0) {
    playerState.experience = 0;
  }
};

const dropPlayerCorpse = () => {
  const bag = getEquipmentSlotItem("backpack");
  if (bag) {
    closeContainerAndChildren(bag);
    playerState.equipment.backpack = null;
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, playerState.z, [bag]));
  } else {
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, playerState.z));
  }
};

const restoreHp = (creature) => {
  if (!creature || !("hp" in creature) || !("maxHp" in creature)) {
    return;
  }
  creature.hp = creature.maxHp;
};

const playerDead = () => {
  dropPlayerCorpse();
  refreshItemUiAfterDrag();
  applyPlayerDeathExperiencePenalty();
  restoreHp(playerState);
  resetPlayerPositionToSpawn();
  resetAfterDeath();
};

const resetAfterDeath = () => {
  selectedMonsterUid = null;
  stopPlayerNavigation();
  cancelItemDrag();
  cancelItemUse();
  clearMonsterSelection();
  syncMobileTargetHud();
  clearMonsters();
  clearGroundItemRender();
  updatePixiVisibleChunksAroundPlayer();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  updateWorldRender();
  updatePlayerExperience();
  refreshPlayerVitalsUi();
  closeAllContainer();
};

//#endregion  -----  PLAYER  -----

/* ==================================================== */
//#region     -----  CAMERA  -----
/* ==================================================== */
/* ---------- CAMERA - POSITION ---------- */

const updateCamera = () => {
  camera.x = playerState.renderX + TILE_SIZE / 2 - GAME_WIDTH / 2;
  camera.y = playerState.renderY + TILE_SIZE / 2 - GAME_HEIGHT / 2;
};
//#endregion  -----  CAMERA  -----

/* ==================================================== */
//#region     -----  MAP  -----
/* ==================================================== */
/* ---------- MAP - DONNEES ---------- */

const gameMap = [
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1,
  ],
];

const mapWidth = gameMap[0].length * TILE_SIZE;
const mapHeight = gameMap.length * TILE_SIZE;

const currentMap = {
  data: gameMap,
  dark: true,
};

/* ---------- MAP - COLLISIONS ET LIMITES ---------- */

const isInsideMap = (testX, testY) => {
  return testX >= 0 && testX <= mapWidth - PLAYER_SIZE && testY >= 0 && testY <= mapHeight - PLAYER_SIZE;
};

const canStepFromTileToTile = (fromX, fromY, toX, toY, z) => {
  const fromHeight = getWorldTileSurfaceHeight(fromX, fromY, z);
  const toHeight = getWorldTileSurfaceHeight(toX, toY, z);
  const heightDifference = toHeight - fromHeight;
  return heightDifference <= MAX_STEP_HEIGHT;
};

const canMoveTo = (fromX, fromY, testX, testY) => {
  if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(testX) || !Number.isFinite(testY)) {
    return false;
  }
  const nextCol = testX / TILE_SIZE;
  const nextRow = testY / TILE_SIZE;
  if (!Number.isInteger(nextCol) || !Number.isInteger(nextRow)) {
    return false;
  }
  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }
  if (isTiledCollisionAtTile(currentWorldMap, nextCol, nextRow)) {
    return false;
  }
  if (!canStepFromTileToTile(fromX, fromY, testX, testY, playerState.z)) {
    return false;
  }
  return true;
};
//#endregion  -----  MAP  -----

/* ==================================================== */
//#region     -----  CORE - OUTILS / HELPERS  -----
/* ==================================================== */
/* ---------- OUTILS - MATH ET DISTANCE ---------- */

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

const getChunkPositionFromWorldPosition = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  return { chunkX, chunkY };
};

const getWorldChunkForTilePosition = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  const chunkKey = `${worldMap.z}:${chunkX}:${chunkY}`;
  return worldMap.chunksByKey.get(chunkKey) ?? null;
};

const getLocalTileIndexInChunk = (col, row) => {
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const localCol = ((col % CHUNK_SIZE_TILES) + CHUNK_SIZE_TILES) % CHUNK_SIZE_TILES;
  const localRow = ((row % CHUNK_SIZE_TILES) + CHUNK_SIZE_TILES) % CHUNK_SIZE_TILES;
  const index = localRow * CHUNK_SIZE_TILES + localCol;
  return index;
};

const getCollisionGidAtTile = (worldMap, col, row) => {
  if (!worldMap || !Number.isInteger(col) || !Number.isInteger(row)) {
    return 0;
  }
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  const index = getLocalTileIndexInChunk(col, row);
  if (!chunk || !Number.isInteger(index)) {
    return 0;
  }
  const collisionLayer = chunk.layers?.collision ?? null;
  if (!Array.isArray(collisionLayer)) {
    return 0;
  }
  const gid = collisionLayer[index] ?? 0;
  return gid;
};

const getWorldLayerGidAtTile = (worldMap, layerName, col, row) => {
  if (!worldMap || typeof layerName !== "string" || !Number.isInteger(col) || !Number.isInteger(row)) {
    return 0;
  }
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  const index = getLocalTileIndexInChunk(col, row);
  if (!chunk || !Number.isInteger(index)) {
    return 0;
  }
  const layer = chunk.layers?.[layerName];
  if (!Array.isArray(layer)) {
    return 0;
  }
  return layer[index] ?? 0;
};

const getMinimapTileColor = (worldMap, col, row) => {
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk) {
    return "#050505";
  }
  if (getWorldLayerGidAtTile(worldMap, "ground", col, row) <= 0) {
    return "#0b0a09";
  }
  if (getWorldLayerGidAtTile(worldMap, "collision", col, row) > 0) {
    return "#312e28";
  }
  if (
    getWorldLayerGidAtTile(worldMap, "walls", col, row) > 0 ||
    getWorldLayerGidAtTile(worldMap, "objects", col, row) > 0
  ) {
    return "#554b3b";
  }
  if (getWorldLayerGidAtTile(worldMap, "groundDetails", col, row) > 0) {
    return "#756b56";
  }
  return "#91846a";
};

const getMinimapExplorationChunkKey = (z, col, row) => {
  if (!Number.isInteger(z) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  const chunkX = Math.floor(col / CHUNK_SIZE_TILES);
  const chunkY = Math.floor(row / CHUNK_SIZE_TILES);
  return `${z}:${chunkX}:${chunkY}`;
};

const serializeMinimapExploration = () => {
  const serializedExploration = {};
  for (const [chunkKey, discoveredIndexes] of minimapRenderState.discoveredTileIndexesByChunkKey.entries()) {
    serializedExploration[chunkKey] = Array.from(discoveredIndexes).sort((firstIndex, secondIndex) => {
      return firstIndex - secondIndex;
    });
  }
  return serializedExploration;
};

const hydrateMinimapExploration = (serializedExploration) => {
  minimapRenderState.discoveredTileIndexesByChunkKey.clear();
  if (!serializedExploration || typeof serializedExploration !== "object") {
    return;
  }
  const maxTileIndex = CHUNK_SIZE_TILES * CHUNK_SIZE_TILES;
  for (const [chunkKey, discoveredIndexes] of Object.entries(serializedExploration)) {
    if (!Array.isArray(discoveredIndexes)) {
      continue;
    }
    const validIndexes = discoveredIndexes.filter((index) => {
      return Number.isInteger(index) && index >= 0 && index < maxTileIndex;
    });
    minimapRenderState.discoveredTileIndexesByChunkKey.set(chunkKey, new Set(validIndexes));
  }
  minimapRenderState.lastDiscoveryCol = null;
  minimapRenderState.lastDiscoveryRow = null;
  minimapRenderState.lastDiscoveryZ = null;
};

const isMinimapTileDiscovered = (z, col, row) => {
  const chunkKey = getMinimapExplorationChunkKey(z, col, row);
  const tileIndex = getLocalTileIndexInChunk(col, row);
  if (!chunkKey || !Number.isInteger(tileIndex)) {
    return false;
  }
  return minimapRenderState.discoveredTileIndexesByChunkKey.get(chunkKey)?.has(tileIndex) === true;
};

const discoverMinimapTile = (worldMap, col, row) => {
  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  const chunkKey = getMinimapExplorationChunkKey(worldMap?.z, col, row);
  const tileIndex = getLocalTileIndexInChunk(col, row);
  if (!chunk || !chunkKey || !Number.isInteger(tileIndex)) {
    return false;
  }
  let discoveredIndexes = minimapRenderState.discoveredTileIndexesByChunkKey.get(chunkKey);
  if (!discoveredIndexes) {
    discoveredIndexes = new Set();
    minimapRenderState.discoveredTileIndexesByChunkKey.set(chunkKey, discoveredIndexes);
  }
  const wasAlreadyDiscovered = discoveredIndexes.has(tileIndex);
  discoveredIndexes.add(tileIndex);
  return !wasAlreadyDiscovered;
};

const revealMinimapAroundPlayer = () => {
  const worldMap = getCurrentWorldMap();
  if (!worldMap) {
    return false;
  }
  const playerCol = Math.floor(playerState.x / TILE_SIZE);
  const playerRow = Math.floor(playerState.y / TILE_SIZE);
  if (
    minimapRenderState.lastDiscoveryCol === playerCol &&
    minimapRenderState.lastDiscoveryRow === playerRow &&
    minimapRenderState.lastDiscoveryZ === playerState.z
  ) {
    return false;
  }

  let didDiscoverTile = false;
  for (let row = playerRow - MINIMAP_DISCOVERY_RADIUS_Y; row <= playerRow + MINIMAP_DISCOVERY_RADIUS_Y; row++) {
    for (let col = playerCol - MINIMAP_DISCOVERY_RADIUS_X; col <= playerCol + MINIMAP_DISCOVERY_RADIUS_X; col++) {
      if (discoverMinimapTile(worldMap, col, row)) {
        didDiscoverTile = true;
      }
    }
  }
  minimapRenderState.lastDiscoveryCol = playerCol;
  minimapRenderState.lastDiscoveryRow = playerRow;
  minimapRenderState.lastDiscoveryZ = playerState.z;
  return didDiscoverTile;
};

const getMinimapWorldMap = () => {
  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return null;
  }
  const viewZ = Number.isInteger(minimapRenderState.viewZ) ? minimapRenderState.viewZ : playerState.z;
  return pixiWorldRenderState.worldMapsByZ.get(viewZ) ?? null;
};

const drawMinimapFog = (context, worldMap) => {
  context.save();
  context.fillStyle = "#000000";
  for (let localRow = 0; localRow < minimapRenderState.visibleRows; localRow++) {
    for (let localCol = 0; localCol < minimapRenderState.visibleCols; localCol++) {
      const col = minimapRenderState.firstCol + localCol;
      const row = minimapRenderState.firstRow + localRow;
      if (!isMinimapTileDiscovered(worldMap.z, col, row)) {
        context.fillRect(
          localCol * minimapRenderState.cellSize,
          localRow * minimapRenderState.cellSize,
          minimapRenderState.cellSize,
          minimapRenderState.cellSize,
        );
      }
    }
  }
  context.restore();
};

const getMinimapCanvasPositionForTile = (col, row) => {
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !Number.isInteger(minimapRenderState.firstCol) ||
    !Number.isInteger(minimapRenderState.firstRow)
  ) {
    return null;
  }
  const localCol = col - minimapRenderState.firstCol;
  const localRow = row - minimapRenderState.firstRow;
  if (
    localCol < 0 ||
    localRow < 0 ||
    localCol >= minimapRenderState.visibleCols ||
    localRow >= minimapRenderState.visibleRows
  ) {
    return null;
  }
  return {
    x: (localCol + 0.5) * minimapRenderState.cellSize,
    y: (localRow + 0.5) * minimapRenderState.cellSize,
  };
};

const drawMinimapGrid = (context) => {
  if (minimapRenderState.cellSize < 8) {
    return;
  }
  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0.5; x < minimapCanvas.width; x += minimapRenderState.cellSize) {
    context.moveTo(x, 0);
    context.lineTo(x, minimapCanvas.height);
  }
  for (let y = 0.5; y < minimapCanvas.height; y += minimapRenderState.cellSize) {
    context.moveTo(0, y);
    context.lineTo(minimapCanvas.width, y);
  }
  context.stroke();
  context.restore();
};

const drawMinimapCreatureMarker = (context, creature, fillColor, markerShape = "circle") => {
  if (creature?.z !== minimapRenderState.viewZ) {
    return;
  }
  const col = Math.floor(creature.x / TILE_SIZE);
  const row = Math.floor(creature.y / TILE_SIZE);
  const position = getMinimapCanvasPositionForTile(col, row);
  if (!position) {
    return;
  }
  const radius = clamp(minimapRenderState.cellSize * 0.38, 1.5, 4);
  context.save();
  context.fillStyle = fillColor;
  context.strokeStyle = "rgba(0, 0, 0, 0.9)";
  context.lineWidth = 1;
  context.beginPath();
  if (markerShape === "diamond") {
    context.moveTo(position.x, position.y - radius);
    context.lineTo(position.x + radius, position.y);
    context.lineTo(position.x, position.y + radius);
    context.lineTo(position.x - radius, position.y);
    context.closePath();
  } else {
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
  }
  context.fill();
  context.stroke();
  context.restore();
};

const drawMinimapNavigationMarker = (context) => {
  if (
    minimapRenderState.viewZ !== playerState.z ||
    playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.click ||
    !playerNavigationState.destinationTile
  ) {
    return;
  }
  const destination = playerNavigationState.destinationTile;
  const position = getMinimapCanvasPositionForTile(destination.col, destination.row);
  if (!position) {
    return;
  }
  const radius = clamp(minimapRenderState.cellSize * 0.52, 2.5, 6);
  context.save();
  context.strokeStyle = "#f7d44a";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
};

const drawMinimapPlayerMarker = (context) => {
  if (minimapRenderState.viewZ !== playerState.z) {
    return;
  }
  const playerCol = Math.floor(playerState.x / TILE_SIZE);
  const playerRow = Math.floor(playerState.y / TILE_SIZE);
  const position = getMinimapCanvasPositionForTile(playerCol, playerRow);
  if (!position) {
    return;
  }
  const directionByName = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  const direction = directionByName[playerState.direction] ?? directionByName.down;
  const perpendicular = { x: -direction.y, y: direction.x };
  const radius = clamp(minimapRenderState.cellSize * 0.62, 2.5, 6);
  context.save();
  context.fillStyle = "#fff2a3";
  context.strokeStyle = "#17130a";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(position.x + direction.x * radius, position.y + direction.y * radius);
  context.lineTo(
    position.x - direction.x * radius * 0.65 + perpendicular.x * radius * 0.7,
    position.y - direction.y * radius * 0.65 + perpendicular.y * radius * 0.7,
  );
  context.lineTo(
    position.x - direction.x * radius * 0.65 - perpendicular.x * radius * 0.7,
    position.y - direction.y * radius * 0.65 - perpendicular.y * radius * 0.7,
  );
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
};

const drawMinimapDynamicMarkers = (context) => {
  drawMinimapNavigationMarker(context);
  const playerCol = Math.floor(playerState.x / TILE_SIZE);
  const playerRow = Math.floor(playerState.y / TILE_SIZE);
  for (const monsterUid of monsterElementsByUid.keys()) {
    const monster = monstersByUid.get(monsterUid);
    const monsterCol = Math.floor(monster?.x / TILE_SIZE);
    const monsterRow = Math.floor(monster?.y / TILE_SIZE);
    const monsterDistance = Math.max(Math.abs(monsterCol - playerCol), Math.abs(monsterRow - playerRow));
    if (monster && monster.z === playerState.z && monsterDistance <= MINIMAP_MONSTER_REVEAL_RANGE_TILES) {
      drawMinimapCreatureMarker(context, monster, "#d94c45");
      if (monster.uid === selectedMonsterUid) {
        const position = getMinimapCanvasPositionForTile(
          Math.floor(monster.x / TILE_SIZE),
          Math.floor(monster.y / TILE_SIZE),
        );
        if (position) {
          context.save();
          context.strokeStyle = "#ffffff";
          context.lineWidth = 1;
          context.beginPath();
          context.arc(position.x, position.y, clamp(minimapRenderState.cellSize * 0.58, 2.5, 6), 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
      }
    }
  }
  for (const npcUid of npcElementsByUid.keys()) {
    const npc = npcsByUid.get(npcUid);
    if (npc) {
      drawMinimapCreatureMarker(context, npc, "#59c6c8", "diamond");
    }
  }
  drawMinimapPlayerMarker(context);
};

const updateMinimapControlUi = () => {
  const zoomIndex = MINIMAP_ZOOM_LEVELS.indexOf(minimapRenderState.cellSize);
  if (minimapZoomLevel) {
    minimapZoomLevel.textContent = `${Math.round((minimapRenderState.cellSize / MINIMAP_DEFAULT_CELL_SIZE) * 100)}%`;
  }
  if (minimapFloorLevel) {
    minimapFloorLevel.textContent = `Z ${minimapRenderState.viewZ}`;
  }
  if (minimapZoomOutButton) {
    minimapZoomOutButton.disabled = zoomIndex <= 0;
  }
  if (minimapZoomInButton) {
    minimapZoomInButton.disabled = zoomIndex >= MINIMAP_ZOOM_LEVELS.length - 1;
  }
  if (minimapFloorUpButton) {
    minimapFloorUpButton.disabled = !pixiWorldRenderState.worldMapsByZ?.has(minimapRenderState.viewZ + 1);
  }
  if (minimapFloorDownButton) {
    minimapFloorDownButton.disabled = !pixiWorldRenderState.worldMapsByZ?.has(minimapRenderState.viewZ - 1);
  }
};

const renderPlayerMinimap = (forceRender = false) => {
  const context = minimapRenderState.context;
  if (!playerMinimap || !minimapCanvas || !context) {
    return;
  }

  const playerCol = Math.floor(playerState.x / TILE_SIZE);
  const playerRow = Math.floor(playerState.y / TILE_SIZE);
  const now = performance.now();
  if (minimapRenderState.lastZ !== null && minimapRenderState.lastZ !== playerState.z) {
    minimapRenderState.isFollowingPlayer = true;
  }
  if (!Number.isInteger(minimapRenderState.viewZ) || minimapRenderState.isFollowingPlayer) {
    minimapRenderState.viewZ = playerState.z;
  }
  const worldMap = getMinimapWorldMap();
  if (!worldMap) {
    return;
  }
  const didDiscoverTile = revealMinimapAroundPlayer();
  if (
    minimapRenderState.isFollowingPlayer ||
    !Number.isInteger(minimapRenderState.centerCol) ||
    !Number.isInteger(minimapRenderState.centerRow)
  ) {
    minimapRenderState.centerCol = playerCol;
    minimapRenderState.centerRow = playerRow;
  }

  const cellSize = minimapRenderState.cellSize;
  const visibleCols = Math.ceil(minimapCanvas.width / cellSize);
  const visibleRows = Math.ceil(minimapCanvas.height / cellSize);
  const firstCol = minimapRenderState.centerCol - Math.floor(visibleCols / 2);
  const firstRow = minimapRenderState.centerRow - Math.floor(visibleRows / 2);
  if (
    !forceRender &&
    !didDiscoverTile &&
    minimapRenderState.lastPlayerCol === playerCol &&
    minimapRenderState.lastPlayerRow === playerRow &&
    minimapRenderState.lastZ === playerState.z &&
    minimapRenderState.lastViewZ === minimapRenderState.viewZ &&
    minimapRenderState.lastCenterCol === minimapRenderState.centerCol &&
    minimapRenderState.lastCenterRow === minimapRenderState.centerRow &&
    minimapRenderState.lastCellSize === cellSize &&
    now < minimapRenderState.nextDynamicRenderAt
  ) {
    return;
  }

  minimapRenderState.firstCol = firstCol;
  minimapRenderState.firstRow = firstRow;
  minimapRenderState.visibleCols = visibleCols;
  minimapRenderState.visibleRows = visibleRows;
  context.fillStyle = "#050505";
  context.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const didDrawTexturedMap = drawPixiMinimapRegion({
    context,
    worldMap,
    firstCol,
    firstRow,
    visibleCols,
    visibleRows,
    cellSize,
  });
  if (!didDrawTexturedMap) {
    for (let localRow = 0; localRow < visibleRows; localRow++) {
      for (let localCol = 0; localCol < visibleCols; localCol++) {
        context.fillStyle = getMinimapTileColor(worldMap, firstCol + localCol, firstRow + localRow);
        context.fillRect(localCol * cellSize, localRow * cellSize, cellSize, cellSize);
      }
    }
  }

  drawMinimapGrid(context);
  drawMinimapFog(context, worldMap);
  drawMinimapDynamicMarkers(context);
  updateMinimapControlUi();

  minimapRenderState.lastPlayerCol = playerCol;
  minimapRenderState.lastPlayerRow = playerRow;
  minimapRenderState.lastZ = playerState.z;
  minimapRenderState.lastViewZ = minimapRenderState.viewZ;
  minimapRenderState.lastCenterCol = minimapRenderState.centerCol;
  minimapRenderState.lastCenterRow = minimapRenderState.centerRow;
  minimapRenderState.lastCellSize = cellSize;
  minimapRenderState.nextDynamicRenderAt = now + MINIMAP_DYNAMIC_REFRESH_MS;
};

const setMinimapZoom = (cellSize) => {
  if (!MINIMAP_ZOOM_LEVELS.includes(cellSize)) {
    return false;
  }
  minimapRenderState.cellSize = cellSize;
  gameOptionsUiState.values.minimapCellSize = cellSize;
  saveGameOptions();
  renderPlayerMinimap(true);
  return true;
};

const adjustMinimapZoom = (direction) => {
  const currentIndex = MINIMAP_ZOOM_LEVELS.indexOf(minimapRenderState.cellSize);
  const nextIndex = clamp(currentIndex + direction, 0, MINIMAP_ZOOM_LEVELS.length - 1);
  return setMinimapZoom(MINIMAP_ZOOM_LEVELS[nextIndex]);
};

const centerMinimapOnPlayer = () => {
  minimapRenderState.isFollowingPlayer = true;
  minimapRenderState.viewZ = playerState.z;
  minimapRenderState.centerCol = Math.floor(playerState.x / TILE_SIZE);
  minimapRenderState.centerRow = Math.floor(playerState.y / TILE_SIZE);
  renderPlayerMinimap(true);
};

const changeMinimapFloor = (floorDelta) => {
  if (!Number.isInteger(floorDelta) || !(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return false;
  }
  const nextZ = minimapRenderState.viewZ + floorDelta;
  if (!pixiWorldRenderState.worldMapsByZ.has(nextZ)) {
    return false;
  }
  minimapRenderState.viewZ = nextZ;
  minimapRenderState.isFollowingPlayer = false;
  renderPlayerMinimap(true);
  return true;
};

const handleTransitionContextMenu = (target) => {
  const transition = getTransitionFromPointerTarget(target);
  if (!transition) {
    return false;
  }

  const transitionType = transition.properties?.transitionType;
  if (transitionType !== "ropeUp") {
    return false;
  }

  if (!isNearPlayer(transition, 1)) {
    return true;
  }

  if (applyWorldTransition(transition)) {
    playGameSfx(GAME_SFX.ropeUse);
  }
  return true;
};

const getTransitionFromPointerTarget = (target) => {
  if (!target?.tile || !target.pointerInsideMap) {
    return null;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return null;
  }

  const transition = findTransitionAtTile(currentWorldMap, target.tile.col, target.tile.row);
  if (!transition) {
    return null;
  }

  return transition;
};

const findInteractableAtTile = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }

  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk || !Array.isArray(chunk.interactables)) {
    return null;
  }

  for (const interactable of chunk.interactables) {
    if (isTileInsideTiledObject(col, row, interactable)) {
      return interactable;
    }
  }

  return null;
};

/* ---------- INTERACTABLES - QUETES ET RECOMPENSES ---------- */

const getQuestData = (questId) => {
  if (typeof questId !== "string" || !(questId in questsDatabase)) {
    return null;
  }
  return questsDatabase[questId];
};

const getPlayerQuestState = (questId) => {
  if (typeof questId !== "string" || !playerState.progress?.questsById) {
    return null;
  }
  return playerState.progress.questsById[questId] ?? null;
};

const setPlayerQuestStatus = (questId, status, now = Date.now()) => {
  if (!getQuestData(questId) || !Object.values(QUEST_STATUS).includes(status) || !Number.isFinite(now)) {
    return false;
  }

  const currentQuestState = getPlayerQuestState(questId);
  const nextQuestState = {
    questId,
    status,
    startedAt: currentQuestState?.startedAt ?? now,
    completedAt: status === QUEST_STATUS.completed ? currentQuestState?.completedAt ?? now : null,
  };
  playerState.progress.questsById[questId] = nextQuestState;
  return true;
};

const hasPlayerClaimedInteractableReward = (interactableId) => {
  if (typeof interactableId !== "string" || !playerState.progress?.rewardClaimsByInteractableId) {
    return false;
  }
  return interactableId in playerState.progress.rewardClaimsByInteractableId;
};

const recordPlayerInteractableRewardClaim = (interactableId, now = Date.now()) => {
  if (
    typeof interactableId !== "string" ||
    interactableId === "" ||
    !Number.isFinite(now) ||
    !playerState.progress?.rewardClaimsByInteractableId
  ) {
    return false;
  }
  playerState.progress.rewardClaimsByInteractableId[interactableId] = {
    interactableId,
    claimedAt: now,
  };
  return true;
};

const isPlayerNearTiledObject = (tiledObject, range = 1) => {
  if (
    !tiledObject ||
    tiledObject.z !== playerState.z ||
    !Number.isFinite(playerState.x) ||
    !Number.isFinite(playerState.y) ||
    !Number.isInteger(range) ||
    range < 0 ||
    !Number.isInteger(tiledObject.col) ||
    !Number.isInteger(tiledObject.row) ||
    !Number.isFinite(tiledObject.width) ||
    !Number.isFinite(tiledObject.height)
  ) {
    return false;
  }

  const widthTiles = Math.max(Math.ceil(tiledObject.width / TILE_SIZE), 1);
  const heightTiles = Math.max(Math.ceil(tiledObject.height / TILE_SIZE), 1);
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const nearestCol = clamp(playerCol, tiledObject.col, tiledObject.col + widthTiles - 1);
  const nearestRow = clamp(playerRow, tiledObject.row, tiledObject.row + heightTiles - 1);
  return Math.abs(playerCol - nearestCol) <= range && Math.abs(playerRow - nearestRow) <= range;
};

const formatRewardItemsText = (rewardItems) => {
  if (!Array.isArray(rewardItems)) {
    return getGameUiText("rewardFallback");
  }
  const labels = rewardItems.map((rewardItem) => {
    const itemData = getLocalizedItemData(rewardItem.itemId);
    if (!itemData) {
      return rewardItem.itemId;
    }
    return `${rewardItem.quantity > 1 ? `${rewardItem.quantity} ` : ""}${getLocalizedItemName(rewardItem.itemId, rewardItem.quantity)}`;
  });
  return labels.join(", ");
};

const addRewardChestFailureFeedback = (reason) => {
  const messagesByReason = {
    backpack: getGameUiText("backpackRequired"),
    capacity: getGameUiText("notEnoughCapacity"),
    space: getGameUiText("backpackFull"),
    configuration: getGameUiText("invalidReward"),
    commit: getGameUiText("rewardCommitFailed"),
  };
  const message = messagesByReason[reason] ?? getGameUiText("chestOpenFailed");
  if (reason === "backpack" || reason === "capacity" || reason === "space") {
    showGameStatusMessage(message);
  }
  return addLogMessage(message, "error");
};

const addQuestCompletionFeedback = (questData, rewardItems) => {
  const localizedQuestData = getLocalizedQuestData(questData.questId) ?? questData;
  const rewardText = formatRewardItemsText(rewardItems);
  const logMessage = getGameUiText("questCompletionLog")(localizedQuestData.name, rewardText);
  const floatingMessage = getGameUiText("questCompletionFloating")(localizedQuestData.name, rewardText);
  addLogMessage(logMessage, "loot");
  showFloatingTextAboveTarget(floatingMessage, 110, playerState, "quest", 5500);
};

const addRewardChestCompletionEffect = (interactable) => {
  if (
    !Number.isFinite(interactable?.x) ||
    !Number.isFinite(interactable?.y) ||
    !Number.isFinite(interactable?.width) ||
    !Number.isFinite(interactable?.height)
  ) {
    return false;
  }
  return playPixiRewardChestEffect({
    x: interactable.x + interactable.width / 2,
    y: interactable.y + interactable.height / 2,
  });
};

const handleRewardChestInteraction = (interactable) => {
  if (!interactable?.properties || !isPlayerNearTiledObject(interactable, 1)) {
    return false;
  }

  const { interactableId, questId, rewardTableId } = interactable.properties;
  const questData = getQuestData(questId);
  const rewardTable = getRewardTableData(rewardTableId);
  if (typeof interactableId !== "string" || interactableId === "" || !questData || !Array.isArray(rewardTable?.items)) {
    addRewardChestFailureFeedback("configuration");
    return false;
  }

  if (hasPlayerClaimedInteractableReward(interactableId)) {
    const localizedQuestData = getLocalizedQuestData(questId) ?? questData;
    addLogMessage(getGameUiText("questAlreadyCompleted")(localizedQuestData.name), "system");
    return false;
  }

  const grantResult = grantRewardItemsToPlayer(rewardTable.items);
  if (!grantResult.success) {
    addRewardChestFailureFeedback(grantResult.reason);
    return false;
  }

  const now = Date.now();
  recordPlayerInteractableRewardClaim(interactableId, now);
  setPlayerQuestStatus(questId, QUEST_STATUS.completed, now);
  renderQuestWindow();
  addQuestCompletionFeedback(questData, rewardTable.items);
  addRewardChestCompletionEffect(interactable);
  playGameSfx(GAME_SFX.openChest);
  setTimeout(() => playGameSfx(GAME_SFX.questDone), 180);
  return true;
};

const interactableContextMenuHandlers = {
  rewardChest: handleRewardChestInteraction,
};

const getOrCreateMonsterSpawnState = (spawnId) => {
  if (typeof spawnId !== "string" || spawnId === "") {
    return null;
  }

  if (!monsterSpawnStateById.has(spawnId)) {
    monsterSpawnStateById.set(spawnId, {
      aliveCount: 0,
      pendingRespawnCount: 0,
    });
  }

  return monsterSpawnStateById.get(spawnId);
};

const getRandomTilePositionInTiledObject = (tiledObject) => {
  if (!Number.isInteger(tiledObject?.col) || !Number.isInteger(tiledObject?.row)) {
    return null;
  }

  const widthTiles = Math.max(Math.ceil((tiledObject.width || TILE_SIZE) / TILE_SIZE), 1);
  const heightTiles = Math.max(Math.ceil((tiledObject.height || TILE_SIZE) / TILE_SIZE), 1);

  const col = tiledObject.col + getRandomInt(0, widthTiles - 1);
  const row = tiledObject.row + getRandomInt(0, heightTiles - 1);

  return { col, row };
};

const getRandomMonsterSpawnTile = (worldMap, spawnZone, maxAttempts = 20, blockNearPlayers = false) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !spawnZone || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    return null;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tilePosition = getRandomTilePositionInTiledObject(spawnZone);
    if (!tilePosition) {
      return null;
    }

    if (canSpawnMonsterAtTile(worldMap, tilePosition.col, tilePosition.row, blockNearPlayers)) {
      return tilePosition;
    }
  }

  return null;
};

const spawnMonsterFromZone = (worldMap, spawnZone, { blockNearPlayers = false } = {}) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !spawnZone) {
    return null;
  }

  const spawnId = spawnZone.properties?.spawnId;
  const monsterId = spawnZone.properties?.monsterId;
  const maxCount = spawnZone.properties?.maxCount;

  if (
    typeof spawnId !== "string" ||
    spawnId === "" ||
    typeof monsterId !== "string" ||
    monsterId === "" ||
    !Number.isInteger(maxCount) ||
    maxCount <= 0
  ) {
    return null;
  }

  const spawnState = getOrCreateMonsterSpawnState(spawnId);
  if (!spawnState || spawnState.aliveCount >= maxCount) {
    return null;
  }

  const tilePosition = getRandomMonsterSpawnTile(worldMap, spawnZone, 20, blockNearPlayers);
  if (!tilePosition) {
    return null;
  }

  const x = tilePosition.col * TILE_SIZE;
  const y = tilePosition.row * TILE_SIZE;

  const monster = createMonster(monsterId, x, y, worldMap.z);
  if (!monster) {
    return null;
  }

  monster.spawnId = spawnId;

  if (!addMonsterToState(monster)) {
    return null;
  }

  spawnState.aliveCount++;
  monsterHpRefresh(monster);

  renderMonsters([monster]);

  return monster;
};

const decreaseMonsterSpawnAliveCount = (monster) => {
  const spawnId = monster?.spawnId;
  if (typeof spawnId !== "string" || spawnId === "") {
    return false;
  }

  const spawnState = monsterSpawnStateById.get(spawnId);
  if (!spawnState) {
    return false;
  }

  spawnState.aliveCount = Math.max(spawnState.aliveCount - 1, 0);
  return true;
};

const getMonsterSpawnRespawnMs = (spawnZone) => {
  const respawnMs = spawnZone?.properties?.respawnMs;
  if (!Number.isInteger(respawnMs) || respawnMs <= 0) {
    return null;
  }
  return respawnMs;
};

const registerMonsterSpawnDefinition = (worldMap, spawnZone) => {
  const spawnId = spawnZone?.properties?.spawnId;
  const monsterId = spawnZone?.properties?.monsterId;
  const maxCount = spawnZone?.properties?.maxCount;
  const respawnMs = getMonsterSpawnRespawnMs(spawnZone);

  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    typeof spawnId !== "string" ||
    spawnId === "" ||
    typeof monsterId !== "string" ||
    monsterId === "" ||
    !Number.isInteger(maxCount) ||
    maxCount <= 0 ||
    !Number.isInteger(respawnMs)
  ) {
    return null;
  }

  const existingDefinition = monsterSpawnDefinitionsById.get(spawnId);
  if (existingDefinition) {
    if (existingDefinition.z !== worldMap.z || existingDefinition.monsterId !== monsterId) {
      console.error(`Duplicate monster spawnId with conflicting data: ${spawnId}`);
      return null;
    }
    return existingDefinition;
  }

  const spawnDefinition = {
    spawnId,
    monsterId,
    maxCount,
    respawnMs,
    z: worldMap.z,
    worldMap,
    spawnZone,
  };

  monsterSpawnDefinitionsById.set(spawnId, spawnDefinition);
  getOrCreateMonsterSpawnState(spawnId);
  return spawnDefinition;
};

const compareMonsterRespawnEvents = (firstEvent, secondEvent) => {
  if (firstEvent.dueAt !== secondEvent.dueAt) {
    return firstEvent.dueAt - secondEvent.dueAt;
  }
  return firstEvent.order - secondEvent.order;
};

const pushMonsterRespawnEvent = (event) => {
  monsterRespawnEventHeap.push(event);
  let index = monsterRespawnEventHeap.length - 1;

  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (compareMonsterRespawnEvents(monsterRespawnEventHeap[parentIndex], event) <= 0) {
      break;
    }
    monsterRespawnEventHeap[index] = monsterRespawnEventHeap[parentIndex];
    index = parentIndex;
  }

  monsterRespawnEventHeap[index] = event;
};

const popMonsterRespawnEvent = () => {
  if (monsterRespawnEventHeap.length === 0) {
    return null;
  }

  const firstEvent = monsterRespawnEventHeap[0];
  const lastEvent = monsterRespawnEventHeap.pop();
  if (monsterRespawnEventHeap.length === 0) {
    return firstEvent;
  }

  let index = 0;
  while (true) {
    const leftIndex = index * 2 + 1;
    const rightIndex = leftIndex + 1;
    if (leftIndex >= monsterRespawnEventHeap.length) {
      break;
    }

    let smallestChildIndex = leftIndex;
    if (
      rightIndex < monsterRespawnEventHeap.length &&
      compareMonsterRespawnEvents(monsterRespawnEventHeap[rightIndex], monsterRespawnEventHeap[leftIndex]) < 0
    ) {
      smallestChildIndex = rightIndex;
    }

    if (compareMonsterRespawnEvents(lastEvent, monsterRespawnEventHeap[smallestChildIndex]) <= 0) {
      break;
    }

    monsterRespawnEventHeap[index] = monsterRespawnEventHeap[smallestChildIndex];
    index = smallestChildIndex;
  }

  monsterRespawnEventHeap[index] = lastEvent;
  return firstEvent;
};

const scheduleMonsterRespawnAt = (spawnId, dueAt) => {
  const spawnDefinition = monsterSpawnDefinitionsById.get(spawnId);
  const spawnState = getOrCreateMonsterSpawnState(spawnId);
  if (!spawnDefinition || !spawnState || !Number.isFinite(dueAt)) {
    return false;
  }

  if (spawnState.aliveCount + spawnState.pendingRespawnCount >= spawnDefinition.maxCount) {
    return false;
  }

  spawnState.pendingRespawnCount++;
  pushMonsterRespawnEvent({
    spawnId,
    dueAt,
    order: nextMonsterRespawnEventOrder++,
  });
  return true;
};

const scheduleMonsterRespawn = (spawnId, now) => {
  const spawnDefinition = monsterSpawnDefinitionsById.get(spawnId);
  if (!spawnDefinition || !Number.isFinite(now)) {
    return false;
  }
  return scheduleMonsterRespawnAt(spawnId, now + spawnDefinition.respawnMs);
};

const countMonstersFromSpawnZone = (spawnId) => {
  if (typeof spawnId !== "string" || spawnId === "") {
    return 0;
  }

  let count = 0;

  for (const monster of monstersByUid.values()) {
    if (monster.spawnId === spawnId) {
      count++;
    }
  }

  return count;
};

const isPlayerBlockingMonsterRespawnAtTile = (player, worldMap, col, row) => {
  if (
    !player ||
    player.z !== worldMap?.z ||
    player.hp <= 0 ||
    !Number.isInteger(col) ||
    !Number.isInteger(row)
  ) {
    return false;
  }

  const playerCol = Math.floor(player.x / TILE_SIZE);
  const playerRow = Math.floor(player.y / TILE_SIZE);
  return (
    Math.abs(playerCol - col) <= MONSTER_RESPAWN_CONFIG.playerBlockRangeX &&
    Math.abs(playerRow - row) <= MONSTER_RESPAWN_CONFIG.playerBlockRangeY
  );
};

const isAnyPlayerBlockingMonsterRespawnAtTile = (worldMap, col, row) => {
  return isPlayerBlockingMonsterRespawnAtTile(playerState, worldMap, col, row);
};

const canSpawnMonsterAtTile = (worldMap, col, row, blockNearPlayers = false) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return false;
  }

  if (isTiledCollisionAtTile(worldMap, col, row)) {
    return false;
  }

  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;

  if (isBlockingItemAtPosition(x, y, worldMap.z)) {
    return false;
  }

  if (isMonsterAtPosition(x, y, worldMap.z)) {
    return false;
  }

  if (isNpcAtPosition(x, y, worldMap.z)) {
    return false;
  }

  if (isPlayerAtPosition(x, y, worldMap.z)) {
    return false;
  }

  if (blockNearPlayers && isAnyPlayerBlockingMonsterRespawnAtTile(worldMap, col, row)) {
    return false;
  }

  return true;
};

const processMonsterRespawnEvent = (event, now) => {
  const spawnDefinition = monsterSpawnDefinitionsById.get(event?.spawnId);
  const spawnState = monsterSpawnStateById.get(event?.spawnId);
  if (!spawnDefinition || !spawnState) {
    return false;
  }

  if (spawnState.aliveCount >= spawnDefinition.maxCount) {
    spawnState.pendingRespawnCount = Math.max(spawnState.pendingRespawnCount - 1, 0);
    return false;
  }

  const monster = spawnMonsterFromZone(spawnDefinition.worldMap, spawnDefinition.spawnZone, {
    blockNearPlayers: true,
  });
  if (monster) {
    spawnState.pendingRespawnCount = Math.max(spawnState.pendingRespawnCount - 1, 0);
    return true;
  }

  event.dueAt = now + MONSTER_RESPAWN_CONFIG.blockedRetryMs;
  event.order = nextMonsterRespawnEventOrder++;
  pushMonsterRespawnEvent(event);
  return false;
};

const updateMonsterRespawns = (now) => {
  if (!Number.isFinite(now)) {
    return;
  }

  let processedEventCount = 0;
  while (
    monsterRespawnEventHeap.length > 0 &&
    monsterRespawnEventHeap[0].dueAt <= now &&
    processedEventCount < MONSTER_RESPAWN_CONFIG.maxEventsPerLogicStep
  ) {
    const event = popMonsterRespawnEvent();
    processMonsterRespawnEvent(event, now);
    processedEventCount++;
  }
};

const getMonsterSpawnZonesFromWorldMap = (worldMap) => {
  if (!(worldMap?.chunksByKey instanceof Map)) {
    return [];
  }

  const monsterSpawnZones = [];

  for (const chunk of worldMap.chunksByKey.values()) {
    if (!Array.isArray(chunk.spawns)) {
      continue;
    }

    for (const spawn of chunk.spawns) {
      if (spawn.properties?.spawnType === "monster") {
        monsterSpawnZones.push(spawn);
      }
    }
  }

  return monsterSpawnZones;
};

const getInteractableFromPointerTarget = (target) => {
  if (!target?.tile || !target.pointerInsideMap) {
    return null;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return null;
  }

  return findInteractableAtTile(currentWorldMap, target.tile.col, target.tile.row);
};

const handleInteractableContextMenu = (target) => {
  const interactable = getInteractableFromPointerTarget(target);
  if (!interactable) {
    return false;
  }

  const interactableType = interactable.properties?.interactableType;

  if (interactableType === "lookOnly") {
    const text = interactable.properties?.lookText ?? interactable.properties?.displayName;
    if (text) {
      showFloatingTextAboveTarget(text, 110, playerState, "look");
    }
    return true;
  }

  const handler = interactableContextMenuHandlers[interactableType];
  if (handler) {
    handler(interactable);
    return true;
  }

  return false;
};

const findTransitionAtTile = (worldMap, col, row) => {
  if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }

  const chunk = getWorldChunkForTilePosition(worldMap, col, row);
  if (!chunk || !Array.isArray(chunk.transitions)) {
    return null;
  }

  for (const transition of chunk.transitions) {
    if (isTileInsideTiledObject(col, row, transition)) {
      return transition;
    }
  }

  return null;
};

const setPlayerWorldPosition = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  playerState.x = x;
  playerState.y = y;
  playerState.oldX = x;
  playerState.oldY = y;
  playerState.renderX = x;
  playerState.renderY = y;
  playerState.moveStartTime = 0;
  playerState.moveDuration = 0;

  return true;
};

const applyWorldTransition = (transition) => {
  const targetZ = transition?.properties?.targetZ;
  const targetCol = transition?.properties?.targetCol;
  const targetRow = transition?.properties?.targetRow;

  if (!Number.isInteger(targetZ) || !Number.isInteger(targetCol) || !Number.isInteger(targetRow)) {
    return false;
  }

  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return false;
  }

  const targetWorldMap = pixiWorldRenderState.worldMapsByZ.get(targetZ);
  if (!targetWorldMap) {
    return false;
  }

  const targetX = targetCol * TILE_SIZE;
  const targetY = targetRow * TILE_SIZE;

  playerState.z = targetZ;
  pixiWorldRenderState.currentZ = playerState.z;
  loseSelectedMonsterTarget();
  stopPlayerNavigation();
  clearMonsters();
  clearGroundItemRender();

  if (!setPlayerWorldPosition(targetX, targetY)) {
    return false;
  }

  pixiWorldRenderState.lastPlayerChunkX = null;
  pixiWorldRenderState.lastPlayerChunkY = null;

  updatePixiVisibleChunksAroundPlayer();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  updateWorldRender();

  return true;
};

const findPlayerSpawnInWorldMap = (worldMap, spawnId) => {
  if (!(worldMap?.chunksByKey instanceof Map) || typeof spawnId !== "string" || spawnId === "") {
    return null;
  }
  for (const chunk of worldMap.chunksByKey.values()) {
    if (!Array.isArray(chunk.spawns)) {
      continue;
    }
    for (const spawn of chunk.spawns) {
      if (spawn.properties?.spawnType === "player" && spawn.properties?.spawnId === spawnId) {
        return spawn;
      }
    }
  }
  return null;
};

const applyPlayerSpawn = (spawn) => {
  if (!Number.isInteger(spawn?.col) || !Number.isInteger(spawn?.row)) {
    return false;
  }

  const spawnX = spawn.col * TILE_SIZE;
  const spawnY = spawn.row * TILE_SIZE;

  return setPlayerWorldPosition(spawnX, spawnY);
};

const isTileInsideTiledObject = (tileCol, tileRow, tiledObject) => {
  if (
    !Number.isInteger(tileCol) ||
    !Number.isInteger(tileRow) ||
    !Number.isInteger(tiledObject?.col) ||
    !Number.isInteger(tiledObject?.row) ||
    !Number.isFinite(tiledObject?.width) ||
    !Number.isFinite(tiledObject?.height)
  ) {
    return false;
  }

  const widthTiles = Math.ceil(tiledObject.width / TILE_SIZE);
  const heightTiles = Math.ceil(tiledObject.height / TILE_SIZE);

  if (widthTiles <= 0 || heightTiles <= 0) {
    return false;
  }

  return (
    tileCol >= tiledObject.col &&
    tileCol < tiledObject.col + widthTiles &&
    tileRow >= tiledObject.row &&
    tileRow < tiledObject.row + heightTiles
  );
};

const getCurrentWorldMap = () => {
  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return null;
  }
  return pixiWorldRenderState.worldMapsByZ.get(pixiWorldRenderState.currentZ) ?? null;
};

const isTiledCollisionAtTile = (worldMap, col, row) => {
  if (!worldMap || !Number.isInteger(col) || !Number.isInteger(row)) {
    return false;
  }
  return getCollisionGidAtTile(worldMap, col, row) > 0;
};

const isNearPlayer = (target, range = 1) => {
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const targetCol = target.x / TILE_SIZE;
  const targetRow = target.y / TILE_SIZE;

  return Math.abs(playerCol - targetCol) <= range && Math.abs(playerRow - targetRow) <= range;
};

const isContainerItem = (item) => {
  if (!item) {
    return false;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return false;
  }
  return itemData.container === true;
};

const clamp = (value, min, max) => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const isEmpty = (valeur) => {
  if (valeur == null) return true;

  if (typeof valeur === "string" || Array.isArray(valeur)) {
    return valeur.length === 0;
  }

  if (typeof valeur === "object") {
    return Object.keys(valeur).length === 0;
  }

  return false;
};

/* ---------- OUTILS - TILE ---------- */
const getWorldTileStackKey = (x, y, z) => {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);

  return `${z}:${col}:${row}`;
};

const getWorldTileStack = (x, y, z) => {
  const tileStackKey = getWorldTileStackKey(x, y, z);
  return worldTileStacksByKey.get(tileStackKey) ?? null;
};

const getTopWorldItemUidAtTile = (x, y, z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack) {
    return null;
  }
  if (tileStack.itemUids.length <= 0) {
    return null;
  }
  return tileStack.itemUids[tileStack.itemUids.length - 1];
};

const getTopWorldItemAtTile = (x, y, z) => {
  const itemUid = getTopWorldItemUidAtTile(x, y, z);
  if (!itemUid) {
    return null;
  }
  return findWorldItemByUid(itemUid);
};

const getOrCreateWorldTileStack = (x, y, z) => {
  const tileStackKey = getWorldTileStackKey(x, y, z);
  let tileStack = getWorldTileStack(x, y, z);
  if (tileStack) {
    return tileStack;
  }
  tileStack = {
    x,
    y,
    z,
    itemUids: [],
  };
  worldTileStacksByKey.set(tileStackKey, tileStack);
  return tileStack;
};

const addItemUidToWorldTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  const tileStack = getOrCreateWorldTileStack(item.x, item.y, item.z);
  if (!tileStack.itemUids.includes(item.uid)) {
    tileStack.itemUids.push(item.uid);
  }
  return true;
};

const removeItemUidFromWorldTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack?.itemUids?.includes(item.uid)) {
    return false;
  }
  const index = tileStack.itemUids.indexOf(item.uid);
  tileStack.itemUids.splice(index, 1);
  if (tileStack.itemUids.length <= 0) {
    const tileStackKey = getWorldTileStackKey(item.x, item.y, item.z);
    worldTileStacksByKey.delete(tileStackKey);
  }
  return true;
};

const moveItemUidToWorldTileStack = (item, nextX, nextY) => {
  if (!item || !item.uid || !Number.isInteger(nextX) || !Number.isInteger(nextY)) {
    return false;
  }
  removeItemUidFromWorldTileStack(item);
  item.x = nextX;
  item.y = nextY;
  addItemUidToWorldTileStack(item);
  return true;
};

const isWorldItemTopOfTileStack = (item) => {
  if (!isValidWorldItem(item)) {
    return false;
  }
  return getTopWorldItemUidAtTile(item.x, item.y, item.z) === item.uid;
};

const getWorldItemStackIndex = (item) => {
  if (!isValidWorldItem(item)) {
    return 0;
  }

  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack) {
    return 0;
  }

  const index = tileStack.itemUids.indexOf(item.uid);
  if (index === -1) {
    return 0;
  }

  return index;
};

const getWorldRenderZIndex = (worldY, localLayer = 0) => {
  const WORLD_RENDER_Z_INDEX_BASE = 1000000;
  return WORLD_RENDER_Z_INDEX_BASE + worldY * WORLD_RENDER_LAYER_SIZE + localLayer;
};

const getEntityRenderSortY = (entity) => {
  if (!Number.isFinite(entity?.y)) {
    return 0;
  }

  const isStillMovingUp =
    Number.isFinite(entity.oldY) &&
    Number.isFinite(entity.renderY) &&
    entity.oldY > entity.y &&
    entity.renderY > entity.y;

  return isStillMovingUp ? entity.oldY : entity.y;
};

const canAddItemSurfaceToTile = (item, x, y) => {
  const currentHeight = getWorldTileSurfaceHeight(x, y, item.z);
  const itemSurfaceHeight = getItemSurfaceHeight(item);
  return currentHeight + itemSurfaceHeight <= MAX_SURFACE_HEIGHT;
};
/* ---------- OUTILS - ATLAS ET COULEURS ---------- */

const getAtlasSource = (col, row, spriteSize) => {
  return {
    sourceX: col * ATLAS_CELL_SIZE + ATLAS_PADDING,
    sourceY: row * ATLAS_CELL_SIZE + ATLAS_PADDING,
    sourceWidth: spriteSize,
    sourceHeight: spriteSize,
  };
};

const getHpColor = (hp, maxHp) => {
  const percent = hp / maxHp;

  const hue = percent * 120;

  return `hsl(${hue}, 100%, 45%)`;
};

const getAtlasPath = (atlasName) => {
  if (atlasName === "items") {
    return new URL("./assets/images/items/items-sheet.png", import.meta.url).href;
  }
  if (atlasName === "monsters") {
    return new URL("./assets/images/monstres/monsters-sheet.png", import.meta.url).href;
  }
  console.error(`atlasName: ${atlasName} n'existe pas`);
};

/* ---------- OUTILS - SOURIS ---------- */
const isMouseInsideMap = (mousePosition) => {
  if (!mousePosition || !Number.isFinite(mousePosition.worldX) || !Number.isFinite(mousePosition.worldY)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const col = Math.floor(mousePosition.worldX / TILE_SIZE);
  const row = Math.floor(mousePosition.worldY / TILE_SIZE);

  return getWorldChunkForTilePosition(currentWorldMap, col, row) !== null;
};

const updateMousePositionInfo = (screenX, screenY) => {
  let gameScale = GAME_SCALE;
  if (!Number.isFinite(GAME_SCALE) || GAME_SCALE <= 0) {
    gameScale = 1;
  }

  const gameRect = game.getBoundingClientRect();
  const gameX = (screenX - gameRect.left) / gameScale;
  const gameY = (screenY - gameRect.top) / gameScale;
  const worldX = camera.x + gameX;
  const worldY = camera.y + gameY;
  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);

  mousePosition.screenX = screenX;
  mousePosition.screenY = screenY;
  mousePosition.gameX = gameX;
  mousePosition.gameY = gameY;
  mousePosition.worldX = worldX;
  mousePosition.worldY = worldY;
  mousePosition.row = row;
  mousePosition.col = col;
  mousePosition.isInsideMap = isMouseInsideMap(mousePosition);
};

//#endregion  -----  CORE - OUTILS / HELPERS  -----

/* ==================================================== */
//#region     -----  ITEMS - DONNEES ET VALIDATION  -----
/* ==================================================== */
/* ---------- ITEMS - ACCES BASE DE DONNEES ---------- */

const getItemData = (itemId) => {
  if (itemsDatabase[itemId]) {
    return itemsDatabase[itemId];
  } else {
    console.log(`itemId: ${itemId} n'existe pas dans itemsDatabase`);
    return null;
  }
};

const getItemUseData = (item) => {
  const itemData = getItemData(item.itemId);
  if (!itemData || !itemData.use) {
    return null;
  }
  return itemData.use;
};

/* ---------- ITEMS - VALIDATION GAMEPLAY ---------- */

const isValidWorldItem = (item) => {
  if (!item) {
    return false;
  }
  const itemData = getItemData(item.itemId);
  if (
    !itemData ||
    !item.uid ||
    !Number.isInteger(item.x) ||
    !Number.isInteger(item.y) ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    return false;
  }
  return true;
};

/* ---------- ITEMS - DONNEES ATLAS ---------- */

const getItemRenderParts = (itemId) => {
  const itemData = getItemData(itemId);
  if (!itemData || !itemData.render || !itemData.render.parts) {
    return [];
  }
  return itemData.render.parts;
};

const getStackableAtlasColOffset = (quantity) => {
  if (quantity >= 50) {
    return 4;
  } else if (quantity >= 25) {
    return 3;
  } else if (quantity >= 3) {
    return 2;
  } else if (quantity >= 2) {
    return 1;
  } else {
    return 0;
  }
};

const getTorchFuelStage = (item) => {
  const itemData = getItemData(item?.itemId);
  const fuelDurationMs = itemData?.lightSource?.fuelDurationMs;
  if (!Number.isFinite(fuelDurationMs) || fuelDurationMs <= 0 || !Number.isFinite(item?.fuelRemainingMs)) {
    return null;
  }
  if (item.fuelRemainingMs <= 0) {
    return 3;
  }
  const fuelRatio = item.fuelRemainingMs / fuelDurationMs;
  if (fuelRatio > 2 / 3) {
    return 0;
  }
  if (fuelRatio > 1 / 3) {
    return 1;
  }
  return 2;
};

const getTorchAtlasCol = (item) => {
  const fuelStage = getTorchFuelStage(item);
  if (!Number.isInteger(fuelStage)) {
    return null;
  }
  if (fuelStage >= 3) {
    return 6;
  }
  return (item.isLit ? 3 : 0) + fuelStage;
};

const getItemRenderData = (item) => {
  if (!item) {
    return [];
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return [];
  }
  const parts = getItemRenderParts(item.itemId);
  const enrichedParts = parts.map((part) => {
    let atlasCol = part.atlasCol;
    const torchAtlasCol = getTorchAtlasCol(item);
    if (Number.isInteger(torchAtlasCol)) {
      atlasCol = torchAtlasCol;
    }
    if (itemData.stackable && itemData.stackAtlasVariants !== false) {
      atlasCol += getStackableAtlasColOffset(item.quantity);
    }
    if (item.decayStage) {
      atlasCol += item.decayStage;
    }
    const source = getAtlasSource(atlasCol, part.atlasRow, SPRITE_SIZE);
    return {
      ...part,
      ...source,
    };
  });
  return enrichedParts;
};

const getItemSurfaceHeight = (item) => {
  if (!item) {
    return 0;
  }
  const itemData = getItemData(item.itemId);
  return itemData?.surfaceHeight ?? 0;
};

const getEntitySurfaceOffsetY = (entity) => {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isInteger(entity.z)) {
    return 0;
  }
  return getWorldTileSurfaceHeight(entity.x, entity.y, entity.z);
};

const getWorldTileSurfaceHeight = (x, y, z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack) {
    return 0;
  }
  let totalSurfaceHeight = 0;
  for (const itemUid of tileStack.itemUids) {
    const item = findWorldItemByUid(itemUid);
    totalSurfaceHeight += getItemSurfaceHeight(item);
  }
  return Math.min(totalSurfaceHeight, MAX_SURFACE_HEIGHT);
};

const getWorldItemStackOffsetY = (item) => {
  if (!isValidWorldItem(item)) {
    return 0;
  }
  const tileStack = getWorldTileStack(item.x, item.y, item.z);
  if (!tileStack) {
    return 0;
  }
  let itemSurfaceHeight = 0;
  for (const itemUid of tileStack.itemUids) {
    if (itemUid === item.uid) {
      break;
    }
    const stackItem = findWorldItemByUid(itemUid);
    itemSurfaceHeight += getItemSurfaceHeight(stackItem);
  }
  return Math.min(itemSurfaceHeight, MAX_SURFACE_HEIGHT);
};

const applyItemRenderPartPosition = (element, position) => {
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
  element.style.width = `${position.width}px`;
  element.style.height = `${position.height}px`;
  element.style.zIndex = position.zIndex;
};

/* ---------- ITEMS - VALIDATION ATLAS FUTUR ---------- */

const isValidItemRenderPart = (part) => {
  if (
    !part ||
    !Number.isInteger(part.atlasCol) ||
    !Number.isInteger(part.atlasRow) ||
    !Number.isInteger(part.offsetX) ||
    !Number.isInteger(part.offsetY) ||
    !Number.isInteger(part.zOffset)
  ) {
    return false;
  }
  return true;
};

const areValidItemRenderParts = (parts) => {
  if (!parts || !Array.isArray(parts) || parts.length <= 0) {
    return false;
  }
  return parts.every((part) => {
    return isValidItemRenderPart(part);
  });
};
//#endregion  -----  ITEMS - DONNEES ET VALIDATION  -----

/* ==================================================== */
//#region     -----  ITEMS - INSTANCES, MONDE ET RENDU DOM  -----
/* ==================================================== */
/* ---------- ITEMS - CREATION DONNEES ---------- */
const createItemInstance = (itemId, quantity, content = []) => {
  const itemData = getItemData(itemId);
  if (!itemData) {
    return;
  }
  const itemInstance = {
    itemId,
    quantity,
    uid: nextItemInstanceId++,
  };

  if (itemData.use && "charges" in itemData.use) {
    itemInstance.charges = itemData.use.charges;
  }

  if (itemData.container) {
    itemInstance.content = content;
  }

  if (itemData.lightSource) {
    itemInstance.isLit = false;
    itemInstance.fuelRemainingMs = itemData.lightSource.fuelDurationMs;
    itemInstance.lastFuelUpdateAt = 0;
  }

  if (itemData.decayType) {
    const decayType = itemData.decayType;
    if (!(decayType in corpseDecayCooldown)) {
      return;
    }
    itemInstance.decayStage = 0;
    itemInstance.nextDecayAt = Date.now() + corpseDecayCooldown[decayType].stage0;
    decayingItems.push(itemInstance);
  }

  return itemInstance;
};

const createGroundItem = (itemId, quantity, x, y, z, content = []) => {
  const itemData = getItemData(itemId);
  if (!itemData) {
    return null;
  }
  const worldItem = createItemInstance(itemId, quantity, content);
  if (!worldItem) {
    return null;
  }
  worldItem.x = x;
  worldItem.y = y;
  worldItem.z = z;
  return worldItem;
};

/* ---------- ITEMS - CREATION RENDU ---------- */

const createWorldItemHitbox = (item) => {
  const itemData = getItemData(item.itemId);
  const hitbox = document.createElement("div");
  hitbox.setAttribute("data-item-uid", item.uid);
  hitbox.classList.add("hitbox");
  hitbox.style.width = `${TILE_SIZE}px`;
  hitbox.style.height = `${TILE_SIZE}px`;
  hitbox.style.left = `${item.x - camera.x}px`;
  hitbox.style.top = `${item.y - camera.y}px`;
  hitbox.style.zIndex = `${getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_EFFECT)}`;

  hitbox.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragState.isDragging) {
      inputState.shouldBlockNextContextMenu = true;
      cancelItemDrag();
      return;
    }
    if (shouldBlockContextMenuAction()) {
      return;
    }

    const monster = findMonsterAtPosition(item.x, item.y);
    if (monster) {
      selectMonster(monster);
      return;
    }

    const target = getPointerTargetFromEvent(e);
    if (handleNpcGreetingFromPointerTarget(target)) {
      return;
    }

    if (!itemData) {
      return;
    }
    const topItem = getTopWorldItemAtTile(item.x, item.y, item.z);
    if (!topItem) {
      return;
    }
    const source = {
      locationType: "worldItem",
      itemUid: topItem.uid,
    };
    handleUseItemFromSource(source);
  });
  return hitbox;
};

const renderGroundItemParts = (item) => {
  if (!item || item.z !== playerState.z) {
    return;
  }
  const enrichedParts = getItemRenderData(item);
  if (enrichedParts.length <= 0) {
    return;
  }

  const stackOffsetY = getWorldItemStackOffsetY(item);
  const stackIndex = getWorldItemStackIndex(item);
  upsertPixiWorldItemVisual({
    uid: item.uid,
    parts: enrichedParts,
    x: item.x,
    y: item.y - stackOffsetY,
    zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
  });

  const existingRefs = findWorldItemRenderRefs(item.uid);
  const hitbox = existingRefs?.hitbox ?? createWorldItemHitbox(item);
  if (!existingRefs?.hitbox) {
    game.appendChild(hitbox);
  }
  worldItemElementsByUid.set(item.uid, {
    hitbox,
  });
};

const findWorldItemRenderRefs = (itemUid) => {
  return worldItemElementsByUid.get(itemUid) ?? null;
};

const findWorldItemHitboxElement = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  return refs?.hitbox ?? null;
};
/* ---------- ITEMS - AFFICHAGE DOM ---------- */

const renderGroundItems = (items) => {
  for (const item of items) {
    renderGroundItemParts(item);
  }
};

/* ---------- ITEMS - AJOUT ET RETRAIT MONDE ---------- */

const addWorldItemToState = (worldItem) => {
  if (!isValidWorldItem(worldItem) || worldItemsByUid.has(worldItem.uid)) {
    return false;
  }

  worldItemsByUid.set(worldItem.uid, worldItem);

  if (!addItemUidToWorldTileStack(worldItem)) {
    worldItemsByUid.delete(worldItem.uid);
    return false;
  }

  return true;
};

const addGroundItem = (worldItem) => {
  const wasAdded = addWorldItemToState(worldItem);
  if (wasAdded) {
    renderGroundItems([worldItem]);
  }
  return wasAdded;
};

const removeWorldItemFromState = (itemUid) => {
  const worldItem = worldItemsByUid.get(itemUid);
  if (!worldItem) {
    return false;
  }

  removeItemUidFromWorldTileStack(worldItem);
  worldItemsByUid.delete(itemUid);
  return true;
};

const removeGroundItemRender = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  refs?.hitbox?.remove();
  removePixiWorldItemVisual(itemUid);

  worldItemElementsByUid.delete(itemUid);
};

const clearGroundItemRender = () => {
  for (const itemUid of worldItemElementsByUid.keys()) {
    removeGroundItemRender(itemUid);
  }
  clearPixiWorldItemVisuals();
};

const removeGroundItem = (itemUid) => {
  const wasRemoved = removeWorldItemFromState(itemUid);
  if (wasRemoved) {
    removeGroundItemRender(itemUid);
    return true;
  }
  return false;
};

/* ---------- ITEMS - POSITION RENDU DOM ---------- */

const updateItemPosition = () => {
  worldItemsByUid.forEach((item) => {
    if (item.z !== playerState.z) {
      removeGroundItemRender(item.uid);
      return;
    }
    const stackOffsetY = getWorldItemStackOffsetY(item);
    const stackIndex = getWorldItemStackIndex(item);
    updatePixiWorldItemTransform(
      item.uid,
      item.x,
      item.y - stackOffsetY,
      getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
    );

    const itemHitboxElement = findWorldItemHitboxElement(item.uid);
    if (itemHitboxElement) {
      const positionHitbox = {
        left: item.x - camera.x,
        top: item.y - camera.y,
        zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_EFFECT),
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      };
      applyItemRenderPartPosition(itemHitboxElement, positionHitbox);
    }
  });
};

const refreshGroundItemRender = (item) => {
  const parts = getItemRenderData(item);
  const stackOffsetY = getWorldItemStackOffsetY(item);
  const stackIndex = getWorldItemStackIndex(item);
  upsertPixiWorldItemVisual({
    uid: item.uid,
    parts,
    x: item.x,
    y: item.y - stackOffsetY,
    zIndex: getWorldRenderZIndex(item.y, WORLD_RENDER_LAYER_ITEM + stackIndex),
  });
};

/* ---------- ITEMS - TORCHES ---------- */

const syncTorchFuel = (item, now) => {
  if (!item?.isLit || !Number.isFinite(item.fuelRemainingMs) || !Number.isFinite(now)) {
    return false;
  }

  const previousStage = getTorchFuelStage(item);
  if (!Number.isFinite(item.lastFuelUpdateAt) || item.lastFuelUpdateAt <= 0) {
    item.lastFuelUpdateAt = now;
    return false;
  }

  const elapsed = Math.max(0, now - item.lastFuelUpdateAt);
  item.lastFuelUpdateAt = now;
  item.fuelRemainingMs = Math.max(0, item.fuelRemainingMs - elapsed);

  if (item.fuelRemainingMs <= 0) {
    item.isLit = false;
    item.lastFuelUpdateAt = 0;
    activeLitTorchesByUid.delete(item.uid);
  }

  return previousStage !== getTorchFuelStage(item) || !item.isLit;
};

const syncActiveTorchFuel = (now) => {
  for (const item of activeLitTorchesByUid.values()) {
    if (syncTorchFuel(item, now)) {
      refreshAllByUid(item.uid);
    }
  }
};

const updateTorchFuel = (now) => {
  if (!Number.isFinite(now) || now < nextTorchFuelRefresh) {
    return;
  }
  nextTorchFuelRefresh = now + TORCH_FUEL_REFRESH_INTERVAL_MS;
  syncActiveTorchFuel(now);
};

/* ---------- ITEMS - DECAY ---------- */
const getCorpseDecayProfile = (item) => {
  const itemData = getItemData(item.itemId);
  if (!itemData || !itemData.decayType) {
    return null;
  }
  const decayType = itemData.decayType;
  if (!(decayType in corpseDecayCooldown)) {
    return null;
  }
  if (!corpseDecayCooldown[decayType]) {
    return null;
  }
  return corpseDecayCooldown[decayType];
};

const applyCorpseDecayStageOne = (item, profile, now) => {
  if (!item || !profile || !("decayStage" in item) || item.decayStage !== 0) {
    return false;
  }
  item.decayStage = 1;
  item.nextDecayAt = now + profile.stage1;
  refreshAllByUid(item.uid);
  return true;
};

const applyCorpseDecayStageTwo = (item, profile, now) => {
  if (!item || !profile || !("decayStage" in item) || item.decayStage !== 1) {
    return false;
  }
  item.decayStage = 2;
  item.nextDecayAt = now + profile.stage2;
  if (isContainerItem(item)) {
    closeContainerAndChildren(item);
    cancelItemDrag();
    cancelItemUse();
  }
  refreshAllByUid(item.uid);
  return true;
};

const applyCorpseDecayRemoval = (item) => {
  if (!item) {
    return false;
  }
  removeAllByUid(item.uid);
  return true;
};
const updateCorpseDecay = (now) => {
  if (nextDecayRefresh < now) {
    nextDecayRefresh = now + DECAY_REFRESH_COOLDOWN_MS;

    for (let i = decayingItems.length - 1; i >= 0; i--) {
      const item = decayingItems[i];

      if ("nextDecayAt" in item) {
        if (now < item.nextDecayAt) {
          continue;
        }

        const profile = getCorpseDecayProfile(item);
        if (!profile) {
          continue;
        }

        if (item.decayStage === 0) {
          applyCorpseDecayStageOne(item, profile, now);
        } else if (item.decayStage === 1) {
          applyCorpseDecayStageTwo(item, profile, now);
        } else if (item.decayStage === 2) {
          applyCorpseDecayRemoval(item);
        }
      }
    }
  }
};

/* ---------- ITEMS - COLLISION ---------- */

const isBlockingItemAtPosition = (x, y, z = playerState.z) => {
  const tileStack = getWorldTileStack(x, y, z);
  if (!tileStack) {
    return false;
  }

  return tileStack.itemUids.some((itemUid) => {
    const item = worldItemsByUid.get(itemUid);
    if (!item) {
      return false;
    }

    const itemData = getItemData(item.itemId);
    return itemData?.blockMovement === true;
  });
};
//#endregion  -----  ITEMS - INSTANCES, MONDE ET RENDU DOM  -----

/* ==================================================== */
//#region     -----  EFFETS DE SOL  -----
/* ==================================================== */
const getGroundEffectData = (groundEffectId) => {
  return groundEffectsDatabase[groundEffectId] ?? null;
};

const renderGroundEffect = (groundEffect) => {
  if (!groundEffect || groundEffect.z !== playerState.z) {
    return false;
  }

  const groundEffectData = getGroundEffectData(groundEffect.groundEffectId);
  if (!groundEffectData) {
    return false;
  }

  const source = getAtlasSource(
    groundEffectData.atlasCol + groundEffect.decayStage,
    groundEffectData.atlasRow,
    SPRITE_SIZE,
  );
  return upsertPixiGroundEffectVisual({
    uid: groundEffect.uid,
    ...source,
    x: groundEffect.x,
    y: groundEffect.y,
  });
};

const removeGroundEffect = (groundEffectUid) => {
  const groundEffect = groundEffectsByUid.get(groundEffectUid);
  if (!groundEffect) {
    return false;
  }

  const tileKey = getWorldTileStackKey(groundEffect.x, groundEffect.y, groundEffect.z);
  if (groundEffectUidByTileKey.get(tileKey) === groundEffectUid) {
    groundEffectUidByTileKey.delete(tileKey);
  }
  groundEffectsByUid.delete(groundEffectUid);
  removePixiGroundEffectVisual(groundEffectUid);
  return true;
};

const addOrRefreshGroundEffect = (groundEffectId, x, y, z, decayStage = 0, now = Date.now()) => {
  if (
    !getGroundEffectData(groundEffectId) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z) ||
    !Number.isInteger(decayStage) ||
    decayStage < 0 ||
    decayStage > 2 ||
    !Number.isFinite(now)
  ) {
    return null;
  }

  const tileKey = getWorldTileStackKey(x, y, z);
  const existingUid = groundEffectUidByTileKey.get(tileKey) ?? null;
  let groundEffect = groundEffectsByUid.get(existingUid) ?? null;

  if (!groundEffect) {
    groundEffect = {
      uid: nextGroundEffectUid++,
      groundEffectId,
      x,
      y,
      z,
      decayStage,
      nextDecayAt: now + GROUND_EFFECT_DECAY_STAGE_MS,
    };
    groundEffectsByUid.set(groundEffect.uid, groundEffect);
    groundEffectUidByTileKey.set(tileKey, groundEffect.uid);
  } else {
    groundEffect.groundEffectId = groundEffectId;
    groundEffect.decayStage = decayStage;
    groundEffect.nextDecayAt = now + GROUND_EFFECT_DECAY_STAGE_MS;
  }

  renderGroundEffect(groundEffect);
  return groundEffect;
};

const syncGroundEffectRenderForCurrentZ = () => {
  clearPixiGroundEffectVisuals();
  for (const groundEffect of groundEffectsByUid.values()) {
    renderGroundEffect(groundEffect);
  }
};

const updateGroundEffectDecay = (now) => {
  if (now < nextGroundEffectDecayRefresh) {
    return;
  }
  nextGroundEffectDecayRefresh = now + DECAY_REFRESH_COOLDOWN_MS;

  for (const groundEffect of [...groundEffectsByUid.values()]) {
    if (now < groundEffect.nextDecayAt) {
      continue;
    }
    if (groundEffect.decayStage >= 2) {
      removeGroundEffect(groundEffect.uid);
      continue;
    }
    groundEffect.decayStage += 1;
    groundEffect.nextDecayAt = now + GROUND_EFFECT_DECAY_STAGE_MS;
    renderGroundEffect(groundEffect);
  }
};
//#endregion  -----  EFFETS DE SOL  -----

/* ==================================================== */
//#region     -----  INVENTAIRE - POIDS ET CAPACITE  -----
/* ==================================================== */
/* ---------- INVENTAIRE - CALCULE DONNEES ---------- */

const getItemTotalWeight = (item) => {
  if (!item) {
    return 0;
  }

  let totalWeight = 0;
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return 0;
  }
  const weight = itemData.weight * item.quantity;
  totalWeight += weight;
  if (isContainerItem(item) && item.content && item.content.length > 0) {
    item.content.forEach((itemInBag) => {
      totalWeight += getItemTotalWeight(itemInBag);
    });
  }
  return totalWeight;
};

const calculatePlayerCarriedWeight = () => {
  let totalWeight = 0;
  Object.values(playerState.equipment).forEach((equipment) => {
    if (equipment) {
      totalWeight += getItemTotalWeight(equipment);
    }
  });
  return totalWeight;
};

const getPlayerRemainingCapacity = () => {
  const remainingCapacity = playerState.capacity - playerState.carriedWeight;
  return Number(remainingCapacity.toFixed(1));
};

const updatePlayerCarriedWeight = () => {
  playerState.carriedWeight = Number(calculatePlayerCarriedWeight().toFixed(2));
};

/* ---------- INVENTAIRE - MONNAIE ET RETRAITS ---------- */

const visitContainerItems = (containerItem, visitor) => {
  if (!Array.isArray(containerItem?.content) || typeof visitor !== "function") {
    return;
  }
  for (let slotIndex = 0; slotIndex < containerItem.content.length; slotIndex++) {
    const item = containerItem.content[slotIndex];
    if (!item) {
      continue;
    }
    visitor(item, containerItem, slotIndex);
    if (Array.isArray(item.content)) {
      visitContainerItems(item, visitor);
    }
  }
};

const getPlayerBackpackItemQuantity = (itemId) => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || typeof itemId !== "string") {
    return 0;
  }
  let quantity = 0;
  visitContainerItems(backpack, (item) => {
    if (item.itemId === itemId) {
      quantity += item.quantity;
    }
  });
  return quantity;
};

const getPlayerGoldAmount = () => {
  return getPlayerBackpackItemQuantity("goldCoin");
};

const createPlayerBackpackItemRemovalPlan = (itemId, quantity) => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || typeof itemId !== "string" || !Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, reason: "configuration" };
  }

  let remainingQuantity = quantity;
  const operations = [];
  visitContainerItems(backpack, (item, containerItem, slotIndex) => {
    if (remainingQuantity <= 0 || item.itemId !== itemId) {
      return;
    }
    const quantityToRemove = Math.min(item.quantity, remainingQuantity);
    operations.push({ containerItem, slotIndex, item, quantity: quantityToRemove });
    remainingQuantity -= quantityToRemove;
  });

  if (remainingQuantity > 0) {
    return { success: false, reason: "quantity" };
  }
  return { success: true, operations };
};

const commitPlayerBackpackItemRemovalPlan = (removalPlan) => {
  if (!removalPlan?.success || !Array.isArray(removalPlan.operations)) {
    return false;
  }
  for (const operation of removalPlan.operations) {
    if (operation.quantity >= operation.item.quantity) {
      operation.containerItem.content[operation.slotIndex] = null;
    } else {
      operation.item.quantity -= operation.quantity;
    }
  }
  return true;
};

const rollbackPlayerBackpackItemRemovalPlan = (removalPlan) => {
  if (!removalPlan?.success || !Array.isArray(removalPlan.operations)) {
    return false;
  }
  for (let index = removalPlan.operations.length - 1; index >= 0; index--) {
    const operation = removalPlan.operations[index];
    if (operation.containerItem.content[operation.slotIndex] === null) {
      operation.containerItem.content[operation.slotIndex] = operation.item;
    } else {
      operation.item.quantity += operation.quantity;
    }
  }
  return true;
};

const spendPlayerGold = (goldAmount) => {
  const removalPlan = createPlayerBackpackItemRemovalPlan("goldCoin", goldAmount);
  if (!removalPlan.success) {
    return false;
  }
  return commitPlayerBackpackItemRemovalPlan(removalPlan);
};

/* ---------- INVENTAIRE - TRANSACTIONS DE RECOMPENSE ---------- */

const getRewardTableData = (rewardTableId) => {
  if (typeof rewardTableId !== "string" || !(rewardTableId in rewardTablesDatabase)) {
    return null;
  }
  return rewardTablesDatabase[rewardTableId];
};

const getRewardItemsTotalWeight = (rewardItems) => {
  if (!Array.isArray(rewardItems)) {
    return null;
  }

  let totalWeight = 0;
  for (const rewardItem of rewardItems) {
    const itemData = getItemData(rewardItem?.itemId);
    if (!itemData || !Number.isInteger(rewardItem.quantity) || rewardItem.quantity <= 0) {
      return null;
    }
    totalWeight += itemData.weight * rewardItem.quantity;
  }
  return totalWeight;
};

const createContainerInsertionPlan = (containerItem, itemEntries) => {
  const containerData = getItemData(containerItem?.itemId);
  if (!containerItem?.content || !containerData?.capacity || !Array.isArray(itemEntries)) {
    return { success: false, reason: "container" };
  }

  const simulatedSlots = Array.from({ length: containerData.capacity }, (_, slotIndex) => {
    const slotItem = containerItem.content[slotIndex];
    if (!slotItem) {
      return null;
    }
    return {
      itemId: slotItem.itemId,
      quantity: slotItem.quantity,
    };
  });
  const operations = [];

  for (const itemEntry of itemEntries) {
    const itemData = getItemData(itemEntry?.itemId);
    if (!itemData || !Number.isInteger(itemEntry.quantity) || itemEntry.quantity <= 0) {
      return { success: false, reason: "configuration" };
    }

    let remainingQuantity = itemEntry.quantity;

    if (itemData.stackable) {
      for (let slotIndex = 0; slotIndex < simulatedSlots.length && remainingQuantity > 0; slotIndex++) {
        const simulatedItem = simulatedSlots[slotIndex];
        if (!simulatedItem || simulatedItem.itemId !== itemEntry.itemId || simulatedItem.quantity >= MAX_ITEM_STACK_SIZE) {
          continue;
        }

        const quantityToStack = Math.min(MAX_ITEM_STACK_SIZE - simulatedItem.quantity, remainingQuantity);
        simulatedItem.quantity += quantityToStack;
        remainingQuantity -= quantityToStack;
        operations.push({ type: "stack", slotIndex, quantity: quantityToStack });
      }

      while (remainingQuantity > 0) {
        const slotIndex = simulatedSlots.findIndex((slotItem) => slotItem === null);
        if (slotIndex === -1) {
          return { success: false, reason: "space" };
        }

        const quantityToCreate = Math.min(remainingQuantity, MAX_ITEM_STACK_SIZE);
        simulatedSlots[slotIndex] = {
          itemId: itemEntry.itemId,
          quantity: quantityToCreate,
        };
        remainingQuantity -= quantityToCreate;
        operations.push({
          type: "create",
          slotIndex,
          itemId: itemEntry.itemId,
          quantity: quantityToCreate,
        });
      }
      continue;
    }

    while (remainingQuantity > 0) {
      const slotIndex = simulatedSlots.findIndex((slotItem) => slotItem === null);
      if (slotIndex === -1) {
        return { success: false, reason: "space" };
      }

      simulatedSlots[slotIndex] = {
        itemId: itemEntry.itemId,
        quantity: 1,
      };
      remainingQuantity--;
      operations.push({
        type: "create",
        slotIndex,
        itemId: itemEntry.itemId,
        quantity: 1,
      });
    }
  }

  return {
    success: true,
    containerItem,
    operations,
  };
};

const commitContainerInsertionPlan = (insertionPlan) => {
  if (!insertionPlan?.success || !insertionPlan.containerItem?.content || !Array.isArray(insertionPlan.operations)) {
    return false;
  }

  const createdItemsByOperationIndex = new Map();
  for (let operationIndex = 0; operationIndex < insertionPlan.operations.length; operationIndex++) {
    const operation = insertionPlan.operations[operationIndex];
    if (operation.type !== "create") {
      continue;
    }
    const item = createItemInstance(operation.itemId, operation.quantity);
    if (!item) {
      return false;
    }
    createdItemsByOperationIndex.set(operationIndex, item);
  }

  for (let operationIndex = 0; operationIndex < insertionPlan.operations.length; operationIndex++) {
    const operation = insertionPlan.operations[operationIndex];
    if (operation.type === "stack") {
      const slotItem = insertionPlan.containerItem.content[operation.slotIndex];
      if (!slotItem) {
        return false;
      }
      slotItem.quantity += operation.quantity;
    } else if (operation.type === "create") {
      insertionPlan.containerItem.content[operation.slotIndex] = createdItemsByOperationIndex.get(operationIndex);
    }
  }
  return true;
};

const grantRewardItemsToPlayer = (rewardItems) => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || !isOpenableContainerItem(backpack)) {
    return { success: false, reason: "backpack" };
  }

  const rewardWeight = getRewardItemsTotalWeight(rewardItems);
  if (!Number.isFinite(rewardWeight)) {
    return { success: false, reason: "configuration" };
  }

  const remainingCapacity = playerState.capacity - calculatePlayerCarriedWeight();
  if (rewardWeight > remainingCapacity) {
    return { success: false, reason: "capacity" };
  }

  const insertionPlan = createContainerInsertionPlan(backpack, rewardItems);
  if (!insertionPlan.success) {
    return insertionPlan;
  }
  if (!commitContainerInsertionPlan(insertionPlan)) {
    return { success: false, reason: "commit" };
  }

  refreshInventoryUi();
  return { success: true };
};

//#endregion  -----  INVENTAIRE - POIDS ET CAPACITE  -----

/* ==================================================== */
//#region     -----  DRAG AND DROP - SOURCES, DESTINATIONS ET REGLES  -----
/* ==================================================== */

/* ---------- DRAG - ETAT ---------- */

const resetDragState = () => {
  dragState.isDragging = false;
  dragState.item = null;
  dragState.sourceLocationType = null;
  dragState.sourceSlotIndex = null;
  dragState.sourceEquipmentSlotName = null;
  dragState.sourceParentContainerUid = null;
  dragState.sourceItemUid = null;
};

const cancelItemDrag = () => {
  const draggingSlots = document.querySelectorAll(".container-slot-dragging");
  draggingSlots.forEach((slot) => {
    slot.classList.remove("container-slot-dragging");
  });

  clearPixiWorldItemSelection();

  resetDragState();
  resetDragStatePending();
  resetInputComboState();
};

const resetDragStatePending = () => {
  dragState.pendingSourceLocation = null;
  dragState.pendingSlotElement = null;
  dragState.startScreenX = null;
  dragState.startScreenY = null;
};

/* ---------- DRAG - DEPART SOURCE ---------- */

const startItemDrag = (source) => {
  if (!source) {
    return;
  }
  const item = getDragSourceItem(source);
  if (!item) {
    return;
  }
  resetDragState();
  inputState.shouldBlockNextWorldClick = true;
  dragState.isDragging = true;
  dragState.item = item;

  if (source.locationType === "containerSlot") {
    dragState.sourceLocationType = "containerSlot";
    dragState.sourceParentContainerUid = source.parentContainerUid;
    dragState.sourceSlotIndex = source.slotIndex;
  } else if (source.locationType === "equipmentSlot") {
    dragState.sourceLocationType = "equipmentSlot";
    dragState.sourceEquipmentSlotName = source.equipmentSlotName;
  } else if (source.locationType === "worldItem") {
    dragState.sourceLocationType = "worldItem";
    dragState.sourceItemUid = source.itemUid;
  } else {
    resetDragState();
    return;
  }
};

/* ---------- DRAG - LECTURE SOURCE ---------- */
const getDragSourceFromState = () => {
  if (!dragState.isDragging) {
    return null;
  }
  if (dragState.sourceLocationType === "containerSlot") {
    return {
      locationType: dragState.sourceLocationType,
      parentContainerUid: dragState.sourceParentContainerUid,
      slotIndex: dragState.sourceSlotIndex,
    };
  } else if (dragState.sourceLocationType === "equipmentSlot") {
    return {
      locationType: dragState.sourceLocationType,
      equipmentSlotName: dragState.sourceEquipmentSlotName,
    };
  } else if (dragState.sourceLocationType === "worldItem") {
    return {
      locationType: dragState.sourceLocationType,
      itemUid: dragState.sourceItemUid,
    };
  } else {
    return null;
  }
};

const getDragSourceItem = (source) => {
  if (!source) {
    return null;
  }

  if (source.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(source);

    if (!isValidContainerSlotParent(parentContainer)) {
      return null;
    }
    return parentContainer.content[source.slotIndex];
  } else if (source.locationType === "equipmentSlot") {
    const item = getEquipmentSlotItem(source.equipmentSlotName);
    return item;
  } else if (source.locationType === "worldItem") {
    const item = findWorldItemByUid(source.itemUid);
    if (!item) {
      return null;
    }
    return item;
  } else {
    return null;
  }
};

/* ---------- DRAG - MODIFICATION SOURCE ---------- */

const isValidContainerSlotParent = (parentContainer) => {
  if (parentContainer && parentContainer.content && isOpenableContainerItem(parentContainer)) {
    return true;
  }
  return false;
};

const removeItemFromContainerSlot = (source, item) => {
  const wasRemoved = setContainerSlotItem(source, null);
  if (wasRemoved) {
    return item;
  } else {
    return null;
  }
};

const removeItemFromEquipmentSlot = (source, item) => {
  const wasRemoved = setEquipmentSlotItem(source, null);

  if (!wasRemoved) {
    return null;
  }

  return item;
};

const removeItemFromWorldItem = (source, item) => {
  const wasRemoved = removeGroundItem(source.itemUid);
  if (wasRemoved) {
    return item;
  } else {
    return null;
  }
};

const removeItemFromDragSource = (source) => {
  if (!source) {
    return null;
  }
  const item = getDragSourceItem(source);
  if (!item) {
    return null;
  }
  if (source.locationType === "containerSlot") {
    return removeItemFromContainerSlot(source, item);
  } else if (source.locationType === "equipmentSlot") {
    return removeItemFromEquipmentSlot(source, item);
  } else if (source.locationType === "worldItem") {
    return removeItemFromWorldItem(source, item);
  } else {
    return null;
  }
};

const setEquipmentSlotItem = (itemLocation, item) => {
  if (!itemLocation || itemLocation.locationType !== "equipmentSlot" || !itemLocation.equipmentSlotName) {
    return false;
  }
  const equipmentSlotName = itemLocation.equipmentSlotName;
  if (!(equipmentSlotName in playerState.equipment)) {
    return false;
  }
  playerState.equipment[equipmentSlotName] = item;
  return true;
};

/* ---------- DRAG - DESTINATION ---------- */

const placeItemInContainerSlot = (destination, item) => {
  const existingItem = getItemFromLocation(destination);
  const wasPlaced = setContainerSlotItem(destination, item);

  if (!wasPlaced) {
    return null;
  }

  if (existingItem) {
    return existingItem;
  }

  return true;
};

const placeItemInEquipmentSlot = (destination, item) => {
  if (
    !destination.equipmentSlotName ||
    !(destination.equipmentSlotName in playerState.equipment) ||
    !canPlaceItemInEquipmentSlot(item, destination.equipmentSlotName)
  ) {
    return null;
  }

  const existingItem = getItemFromLocation(destination);

  const wasPlaced = setEquipmentSlotItem(destination, item);
  if (!wasPlaced) {
    return null;
  }

  if (existingItem) {
    return existingItem;
  }

  return true;
};

const placeItemOnWorldTile = (destination, item) => {
  const wasPositioned = setWorldItemPosition(destination, item);
  if (!wasPositioned) {
    return false;
  }
  addGroundItem(item);
  return true;
};

const placeItemInDragDestination = (destination, item) => {
  if (!destination || !item) {
    return null;
  }
  if (destination.locationType === "containerSlot") {
    return placeItemInContainerSlot(destination, item);
  } else if (destination.locationType === "equipmentSlot") {
    return placeItemInEquipmentSlot(destination, item);
  } else if (destination.locationType === "worldTile") {
    return placeItemOnWorldTile(destination, item);
  } else {
    return null;
  }
};

const isItemInsideContainer = (containerItem, searchedItemUid) => {
  if (!containerItem || !containerItem.content) {
    return false;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData || !itemData.capacity) {
    return false;
  }
  for (let index = 0; index < itemData.capacity; index++) {
    const item = containerItem.content[index];

    if (!item) {
      continue;
    }
    if (item.uid === searchedItemUid) {
      return true;
    }
    if (isContainerItem(item)) {
      if (isItemInsideContainer(item, searchedItemUid)) {
        return true;
      }
    }
  }
  return false;
};

const setWorldItemPosition = (destination, item) => {
  if (!item || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y)) {
    return false;
  }

  const col = destination.x / TILE_SIZE;
  const row = destination.y / TILE_SIZE;

  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const worldChunk = getWorldChunkForTilePosition(currentWorldMap, col, row);
  if (!worldChunk) {
    return false;
  }

  if (isTiledCollisionAtTile(currentWorldMap, col, row)) {
    return false;
  }

  item.z = destination.z ?? playerState.z;

  if (!canAddItemSurfaceToTile(item, destination.x, destination.y)) {
    return false;
  }

  return moveItemUidToWorldTileStack(item, destination.x, destination.y);
};
/* ---------- DRAG - VALIDATION ACTION COMPLETE ---------- */
const refreshInventoryUi = () => {
  updatePlayerCarriedWeight();
  updatePlayerInventory();
  renderContainerDock();
};

const refreshItemUiAfterDrag = () => {
  relocateInvalidEquippedAmmunition();
  refreshInventoryUi();
  cancelItemDrag();
};

const canPlaceItemInEquipmentSlot = (item, slotName) => {
  if (!item || !slotName) {
    return false;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData || !Array.isArray(itemData.equipmentSlot)) {
    return false;
  }
  if (!itemData.equipmentSlot.includes(slotName)) {
    return false;
  }

  if (slotName === "weapon" && itemData.combat?.ammunitionItemId) {
    const offhandItem = playerState.equipment.shield;
    if (offhandItem && offhandItem.itemId !== itemData.combat.ammunitionItemId) {
      return false;
    }
  }

  if (slotName === "shield" && Number.isFinite(itemData.combat?.shieldDefense)) {
    const equippedWeapon = playerState.equipment.weapon;
    const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
    if (equippedWeaponData?.combat?.ammunitionItemId) {
      return false;
    }
  }

  if (slotName === "shield" && itemData.type === "ammunition") {
    const equippedWeapon = playerState.equipment.weapon;
    const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
    if (equippedWeaponData?.combat?.ammunitionItemId !== item.itemId) {
      return false;
    }
  }

  return true;
};

const findFirstStackableContainerSlot = (containerItem, itemToAdd) => {
  if (!containerItem?.content || !itemToAdd) {
    return null;
  }
  const itemToAddData = getItemData(itemToAdd.itemId);
  if (!itemToAddData?.stackable) {
    return null;
  }
  const containerData = getItemData(containerItem.itemId);
  if (!containerData?.capacity) {
    return null;
  }
  for (let index = 0; index < containerData.capacity; index++) {
    const slotItem = containerItem.content[index];
    if (!slotItem) {
      continue;
    }
    if (slotItem.itemId === itemToAdd.itemId && slotItem.quantity < 100) {
      return index;
    }
  }

  return null;
};

const findBestContainerSlotForItem = (containerItem, itemToAdd) => {
  return (
    findFirstStackableContainerSlot(containerItem, itemToAdd) ?? findFirstEmptyContainerSlot(containerItem) ?? null
  );
};

const findFirstEmptyContainerSlot = (containerItem) => {
  if (!containerItem || !containerItem.content) {
    return null;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData?.capacity) {
    return null;
  }
  for (let index = 0; index < itemData.capacity; index++) {
    if (!containerItem.content[index]) {
      return index;
    }
  }
  return null;
};

const findContainerSlotForWholeItem = (containerItem, itemToAdd) => {
  if (!containerItem?.content || !itemToAdd) {
    return null;
  }
  const containerData = getItemData(containerItem.itemId);
  const itemData = getItemData(itemToAdd.itemId);
  if (!containerData?.capacity || !itemData) {
    return null;
  }

  if (itemData.stackable) {
    for (let index = 0; index < containerData.capacity; index++) {
      const slotItem = containerItem.content[index];
      if (slotItem?.itemId === itemToAdd.itemId && slotItem.quantity + itemToAdd.quantity <= 100) {
        return { index, shouldStack: true };
      }
    }
  }

  const emptySlot = findFirstEmptyContainerSlot(containerItem);
  if (emptySlot === null) {
    return null;
  }
  return { index: emptySlot, shouldStack: false };
};

const relocateInvalidEquippedAmmunition = () => {
  const ammunition = playerState.equipment.shield;
  const ammunitionData = ammunition ? getItemData(ammunition.itemId) : null;
  if (ammunitionData?.type !== "ammunition") {
    return false;
  }

  const equippedWeapon = playerState.equipment.weapon;
  const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
  if (equippedWeaponData?.combat?.ammunitionItemId === ammunition.itemId) {
    return false;
  }

  const backpack = playerState.equipment.backpack;
  const backpackDestination = findContainerSlotForWholeItem(backpack, ammunition);
  if (backpackDestination) {
    const destinationItem = backpack.content[backpackDestination.index];
    if (backpackDestination.shouldStack) {
      destinationItem.quantity += ammunition.quantity;
    } else {
      backpack.content[backpackDestination.index] = ammunition;
    }
    playerState.equipment.shield = null;
    return true;
  }

  ammunition.x = playerState.x;
  ammunition.y = playerState.y;
  ammunition.z = playerState.z;
  if (!addGroundItem(ammunition)) {
    return false;
  }
  playerState.equipment.shield = null;
  return true;
};

const canInteractWithWorldItemSource = (source) => {
  if (source?.locationType !== "worldItem") {
    return false;
  }
  const item = getDragSourceItem(source);
  return isWorldItemAvailableForInteraction(item) && isNearPlayer(item, 1);
};

const isWorldItemAvailableForInteraction = (item) => {
  return item?.z === playerState.z && isWorldItemTopOfTileStack(item);
};

const shouldCloseOpenedContainerByDistance = (containerWrapper) => {
  if (!containerWrapper) {
    return false;
  }
  if (containerWrapper.sourceType !== "world") {
    return false;
  }
  if (containerWrapper.item.z !== playerState.z) {
    return true;
  }
  return !isNearPlayer(containerWrapper.item, 1);
};

const closeFarOpenedContainers = () => {
  for (let index = openedContainers.length - 1; index >= 0; index--) {
    const container = openedContainers[index];

    const rootWrapper = getOpenedContainerRootWrapper(container);
    if (!rootWrapper) {
      continue;
    }
    if (shouldCloseOpenedContainerByDistance(rootWrapper)) {
      closeContainerAndChildren(container.item);
    }
  }
};

const getParentContainerFromContainerSlotLocation = (itemLocation) => {
  if (!itemLocation || itemLocation.locationType !== "containerSlot" || !("parentContainerUid" in itemLocation)) {
    return null;
  }
  const parentContainerLocation = findItemLocationByUid(itemLocation.parentContainerUid);
  if (!parentContainerLocation) {
    return null;
  }
  const parentContainer = getItemFromLocation(parentContainerLocation);
  return parentContainer;
};

const rollbackDraggedItem = (rollbackDestination, item) => {
  if (!rollbackDestination || !item) {
    return false;
  }
  const wasRollbackPlaced = placeItemInDragDestination(rollbackDestination, item);
  if (!wasRollbackPlaced) {
    return false;
  }
  return true;
};

const setContainerSlotItem = (itemLocation, item) => {
  const parentContainer = getParentContainerFromContainerSlotLocation(itemLocation);
  if (isValidContainerSlotParent(parentContainer)) {
    parentContainer.content[itemLocation.slotIndex] = item;
    return true;
  }
  return false;
};

const updateOpenedContainerSourceType = (item, sourceType) => {
  const openedContainerWrapper = findOpenedContainerWrapperByUid(item.uid);
  if (!openedContainerWrapper) {
    return;
  }
  openedContainerWrapper.sourceType = sourceType;
};

const tryStackItemsDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (destinationItem && sourceItem.itemId === destinationItem.itemId) {
    const itemData = getItemData(sourceItem.itemId);
    let canMoveRestToFreeSlot = true;
    if (itemData && itemData.stackable) {
      const freeStackSpace = 100 - destinationItem.quantity;
      let quantityAllowed = freeStackSpace;
      if (!isItemLocationCarriedByPlayer(source) && isItemLocationCarriedByPlayer(destination)) {
        const freeCapSpace = playerState.capacity - calculatePlayerCarriedWeight();
        const maxQuantityByCapacity = Math.floor(freeCapSpace / itemData.weight);
        quantityAllowed = Math.min(freeStackSpace, maxQuantityByCapacity);
        const remainingQuantityAfterStack = Math.max(sourceItem.quantity - quantityAllowed, 0);
        canMoveRestToFreeSlot = maxQuantityByCapacity >= remainingQuantityAfterStack;
      }
      if (freeStackSpace <= 0) {
        return false;
      }

      if (quantityAllowed <= 0) {
        cancelItemDrag();
        return true;
      }

      if (sourceItem.quantity <= quantityAllowed) {
        destinationItem.quantity += sourceItem.quantity;
        removeItemFromDragSource(source);
        refreshItemUiAfterDrag();
        return true;
      }

      if (sourceItem.quantity > quantityAllowed) {
        destinationItem.quantity += quantityAllowed;
        sourceItem.quantity -= quantityAllowed;
      }
      if (destination.locationType === "containerSlot" && quantityAllowed === freeStackSpace && canMoveRestToFreeSlot) {
        const parentContainer = getParentContainerFromContainerSlotLocation(destination);

        if (!parentContainer || !parentContainer.content) {
          refreshItemUiAfterDrag();
          return true;
        }

        const freeSlot = findFirstEmptyContainerSlot(parentContainer);
        if (freeSlot !== null) {
          const tempDestination = {
            locationType: "containerSlot",
            parentContainerUid: destination.parentContainerUid,
            slotIndex: freeSlot,
          };

          let rollbackDestination = source;

          if (source.locationType === "worldItem") {
            rollbackDestination = {
              locationType: "worldTile",
              x: sourceItem.x,
              y: sourceItem.y,
              z: sourceItem.z,
            };
          }

          const removedItem = removeItemFromDragSource(source);
          if (!removedItem) {
            cancelItemDrag();
            return true;
          }
          const result = placeItemInDragDestination(tempDestination, removedItem);
          if (!result) {
            const wasRollbackPlaced = rollbackDraggedItem(rollbackDestination, removedItem);
            if (!wasRollbackPlaced) {
              cancelItemDrag();
              return true;
            }
          }
        }
      }
      refreshItemUiAfterDrag();
      return true;
    }
  }

  return false;
};

const tryMoveItemOnContainerItemDuringDrag = (source, sourceItem, destinationItem) => {
  if (destinationItem && isOpenableContainerItem(destinationItem)) {
    if (destinationItem === sourceItem) {
      cancelItemDrag();
      return true;
    }

    const bestSlot = findBestContainerSlotForItem(destinationItem, sourceItem);
    if (bestSlot === null) {
      cancelItemDrag();
      return true;
    }

    const bestSlotItem = destinationItem.content[bestSlot];

    const destinationSlotContainer = {
      locationType: "containerSlot",
      parentContainerUid: destinationItem.uid,
      slotIndex: bestSlot,
    };

    if (bestSlotItem) {
      return tryStackItemsDuringDrag(source, sourceItem, destinationSlotContainer, bestSlotItem);
    }

    if (!isItemCarriedByPlayer(sourceItem.uid) && isItemCarriedByPlayer(destinationItem.uid)) {
      if (getItemTotalWeight(sourceItem) > getPlayerRemainingCapacity()) {
        cancelItemDrag();
        return true;
      }
    }
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destinationSlotContainer, removedItem);
    if (isContainerItem(removedItem)) {
      updateOpenedContainerSourceType(removedItem, "container");
    }

    refreshItemUiAfterDrag();
    return true;
  }

  return false;
};

const shouldMoveItemToFreeContainerSlotInsteadOfSwap = (source, sourceItem, destination, destinationItem) => {
  if (!source || !sourceItem || !destination || !destinationItem) {
    return false;
  }

  if (destination.locationType !== "containerSlot") {
    return false;
  }

  const sourceIsWorld = source.locationType === "worldItem";
  const sourceIsUncarriedContainerSlot =
    source.locationType === "containerSlot" && !isItemLocationCarriedByPlayer(source);

  if (!sourceIsWorld && !sourceIsUncarriedContainerSlot) {
    return false;
  }

  const sameItem = sourceItem.itemId === destinationItem.itemId;
  const itemData = getItemData(sourceItem.itemId);
  const isStackable = itemData?.stackable === true;

  if (!sameItem) {
    return true;
  }

  return !isStackable;
};

const tryMoveItemToFreeContainerSlotInsteadOfSwapDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (!shouldMoveItemToFreeContainerSlotInsteadOfSwap(source, sourceItem, destination, destinationItem)) {
    return false;
  }

  const parentContainer = getParentContainerFromContainerSlotLocation(destination);
  const bestSlot = findBestContainerSlotForItem(parentContainer, sourceItem);

  if (bestSlot === null) {
    return false;
  }

  const bestSlotItem = parentContainer.content[bestSlot];

  if (bestSlotItem) {
    const bestDestination = {
      locationType: "containerSlot",
      parentContainerUid: destination.parentContainerUid,
      slotIndex: bestSlot,
    };

    return tryStackItemsDuringDrag(source, sourceItem, bestDestination, bestSlotItem);
  }

  let rollbackDestination = source;

  if (source.locationType === "worldItem") {
    rollbackDestination = {
      locationType: "worldTile",
      x: sourceItem.x,
      y: sourceItem.y,
      z: sourceItem.z,
    };
  }

  const removedItem = removeItemFromDragSource(source);
  if (!removedItem) {
    cancelItemDrag();
    return true;
  }

  const freeDestination = {
    locationType: "containerSlot",
    parentContainerUid: destination.parentContainerUid,
    slotIndex: bestSlot,
  };

  const wasPlaced = placeItemInDragDestination(freeDestination, removedItem);
  if (!wasPlaced) {
    const wasRollbackPlaced = rollbackDraggedItem(rollbackDestination, removedItem);
    if (!wasRollbackPlaced) {
      cancelItemDrag();
      return true;
    }
  }

  if (isContainerItem(removedItem)) {
    updateOpenedContainerSourceType(removedItem, "container");
  }

  refreshItemUiAfterDrag();
  return true;
};

const tryMoveItemToEmptySlotDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (
    !destinationItem &&
    (destination.locationType === "containerSlot" ||
      (destination.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(sourceItem, destination.equipmentSlotName)))
  ) {
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destination, removedItem);
    if (isContainerItem(removedItem)) {
      if (destination.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedItem, "container");
      } else if (destination.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedItem, "equipment");
      }
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag = (source, destination, destinationItem) => {
  if (
    source.locationType === "equipmentSlot" &&
    destination.locationType === "containerSlot" &&
    destinationItem &&
    !canPlaceItemInEquipmentSlot(destinationItem, source.equipmentSlotName)
  ) {
    const destinationContainer = getParentContainerFromContainerSlotLocation(destination);

    if (!destinationContainer || !destinationContainer.content) {
      cancelItemDrag();
      return true;
    }

    const emptySlot = findFirstEmptyContainerSlot(destinationContainer);
    if (emptySlot === null) {
      cancelItemDrag();
      return true;
    }

    const destinationSlotContainer = {
      locationType: "containerSlot",
      parentContainerUid: destination.parentContainerUid,
      slotIndex: emptySlot,
    };

    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destinationSlotContainer, removedItem);
    if (isContainerItem(removedItem)) {
      updateOpenedContainerSourceType(removedItem, "container");
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const trySwapItemsDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (!isItemLocationCarriedByPlayer(source) || !isItemLocationCarriedByPlayer(destination)) {
    return false;
  }
  if (
    (destination.locationType === "containerSlot" ||
      (destination.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(sourceItem, destination.equipmentSlotName))) &&
    (source.locationType === "containerSlot" ||
      (source.locationType === "equipmentSlot" &&
        canPlaceItemInEquipmentSlot(destinationItem, source.equipmentSlotName)))
  ) {
    const removedSource = removeItemFromDragSource(source);
    if (!removedSource) {
      cancelItemDrag();
      return true;
    }
    const removedDestination = removeItemFromDragSource(destination);
    if (!removedDestination) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destination, removedSource);
    if (isContainerItem(removedSource)) {
      if (destination.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedSource, "container");
      } else if (destination.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedSource, "equipment");
      }
    }
    placeItemInDragDestination(source, removedDestination);
    if (isContainerItem(removedDestination)) {
      if (source.locationType === "containerSlot") {
        updateOpenedContainerSourceType(removedDestination, "container");
      } else if (source.locationType === "equipmentSlot") {
        updateOpenedContainerSourceType(removedDestination, "equipment");
      }
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const tryMoveItemToWorldDuringDrag = (source, sourceItem, destination) => {
  if (destination.locationType === "worldTile") {
    if (!isNearPlayer(destination, WORLD_ITEM_THROW_RANGE)) {
      cancelItemDrag();
      return true;
    }
    if (!hasPlayerLineOfSightToWorldPosition(destination)) {
      showGameStatusMessage(getGameUiText("cannotPlaceItem"));
      cancelItemDrag();
      return true;
    }
    const oldSource = {
      locationType: "worldTile",
      x: sourceItem.x,
      y: sourceItem.y,
      z: sourceItem.z,
    };
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }

    const result = placeItemInDragDestination(destination, removedItem);
    if (result) {
      if (isContainerItem(removedItem)) {
        updateOpenedContainerSourceType(removedItem, "world");
        closeFarOpenedContainers();
      }

      refreshItemUiAfterDrag();

      return true;
    } else {
      showGameStatusMessage(getGameUiText("cannotPlaceItem"));
      if (source.locationType === "worldItem") {
        const wasRollbackPlaced = rollbackDraggedItem(oldSource, removedItem);
        if (!wasRollbackPlaced) {
          cancelItemDrag();
          return true;
        }
        refreshItemUiAfterDrag();
        return true;
      } else {
        const wasRollbackPlaced = rollbackDraggedItem(source, removedItem);
        if (!wasRollbackPlaced) {
          cancelItemDrag();
          return true;
        }
        refreshItemUiAfterDrag();
        return true;
      }
    }
  }
  return false;
};

const isItemCarriedByPlayer = (itemUid) => {
  return Object.values(playerState.equipment).some((equipment) => {
    if (!equipment) {
      return false;
    }
    return isItemInsideItem(equipment, itemUid);
  });
};

const isItemInsideItem = (item, searchedUid) => {
  if (!item) {
    return false;
  }
  if (item.uid === searchedUid) {
    return true;
  }
  if (!isContainerItem(item)) {
    return false;
  }
  return item.content.some((itemInContainer) => {
    return isItemInsideItem(itemInContainer, searchedUid);
  });
};

const isItemLocationCarriedByPlayer = (itemLocation) => {
  if (itemLocation.locationType === "equipmentSlot") {
    return true;
  }
  if (itemLocation.locationType === "worldItem" || itemLocation.locationType === "worldTile") {
    return false;
  }
  if (itemLocation.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(itemLocation);

    if (!parentContainer) {
      return false;
    }

    return isItemCarriedByPlayer(parentContainer.uid);
  }
  return false;
};

const isExceedCapacity = (source, destination, item) => {
  const sourceCarried = isItemLocationCarriedByPlayer(source);
  const destinationCarried = isItemLocationCarriedByPlayer(destination);
  if (!sourceCarried && destinationCarried) {
    if (playerState.capacity - playerState.carriedWeight < getItemTotalWeight(item)) {
      return true;
    }
  }
  return false;
};

const isSameDragSourceAndDestination = (source, destination) => {
  if (
    source.locationType === "containerSlot" &&
    destination.locationType === "containerSlot" &&
    source.parentContainerUid === destination.parentContainerUid &&
    source.slotIndex === destination.slotIndex
  ) {
    return true;
  }
  if (
    source.locationType === "equipmentSlot" &&
    destination.locationType === "equipmentSlot" &&
    source.equipmentSlotName === destination.equipmentSlotName
  ) {
    return true;
  }
  return false;
};

const isContainerMoveIntoContainerItemItself = (sourceItem, destinationItem) => {
  if (isContainerItem(sourceItem) && destinationItem && isContainerItem(destinationItem)) {
    if (destinationItem.uid === sourceItem.uid) {
      return true;
    }
    if (isItemInsideContainer(sourceItem, destinationItem.uid)) {
      return true;
    }
  }
  return false;
};

const isContainerMoveIntoItself = (sourceItem, destinationContainer) => {
  if (isContainerItem(sourceItem) && destinationContainer) {
    if (destinationContainer.uid === sourceItem.uid || isItemInsideContainer(sourceItem, destinationContainer.uid)) {
      return true;
    }
  }
  return false;
};

const isDropStackToStack = (sourceItem, destinationItem) => {
  if (destinationItem && sourceItem.itemId === destinationItem.itemId) {
    const itemData = getItemData(sourceItem.itemId);
    if (itemData && itemData.stackable === true) {
      return true;
    }
  }
  return false;
};

const isOpenableContainerItem = (item) => {
  if (!isContainerItem(item)) {
    return false;
  }
  if (item.decayStage >= 2) {
    return false;
  }
  return true;
};

const getItemFromLocation = (itemLocation) => {
  if (!itemLocation || !itemLocation.locationType) {
    return null;
  }
  if (itemLocation.locationType === "worldItem") {
    return findWorldItemByUid(itemLocation.itemUid);
  } else if (itemLocation.locationType === "equipmentSlot") {
    return playerState.equipment[itemLocation.equipmentSlotName];
  } else if (itemLocation.locationType === "containerSlot") {
    const parentContainer = getParentContainerFromContainerSlotLocation(itemLocation);
    if (!parentContainer || !parentContainer.content) {
      return null;
    }
    return parentContainer.content[itemLocation.slotIndex] || null;
  }
  return null;
};

const findItemLocationInsideContainer = (containerItem, searchedUid) => {
  if (!containerItem || !isContainerItem(containerItem) || !containerItem.content) {
    return null;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData) {
    return null;
  }

  for (let index = 0; index < itemData.capacity; index++) {
    const item = containerItem.content[index];
    if (!item) {
      continue;
    }
    if (item.uid === searchedUid) {
      return {
        locationType: "containerSlot",
        itemUid: item.uid,
        parentContainerUid: containerItem.uid,
        slotIndex: index,
      };
    }
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, searchedUid);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const findItemLocationByUid = (uid) => {
  const worldItem = findWorldItemByUid(uid);
  if (worldItem) {
    return {
      locationType: "worldItem",
      itemUid: worldItem.uid,
    };
  }

  for (const item of worldItemsByUid.values()) {
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, uid);
      if (result) {
        return result;
      }
    }
  }

  for (const [slotName, item] of Object.entries(playerState.equipment)) {
    if (!item) {
      continue;
    }
    if (item.uid === uid) {
      return {
        locationType: "equipmentSlot",
        itemUid: item.uid,
        equipmentSlotName: slotName,
      };
    }
    if (isContainerItem(item)) {
      const result = findItemLocationInsideContainer(item, uid);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const findWorldItemByUid = (itemUid) => {
  return worldItemsByUid.get(itemUid) ?? null;
};

const refreshAllByUid = (uid) => {
  const location = findItemLocationByUid(uid);
  if (!location) {
    return;
  }
  const item = getItemFromLocation(location);
  if (!item) {
    return;
  }
  if (location.locationType === "worldItem") {
    refreshGroundItemRender(item);
    return;
  }
  refreshInventoryUi();
};

const isOpenedContainerChildOf = (openedWindow, containerToClose) => {
  if (!openedWindow || !containerToClose) {
    return false;
  }
  let openedWindowParent = openedWindow.parent;
  while (openedWindowParent) {
    if (openedWindowParent.item.uid === containerToClose.uid) {
      return true;
    }

    openedWindowParent = openedWindowParent.parent;
  }
  return false;
};

const closeContainerAndChildren = (containerToClose) => {
  if (!containerToClose) {
    return;
  }
  let wasClosed = false;
  for (let index = openedContainers.length - 1; index >= 0; index--) {
    const wrapper = openedContainers[index];
    if (wrapper.item.uid === containerToClose.uid || isOpenedContainerChildOf(wrapper, containerToClose)) {
      openedContainers.splice(index, 1);
      wasClosed = true;
    }
  }
  if (wasClosed) {
    renderContainerDock();
  }
};

const removeAllByUid = (uid) => {
  const location = findItemLocationByUid(uid);
  if (!location) {
    return;
  }
  const item = getItemFromLocation(location);
  if (!item) {
    return;
  }

  if (isContainerItem(item)) {
    closeContainerAndChildren(item);
  }

  if ("decayStage" in item) {
    const index = decayingItems.findIndex((corpse) => {
      return item.uid === corpse.uid;
    });
    if (index !== -1) {
      decayingItems.splice(index, 1);
    }
  }

  activeLitTorchesByUid.delete(uid);

  if (location.locationType === "worldItem") {
    const wasRemoved = removeGroundItem(uid);
    if (!wasRemoved) {
      return;
    }
  } else if (location.locationType === "equipmentSlot") {
    const wasRemoved = setEquipmentSlotItem(location, null);

    if (!wasRemoved) {
      return;
    }
  } else if (location.locationType === "containerSlot") {
    const wasRemoved = setContainerSlotItem(location, null);
    if (!wasRemoved) {
      return;
    }
  } else {
    return;
  }
  refreshInventoryUi();
};

const ITEM_INVENTORY_LOCATION_TYPES = new Set(["containerSlot", "equipmentSlot"]);
const WORLD_ITEM_THROW_RANGE = 9;

const createItemDragSfxSnapshot = (source, sourceItem, destination, destinationItem) => {
  return {
    source: { ...source },
    destination: { ...destination },
    sourceItem,
    sourceQuantity: sourceItem.quantity,
    sourceX: sourceItem.x,
    sourceY: sourceItem.y,
    sourceZ: sourceItem.z,
    destinationItem,
    destinationQuantity: destinationItem?.quantity ?? null,
  };
};

const areItemLocationsEqual = (firstLocation, secondLocation) => {
  if (!firstLocation || !secondLocation || firstLocation.locationType !== secondLocation.locationType) {
    return false;
  }
  if (firstLocation.locationType === "equipmentSlot") {
    return firstLocation.equipmentSlotName === secondLocation.equipmentSlotName;
  }
  if (firstLocation.locationType === "containerSlot") {
    return (
      firstLocation.parentContainerUid === secondLocation.parentContainerUid &&
      firstLocation.slotIndex === secondLocation.slotIndex
    );
  }
  if (firstLocation.locationType === "worldItem") {
    return firstLocation.itemUid === secondLocation.itemUid;
  }
  return false;
};

const didItemDragChangeState = (snapshot) => {
  const currentLocation = findItemLocationByUid(snapshot.sourceItem.uid);
  return (
    !areItemLocationsEqual(snapshot.source, currentLocation) ||
    snapshot.sourceItem.quantity !== snapshot.sourceQuantity ||
    snapshot.sourceItem.x !== snapshot.sourceX ||
    snapshot.sourceItem.y !== snapshot.sourceY ||
    snapshot.sourceItem.z !== snapshot.sourceZ ||
    (snapshot.destinationItem?.quantity ?? null) !== snapshot.destinationQuantity
  );
};

const playCompletedItemDragSfx = (snapshot) => {
  if (!didItemDragChangeState(snapshot)) {
    return false;
  }
  if (snapshot.destination.locationType === "equipmentSlot") {
    return playGameSfx(GAME_SFX.itemEquip);
  }
  if (
    !ITEM_INVENTORY_LOCATION_TYPES.has(snapshot.source.locationType) &&
    !ITEM_INVENTORY_LOCATION_TYPES.has(snapshot.destination.locationType)
  ) {
    return false;
  }
  if (snapshot.sourceItem.itemId === "goldCoin") {
    return playGameSfx(GAME_SFX.moneyMove);
  }
  return playGameSfx(GAME_SFX.itemMove);
};

const tryStartItemDragActionNavigation = (source, sourceItem, destination) => {
  if (source.locationType === "worldItem" && !isNearPlayer(sourceItem, 1)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.itemDrag,
      itemUid: sourceItem.uid,
      source: { ...source },
      destination: { ...destination },
    });
    return true;
  }

  if (destination.locationType === "worldTile" && !isNearPlayer(destination, WORLD_ITEM_THROW_RANGE)) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.itemDrag,
      itemUid: sourceItem.uid,
      source: { ...source },
      destination: { ...destination },
    });
    return true;
  }

  return false;
};

const completeItemDrag = (destination) => {
  if (!dragState.isDragging || !destination) {
    cancelItemDrag();
    return;
  }
  const source = getDragSourceFromState();
  const sourceItem = getDragSourceItem(source);
  if (sourceItem !== dragState.item) {
    cancelItemDrag();
    return;
  }
  if (source.locationType === "worldItem" && !isWorldItemAvailableForInteraction(sourceItem)) {
    cancelItemDrag();
    return;
  }

  if (tryStartItemDragActionNavigation(source, sourceItem, destination)) {
    cancelItemDrag();
    return;
  }

  if (source.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    cancelItemDrag();
    return;
  }

  const destinationItem = getDragSourceItem(destination);
  const dragSfxSnapshot = createItemDragSfxSnapshot(source, sourceItem, destination, destinationItem);

  if (tryMoveItemToWorldDuringDrag(source, sourceItem, destination)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (!isDropStackToStack(sourceItem, destinationItem)) {
    if (isExceedCapacity(source, destination, sourceItem)) {
      showGameStatusMessage(getGameUiText("notEnoughCapacity"));
      cancelItemDrag();
      return;
    }
  }

  if (isSameDragSourceAndDestination(source, destination)) {
    cancelItemDrag();
    return;
  }

  let destinationContainer = null;
  if (destination.locationType === "containerSlot") {
    destinationContainer = getParentContainerFromContainerSlotLocation(destination);

    if (!isValidContainerSlotParent(destinationContainer)) {
      cancelItemDrag();
      return;
    }
  }

  if (isContainerMoveIntoItself(sourceItem, destinationContainer)) {
    showGameStatusMessage(getGameUiText("cannotPlaceItem"));
    cancelItemDrag();
    return;
  }

  if (tryStackItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (isContainerMoveIntoContainerItemItself(sourceItem, destinationItem)) {
    showGameStatusMessage(getGameUiText("cannotPlaceItem"));
    cancelItemDrag();
    return;
  }

  if (tryMoveItemOnContainerItemDuringDrag(source, sourceItem, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (tryMoveItemToFreeContainerSlotInsteadOfSwapDuringDrag(source, sourceItem, destination, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (tryMoveItemToEmptySlotDuringDrag(source, sourceItem, destination, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag(source, destination, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  if (trySwapItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    playCompletedItemDragSfx(dragSfxSnapshot);
    return;
  }

  showGameStatusMessage(getGameUiText("cannotPlaceItem"));
  cancelItemDrag();
};
//#endregion  -----  DRAG AND DROP - SOURCES, DESTINATIONS ET REGLES  -----

/* ==================================================== */
//#region     -----  UI - EQUIPMENT / INVENTAIRE  -----
/* ==================================================== */

/* ---------- UI - INVENTAIRE ---------- */
const getEquipmentSlotItem = (slotName) => {
  if (!playerState.equipment[slotName]) {
    return null;
  }
  return playerState.equipment[slotName];
};

const renderItemIcon = (parentElement, item, slotSize) => {
  parentElement.innerHTML = "";
  if (!item) {
    return;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return;
  }
  const atlasPath = getAtlasPath(itemData.render.atlas);
  const enrichedParts = getItemRenderData(item);
  let totalWidth = 0;
  let totalHeight = 0;
  let minX = null;
  let maxX = null;
  let minY = null;
  let maxY = null;
  enrichedParts.forEach((enrichedPart) => {
    if (minX === null || minX > enrichedPart.offsetX) {
      minX = enrichedPart.offsetX;
    }
    if (maxX === null || maxX < enrichedPart.offsetX + enrichedPart.sourceWidth) {
      maxX = enrichedPart.offsetX + enrichedPart.sourceWidth;
    }
    if (minY === null || minY > enrichedPart.offsetY) {
      minY = enrichedPart.offsetY;
    }
    if (maxY === null || maxY < enrichedPart.offsetY + enrichedPart.sourceHeight) {
      maxY = enrichedPart.offsetY + enrichedPart.sourceHeight;
    }
    totalWidth = maxX - minX;
    totalHeight = maxY - minY;
  });
  const biggestDimension = Math.max(totalWidth, totalHeight);
  const scale = slotSize / biggestDimension;
  const renderWidth = totalWidth * scale;
  const renderHeight = totalHeight * scale;
  const paddingLeft = (slotSize - renderWidth) / 2;
  const paddingTop = (slotSize - renderHeight) / 2;
  enrichedParts.forEach((enrichedPart) => {
    const div = document.createElement("div");
    div.classList.add("item-icon-part");
    div.style.backgroundImage = `url("${atlasPath}")`;
    div.style.backgroundPosition = `-${enrichedPart.sourceX}px -${enrichedPart.sourceY}px`;
    div.style.left = `${paddingLeft + (enrichedPart.offsetX - minX) * scale}px`;
    div.style.top = `${paddingTop + (enrichedPart.offsetY - minY) * scale}px`;
    div.style.width = `${enrichedPart.sourceWidth}px`;
    div.style.height = `${enrichedPart.sourceHeight}px`;
    div.style.transform = `scale(${scale})`;
    div.style.transformOrigin = "top left";

    parentElement.appendChild(div);
  });
  if (itemData.stackable && item.quantity > 1) {
    const quantity = document.createElement("p");
    quantity.innerHTML = `${item.quantity}`;
    quantity.classList.add("item-quantity");
    parentElement.appendChild(quantity);
  }
  if (itemData.type === "rune" && itemData.use?.cooldownGroup) {
    const cooldownOverlay = document.createElement("div");
    cooldownOverlay.classList.add("item-cooldown-overlay");
    cooldownOverlay.dataset.cooldownGroup = itemData.use.cooldownGroup;
    cooldownOverlay.setAttribute("aria-hidden", "true");
    parentElement.appendChild(cooldownOverlay);
    itemCooldownOverlayElements.add(cooldownOverlay);
    updateItemCooldownOverlayElement(cooldownOverlay, Date.now());
  }
};

const renderEquipmentSlots = () => {
  const equipmentsElement = document.querySelectorAll("[data-equipment-slot]");
  const equippedWeapon = getEquipmentSlotItem("weapon");
  const equippedWeaponData = equippedWeapon ? getItemData(equippedWeapon.itemId) : null;
  const weaponUsesAmmunition = typeof equippedWeaponData?.combat?.ammunitionItemId === "string";
  equipmentsElement.forEach((equipmentElement) => {
    const slotName = equipmentElement.getAttribute("data-equipment-slot");
    const item = getEquipmentSlotItem(slotName);
    const slotSize = equipmentElement.classList.contains("equipment-small-slot") ? 24 : 48;
    equipmentElement.classList.toggle(
      "equipment-slot-ammunition-mode",
      slotName === "shield" && weaponUsesAmmunition,
    );
    renderItemIcon(equipmentElement, item, slotSize);
    if (item) {
      equipmentElement.classList.add("equipment-slot-filled");
      equipmentElement.classList.remove("equipment-slot-empty");

      equipmentElement.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragState.isDragging) {
          inputState.shouldBlockNextContextMenu = true;
          cancelItemDrag();
          return;
        }
        if (shouldBlockContextMenuAction()) {
          return;
        }
        const itemData = getItemData(item.itemId);
        if (!itemData) {
          return;
        }
        const source = {
          locationType: "equipmentSlot",
          equipmentSlotName: slotName,
        };
        handleUseItemFromSource(source);
      });
    }
    if (!item) {
      equipmentElement.classList.remove("equipment-slot-filled");
      equipmentElement.classList.add("equipment-slot-empty");
    }
  });
};

/* ---------- UI - OPTIONS ---------- */

const GAME_UI_TEXT = {
  en: {
    play: "PLAY",
    home: "Home",
    game: "Game",
    account: "Account",
    minimap: "Minimap",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    centerMinimap: "Center on player",
    floorUp: "View upper floor",
    floorDown: "View lower floor",
    language: "Language",
    english: "English",
    french: "French",
    showFps: "Show FPS",
    showCreatureNames: "Creature names",
    showHealthBars: "Health bars",
    musicEnabled: "Music",
    sfxEnabled: "Sound effects",
    musicVolume: "Music volume",
    sfxVolume: "Effects volume",
    restoreDefaults: "Restore defaults",
    closeOptions: "Close options",
    quests: "Quests",
    closeQuests: "Close quests",
    noQuests: "No quests started.",
    questCompleted: "Completed",
    questStarted: "Started",
    characters: "Characters",
    closeCharacters: "Close characters",
    noCharacters: "No characters created.",
    current: "Current",
    select: "Select",
    delete: "Delete",
    deleteCharacter: (name) => `Delete ${name}`,
    deleteCharacterConfirm: (name) => `Delete ${name}? This cannot be undone.`,
    newCharacter: "New character",
    characterName: "Character name",
    create: "Create",
    equipments: "Equipments",
    capacityShort: "Cap",
    follow: "Follow",
    hotkeys: "Spells",
    spells: "Spells",
    closeSpells: "Close spells",
    spellBar: "Spell bar",
    spellWindowHelp: "Tap a spell to cast it, or select Assign and then choose a slot above.",
    spellAssignPrompt: (spellName) => `Choose a slot above for ${spellName}.`,
    mobileSpellBarHelp: "Tap to cast. Hold a slot to reassign it.",
    mobileSpellAssignPrompt: (key) => `Choose a learned spell for slot ${key}.`,
    emptySpellSlot: "Empty spell slot",
    spellSlotLabel: (key, spellName) => `Slot ${key}: ${spellName}`,
    clearSpellSlot: (key) => `Clear spell slot ${key}`,
    learnedSpells: "Learned spells",
    castSpell: "Cast",
    assignSpell: "Assign",
    clearHotkey: "Clear",
    noLearnedSpells: "No spells learned.",
    options: "Options",
    logout: "Logout",
    fullAttack: "Full Attack",
    balanced: "Balanced",
    fullDefense: "Full Defense",
    stats: "Stats",
    mobileMap: "Map",
    mobileEquipment: "Gear",
    mobileBackpack: "Bag",
    mobileChat: "Chat",
    rotateDeviceTitle: "Rotate your phone",
    rotateDeviceText: "This game is played in landscape mode.",
    nameLabel: "Name:",
    healthLabel: "Hp:",
    manaLabel: "Mana:",
    sanityLabel: "Sanity:",
    experienceLabel: "Experience:",
    levelLabel: "Level:",
    magicLabel: "Magic:",
    fistLabel: "Fist Fighting:",
    swordLabel: "Sword Fighting:",
    maceLabel: "Mace Fighting:",
    axeLabel: "Axe Fighting:",
    distanceLabel: "Distance:",
    shieldingLabel: "Shielding:",
    xpRemaining: (amount) => `${amount} XP left to go.`,
    characterSaved: "Character saved.",
    characterSaveFailed: "Unable to save character.",
    currentCharacterSaveFailed: "Unable to save the current character.",
    cannotPlaceItem: "You cannot place this item there.",
    notEnoughCapacity: "You do not have enough capacity.",
    pvpUnavailable: "PVP is not implemented yet.",
    cannotPourPotion: "You cannot pour this potion there.",
    exhausted: "You are exhausted.",
    targetOutOfRange: "Target is out of range.",
    runeBlockedByWall: "You cannot use this rune through a wall.",
    alreadyFull: "You are already full.",
    fullHealth: "You are already at full health.",
    fullMana: "You are already at full mana.",
    torchBurnedOut: "This torch is burned out.",
    torchNeedsPlacement: "Equip or place the torch on the ground before lighting it.",
    noPath: "No path possible.",
    destinationTooFar: "Destination is too far.",
    minimapWrongFloor: "Return to your floor before walking there.",
    targetLost: "Target lost.",
    arrowsRequired: "You need arrows to use this bow.",
    invalidCharacterName: "Use 2 to 20 letters. Spaces, apostrophes and hyphens are allowed.",
    invalidAppearance: "Choose a character appearance.",
    spellWrongClass: "Your class cannot cast this spell.",
    spellNotLearned: "You have not learned this spell.",
    spellMagicLevelRequired: (level) => `You need magic level ${level} to cast this spell.`,
    spellNotEnoughMana: "You do not have enough mana.",
    duplicateCharacterName: "A character with this name already exists.",
    characterStorageError: "The character data could not be saved.",
    corruptedSave: "The character data is corrupted.",
    unsupportedSave: "This character save format is not supported.",
    characterNotFound: "This character no longer exists.",
    characterOperationFailed: "The character operation failed.",
    backpackRequired: "You need to equip a backpack.",
    backpackFull: "Your backpack is full.",
    invalidReward: "This chest has an invalid reward configuration.",
    rewardCommitFailed: "The reward could not be added to your backpack.",
    chestOpenFailed: "You cannot open this chest.",
    rewardFallback: "your reward",
    questCompletionLog: (questName, rewardText) => `Quest completed: ${questName}. You received ${rewardText}.`,
    questCompletionFloating: (questName, rewardText) => `Quest completed!\n${questName}\nLoot: ${rewardText}`,
    questAlreadyCompleted: (questName) => `You have already completed ${questName}.`,
    levelAdvanced: (level) => `You advanced to level ${level}.`,
    skillAdvanced: (skill, level) => `Your ${skill} skill advanced to level ${level}.`,
    youSeeProperName: (name) => `You see ${name}.`,
    youSee: (article, name) => `You see ${article} ${name}.`,
    youSeeYourself: (level) => `You see yourself. You are level ${level}.`,
    youSeeYourselfClass: (className, level) => `You see yourself. You are a ${className} level ${level}.`,
    attack: "Attack",
    defense: "Defense",
    itemCharges: (charges) => `It has ${charges} charge${charges > 1 ? "s" : ""}`,
    itemWeight: (weight) => `It weighs ${weight.toFixed(1)} oz.`,
    itemsWeight: (weight) => `They weigh ${weight.toFixed(1)} oz.`,
    unknownItem: "unknown item",
    lootNothing: "Loot: nothing.",
    lootFromNothing: (sourceName) => `Loot from ${sourceName}: nothing.`,
    lootList: (items) => `Loot: ${items}.`,
    lootFromList: (sourceName, items) => `Loot from ${sourceName}: ${items}.`,
    experienceGained: (amount) => `You gained ${amount} experience.`,
    experienceGainedFrom: (amount, sourceName) => `You gained ${amount} experience from ${sourceName}.`,
    damageTaken: (amount, sourceName) => `You took ${amount} damage from ${sourceName}.`,
    damageDealt: (amount, sourceName) => `You dealt ${amount} damage to ${sourceName}.`,
    tileName: "Tile",
    tileDescription: "A tile.",
    localChannel: "Local",
    globalChannel: "Global",
    tradeChannel: "Trade",
    logsChannel: "Logs",
    npcQueue: (name, position) => `${name} asks you to wait. Queue position: ${position}.`,
    sayNpcOption: (speech) => `Say ${speech}`,
    npcOptionsLabel: "You can say:",
  },
  fr: {
    play: "JOUER",
    home: "Accueil",
    game: "Jeu",
    account: "Compte",
    minimap: "Mini-carte",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arriere",
    centerMinimap: "Recentrer sur le joueur",
    floorUp: "Voir l'etage du haut",
    floorDown: "Voir l'etage du bas",
    language: "Langue",
    english: "Anglais",
    french: "Francais",
    showFps: "Afficher les FPS",
    showCreatureNames: "Noms des creatures",
    showHealthBars: "Barres de vie",
    musicEnabled: "Musique",
    sfxEnabled: "Effets sonores",
    musicVolume: "Volume de la musique",
    sfxVolume: "Volume des effets",
    restoreDefaults: "Remettre par defaut",
    closeOptions: "Fermer les options",
    quests: "Quetes",
    closeQuests: "Fermer les quetes",
    noQuests: "Aucune quete commencee.",
    questCompleted: "Terminee",
    questStarted: "Commencee",
    characters: "Personnages",
    closeCharacters: "Fermer les personnages",
    noCharacters: "Aucun personnage cree.",
    current: "Actuel",
    select: "Choisir",
    delete: "Supprimer",
    deleteCharacter: (name) => `Supprimer ${name}`,
    deleteCharacterConfirm: (name) => `Supprimer ${name}? Cette action est irreversible.`,
    newCharacter: "Nouveau personnage",
    characterName: "Nom du personnage",
    create: "Creer",
    equipments: "Equipement",
    capacityShort: "Cap",
    follow: "Suivre",
    hotkeys: "Sort",
    spells: "Sorts",
    closeSpells: "Fermer les sorts",
    spellBar: "Barre de sorts",
    spellWindowHelp: "Touche un sort pour le lancer, ou choisis Assigner puis un emplacement en haut.",
    spellAssignPrompt: (spellName) => `Choisis un emplacement en haut pour ${spellName}.`,
    mobileSpellBarHelp: "Touche pour lancer. Maintiens une case pour la reassigner.",
    mobileSpellAssignPrompt: (key) => `Choisis un sort appris pour la case ${key}.`,
    emptySpellSlot: "Emplacement de sort vide",
    spellSlotLabel: (key, spellName) => `Emplacement ${key}: ${spellName}`,
    clearSpellSlot: (key) => `Vider l'emplacement de sort ${key}`,
    learnedSpells: "Sorts appris",
    castSpell: "Lancer",
    assignSpell: "Assigner",
    clearHotkey: "Vider",
    noLearnedSpells: "Aucun sort appris.",
    options: "Options",
    logout: "Quitter",
    fullAttack: "Attaque",
    balanced: "Equilibre",
    fullDefense: "Defense",
    stats: "Stats",
    mobileMap: "Carte",
    mobileEquipment: "Equip.",
    mobileBackpack: "Sac",
    mobileChat: "Chat",
    rotateDeviceTitle: "Tourne ton telephone",
    rotateDeviceText: "Le jeu se joue en mode paysage.",
    nameLabel: "Nom:",
    healthLabel: "Vie:",
    manaLabel: "Mana:",
    sanityLabel: "Satiete:",
    experienceLabel: "Experience:",
    levelLabel: "Niveau:",
    magicLabel: "Magie:",
    fistLabel: "Combat a mains nues:",
    swordLabel: "Epee:",
    maceLabel: "Masse:",
    axeLabel: "Hache:",
    distanceLabel: "Distance:",
    shieldingLabel: "Bouclier:",
    xpRemaining: (amount) => `${amount} XP avant le prochain niveau.`,
    characterSaved: "Personnage sauvegarde.",
    characterSaveFailed: "Impossible de sauvegarder le personnage.",
    currentCharacterSaveFailed: "Impossible de sauvegarder le personnage actuel.",
    cannotPlaceItem: "Tu ne peux pas placer cet objet la.",
    notEnoughCapacity: "Tu n'as pas assez de capacite.",
    pvpUnavailable: "Le PVP n'est pas encore disponible.",
    cannotPourPotion: "Tu ne peux pas vider cette potion la.",
    exhausted: "Tu es epuise.",
    targetOutOfRange: "La cible est trop loin.",
    runeBlockedByWall: "Tu ne peux pas lancer cette rune a travers un mur.",
    alreadyFull: "Tu n'as plus faim.",
    fullHealth: "Ta vie est deja pleine.",
    fullMana: "Ton mana est deja plein.",
    torchBurnedOut: "Cette torche est completement brulee.",
    torchNeedsPlacement: "Equipe la torche ou pose-la au sol avant de l'allumer.",
    noPath: "Aucun chemin possible.",
    destinationTooFar: "La destination est trop loin.",
    minimapWrongFloor: "Reviens a ton etage avant de marcher la.",
    targetLost: "Cible perdue.",
    arrowsRequired: "Il te faut des fleches pour utiliser cet arc.",
    invalidCharacterName: "Utilise de 2 a 20 lettres. Les espaces, apostrophes et tirets sont permis.",
    invalidAppearance: "Choisis une apparence.",
    spellWrongClass: "Ta classe ne peut pas lancer ce sort.",
    spellNotLearned: "Tu n'as pas appris ce sort.",
    spellMagicLevelRequired: (level) => `Il te faut le niveau de magie ${level} pour lancer ce sort.`,
    spellNotEnoughMana: "Tu n'as pas assez de mana.",
    duplicateCharacterName: "Un personnage porte deja ce nom.",
    characterStorageError: "Les donnees du personnage n'ont pas pu etre sauvegardees.",
    corruptedSave: "La sauvegarde du personnage est corrompue.",
    unsupportedSave: "Ce format de sauvegarde n'est pas supporte.",
    characterNotFound: "Ce personnage n'existe plus.",
    characterOperationFailed: "L'operation sur le personnage a echoue.",
    backpackRequired: "Tu dois equiper un sac.",
    backpackFull: "Ton sac est plein.",
    invalidReward: "La recompense de ce coffre est mal configuree.",
    rewardCommitFailed: "La recompense n'a pas pu etre ajoutee a ton sac.",
    chestOpenFailed: "Tu ne peux pas ouvrir ce coffre.",
    rewardFallback: "ta recompense",
    questCompletionLog: (questName, rewardText) => `Quete terminee: ${questName}. Tu as recu ${rewardText}.`,
    questCompletionFloating: (questName, rewardText) => `Quete terminee!\n${questName}\nButin: ${rewardText}`,
    questAlreadyCompleted: (questName) => `Tu as deja termine ${questName}.`,
    levelAdvanced: (level) => `Tu es maintenant niveau ${level}.`,
    skillAdvanced: (skill, level) => `Ta competence ${skill} est maintenant niveau ${level}.`,
    youSeeProperName: (name) => `Tu vois ${name}.`,
    youSee: (article, name) => `Tu vois ${article} ${name}.`,
    youSeeYourself: (level) => `Tu te vois. Tu es niveau ${level}.`,
    youSeeYourselfClass: (className, level) => `Tu te vois. Tu es ${className}, niveau ${level}.`,
    attack: "Attaque",
    defense: "Defense",
    itemCharges: (charges) => `Il reste ${charges} charge${charges > 1 ? "s" : ""}.`,
    itemWeight: (weight) => `Il pese ${weight.toFixed(1)} oz.`,
    itemsWeight: (weight) => `Ils pesent ${weight.toFixed(1)} oz.`,
    unknownItem: "objet inconnu",
    lootNothing: "Butin: rien.",
    lootFromNothing: (sourceName) => `Butin de ${sourceName}: rien.`,
    lootList: (items) => `Butin: ${items}.`,
    lootFromList: (sourceName, items) => `Butin de ${sourceName}: ${items}.`,
    experienceGained: (amount) => `Tu as gagne ${amount} points d'experience.`,
    experienceGainedFrom: (amount, sourceName) => `Tu as gagne ${amount} points d'experience grace a ${sourceName}.`,
    damageTaken: (amount, sourceName) => `Tu as recu ${amount} degats de ${sourceName}.`,
    damageDealt: (amount, sourceName) => `Tu as inflige ${amount} degats a ${sourceName}.`,
    tileName: "Tuile",
    tileDescription: "Une tuile.",
    localChannel: "Local",
    globalChannel: "Global",
    tradeChannel: "Echange",
    logsChannel: "Journal",
    npcQueue: (name, position) => `${name} te demande d'attendre. Position dans la file : ${position}.`,
    sayNpcOption: (speech) => `Dire ${speech}`,
    npcOptionsLabel: "Tu peux dire :",
  },
};

const GAME_CONTENT_TEXT = {
  fr: {
    items: {
      apple: { name: "Pomme", pluralName: "Pommes", desc: "Une pomme.", suffix: "une" },
      cheese: { name: "Fromage", pluralName: "Fromages", desc: "Un morceau de fromage.", suffix: "un" },
      box: { name: "Caisse", pluralName: "Caisses", desc: "Une grosse vieille caisse.", suffix: "une" },
      smallBox: { name: "Petite caisse", pluralName: "Petites caisses", desc: "Une petite caisse.", suffix: "une" },
      healthPotion: { name: "Potion de vie", pluralName: "Potions de vie", desc: "Une potion qui redonne de la vie.", suffix: "une" },
      manaPotion: { name: "Potion de mana", pluralName: "Potions de mana", desc: "Une potion qui redonne du mana.", suffix: "une" },
      emptyPotion: { name: "Fiole vide", pluralName: "Fioles vides", desc: "Une fiole vide.", suffix: "une" },
      torch: { name: "Torche", pluralName: "Torches", desc: "Une torche qui eclaire les endroits sombres.", suffix: "une" },
      ratCorpse: { name: "Cadavre de rat", pluralName: "Cadavres de rat", desc: "Un rat mort.", suffix: "un" },
      playerCorpse: { name: "Cadavre de joueur", pluralName: "Cadavres de joueur", desc: "Un joueur mort.", suffix: "un" },
      sword: { name: "Epee", pluralName: "Epees", desc: "Une vieille epee rouillee.", suffix: "une" },
      mace: { name: "Masse", pluralName: "Masses", desc: "Une masse rudimentaire et peu fiable.", suffix: "une" },
      arrow: { name: "Fleche", pluralName: "Fleches", desc: "Une fleche toute simple.", suffix: "une" },
      bow: { name: "Arc", pluralName: "Arcs", desc: "Un arc de chasse de base.", suffix: "un" },
      woodenShield: { name: "Bouclier de bois", pluralName: "Boucliers de bois", desc: "Un vieux bouclier de bois.", suffix: "un" },
      leatherArmor: { name: "Armure de cuir", pluralName: "Armures de cuir", desc: "Une armure de cuir classique.", suffix: "une" },
      spiderCorpse: { name: "Cadavre d'araignee", pluralName: "Cadavres d'araignee", desc: "Une araignee morte.", suffix: "un" },
      bag: { name: "Sac", pluralName: "Sacs", desc: "Un sac de 8 cases.", suffix: "un" },
      goldCoin: { name: "Piece d'or", pluralName: "Pieces d'or", desc: "Une piece d'or.", suffix: "une" },
      fireRune: { name: "Rune de feu", pluralName: "Runes de feu", desc: "Une rune gravee de magie de feu.", suffix: "une" },
    },
    monsters: {
      rat: { name: "Rat", desc: "Un petit rat feroce.", suffix: "un" },
      spider: { name: "Araignee", desc: "Une araignee venimeuse.", suffix: "une" },
    },
    classes: {
      noClass: { name: "Sans classe" },
      knight: { name: "Chevalier" },
      archer: { name: "Archer" },
      mage: { name: "Mage" },
      priest: { name: "Pretre" },
    },
    appearances: {
      male: { label: "Garcon" },
      female: { label: "Fille" },
    },
    quests: {
      tiro_cave_spider_treasure: {
        name: "Tresor de la caverne aux araignees",
        description: "Tu as trouve le tresor cache dans la caverne aux araignees.",
      },
    },
  },
};

const getCurrentGameLanguage = () => {
  const language = gameOptionsUiState.values.language;
  return SUPPORTED_GAME_LANGUAGES.has(language) ? language : DEFAULT_GAME_OPTIONS.language;
};

const getGameUiText = (textKey) => {
  const language = getCurrentGameLanguage();
  return GAME_UI_TEXT[language]?.[textKey] ?? GAME_UI_TEXT.en[textKey] ?? textKey;
};

const getLocalizedContentData = (contentType, contentId, fallbackData) => {
  const language = getCurrentGameLanguage();
  const localizedData = GAME_CONTENT_TEXT[language]?.[contentType]?.[contentId];
  return localizedData ? { ...fallbackData, ...localizedData } : fallbackData;
};

const getLocalizedItemData = (itemId) => {
  const itemData = getItemData(itemId);
  return itemData ? getLocalizedContentData("items", itemId, itemData) : null;
};

const getLocalizedMonsterData = (monsterId) => {
  const monsterData = getMonsterData(monsterId);
  return monsterData ? getLocalizedContentData("monsters", monsterId, monsterData) : null;
};

const getLocalizedClassData = (classId) => {
  const classData = playerClassesDatabase[classId];
  return classData ? getLocalizedContentData("classes", classId, classData) : null;
};

const getLocalizedQuestData = (questId) => {
  const questData = getQuestData(questId);
  return questData ? getLocalizedContentData("quests", questId, questData) : null;
};

const getLocalizedItemName = (itemId, quantity = 1) => {
  const itemData = getLocalizedItemData(itemId);
  if (!itemData) {
    return itemId;
  }
  if (quantity > 1) {
    return itemData.pluralName ?? `${itemData.name}s`;
  }
  return itemData.name;
};

const getLocalizedSkillName = (skillKey) => {
  const textKeyBySkill = {
    magic: "magicLabel",
    fist: "fistLabel",
    sword: "swordLabel",
    mace: "maceLabel",
    axe: "axeLabel",
    distance: "distanceLabel",
    shielding: "shieldingLabel",
  };
  const label = getGameUiText(textKeyBySkill[skillKey]);
  return typeof label === "string" ? label.replace(":", "").toLowerCase() : skillKey;
};

const refreshLocalizedWorldLabels = () => {
  for (const [monsterUid, refs] of monsterElementsByUid.entries()) {
    const monster = findMonsterByUid(monsterUid);
    const nameElement = refs.root?.querySelector(".monster-name");
    const monsterData = getLocalizedMonsterData(monster?.monsterId);
    if (nameElement && monsterData) {
      nameElement.textContent = monsterData.name;
    }
  }
  renderContainerDock();
};

const applyGameLanguageUi = () => {
  const language = getCurrentGameLanguage();
  document.documentElement.lang = language;
  if (gameWelcomePlayButton) {
    gameWelcomePlayButton.textContent = getGameUiText("play");
  }
  for (const languageButton of gameWelcomeLanguageButtons) {
    const isActive = languageButton.dataset.gameLanguage === language;
    languageButton.classList.toggle("game-welcome-language-button-active", isActive);
    languageButton.setAttribute("aria-pressed", String(isActive));
  }
  for (const textElement of document.querySelectorAll("[data-game-text]")) {
    textElement.textContent = getGameUiText(textElement.dataset.gameText);
  }
  for (const titleElement of document.querySelectorAll("[data-game-title]")) {
    const title = getGameUiText(titleElement.dataset.gameTitle);
    titleElement.title = title;
    titleElement.setAttribute("aria-label", title);
  }
};

const GAME_OPTION_DEFINITIONS = [
  { key: "showFps", labelKey: "showFps" },
  { key: "showCreatureNames", labelKey: "showCreatureNames" },
  { key: "showHealthBars", labelKey: "showHealthBars" },
  { key: "musicEnabled", labelKey: "musicEnabled" },
  { key: "sfxEnabled", labelKey: "sfxEnabled" },
];

const GAME_VOLUME_OPTION_DEFINITIONS = [
  { key: "musicVolume", labelKey: "musicVolume" },
  { key: "sfxVolume", labelKey: "sfxVolume" },
];

const saveGameOptions = () => {
  try {
    localStorage.setItem(GAME_OPTIONS_STORAGE_KEY, JSON.stringify(gameOptionsUiState.values));
    return true;
  } catch {
    return false;
  }
};

const applyGameOptions = () => {
  fpsCounter.style.display = gameOptionsUiState.values.showFps ? "" : "none";
  lightCanvas.style.removeProperty("display");
  game.classList.toggle("game-hide-creature-names", !gameOptionsUiState.values.showCreatureNames);
  game.classList.toggle("game-hide-health-bars", !gameOptionsUiState.values.showHealthBars);
  setGameAudioSettings(gameOptionsUiState.values);
  if (MINIMAP_ZOOM_LEVELS.includes(gameOptionsUiState.values.minimapCellSize)) {
    minimapRenderState.cellSize = gameOptionsUiState.values.minimapCellSize;
  }
  applyGameLanguageUi();
  if (gameRuntimeState.isStarted) {
    renderPlayerMinimap(true);
  }
};

const setGameOption = (optionKey, enabled) => {
  if (!(optionKey in DEFAULT_GAME_OPTIONS) || typeof enabled !== "boolean") {
    return false;
  }
  gameOptionsUiState.values[optionKey] = enabled;
  saveGameOptions();
  applyGameOptions();
  return true;
};

const setGameVolumeOption = (optionKey, volume) => {
  if (!(optionKey in DEFAULT_GAME_OPTIONS) || !Number.isFinite(volume)) {
    return false;
  }
  gameOptionsUiState.values[optionKey] = clamp(volume, 0, 1);
  saveGameOptions();
  applyGameOptions();
  return true;
};

const refreshGameLanguageDependentUi = () => {
  applyGameLanguageUi();
  if (characterSelectorUiState.isOpen) {
    renderCharacterSelector();
  }
  if (gameRuntimeState.isStarted) {
    playerStatsUi.root = null;
    updatePlayerStats();
    refreshChatUi();
    updatePlayerInventory();
    refreshLocalizedWorldLabels();
  } else if (gameOptionsUiState.isOpen) {
    renderOptionsWindow();
  }
};

const setGameLanguage = (language) => {
  if (!SUPPORTED_GAME_LANGUAGES.has(language)) {
    return false;
  }
  gameOptionsUiState.values.language = language;
  saveGameOptions();
  refreshGameLanguageDependentUi();
  return true;
};

const closeOptionsWindow = () => {
  gameOptionsUiState.isOpen = false;
  updatePlayerInventory();
};

const renderOptionsWindow = () => {
  if (!gameOptionsWindow) {
    return;
  }

  gameOptionsWindow.hidden = !gameOptionsUiState.isOpen;
  gameOptionsWindow.textContent = "";
  if (!gameOptionsUiState.isOpen) {
    return;
  }

  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add("boite-boite");
  const headerElement = document.createElement("div");
  headerElement.classList.add("options-window-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("options");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("options-window-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "x";
  closeButtonElement.title = getGameUiText("closeOptions");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closeOptions"));
  closeButtonElement.addEventListener("click", closeOptionsWindow);
  headerElement.append(titleElement, closeButtonElement);

  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const optionListElement = document.createElement("div");
  optionListElement.classList.add("options-list");

  for (const optionDefinition of GAME_OPTION_DEFINITIONS) {
    const optionElement = document.createElement("label");
    optionElement.classList.add("options-row");
    const labelElement = document.createElement("span");
    labelElement.textContent = getGameUiText(optionDefinition.labelKey);
    const inputElement = document.createElement("input");
    inputElement.classList.add("options-toggle");
    inputElement.type = "checkbox";
    inputElement.checked = gameOptionsUiState.values[optionDefinition.key];
    inputElement.addEventListener("change", () => {
      setGameOption(optionDefinition.key, inputElement.checked);
    });
    optionElement.append(labelElement, inputElement);
    optionListElement.appendChild(optionElement);
  }

  for (const optionDefinition of GAME_VOLUME_OPTION_DEFINITIONS) {
    const optionElement = document.createElement("label");
    optionElement.classList.add("options-row");
    const labelElement = document.createElement("span");
    labelElement.textContent = getGameUiText(optionDefinition.labelKey);
    const inputElement = document.createElement("input");
    inputElement.classList.add("options-volume-slider");
    inputElement.type = "range";
    inputElement.min = "0";
    inputElement.max = "1";
    inputElement.step = "0.05";
    inputElement.value = String(gameOptionsUiState.values[optionDefinition.key]);
    inputElement.addEventListener("input", () => {
      setGameVolumeOption(optionDefinition.key, Number(inputElement.value));
    });
    optionElement.append(labelElement, inputElement);
    optionListElement.appendChild(optionElement);
  }

  const languageOptionElement = document.createElement("label");
  languageOptionElement.classList.add("options-row");
  const languageLabelElement = document.createElement("span");
  languageLabelElement.textContent = getGameUiText("language");
  const languageSelectElement = document.createElement("select");
  languageSelectElement.classList.add("options-language-select");
  for (const language of [
    { id: "en", labelKey: "english" },
    { id: "fr", labelKey: "french" },
  ]) {
    const languageOption = document.createElement("option");
    languageOption.value = language.id;
    languageOption.textContent = getGameUiText(language.labelKey);
    languageSelectElement.appendChild(languageOption);
  }
  languageSelectElement.value = getCurrentGameLanguage();
  languageSelectElement.addEventListener("change", () => {
    setGameLanguage(languageSelectElement.value);
  });
  languageOptionElement.append(languageLabelElement, languageSelectElement);
  optionListElement.appendChild(languageOptionElement);

  const resetButtonElement = document.createElement("button");
  resetButtonElement.classList.add("options-reset-button");
  resetButtonElement.type = "button";
  resetButtonElement.textContent = getGameUiText("restoreDefaults");
  resetButtonElement.addEventListener("click", () => {
    gameOptionsUiState.values = { ...DEFAULT_GAME_OPTIONS };
    saveGameOptions();
    applyGameOptions();
    refreshGameLanguageDependentUi();
  });

  wrapperElement.append(headerElement, separatorElement, optionListElement, resetButtonElement);
  gameOptionsWindow.appendChild(wrapperElement);
};

const toggleOptionsWindow = () => {
  gameOptionsUiState.isOpen = !gameOptionsUiState.isOpen;
  if (gameOptionsUiState.isOpen) {
    questUiState.isOpen = false;
    spellUiState.isOpen = false;
  }
  updatePlayerInventory();
};

const showPvpUnavailableMessage = () => {
  showGameStatusMessage(getGameUiText("pvpUnavailable"));
};

const logoutCurrentCharacter = () => {
  if (!saveCurrentCharacterBeforeSwitch()) {
    return;
  }

  gameRuntimeState.isSwitchingCharacter = true;
  try {
    sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
  } catch {
    // The welcome screen is still the default destination without session storage.
  }
  stopGameMusic();
  window.location.reload();
};

const bindEquipmentMenuButtons = () => {
  const pvpButton = playerInventory.querySelector('[data-ui-action="show-pvp-status"]');
  const hotkeyButton = playerInventory.querySelector('[data-ui-action="toggle-spells"]');
  const optionsButton = playerInventory.querySelector('[data-ui-action="toggle-options"]');
  const logoutButton = playerInventory.querySelector('[data-ui-action="logout"]');
  pvpButton?.addEventListener("click", showPvpUnavailableMessage);
  hotkeyButton?.addEventListener("click", toggleSpellWindow);
  optionsButton?.addEventListener("click", toggleOptionsWindow);
  logoutButton?.addEventListener("click", logoutCurrentCharacter);
};

/* ---------- UI - SORTS ET HOTKEYS ---------- */

const isPlayerSpellLearned = (spellId) => {
  return playerState.spellbook.learnedSpellIds.includes(spellId);
};

const getLearnedPlayerSpells = () => {
  return playerState.spellbook.learnedSpellIds.map(getLocalizedSpellData).filter(Boolean);
};

const assignPlayerSpellToHotkey = (hotkeyIndex, spellId) => {
  if (
    !Number.isInteger(hotkeyIndex) ||
    hotkeyIndex < 0 ||
    hotkeyIndex >= SPELL_HOTKEY_KEYS.length ||
    (spellId !== null && !isPlayerSpellLearned(spellId))
  ) {
    return false;
  }
  playerState.spellbook.hotkeySpellIds[hotkeyIndex] = spellId;
  spellUiState.selectedSpellId = null;
  spellUiState.mobileAssignHotkeyIndex = null;
  autosaveCurrentCharacter();
  renderSpellWindow();
  return true;
};

const renderSpellWindow = () => {
  if (!playerSpells) {
    return;
  }

  const mobileLayout = isMobileGameLayout();
  const spellWindowParent = mobileLayout ? mobileGameControls : game;
  if (spellWindowParent && playerSpells.parentElement !== spellWindowParent) {
    spellWindowParent.appendChild(playerSpells);
  }
  const mobileAssignHotkeyIndex = Number.isInteger(spellUiState.mobileAssignHotkeyIndex)
    ? spellUiState.mobileAssignHotkeyIndex
    : null;
  const isMobileAssigning = mobileLayout && mobileAssignHotkeyIndex !== null;
  const shouldFocusSpellWindow = !mobileLayout && playerSpells.hidden && spellUiState.isOpen;
  playerSpells.hidden = !spellUiState.isOpen;
  playerSpells.innerHTML = "";
  playerSpells.classList.toggle("spell-window-mobile-bar", mobileLayout);
  playerSpells.classList.toggle("spell-window-mobile-assigning", isMobileAssigning);
  playerSpells.setAttribute("role", mobileLayout ? "region" : "dialog");
  if (mobileLayout) {
    playerSpells.removeAttribute("aria-modal");
  } else {
    playerSpells.setAttribute("aria-modal", "true");
  }
  playerSpells.setAttribute("aria-labelledby", "spell-window-title");
  playerSpells.setAttribute("aria-describedby", "spell-window-help");
  const mobileSpellButton = document.querySelector('[data-mobile-action="toggle-spells"]');
  mobileSpellButton?.classList.toggle("mobile-panel-button-active", spellUiState.isOpen);
  mobileSpellButton?.setAttribute("aria-expanded", spellUiState.isOpen ? "true" : "false");
  if (!spellUiState.isOpen) {
    return;
  }

  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add("boite-boite");
  const headerElement = document.createElement("div");
  headerElement.classList.add("spell-window-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.id = "spell-window-title";
  titleElement.textContent = getGameUiText("spells");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("spell-window-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "x";
  closeButtonElement.title = getGameUiText("closeSpells");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closeSpells"));
  closeButtonElement.addEventListener("click", () => {
    spellUiState.isOpen = false;
    spellUiState.selectedSpellId = null;
    spellUiState.mobileAssignHotkeyIndex = null;
    updatePlayerInventory();
  });
  headerElement.append(titleElement, closeButtonElement);

  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const hotkeyTitleElement = document.createElement("div");
  hotkeyTitleElement.id = "spell-hotkey-title";
  hotkeyTitleElement.classList.add("spell-list-title", "spell-hotkey-title");
  hotkeyTitleElement.textContent = getGameUiText("spellBar");
  const helpElement = document.createElement("div");
  helpElement.id = "spell-window-help";
  helpElement.classList.add("spell-window-help");
  helpElement.setAttribute("aria-live", "polite");
  const selectedSpellData = spellUiState.selectedSpellId
    ? getLocalizedSpellData(spellUiState.selectedSpellId)
    : null;
  if (isMobileAssigning) {
    helpElement.textContent = getGameUiText("mobileSpellAssignPrompt")(
      SPELL_HOTKEY_KEYS[mobileAssignHotkeyIndex],
    );
  } else if (mobileLayout) {
    helpElement.textContent = getGameUiText("mobileSpellBarHelp");
  } else {
    helpElement.textContent = selectedSpellData
      ? getGameUiText("spellAssignPrompt")(selectedSpellData.name)
      : getGameUiText("spellWindowHelp");
  }
  const hotkeyGridElement = document.createElement("div");
  hotkeyGridElement.classList.add("spell-hotkey-grid");
  hotkeyGridElement.setAttribute("role", "group");
  hotkeyGridElement.setAttribute("aria-labelledby", "spell-hotkey-title");

  for (let hotkeyIndex = 0; hotkeyIndex < SPELL_HOTKEY_KEYS.length; hotkeyIndex++) {
    const spellId = playerState.spellbook.hotkeySpellIds[hotkeyIndex];
    const spellData = spellId ? getLocalizedSpellData(spellId) : null;
    const slotElement = document.createElement("div");
    slotElement.classList.add("spell-hotkey-slot");
    slotElement.classList.toggle("spell-hotkey-slot-assigning", mobileAssignHotkeyIndex === hotkeyIndex);
    const castButtonElement = document.createElement("button");
    castButtonElement.classList.add("spell-hotkey-cast-button");
    castButtonElement.type = "button";
    castButtonElement.innerHTML = `<span class="spell-hotkey-key">${SPELL_HOTKEY_KEYS[hotkeyIndex]}</span><span class="spell-hotkey-name">${spellData?.name ?? "-"}</span>`;
    castButtonElement.setAttribute(
      "aria-label",
      getGameUiText("spellSlotLabel")(
        SPELL_HOTKEY_KEYS[hotkeyIndex],
        spellData?.name ?? getGameUiText("emptySpellSlot"),
      ),
    );
    if (!mobileLayout && !spellId && !spellUiState.selectedSpellId) {
      castButtonElement.disabled = true;
    }
    let mobileLongPressTimeoutId = null;
    let mobilePressStartX = null;
    let mobilePressStartY = null;
    let mobilePressCancelled = false;
    let suppressNextClick = false;

    const clearMobileLongPressTimeout = () => {
      if (mobileLongPressTimeoutId !== null) {
        clearTimeout(mobileLongPressTimeoutId);
        mobileLongPressTimeoutId = null;
      }
    };

    castButtonElement.addEventListener("pointerdown", (e) => {
      if (!mobileLayout || e.pointerType === "mouse") {
        return;
      }
      mobilePressStartX = e.clientX;
      mobilePressStartY = e.clientY;
      mobilePressCancelled = false;
      clearMobileLongPressTimeout();
      mobileLongPressTimeoutId = setTimeout(() => {
        mobileLongPressTimeoutId = null;
        spellUiState.mobileAssignHotkeyIndex = hotkeyIndex;
        spellUiState.selectedSpellId = null;
        renderSpellWindow();
      }, MOBILE_SPELL_LONG_PRESS_MS);
    });

    castButtonElement.addEventListener("pointermove", (e) => {
      if (mobileLongPressTimeoutId === null || mobilePressStartX === null || mobilePressStartY === null) {
        return;
      }
      const moveDistance = Math.abs(e.clientX - mobilePressStartX) + Math.abs(e.clientY - mobilePressStartY);
      if (moveDistance > MOBILE_SPELL_PRESS_MOVE_TOLERANCE_PX) {
        mobilePressCancelled = true;
        clearMobileLongPressTimeout();
      }
    });

    castButtonElement.addEventListener("pointerup", (e) => {
      if (!mobileLayout || e.pointerType === "mouse") {
        return;
      }
      e.preventDefault();
      const shouldCastSpell = mobileLongPressTimeoutId !== null && !mobilePressCancelled && Boolean(spellId);
      clearMobileLongPressTimeout();
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 100);
      if (shouldCastSpell) {
        castLearnedPlayerSpellById(spellId);
      }
    });

    castButtonElement.addEventListener("pointercancel", () => {
      mobilePressCancelled = true;
      clearMobileLongPressTimeout();
    });

    castButtonElement.addEventListener("click", () => {
      if (suppressNextClick) {
        return;
      }
      if (spellUiState.selectedSpellId) {
        assignPlayerSpellToHotkey(hotkeyIndex, spellUiState.selectedSpellId);
      } else if (spellId) {
        castLearnedPlayerSpellById(spellId);
      }
    });
    slotElement.appendChild(castButtonElement);
    if (spellId) {
      const clearButtonElement = document.createElement("button");
      clearButtonElement.classList.add("spell-hotkey-clear-button");
      clearButtonElement.type = "button";
      clearButtonElement.textContent = "x";
      clearButtonElement.title = getGameUiText("clearHotkey");
      clearButtonElement.setAttribute(
        "aria-label",
        getGameUiText("clearSpellSlot")(SPELL_HOTKEY_KEYS[hotkeyIndex]),
      );
      clearButtonElement.addEventListener("click", () => {
        assignPlayerSpellToHotkey(hotkeyIndex, null);
      });
      slotElement.appendChild(clearButtonElement);
    }
    hotkeyGridElement.appendChild(slotElement);
  }

  const learnedTitleElement = document.createElement("div");
  learnedTitleElement.classList.add("spell-list-title");
  learnedTitleElement.textContent = getGameUiText("learnedSpells");
  learnedTitleElement.hidden = mobileLayout && !isMobileAssigning;
  const learnedListElement = document.createElement("div");
  learnedListElement.classList.add("spell-list");
  learnedListElement.setAttribute("role", "list");
  learnedListElement.hidden = mobileLayout && !isMobileAssigning;
  const learnedSpells = getLearnedPlayerSpells();

  if (learnedSpells.length === 0) {
    const emptyElement = document.createElement("div");
    emptyElement.classList.add("spell-list-empty");
    emptyElement.textContent = getGameUiText("noLearnedSpells");
    learnedListElement.appendChild(emptyElement);
  } else {
    for (const spellData of learnedSpells) {
      const rowElement = document.createElement("div");
      rowElement.classList.add("spell-list-row");
      rowElement.classList.toggle("spell-list-row-selected", spellUiState.selectedSpellId === spellData.spellId);
      rowElement.setAttribute("role", "listitem");
      const detailsElement = document.createElement("div");
      detailsElement.classList.add("spell-list-details");
      const nameElement = document.createElement("strong");
      nameElement.textContent = spellData.name;
      const statsElement = document.createElement("span");
      statsElement.textContent = `${spellData.incantation} | ML ${spellData.requiredMagicLevel} | ${spellData.manaCost} MP`;
      detailsElement.append(nameElement, statsElement);
      const actionsElement = document.createElement("div");
      actionsElement.classList.add("spell-list-actions");
      const castButtonElement = document.createElement("button");
      castButtonElement.classList.add("spell-list-cast-button");
      castButtonElement.type = "button";
      castButtonElement.textContent = getGameUiText("castSpell");
      castButtonElement.hidden = mobileLayout;
      castButtonElement.setAttribute("aria-label", `${getGameUiText("castSpell")}: ${spellData.name}`);
      castButtonElement.addEventListener("click", () => castLearnedPlayerSpellById(spellData.spellId));
      const assignButtonElement = document.createElement("button");
      assignButtonElement.classList.add("spell-list-assign-button");
      assignButtonElement.type = "button";
      assignButtonElement.textContent = getGameUiText("assignSpell");
      assignButtonElement.setAttribute("aria-pressed", spellUiState.selectedSpellId === spellData.spellId ? "true" : "false");
      assignButtonElement.setAttribute("aria-label", `${getGameUiText("assignSpell")}: ${spellData.name}`);
      assignButtonElement.addEventListener("click", () => {
        if (isMobileAssigning) {
          assignPlayerSpellToHotkey(mobileAssignHotkeyIndex, spellData.spellId);
          return;
        }
        spellUiState.selectedSpellId = spellUiState.selectedSpellId === spellData.spellId ? null : spellData.spellId;
        renderSpellWindow();
      });
      actionsElement.append(castButtonElement, assignButtonElement);
      rowElement.append(detailsElement, actionsElement);
      learnedListElement.appendChild(rowElement);
    }
  }

  wrapperElement.append(
    headerElement,
    separatorElement,
    hotkeyTitleElement,
    helpElement,
    hotkeyGridElement,
    learnedTitleElement,
    learnedListElement,
  );
  playerSpells.appendChild(wrapperElement);
  if (shouldFocusSpellWindow) {
    requestAnimationFrame(() => closeButtonElement.focus());
  }
};

const toggleSpellWindow = () => {
  spellUiState.isOpen = !spellUiState.isOpen;
  spellUiState.selectedSpellId = null;
  spellUiState.mobileAssignHotkeyIndex = null;
  if (spellUiState.isOpen) {
    questUiState.isOpen = false;
    gameOptionsUiState.isOpen = false;
    setOpenMobilePanel(null);
  }
  updatePlayerInventory();
};

/* ---------- UI - QUETES ---------- */

const getPlayerQuestEntries = () => {
  if (!playerState.progress?.questsById) {
    return [];
  }
  return Object.values(playerState.progress.questsById)
    .filter((questState) => getQuestData(questState.questId))
    .sort((firstQuest, secondQuest) => {
      if (firstQuest.status !== secondQuest.status) {
        return firstQuest.status === QUEST_STATUS.started ? -1 : 1;
      }
      return firstQuest.startedAt - secondQuest.startedAt;
    });
};

const renderQuestWindow = () => {
  if (!playerQuests) {
    return;
  }

  playerQuests.hidden = !questUiState.isOpen;
  playerQuests.innerHTML = "";
  if (!questUiState.isOpen) {
    return;
  }

  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add("boite-boite");
  const headerElement = document.createElement("div");
  headerElement.classList.add("quest-window-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("quests");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("quest-window-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "x";
  closeButtonElement.title = getGameUiText("closeQuests");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closeQuests"));
  closeButtonElement.addEventListener("click", () => {
    questUiState.isOpen = false;
    updatePlayerInventory();
  });
  headerElement.append(titleElement, closeButtonElement);

  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const questListElement = document.createElement("div");
  questListElement.classList.add("quest-list");
  const questEntries = getPlayerQuestEntries();

  if (questEntries.length === 0) {
    const emptyElement = document.createElement("div");
    emptyElement.classList.add("quest-list-empty");
    emptyElement.textContent = getGameUiText("noQuests");
    questListElement.appendChild(emptyElement);
  } else {
    for (const questState of questEntries) {
      const questData = getLocalizedQuestData(questState.questId);
      const questRowElement = document.createElement("div");
      questRowElement.classList.add("quest-list-row", `quest-list-row-${questState.status}`);
      const questNameElement = document.createElement("span");
      questNameElement.classList.add("quest-list-name");
      questNameElement.textContent = questData.name;
      const questStatusElement = document.createElement("span");
      questStatusElement.classList.add("quest-list-status");
      questStatusElement.textContent =
        questState.status === QUEST_STATUS.completed
          ? getGameUiText("questCompleted")
          : getGameUiText("questStarted");
      questRowElement.append(questNameElement, questStatusElement);
      questListElement.appendChild(questRowElement);
    }
  }

  wrapperElement.append(headerElement, separatorElement, questListElement);
  playerQuests.appendChild(wrapperElement);
};

const toggleQuestWindow = () => {
  questUiState.isOpen = !questUiState.isOpen;
  if (questUiState.isOpen) {
    gameOptionsUiState.isOpen = false;
    spellUiState.isOpen = false;
  }
  updatePlayerInventory();
};

const bindQuestUiButton = () => {
  const questButton = playerInventory.querySelector('[data-ui-action="toggle-quests"]');
  if (!questButton) {
    return;
  }
  questButton.addEventListener("click", toggleQuestWindow);
};

const getCharacterSelectorErrorMessage = (reason) => {
  const messagesByReason = {
    "invalid-name": getGameUiText("invalidCharacterName"),
    "invalid-appearance": getGameUiText("invalidAppearance"),
    "duplicate-name": getGameUiText("duplicateCharacterName"),
    "storage-error": getGameUiText("characterStorageError"),
    "corrupted-save": getGameUiText("corruptedSave"),
    "unsupported-save": getGameUiText("unsupportedSave"),
    "not-found": getGameUiText("characterNotFound"),
  };
  return messagesByReason[reason] ?? getGameUiText("characterOperationFailed");
};

const closeCharacterSelector = () => {
  characterSelectorUiState.isOpen = false;
  renderCharacterSelector();
};

const reloadIntoSelectedCharacter = () => {
  gameRuntimeState.isSwitchingCharacter = true;
  try {
    sessionStorage.setItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY, "true");
  } catch {
    // The reload still uses the active character saved in local storage.
  }
  window.location.reload();
};

const startSelectedCharacterGame = async () => {
  if (gameRuntimeState.isStarting || gameRuntimeState.isStarted) {
    return false;
  }
  closeCharacterSelector();
  if (gameWelcome) {
    gameWelcome.hidden = true;
  }
  return startGame();
};

const openCharacterSelector = () => {
  if (characterSelectorUiState.isOpen) {
    return;
  }
  characterSelectorUiState.isOpen = true;
  if (gameRuntimeState.isStarted) {
    questUiState.isOpen = false;
    gameOptionsUiState.isOpen = false;
    renderQuestWindow();
    renderOptionsWindow();
    resetMobileJoystick();
    setOpenMobilePanel(null);
    stopPlayerNavigation();
    cancelItemDrag();
    cancelItemUse();
  }
  renderCharacterSelector();
};

const saveCurrentCharacterBeforeSwitch = () => {
  const saveResult = saveCharacterSnapshot(createCharacterSaveSnapshot());
  if (!saveResult.success) {
    showGameStatusMessage(getGameUiText("currentCharacterSaveFailed"));
    return false;
  }
  return true;
};

const selectCharacterProfile = (characterId) => {
  if (!gameRuntimeState.isStarted) {
    const selectionResult = setActiveCharacterId(characterId);
    if (!selectionResult.success) {
      showGameStatusMessage(getCharacterSelectorErrorMessage(selectionResult.reason));
      return;
    }
    startSelectedCharacterGame();
    return;
  }

  if (characterId === playerState.uid) {
    closeCharacterSelector();
    return;
  }
  if (!saveCurrentCharacterBeforeSwitch()) {
    return;
  }

  const selectionResult = setActiveCharacterId(characterId);
  if (!selectionResult.success) {
    showGameStatusMessage(getCharacterSelectorErrorMessage(selectionResult.reason));
    return;
  }
  reloadIntoSelectedCharacter();
};

const createNewCharacterProfile = (name, appearanceId, errorElement) => {
  if (gameRuntimeState.isStarted && !saveCurrentCharacterBeforeSwitch()) {
    errorElement.textContent = getGameUiText("currentCharacterSaveFailed");
    return;
  }

  const creationResult = createCharacterProfile(name, appearanceId);
  if (!creationResult.success) {
    errorElement.textContent = getCharacterSelectorErrorMessage(creationResult.reason);
    return;
  }
  if (gameRuntimeState.isStarted) {
    reloadIntoSelectedCharacter();
  } else {
    startSelectedCharacterGame();
  }
};

const deleteExistingCharacterProfile = (characterProfile) => {
  if (!characterProfile || !window.confirm(getGameUiText("deleteCharacterConfirm")(characterProfile.name))) {
    return;
  }

  const deletionResult = deleteCharacterProfile(characterProfile.characterId);
  if (!deletionResult.success) {
    showGameStatusMessage(getCharacterSelectorErrorMessage(deletionResult.reason));
    return;
  }

  if (deletionResult.wasActive && gameRuntimeState.isStarted) {
    if (deletionResult.activeCharacterId === null) {
      gameRuntimeState.isSwitchingCharacter = true;
      try {
        sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
      } catch {
        // The welcome screen is still the default after a normal reload.
      }
      window.location.reload();
      return;
    }
    reloadIntoSelectedCharacter();
    return;
  }
  renderCharacterSelector();
};

const renderCharacterSelector = () => {
  if (!characterSelector) {
    return;
  }

  characterSelector.hidden = !characterSelectorUiState.isOpen;
  characterSelector.textContent = "";
  if (!characterSelectorUiState.isOpen) {
    return;
  }

  const windowElement = document.createElement("section");
  windowElement.classList.add("boite-panneau", "character-selector-window");

  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add("boite-boite");

  const headerElement = document.createElement("div");
  headerElement.classList.add("character-selector-header");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("characters");
  const closeButtonElement = document.createElement("button");
  closeButtonElement.classList.add("character-selector-close-button");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "x";
  closeButtonElement.title = getGameUiText("closeCharacters");
  closeButtonElement.setAttribute("aria-label", getGameUiText("closeCharacters"));
  closeButtonElement.addEventListener("click", closeCharacterSelector);
  headerElement.append(titleElement, closeButtonElement);

  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");

  const characterListElement = document.createElement("div");
  characterListElement.classList.add("character-selector-list");
  const profileResult = listCharacterProfiles();
  if (!profileResult.success) {
    const errorElement = document.createElement("div");
    errorElement.classList.add("character-selector-empty");
    errorElement.textContent = getCharacterSelectorErrorMessage(profileResult.reason);
    characterListElement.appendChild(errorElement);
  } else if (profileResult.characters.length === 0) {
    const emptyElement = document.createElement("div");
    emptyElement.classList.add("character-selector-empty");
    emptyElement.textContent = getGameUiText("noCharacters");
    characterListElement.appendChild(emptyElement);
  } else {
    for (const characterProfile of profileResult.characters) {
      const rowElement = document.createElement("div");
      rowElement.classList.add("character-selector-row");
      if (characterProfile.isActive) {
        rowElement.classList.add("character-selector-row-active");
      }

      const selectButtonElement = document.createElement("button");
      selectButtonElement.classList.add("character-selector-select-button");
      selectButtonElement.type = "button";

      const appearanceData = getPlayerAppearanceData(characterProfile.appearanceId);
      const portraitElement = document.createElement("span");
      portraitElement.classList.add("character-selector-portrait");
      portraitElement.style.backgroundImage = `url("${appearanceData.textureUrl}")`;

      const identityElement = document.createElement("span");
      identityElement.classList.add("character-selector-identity");
      const nameElement = document.createElement("span");
      nameElement.classList.add("character-selector-name");
      nameElement.textContent = characterProfile.name;
      const levelElement = document.createElement("span");
      levelElement.classList.add("character-selector-level");
      levelElement.textContent = `${getGameUiText("levelLabel")} ${getLevelFromExperience(characterProfile.experience)}`;
      identityElement.append(nameElement, levelElement);

      const statusElement = document.createElement("span");
      statusElement.classList.add("character-selector-current-label");
      statusElement.textContent = characterProfile.isActive ? getGameUiText("current") : getGameUiText("select");
      selectButtonElement.append(portraitElement, identityElement, statusElement);
      selectButtonElement.addEventListener("click", () => {
        selectCharacterProfile(characterProfile.characterId);
      });

      const deleteButtonElement = document.createElement("button");
      deleteButtonElement.classList.add("character-selector-delete-button");
      deleteButtonElement.type = "button";
      deleteButtonElement.textContent = getGameUiText("delete");
      deleteButtonElement.title = getGameUiText("deleteCharacter")(characterProfile.name);
      deleteButtonElement.addEventListener("click", () => {
        deleteExistingCharacterProfile(characterProfile);
      });

      rowElement.append(selectButtonElement, deleteButtonElement);
      characterListElement.appendChild(rowElement);
    }
  }

  const secondSeparatorElement = document.createElement("div");
  secondSeparatorElement.classList.add("separateur-panneau");

  const formElement = document.createElement("form");
  formElement.classList.add("character-create-form");
  const formTitleElement = document.createElement("div");
  formTitleElement.classList.add("character-create-title");
  formTitleElement.textContent = getGameUiText("newCharacter");
  const nameInputElement = document.createElement("input");
  nameInputElement.classList.add("character-create-input");
  nameInputElement.type = "text";
  nameInputElement.name = "characterName";
  nameInputElement.placeholder = getGameUiText("characterName");
  nameInputElement.minLength = 2;
  nameInputElement.maxLength = 20;
  nameInputElement.autocomplete = "off";
  const appearanceOptionsElement = document.createElement("div");
  appearanceOptionsElement.classList.add("character-appearance-options");
  let selectedAppearanceId = DEFAULT_PLAYER_APPEARANCE_ID;
  const appearanceButtonsById = new Map();

  const selectAppearance = (appearanceId) => {
    selectedAppearanceId = getPlayerAppearanceData(appearanceId).appearanceId;
    for (const [buttonAppearanceId, buttonElement] of appearanceButtonsById.entries()) {
      const isSelected = buttonAppearanceId === selectedAppearanceId;
      buttonElement.classList.toggle("character-appearance-option-active", isSelected);
      buttonElement.setAttribute("aria-pressed", String(isSelected));
    }
  };

  for (const appearanceData of Object.values(playerAppearancesDatabase)) {
    const appearanceButtonElement = document.createElement("button");
    appearanceButtonElement.classList.add("character-appearance-option");
    appearanceButtonElement.type = "button";
    appearanceButtonElement.setAttribute("aria-pressed", "false");
    const appearancePreviewElement = document.createElement("span");
    appearancePreviewElement.classList.add("character-appearance-preview");
    appearancePreviewElement.style.backgroundImage = `url("${appearanceData.textureUrl}")`;
    const appearanceLabelElement = document.createElement("span");
    appearanceLabelElement.classList.add("character-appearance-label");
    appearanceLabelElement.textContent =
      getLocalizedContentData("appearances", appearanceData.appearanceId, appearanceData).label;
    appearanceButtonElement.append(appearancePreviewElement, appearanceLabelElement);
    appearanceButtonElement.addEventListener("click", () => {
      selectAppearance(appearanceData.appearanceId);
    });
    appearanceButtonsById.set(appearanceData.appearanceId, appearanceButtonElement);
    appearanceOptionsElement.appendChild(appearanceButtonElement);
  }
  selectAppearance(selectedAppearanceId);
  const createButtonElement = document.createElement("button");
  createButtonElement.classList.add("character-create-button");
  createButtonElement.type = "submit";
  createButtonElement.textContent = getGameUiText("create");
  const formErrorElement = document.createElement("div");
  formErrorElement.classList.add("character-selector-error");

  formElement.append(
    formTitleElement,
    appearanceOptionsElement,
    nameInputElement,
    createButtonElement,
    formErrorElement,
  );
  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    createNewCharacterProfile(nameInputElement.value, selectedAppearanceId, formErrorElement);
  });

  wrapperElement.append(
    headerElement,
    separatorElement,
    characterListElement,
    secondSeparatorElement,
    formElement,
  );
  windowElement.appendChild(wrapperElement);
  characterSelector.appendChild(windowElement);
  nameInputElement.focus();
};

const toggleCharacterSelector = () => {
  if (characterSelectorUiState.isOpen) {
    closeCharacterSelector();
  } else {
    openCharacterSelector();
  }
};

const initializeGameWelcome = () => {
  if (!gameWelcome || !gameWelcomePlayButton) {
    return true;
  }

  let shouldEnterGame = false;
  try {
    shouldEnterGame = sessionStorage.getItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY) === "true";
    sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
  } catch {
    shouldEnterGame = false;
  }
  gameWelcome.hidden = shouldEnterGame;
  applyGameLanguageUi();

  gameWelcome.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  gameWelcome.addEventListener("mouseup", (event) => {
    event.stopPropagation();
  });
  gameWelcome.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  gameWelcome.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  gameWelcomePlayButton.addEventListener("click", () => {
    unlockGameAudio();
    openCharacterSelector();
  });
  for (const languageButton of gameWelcomeLanguageButtons) {
    languageButton.addEventListener("click", () => {
      setGameLanguage(languageButton.dataset.gameLanguage);
    });
  }
  return shouldEnterGame;
};

const togglePlayerFollow = () => {
  playerNavigationState.followEnabled = !playerNavigationState.followEnabled;

  if (playerNavigationState.followEnabled) {
    startPlayerFollowNavigation();
  } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
    stopPlayerNavigation();
  }

  updatePlayerInventory();
};

const bindPlayerFollowButton = () => {
  const followButton = playerInventory.querySelector('[data-ui-action="toggle-follow"]');
  if (!followButton) {
    return;
  }
  followButton.addEventListener("click", togglePlayerFollow);
};

const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
              <div class="equipment-panel">
                <div class="boite-jeux-titre">${getGameUiText("equipments")}</div>
                <div class="separateur-panneau"></div>

                <div id="equipment-area" class="equipment-area">
                  <div class="equipment-grid">
                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="necklace"></div>
                      <div class="equipment-slot" data-equipment-slot="weapon"></div>
                      <div class="equipment-slot" data-equipment-slot="ring"></div>
                      <div class="equipment-small-slot" data-equipment-small-slot="status"></div>
                    </div>

                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="helmet"></div>
                      <div class="equipment-slot" data-equipment-slot="armor"></div>
                      <div class="equipment-slot" data-equipment-slot="legs"></div>
                      <div class="equipment-slot" data-equipment-slot="boots"></div>
                    </div>

                    <div class="equipment-column">
                      <div class="equipment-slot" data-equipment-slot="backpack"></div>
                      <div class="equipment-slot" data-equipment-slot="shield"></div>
                      <div class="equipment-slot" data-equipment-slot="ammo"></div>
                      <div class="equipment-small-slot equipment-cap-slot">${getGameUiText("capacityShort")}:<br />${getPlayerRemainingCapacity()}</div>
                    </div>
                  </div>

                  <div class="equipment-right-bar">
                    <button class="equipment-ui-button${playerNavigationState.followEnabled ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-follow" aria-pressed="${playerNavigationState.followEnabled}">${getGameUiText("follow")}</button>
                    <button class="equipment-ui-button" data-ui-action="show-pvp-status">PVP</button>
                    <button class="equipment-ui-button${spellUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-spells" aria-haspopup="dialog" aria-controls="player-spells" aria-expanded="${spellUiState.isOpen}">${getGameUiText("hotkeys")}</button>
                    <button class="equipment-ui-button${questUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-quests">${getGameUiText("quests")}</button>
                    <button class="equipment-ui-button${gameOptionsUiState.isOpen ? " equipment-ui-button-active" : ""}" data-ui-action="toggle-options">${getGameUiText("options")}</button>
                    <button class="equipment-ui-button" data-ui-action="logout">${getGameUiText("logout")}</button>
                  </div>
                </div>
               <div class="stance-bar">
                  <button class="stance-button" data-combat-mode="fullAttack">${getGameUiText("fullAttack")}</button>
                  <button class="stance-button stance-button-active" data-combat-mode="balanced">${getGameUiText("balanced")}</button>
                  <button class="stance-button" data-combat-mode="fullDefense">${getGameUiText("fullDefense")}</button>
                </div>
              </div>
            </div>`;

  playerInventory.innerHTML = html;
  renderEquipmentSlots();
  bindCombatModeButtons();
  bindPlayerFollowButton();
  bindQuestUiButton();
  bindEquipmentMenuButtons();
  refreshCombatModeButtons();
  renderQuestWindow();
  renderOptionsWindow();
  renderSpellWindow();
  syncMobileBackpackButton();
  syncMobileFollowButton();
  syncItemUseSourceFeedback();
};

const getLocalizedSpellData = (spellId) => {
  const spellData = spellsDatabase[spellId] ?? null;
  if (!spellData) {
    return null;
  }
  if (getCurrentGameLanguage() === "fr") {
    return {
      ...spellData,
      name: spellData.nameFr ?? spellData.name,
      description: spellData.descriptionFr ?? spellData.description,
    };
  }
  return spellData;
};
//#endregion  -----  UI - EQUIPMENT / INVENTAIRE  -----

/* ==================================================== */
//#region     -----  UI - CONTENEURS  -----
/* ==================================================== */
/* ---------- CONTENEURS - SLOTS ET FENETRES ---------- */

const renderContainerSlots = (containerBody, containerItem) => {
  if (!containerItem || !containerBody) {
    return;
  }

  containerBody.innerHTML = ``;

  const dataItem = getItemData(containerItem.itemId);
  if (!dataItem) {
    return null;
  }
  const slotGrid = document.createElement("div");
  slotGrid.classList.add("container-slot-grid");
  for (let i = 0; i < dataItem.capacity; i++) {
    const slotItem = containerItem.content[i];
    const slot = document.createElement("div");
    slot.classList.add("container-slot");
    slot.setAttribute("data-container-slot-index", i);
    slot.setAttribute("data-container-uid", containerItem.uid);

    if (slotItem) {
      renderItemIcon(slot, slotItem, 40);
      slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragState.isDragging) {
          inputState.shouldBlockNextContextMenu = true;
          cancelItemDrag();
          return;
        }
        if (shouldBlockContextMenuAction()) {
          return;
        }
        const source = {
          locationType: "containerSlot",
          parentContainerUid: containerItem.uid,
          slotIndex: i,
        };

        handleUseItemFromSource(source);
      });
    }
    slotGrid.appendChild(slot);
  }

  containerBody.appendChild(slotGrid);
};

const syncOpenedContainerOrderFromDock = () => {
  if (!playerContainers) {
    return;
  }
  const openedContainersByUid = new Map(
    openedContainers.map((container) => {
      return [container.item.uid, container];
    }),
  );
  const orderedContainers = [];
  for (const element of playerContainers.querySelectorAll(".container-window")) {
    const containerUid = Number(element.dataset.containerUid);
    const container = openedContainersByUid.get(containerUid);
    if (container) {
      orderedContainers.push(container);
    }
  }
  if (orderedContainers.length === openedContainers.length) {
    openedContainers.splice(0, openedContainers.length, ...orderedContainers);
  }
};

const startContainerWindowDockDrag = (event, windowElement, headerElement) => {
  if (event.button !== 0 || event.target.closest("button") || !playerContainers.contains(windowElement)) {
    return;
  }
  event.preventDefault();
  windowElement.classList.add("container-window-dragging");
  headerElement.setPointerCapture(event.pointerId);

  const moveWindow = (moveEvent) => {
    const siblingWindows = [...playerContainers.querySelectorAll(".container-window")].filter((element) => {
      return element !== windowElement;
    });
    const insertBeforeWindow =
      siblingWindows.find((element) => {
        const elementRect = element.getBoundingClientRect();
        return moveEvent.clientY < elementRect.top + elementRect.height / 2;
      }) ?? null;

    playerContainers.insertBefore(windowElement, insertBeforeWindow);
  };

  const finishWindowMove = (finishEvent) => {
    windowElement.classList.remove("container-window-dragging");
    headerElement.removeEventListener("pointermove", moveWindow);
    headerElement.removeEventListener("pointerup", finishWindowMove);
    headerElement.removeEventListener("pointercancel", finishWindowMove);
    if (headerElement.hasPointerCapture(finishEvent.pointerId)) {
      headerElement.releasePointerCapture(finishEvent.pointerId);
    }
    syncOpenedContainerOrderFromDock();
  };

  headerElement.addEventListener("pointermove", moveWindow);
  headerElement.addEventListener("pointerup", finishWindowMove, { once: true });
  headerElement.addEventListener("pointercancel", finishWindowMove, { once: true });
};

const startContainerWindowResize = (event, windowElement, container, resizeHandle) => {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const startPointerY = event.clientY;
  const startHeight = windowElement.getBoundingClientRect().height;
  resizeHandle.setPointerCapture(event.pointerId);

  const resizeWindow = (moveEvent) => {
    const contentMaxHeight = Number.isFinite(container.maxWindowHeight)
      ? container.maxWindowHeight
      : playerContainers.clientHeight;
    const maxHeight = Math.max(70, Math.min(contentMaxHeight, playerContainers.clientHeight));
    const nextHeight = clamp(startHeight + moveEvent.clientY - startPointerY, 70, maxHeight);
    windowElement.style.height = `${nextHeight}px`;
    container.windowHeight = nextHeight;
  };

  const finishResize = (finishEvent) => {
    resizeHandle.removeEventListener("pointermove", resizeWindow);
    resizeHandle.removeEventListener("pointerup", finishResize);
    resizeHandle.removeEventListener("pointercancel", finishResize);
    if (resizeHandle.hasPointerCapture(finishEvent.pointerId)) {
      resizeHandle.releasePointerCapture(finishEvent.pointerId);
    }
  };

  resizeHandle.addEventListener("pointermove", resizeWindow);
  resizeHandle.addEventListener("pointerup", finishResize, { once: true });
  resizeHandle.addEventListener("pointercancel", finishResize, { once: true });
};

const applyContainerWindowHeightBounds = (windowElement, bodyElement, container) => {
  if (!windowElement || !bodyElement || !container) {
    return;
  }
  const currentWindowHeight = windowElement.getBoundingClientRect().height;
  const windowChromeHeight = currentWindowHeight - bodyElement.clientHeight;
  const slotGridHeight = bodyElement.querySelector(".container-slot-grid")?.getBoundingClientRect().height ?? 0;
  const bodyStyle = window.getComputedStyle(bodyElement);
  const bodyVerticalPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
  const contentHeight = Math.ceil(windowChromeHeight + bodyVerticalPadding + slotGridHeight);
  const maxWindowHeight = Math.max(70, Math.min(contentHeight, playerContainers.clientHeight));
  const requestedHeight = Number.isFinite(container.windowHeight) ? container.windowHeight : maxWindowHeight;
  const resolvedHeight = clamp(requestedHeight, 70, maxWindowHeight);

  container.maxWindowHeight = maxWindowHeight;
  container.windowHeight = resolvedHeight;
  windowElement.style.maxHeight = `${maxWindowHeight}px`;
  windowElement.style.height = `${resolvedHeight}px`;
};

const renderContainerDock = () => {
  if (!playerContainers) {
    return;
  }
  playerContainers.innerHTML = ``;
  openedContainers.forEach((container) => {
    let backButton = null;
    let body = null;
    const div = document.createElement("div");
    div.classList.add("container-window");
    div.classList.add(`container-window-${container.sourceType}`);
    div.dataset.containerUid = container.item.uid;
    const header = document.createElement("div");
    header.classList.add("container-window-header");
    header.addEventListener("pointerdown", (event) => {
      startContainerWindowDockDrag(event, div, header);
    });
    const button = document.createElement("button");
    button.classList.add("container-minimize-button");
    const closeButton = document.createElement("button");
    closeButton.classList.add("container-minimize-button");
    closeButton.innerText = "X";
    const title = document.createElement("div");
    title.classList.add("boite-jeux-titre");
    title.textContent = getLocalizedItemName(container.item.itemId);
    header.appendChild(title);
    if (container.parent !== null) {
      backButton = document.createElement("button");
      backButton.classList.add("container-back-button");
      backButton.innerText = `‹`;
      backButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const parentWrapper = container.parent;
        closeContainer(container.item);
        const parentAlreadyOpen = findOpenedContainerWrapperByUid(parentWrapper.item.uid);
        if (parentAlreadyOpen) {
          parentAlreadyOpen.isMinimized = false;
          renderContainerDock();
          return;
        }
        openContainer(parentWrapper.item, parentWrapper.title, parentWrapper.sourceType, parentWrapper.parent);
      });
      header.append(backButton);
    }
    closeButton.addEventListener("click", (e) => {
      e.preventDefault();
      closeContainer(container.item);
      e.stopPropagation();
    });
    button.addEventListener("click", (e) => {
      e.preventDefault();
      toggleContainerMinimized(container.item);
      e.stopPropagation();
    });

    header.append(button, closeButton);

    if (container.isMinimized === true) {
      div.classList.add("container-window-minimized");
      button.textContent = "+";
      div.append(header);
    } else {
      if (Number.isFinite(container.windowHeight)) {
        div.style.height = `${container.windowHeight}px`;
      }
      const separateur = document.createElement("div");
      separateur.classList.add("separateur-panneau");
      button.textContent = "-";
      body = document.createElement("div");
      body.classList.add("container-window-body");
      renderContainerSlots(body, container.item);
      const resizeHandle = document.createElement("div");
      resizeHandle.classList.add("container-window-resize-handle");
      resizeHandle.addEventListener("pointerdown", (event) => {
        startContainerWindowResize(event, div, container, resizeHandle);
      });
      div.append(header, separateur, body, resizeHandle);
    }

    playerContainers.append(div);
    if (body) {
      applyContainerWindowHeightBounds(div, body, container);
    }
  });
  mobileGameControls?.classList.toggle("mobile-game-controls-container-open", openedContainers.length > 0);
  syncMobileBackpackButton();
  syncItemUseSourceFeedback();
};

const closeAllContainer = () => {
  if (openedContainers.length > 0) {
    openedContainers.length = 0;
  }
  refreshInventoryUi();
};

const closeContainer = (containerItem) => {
  const index = findOpenedContainerIndexByUid(containerItem.uid);
  if (index === -1) {
    return;
  }
  openedContainers.splice(index, 1);
  renderContainerDock();
};

const openContainer = (containerItem, title, source, parent) => {
  if (!isContainerItem(containerItem) || !isOpenableContainerItem(containerItem)) {
    return;
  }

  if (source === "world") {
    let rootItem = null;
    if (parent) {
      rootItem = getOpenedContainerRootWrapper(parent).item;
    } else {
      rootItem = containerItem;
    }
    if (rootItem.z !== playerState.z) {
      return;
    }
    if (!isNearPlayer(rootItem, 1)) {
      return;
    }
  }

  const alreadyOpen = findOpenedContainerWrapperByUid(containerItem.uid);
  if (alreadyOpen) {
    closeContainer(containerItem);
    return;
  }
  openedContainers.push({
    item: containerItem,
    title: title,
    isMinimized: false,
    sourceType: source,
    parent: parent,
    windowHeight: null,
    maxWindowHeight: null,
  });

  if (isMobileGameLayout()) {
    setOpenMobilePanel(null);
  }
  renderContainerDock();
};

const findOpenedContainerItemByUid = (containerUid) => {
  const openedContainer = findOpenedContainerWrapperByUid(containerUid);
  if (!openedContainer) {
    return null;
  }
  return openedContainer.item;
};

const findOpenedContainerIndexByUid = (containerUid) => {
  return openedContainers.findIndex((container) => {
    return container.item.uid === containerUid;
  });
};

const toggleContainerMinimized = (containerItem) => {
  const openedContainer = findOpenedContainerWrapperByUid(containerItem.uid);
  if (!openedContainer) {
    return;
  }
  openedContainer.isMinimized = !openedContainer.isMinimized;
  renderContainerDock();
};
//#endregion  -----  UI - CONTENEURS  -----

/* ==================================================== */
//#region     -----  ITEMS - UTILISATION ET COOLDOWNS  -----
/* ==================================================== */

const consumeOneChargeFromRune = (item, source) => {
  if (!item || !source || !item.charges) {
    return false;
  }
  if (item.charges >= 1) {
    item.charges -= 1;
  }
  if (item.charges <= 0) {
    const wasRemoved = removeItemFromDragSource(source);
    if (!wasRemoved) {
      return false;
    }
  }
  refreshItemUiAfterDrag();
  return true;
};
/* ---------- ITEM USE - COOLDOWN ---------- */
const getUseCooldownGroup = (useData) => {
  if (!useData.cooldownGroup) {
    return null;
  }
  return useData.cooldownGroup;
};

const isUseCooldownReady = (cooldownGroup) => {
  if (cooldownGroup === null) {
    return true;
  }

  return nextUseCooldown[cooldownGroup] <= Date.now();
};

const startUseCooldown = (cooldownGroup) => {
  if (cooldownGroup === null) {
    return;
  }
  nextUseCooldown[cooldownGroup] = useCooldown[cooldownGroup] + Date.now();
  updateItemCooldownOverlays(Date.now());
};

const getUseCooldownRemainingRatio = (cooldownGroup, now) => {
  const cooldownDuration = useCooldown[cooldownGroup];
  const cooldownEndTime = nextUseCooldown[cooldownGroup];
  if (!Number.isFinite(cooldownDuration) || cooldownDuration <= 0 || !Number.isFinite(cooldownEndTime)) {
    return 0;
  }
  return clamp((cooldownEndTime - now) / cooldownDuration, 0, 1);
};

const updateItemCooldownOverlayElement = (element, now) => {
  const cooldownGroup = element?.dataset.cooldownGroup;
  if (!cooldownGroup) {
    return;
  }
  const remainingRatio = getUseCooldownRemainingRatio(cooldownGroup, now);
  element.style.setProperty("--item-cooldown-angle", `${remainingRatio * 360}deg`);
  element.classList.toggle("item-cooldown-overlay-active", remainingRatio > 0);
};

const updateItemCooldownOverlays = (now) => {
  for (const element of itemCooldownOverlayElements) {
    if (!element.isConnected) {
      itemCooldownOverlayElements.delete(element);
      continue;
    }
    updateItemCooldownOverlayElement(element, now);
  }
};

/* ---------- ITEM USE - ETAT / ROUTAGE ET ACTIONS ---------- */
const addUseCursorClass = () => {
  boitePrincipale.classList.add("item-use-cursor");
};

const removeUseCursorClass = () => {
  boitePrincipale.classList.remove("item-use-cursor");
};

const cancelItemUse = () => {
  clearItemUseSourceFeedback();
  itemUseState.isUsingItem = false;
  itemUseState.source = null;
  itemUseState.item = null;
  itemUseState.useData = null;
  itemUseState.startedAt = null;
  clearPixiItemUseTargets();
  removeUseCursorClass();
  resetInputComboState();
};

const startItemUse = (source, item, useData) => {
  if (!source || !item || !useData) {
    cancelItemUse();
    return;
  }
  itemUseState.isUsingItem = true;
  addUseCursorClass();
  itemUseState.source = source;
  itemUseState.item = item;
  itemUseState.useData = useData;
  itemUseState.startedAt = Date.now();
  syncItemUseSourceFeedback();
  syncItemUseTargetIndicators();
};

const getItemUseSourceElement = (source) => {
  if (source?.locationType === "containerSlot") {
    return document.querySelector(
      `[data-container-uid="${source.parentContainerUid}"][data-container-slot-index="${source.slotIndex}"]`,
    );
  }
  if (source?.locationType === "equipmentSlot") {
    return document.querySelector(`[data-equipment-slot="${source.equipmentSlotName}"]`);
  }
  return null;
};

const clearItemUseSourceFeedback = () => {
  for (const sourceElement of document.querySelectorAll(".item-use-source-active")) {
    sourceElement.classList.remove("item-use-source-active");
  }
  if (isMobileGameLayout() && itemUseState.source?.locationType === "worldItem") {
    setPixiWorldItemSelected(itemUseState.source.itemUid, false);
  }
  if (mobileItemUseIcon) {
    mobileItemUseIcon.textContent = "";
  }
  if (mobileItemUseLabel) {
    mobileItemUseLabel.textContent = "";
  }
  mobileItemUseIndicator?.toggleAttribute("hidden", true);
};

const syncItemUseSourceFeedback = () => {
  clearItemUseSourceFeedback();
  if (!isMobileGameLayout() || !itemUseState.isUsingItem || !itemUseState.item) {
    return;
  }

  getItemUseSourceElement(itemUseState.source)?.classList.add("item-use-source-active");
  if (itemUseState.source?.locationType === "worldItem") {
    setPixiWorldItemSelected(itemUseState.source.itemUid, true);
  }
  if (mobileItemUseIcon) {
    renderItemIcon(mobileItemUseIcon, itemUseState.item, 28);
  }
  if (mobileItemUseLabel) {
    mobileItemUseLabel.textContent = getLocalizedItemName(itemUseState.item.itemId);
  }
  mobileItemUseIndicator?.toggleAttribute("hidden", false);
};

const isUsingItem = () => {
  return itemUseState.isUsingItem;
};

const getItemUseTargetRenderPosition = (entity) => {
  if (!entity) {
    return null;
  }
  const renderX = Number.isFinite(entity.renderX) ? entity.renderX : entity.x;
  const renderY = Number.isFinite(entity.renderY) ? entity.renderY : entity.y;
  if (!Number.isFinite(renderX) || !Number.isFinite(renderY)) {
    return null;
  }
  return {
    x: renderX,
    y: renderY - getEntitySurfaceOffsetY(entity),
  };
};

const isMonsterValidRuneTarget = (monster, useData) => {
  return (
    monster?.hp > 0 &&
    monster.z === playerState.z &&
    useData?.action === "attackRune" &&
    Number.isFinite(useData.range) &&
    isNearPlayer(monster, useData.range)
  );
};

const getRuneItemUseTargetIndicators = (useData) => {
  const chunkRadius = Math.ceil(useData.range / CHUNK_SIZE_TILES);
  const nearbyMonsters = getMonstersInChunkRadius(playerState.x, playerState.y, playerState.z, chunkRadius);
  const indicators = [];

  for (const monster of nearbyMonsters) {
    if (!isMonsterValidRuneTarget(monster, useData)) {
      continue;
    }
    const renderPosition = getItemUseTargetRenderPosition(monster);
    if (!renderPosition) {
      continue;
    }
    indicators.push({
      key: `monster:${monster.uid}`,
      x: renderPosition.x,
      y: renderPosition.y,
      color: 0xe4a75b,
    });
  }

  return indicators;
};

const syncItemUseTargetIndicators = () => {
  if (!itemUseState.isUsingItem || !itemUseState.useData) {
    clearPixiItemUseTargets();
    return;
  }

  if (itemUseState.useData.action === "drinkPotion") {
    const renderPosition = getItemUseTargetRenderPosition(playerState);
    if (!renderPosition) {
      clearPixiItemUseTargets();
      return;
    }
    setPixiItemUseTargets([
      {
        key: "player:self",
        x: renderPosition.x,
        y: renderPosition.y,
        color: 0x72d6b1,
      },
    ]);
    return;
  }

  if (itemUseState.useData.action === "attackRune") {
    setPixiItemUseTargets(getRuneItemUseTargetIndicators(itemUseState.useData));
    return;
  }

  clearPixiItemUseTargets();
};

const getOpenedContainerRootWrapper = (containerWrapper) => {
  if (!containerWrapper) {
    return null;
  }
  let rootWrapper = containerWrapper;
  while (rootWrapper.parent) {
    rootWrapper = rootWrapper.parent;
  }
  return rootWrapper;
};

const findOpenedContainerWrapperByUid = (containerUid) => {
  for (const container of openedContainers) {
    if (container.item.uid === containerUid) {
      return container;
    }
  }
  return null;
};

const handleOpenContainerUse = (source, item, itemData, context = {}) => {
  if (source.locationType === "equipmentSlot") {
    openContainer(item, getLocalizedItemName(item.itemId), "equipment", null);
    return;
  } else if (source.locationType === "worldItem") {
    openContainer(item, getLocalizedItemName(item.itemId), "world", null);
    return;
  } else if (source.locationType === "containerSlot") {
    const parentWrapper = findOpenedContainerWrapperByUid(source.parentContainerUid);
    if (!parentWrapper) {
      return;
    }

    if (!itemData) {
      return;
    }

    if (findOpenedContainerItemByUid(item.uid)) {
      openContainer(item, getLocalizedItemName(item.itemId), parentWrapper.sourceType, parentWrapper);
      return;
    } else {
      closeContainer(parentWrapper.item);
      openContainer(item, getLocalizedItemName(item.itemId), parentWrapper.sourceType, parentWrapper);
    }
  }
};

const handleUseItemFromSource = (source) => {
  const item = getDragSourceItem(source);
  if (!item) {
    return;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return;
  }
  const useData = getItemUseData(item);
  const cooldownGroup = itemData.type === "rune" ? getUseCooldownGroup(useData) : null;
  if (itemData.type === "rune" && !isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    return;
  }
  if (source.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    if (isWorldItemAvailableForInteraction(item) && (useData || isOpenableContainerItem(item))) {
      startPlayerActionNavigation({
        type: PLAYER_ACTION_TYPE.useWorldItem,
        itemUid: item.uid,
      });
    }
    return;
  }
  if (!useData) {
    if (isOpenableContainerItem(item)) {
      handleOpenContainerUse(source, item, itemData);
      return;
    }
  }
  if (!useData || !useData.mode) {
    return;
  }

  if (useData.mode === "direct") {
    executeDirectItemUse(item, source);
  }
  if (useData.mode === "target") {
    startItemUse(source, item, useData);
  }
};

const potionRestoreStats = {
  hp: {
    maxStat: "maxHp",
    floatingTextType: "heal",
    fullMessageKey: "fullHealth",
  },
  mana: {
    maxStat: "maxMana",
    floatingTextType: "mana",
    fullMessageKey: "fullMana",
  },
};

const replacePotionWithEmptyBottle = (item, emptyItemId) => {
  const emptyItemData = getItemData(emptyItemId);
  if (!item || !emptyItemData || emptyItemData.use) {
    return false;
  }

  item.itemId = emptyItemId;
  refreshAllByUid(item.uid);
  return true;
};

const createFluidPuddle = (groundEffectId, x, y, z, decayStage = 0) => {
  if (
    !getGroundEffectData(groundEffectId) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z)
  ) {
    return null;
  }

  const col = x / TILE_SIZE;
  const row = y / TILE_SIZE;
  const worldMap = pixiWorldRenderState.worldMapsByZ?.get(z) ?? null;
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !getWorldChunkForTilePosition(worldMap, col, row) ||
    isTiledCollisionAtTile(worldMap, col, row)
  ) {
    return null;
  }

  return addOrRefreshGroundEffect(groundEffectId, x, y, z, decayStage);
};

const restorePlayerVitalFromPotion = (item, useData) => {
  const restoreData = potionRestoreStats[useData?.restoreStat] ?? null;
  if (!restoreData || !Number.isFinite(useData.restoreAmount) || useData.restoreAmount <= 0) {
    return false;
  }

  const currentAmount = playerState[useData.restoreStat];
  const maximumAmount = playerState[restoreData.maxStat];
  if (!Number.isFinite(currentAmount) || !Number.isFinite(maximumAmount)) {
    return false;
  }
  if (currentAmount >= maximumAmount) {
    showGameStatusMessage(getGameUiText(restoreData.fullMessageKey));
    return false;
  }

  const restoredAmount = Math.min(useData.restoreAmount, maximumAmount - currentAmount);
  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return false;
  }

  playerState[useData.restoreStat] += restoredAmount;
  showFloatingTextAbovePlayer(restoredAmount, restoreData.floatingTextType);
  refreshPlayerVitalsUi();
  return true;
};

const pourPotionOnTile = (item, useData, tile) => {
  const fluidPuddle = createFluidPuddle(useData?.groundEffectId, tile?.x, tile?.y, playerState.z);
  if (!fluidPuddle) {
    showGameStatusMessage(getGameUiText("cannotPourPotion"));
    return false;
  }

  if (!replacePotionWithEmptyBottle(item, useData.emptyItemId)) {
    return false;
  }
  return true;
};

const handleDrinkPotionUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    cancelItemUse();
    return;
  }
  if (target.player) {
    if (restorePlayerVitalFromPotion(item, useData)) {
      playGameSfx(GAME_SFX.drinkPotion);
      startUseCooldown(cooldownGroup);
    }
  } else if (target.tile) {
    if (!isNearPlayer(target.tile, useData.range)) {
      startPlayerActionNavigation({
        type: PLAYER_ACTION_TYPE.targetItemUse,
        itemUid: item.uid,
        targetType: "tile",
        targetTile: { ...target.tile, z: playerState.z },
      });
    } else if (pourPotionOnTile(item, useData, target.tile)) {
      startUseCooldown(cooldownGroup);
    }
  }

  cancelItemUse();
};

const handleRuneUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    cancelItemUse();
    return;
  }
  if (
    target.monster?.hp > 0 &&
    target.monster.z === playerState.z &&
    !isNearPlayer(target.monster, useData.range)
  ) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.targetItemUse,
      itemUid: item.uid,
      targetType: "monster",
      targetUid: target.monster.uid,
    });
  } else if (target.monster && isMonsterValidRuneTarget(target.monster, useData)) {
    if (!hasPlayerLineOfSightToEntity(target.monster)) {
      showGameStatusMessage(getGameUiText("runeBlockedByWall"));
      cancelItemUse();
      return;
    }
    if (!consumeOneChargeFromRune(item, source)) {
      cancelItemUse();
      return;
    }
    const attackResult = calculateRuneAttackResult(useData);
    applyDamageToMonster(target.monster, attackResult);
    playGameSfx(GAME_SFX.runeUse);
    startUseCooldown(cooldownGroup);
  } else if (target.monster) {
    showGameStatusMessage(getGameUiText("targetOutOfRange"));
  }
  cancelItemUse();
};

const completeItemUseFromEvent = (e) => {
  const target = getPointerTargetFromEvent(e);
  if (!target.pointerInsideMap) {
    cancelItemUse();
    return;
  }

  const item = itemUseState.item;
  const useData = itemUseState.useData;
  const source = itemUseState.source;
  if (source?.locationType === "worldItem" && !canInteractWithWorldItemSource(source)) {
    cancelItemUse();
    return;
  }
  if (useData.action === "drinkPotion") {
    handleDrinkPotionUse(source, item, useData, target);
  }
  if (useData.action === "attackRune") {
    handleRuneUse(source, item, useData, target);
  }
};
/* ---------- ITEM USE - ACTIONS DIRECTES ---------- */

const consumeOneItemFromSource = (source, item) => {
  if (!source || !item) {
    return false;
  }
  if (!item.quantity || item.quantity <= 1) {
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      return false;
    }
    refreshItemUiAfterDrag();
    return true;
  } else if (item.quantity > 1) {
    item.quantity -= 1;
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const handleEatFoodUse = (item, source, useData) => {
  if (!item || !source || !Number.isFinite(useData?.sanity) || useData.sanity <= 0) {
    return false;
  }

  const nextSanity = playerState.sanity + useData.sanity;
  if (nextSanity > playerState.maxSanity) {
    showGameStatusMessage(getGameUiText("alreadyFull"));
    return false;
  }

  if (!consumeOneItemFromSource(source, item)) {
    return false;
  }

  const wasRegenerationInactive = playerState.sanity <= 0 || playerState.regeneration.nextHealthRegenAt === 0;
  playerState.sanity = nextSanity;
  if (wasRegenerationInactive) {
    startPlayerRegenerationTimers(Date.now());
  }

  refreshPlayerVitalsUi();
  playGameSfx(GAME_SFX.eat);
  return true;
};

const canLightTorchFromSource = (source) => {
  return ["worldItem", "equipmentSlot", "containerSlot"].includes(source?.locationType);
};

const handleToggleTorchUse = (item, source) => {
  const itemData = getItemData(item?.itemId);
  if (!itemData?.lightSource || !Number.isFinite(item.fuelRemainingMs)) {
    return false;
  }

  if (item.isLit) {
    syncTorchFuel(item, Date.now());
    item.isLit = false;
    item.lastFuelUpdateAt = 0;
    activeLitTorchesByUid.delete(item.uid);
    refreshAllByUid(item.uid);
    return true;
  }

  if (item.fuelRemainingMs <= 0) {
    showGameStatusMessage(getGameUiText("torchBurnedOut"));
    return false;
  }
  if (!canLightTorchFromSource(source)) {
    showGameStatusMessage(getGameUiText("torchNeedsPlacement"));
    return false;
  }

  item.isLit = true;
  item.lastFuelUpdateAt = Date.now();
  activeLitTorchesByUid.set(item.uid, item);
  refreshAllByUid(item.uid);
  playGameSfx(GAME_SFX.torchOn);
  return true;
};

const executeDirectItemUse = (item, source) => {
  if (!item) {
    return;
  }
  const useData = getItemUseData(item);
  if (!useData || !useData.action) {
    return;
  }
  if (useData.action === "eat") {
    handleEatFoodUse(item, source, useData);
  } else if (useData.action === "toggleTorch") {
    handleToggleTorchUse(item, source);
  }
};
//#endregion  -----  ITEMS - UTILISATION ET COOLDOWNS  -----

/* ==================================================== */
//#region     -----  UI - COMBAT MODE  -----
/* ==================================================== */

/* ---------- UI - COMBAT MODE ---------- */

const setPlayerCombatMode = (combatMode) => {
  playerState.combatMode = combatMode;
};

const MOBILE_COMBAT_MODE_ORDER = ["fullAttack", "balanced", "fullDefense"];
const MOBILE_COMBAT_MODE_SHORT_LABELS = {
  fullAttack: "ATK",
  balanced: "BAL",
  fullDefense: "DEF",
};

const syncMobileStanceButton = () => {
  const combatMode = playerState.combatMode;
  if (!MOBILE_COMBAT_MODE_ORDER.includes(combatMode)) {
    return;
  }
  const stanceButton = mobileStanceLabel?.closest(".mobile-stance-button");
  if (mobileStanceIcon) {
    mobileStanceIcon.textContent = MOBILE_COMBAT_MODE_SHORT_LABELS[combatMode];
  }
  if (mobileStanceLabel) {
    mobileStanceLabel.textContent = getGameUiText(combatMode);
  }
  stanceButton?.setAttribute("data-combat-mode", combatMode);
  stanceButton?.setAttribute("aria-label", getGameUiText(combatMode));
};

const cycleMobileCombatMode = () => {
  const currentIndex = MOBILE_COMBAT_MODE_ORDER.indexOf(playerState.combatMode);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % MOBILE_COMBAT_MODE_ORDER.length;
  setPlayerCombatMode(MOBILE_COMBAT_MODE_ORDER[nextIndex]);
  refreshCombatModeButtons();
};

const refreshCombatModeButtons = () => {
  const combatMode = playerState.combatMode;
  const stanceButtonElement = document.querySelectorAll(".stance-button");
  if (!combatMode) {
    return;
  }
  stanceButtonElement.forEach((stanceButton) => {
    stanceButton.classList.remove("stance-button-active");
    const buttonStance = stanceButton.getAttribute("data-combat-mode");
    if (buttonStance === combatMode) {
      stanceButton.classList.add("stance-button-active");
    }
  });
  syncMobileStanceButton();
};

const bindCombatModeButtons = () => {
  const stanceButtonElement = document.querySelectorAll(".stance-button");
  if (!stanceButtonElement) {
    return;
  }
  stanceButtonElement.forEach((stanceButton) => {
    stanceButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const combatMode = stanceButton.getAttribute("data-combat-mode");
      setPlayerCombatMode(combatMode);
      refreshCombatModeButtons();
    });
  });
};
//#endregion  -----  UI - COMBAT MODE  -----

/* ==================================================== */
//#region     -----  UI - STATS, SCALE ET TEXTES FLOTTANTS  -----
/* ==================================================== */
/* ---------- UI - STATS JOUEUR ---------- */
const refreshPlayerVitalsUi = () => {
  updatePlayerStats();
  hpRefresh();
};

const playerStatsUi = {
  root: null,
  rows: {
    name: null,
    level: null,
    hp: null,
    mana: null,
    sanity: null,
    experience: null,
    magic: null,
    fist: null,
    sword: null,
    mace: null,
    axe: null,
    distance: null,
    shielding: null,
  },
};

const updateSkillStatRow = (skillKey) => {
  if (!skillKey) {
    return;
  }
  const row = playerStatsUi.rows[skillKey];
  const skill = playerState.skills[skillKey];
  const skillProgressData = getSkillProgressData(skillKey);
  if (!row || !skill || !Number.isInteger(skill.experience) || !skillProgressData) {
    return;
  }

  row.valueElement.textContent = skillProgressData.level;
  setProgressBarValue(row.progressBarRefs, skillProgressData.progressRatio);
  setProgressTooltipText(row.tooltipElement, getGameUiText("xpRemaining")(skillProgressData.experienceNeededForNextLevel));
};

const createProgressBarRefs = () => {
  const progressBarElement = document.createElement("div");
  progressBarElement.classList.add("stat-progress-bar");
  const progressFillElement = document.createElement("div");
  progressFillElement.classList.add("stat-progress-fill");
  progressBarElement.appendChild(progressFillElement);
  return { root: progressBarElement, fill: progressFillElement };
};

const setProgressBarValue = (progressBarRefs, progressRatio) => {
  if (!progressBarRefs || !Number.isFinite(progressRatio) || !("fill" in progressBarRefs)) {
    return;
  }
  const safeRatio = clamp(progressRatio, 0, 1);
  const ratioPercent = safeRatio * 100;
  progressBarRefs.fill.style.width = `${ratioPercent}%`;
};

const createProgressTooltipElement = () => {
  const toolTipElement = document.createElement("div");
  toolTipElement.classList.add("tooltip");
  return toolTipElement;
};

const createValueElement = (statKey) => {
  if (!statKey) {
    return null;
  }
  const valueElement = document.createElement("div");
  valueElement.classList.add("stat-value");
  return valueElement;
};

const createLabelElement = (label) => {
  if (!label) {
    return null;
  }
  const labelElement = document.createElement("div");
  labelElement.classList.add("stat-label");
  labelElement.textContent = label;
  return labelElement;
};

const createStatWrapperElement = (statKey) => {
  if (!statKey) {
    return null;
  }
  const statWrapper = document.createElement("div");
  statWrapper.setAttribute("data-stat-key", statKey);
  statWrapper.classList.add("stat-wrapper");
  return statWrapper;
};

const setProgressTooltipText = (tooltipElement, tooltipText) => {
  if (!tooltipElement) {
    return;
  }
  const tooltipTextString = String(tooltipText);
  tooltipElement.textContent = tooltipTextString;
};

const createProgressStatRowElement = (statKey, label) => {
  if (!statKey || !label) {
    return null;
  }
  const statWrapper = createStatWrapperElement(statKey);
  const labelElement = createLabelElement(label);
  const valueElement = createValueElement(statKey);
  const progressBarRefs = createProgressBarRefs();
  const tooltipElement = createProgressTooltipElement();

  if (!statWrapper || !labelElement || !valueElement || !progressBarRefs || !tooltipElement) {
    return null;
  }

  statWrapper.append(labelElement, valueElement, progressBarRefs.root, tooltipElement);
  playerStatsUi.rows[statKey] = {
    statWrapper,
    labelElement,
    valueElement,
    progressBarRefs,
    tooltipElement,
  };
  return statWrapper;
};

const createSimpleStatRowElement = (statKey, label) => {
  if (!statKey || !label) {
    return null;
  }
  const statWrapper = createStatWrapperElement(statKey);
  const labelElement = createLabelElement(label);
  const valueElement = createValueElement(statKey);

  if (!statWrapper || !labelElement || !valueElement) {
    return null;
  }

  statWrapper.append(labelElement, valueElement);
  playerStatsUi.rows[statKey] = {
    statWrapper,
    labelElement,
    valueElement,
  };
  return statWrapper;
};

const createPlayerStatsUi = () => {
  const statsWrapperElement = document.createElement("div");
  statsWrapperElement.classList.add("boite-boite");
  const titleElement = document.createElement("div");
  titleElement.classList.add("boite-jeux-titre");
  titleElement.textContent = getGameUiText("stats");
  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const nameElement = createSimpleStatRowElement("name", getGameUiText("nameLabel"));
  const hpElement = createProgressStatRowElement("hp", getGameUiText("healthLabel"));
  const manaElement = createProgressStatRowElement("mana", getGameUiText("manaLabel"));
  const sanityElement = createProgressStatRowElement("sanity", getGameUiText("sanityLabel"));
  const experienceElement = createProgressStatRowElement("experience", getGameUiText("experienceLabel"));
  const levelElement = createProgressStatRowElement("level", getGameUiText("levelLabel"));
  const magicElement = createProgressStatRowElement("magic", getGameUiText("magicLabel"));
  const fistElement = createProgressStatRowElement("fist", getGameUiText("fistLabel"));
  const swordElement = createProgressStatRowElement("sword", getGameUiText("swordLabel"));
  const maceElement = createProgressStatRowElement("mace", getGameUiText("maceLabel"));
  const axeElement = createProgressStatRowElement("axe", getGameUiText("axeLabel"));
  const distanceElement = createProgressStatRowElement("distance", getGameUiText("distanceLabel"));
  const shieldingElement = createProgressStatRowElement("shielding", getGameUiText("shieldingLabel"));
  if (
    !nameElement ||
    !hpElement ||
    !manaElement ||
    !sanityElement ||
    !experienceElement ||
    !levelElement ||
    !magicElement ||
    !fistElement ||
    !swordElement ||
    !maceElement ||
    !axeElement ||
    !distanceElement ||
    !shieldingElement
  ) {
    return;
  }
  statsWrapperElement.append(
    titleElement,
    separatorElement,
    nameElement,
    hpElement,
    manaElement,
    sanityElement,
    experienceElement,
    levelElement,
    magicElement,
    fistElement,
    swordElement,
    maceElement,
    axeElement,
    distanceElement,
    shieldingElement,
  );
  playerStats.innerHTML = "";
  playerStats.appendChild(statsWrapperElement);
  playerStatsUi.root = statsWrapperElement;
};

const updatePlayerStatsUi = () => {
  const progressData = getPlayerExperienceProgressData();
  if (!progressData) {
    return;
  }
  const rows = playerStatsUi.rows;
  if (!rows.name || !rows.hp || !rows.mana || !rows.sanity || !rows.experience || !rows.level) {
    return;
  }

  rows.name.valueElement.textContent = playerState.name;
  rows.hp.valueElement.textContent = `${playerState.hp}/${playerState.maxHp}`;
  rows.mana.valueElement.textContent = `${playerState.mana}/${playerState.maxMana}`;
  rows.sanity.valueElement.textContent = `${playerState.sanity}/${playerState.maxSanity}`;
  setProgressBarValue(rows.hp.progressBarRefs, playerState.hp / playerState.maxHp);
  setProgressBarValue(rows.mana.progressBarRefs, playerState.maxMana > 0 ? playerState.mana / playerState.maxMana : 0);
  setProgressBarValue(
    rows.sanity.progressBarRefs,
    playerState.maxSanity > 0 ? playerState.sanity / playerState.maxSanity : 0,
  );
  setProgressTooltipText(rows.hp.tooltipElement, `${playerState.hp}/${playerState.maxHp} HP`);
  setProgressTooltipText(rows.mana.tooltipElement, `${playerState.mana}/${playerState.maxMana} mana`);
  setProgressTooltipText(rows.sanity.tooltipElement, `${playerState.sanity}/${playerState.maxSanity} ${getGameUiText("sanityLabel").replace(":", "").toLowerCase()}`);
  rows.experience.valueElement.textContent = playerState.experience;
  setProgressBarValue(rows.experience.progressBarRefs, progressData.progressRatio);
  setProgressTooltipText(
    rows.experience.tooltipElement,
    getGameUiText("xpRemaining")(progressData.experienceNeededForNextLevel),
  );
  rows.level.valueElement.textContent = progressData.level;
  const level = rows.level;
  setProgressBarValue(level.progressBarRefs, progressData.progressRatio);
  setProgressTooltipText(level.tooltipElement, getGameUiText("xpRemaining")(progressData.experienceNeededForNextLevel));
  for (const skillKey of Object.keys(playerState.skills)) {
    updateSkillStatRow(skillKey);
  }
  syncMobilePlayerHud();
};

const updatePlayerStats = () => {
  if (!playerStatsUi.root) {
    createPlayerStatsUi();
  }
  updatePlayerStatsUi();
};

const getPlayerExperienceProgressData = () => {
  const experience = playerState.experience;
  const level = getLevelFromExperience(experience);
  const currentLevelExperienceRequired = getExperienceRequiredForLevel(level);
  const nextLevelExperienceRequired = getExperienceRequiredForLevel(level + 1);
  const experienceInCurrentLevel = getExperienceProgressForLevel(experience, level);
  const experienceNeededForNextLevel = getExperienceRequiredForNextLevel(experience, level);
  const totalLevelExperience = nextLevelExperienceRequired - currentLevelExperienceRequired;
  let progressRatio = 0;
  if (totalLevelExperience > 0) {
    progressRatio = clamp(experienceInCurrentLevel / totalLevelExperience, 0, 1);
  }
  return {
    experience,
    level,
    currentLevelExperienceRequired,
    nextLevelExperienceRequired,
    experienceInCurrentLevel,
    experienceNeededForNextLevel,
    totalLevelExperience,
    progressRatio,
  };
};

const getExperienceRequiredForLevel = (level) => {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.floor(80 * level + 8 * level ** 2 + 12 * level ** 1.5);
};

const getLevelFromExperience = (experience) => {
  if (!Number.isFinite(experience)) {
    return 0;
  }
  let level = 0;
  while (getExperienceRequiredForLevel(level + 1) <= experience) {
    level++;
  }
  return level;
};

const getExperienceProgressForLevel = (experience, level) => {
  if (!Number.isFinite(level) || !Number.isFinite(experience)) {
    return 0;
  }
  const currentLevelExperienceRequired = getExperienceRequiredForLevel(level);
  return experience - currentLevelExperienceRequired;
};

const getExperienceRequiredForNextLevel = (experience, level) => {
  if (!Number.isFinite(level) || !Number.isFinite(experience)) {
    return 0;
  }
  const nextLevelExperienceRequired = getExperienceRequiredForLevel(level + 1);
  return nextLevelExperienceRequired - experience;
};

const getSkillExperienceRequiredForLevel = (skillLevel) => {
  if (!Number.isFinite(skillLevel)) {
    return 0;
  }
  return Math.floor(80 * skillLevel + 8 * skillLevel ** 2 + 12 * skillLevel ** 1.5);
};

const getSkillLevelFromExperience = (skillExperience, baseLevel = 0) => {
  if (!Number.isFinite(skillExperience)) {
    return 0;
  }
  let level = baseLevel;
  while (getSkillExperienceRequiredForLevel(level + 1) <= skillExperience) {
    level++;
  }
  return level;
};

const getSkillProgressData = (skillKey) => {
  const skill = playerState.skills[skillKey] || null;
  if (!skill) {
    return null;
  }
  const experience = skill.experience;
  const level = getSkillLevelFromExperience(experience);
  const currentLevelExperienceRequired = getSkillExperienceRequiredForLevel(level);
  const nextLevelExperienceRequired = getSkillExperienceRequiredForLevel(level + 1);
  const experienceInCurrentLevel = experience - currentLevelExperienceRequired;
  const experienceNeededForNextLevel = nextLevelExperienceRequired - experience;
  const totalLevelExperience = nextLevelExperienceRequired - currentLevelExperienceRequired;
  let progressRatio = 0;
  if (totalLevelExperience > 0) {
    progressRatio = clamp(experienceInCurrentLevel / totalLevelExperience, 0, 1);
  }
  return {
    experience,
    level,
    currentLevelExperienceRequired,
    nextLevelExperienceRequired,
    experienceInCurrentLevel,
    experienceNeededForNextLevel,
    totalLevelExperience,
    progressRatio,
  };
};

const updatePlayerSkillLevel = (skillKey) => {
  if (!skillKey || !(skillKey in playerState.skills)) {
    return;
  }
  const skillLevelByExperience = getSkillLevelFromExperience(playerState.skills[skillKey].experience);
  if (playerState.skills[skillKey].level < skillLevelByExperience) {
    addSkillLevelUpFeedback(skillKey, skillLevelByExperience);
  }
  playerState.skills[skillKey].level = skillLevelByExperience;
  updateSkillStatRow(skillKey);
};

const updateAllPlayerSkillLevels = () => {
  for (const [skillKey, skill] of Object.entries(playerState.skills)) {
    skill.level = getSkillLevelFromExperience(skill.experience);
    updateSkillStatRow(skillKey);
  }
};

const applyExperienceToPlayerSkill = (skillKey, experienceAmount) => {
  if (!skillKey || experienceAmount <= 0 || !(skillKey in playerState.skills)) {
    return;
  }
  playerState.skills[skillKey].experience += experienceAmount;
  updatePlayerSkillLevel(skillKey);
};

const applyPlayerCurrentVitalLevelUpGains = (previousMaxHp, previousMaxMana) => {
  if (!Number.isFinite(previousMaxHp) || !Number.isFinite(previousMaxMana)) {
    return;
  }

  const hpGain = Math.max(playerState.maxHp - previousMaxHp, 0);
  const manaGain = Math.max(playerState.maxMana - previousMaxMana, 0);
  playerState.hp = Math.min(playerState.hp + hpGain, playerState.maxHp);
  playerState.mana = Math.min(playerState.mana + manaGain, playerState.maxMana);
};

const updatePlayerExperience = () => {
  const progressData = getPlayerExperienceProgressData();
  if (!progressData) {
    return;
  }
  const didLevelUp = playerState.level < progressData.level;
  const previousMaxHp = playerState.maxHp;
  const previousMaxMana = playerState.maxMana;
  if (didLevelUp) {
    addLevelUpFeedback(progressData.level);
  }
  playerState.level = progressData.level;
  syncPlayerDerivedStats();
  if (didLevelUp) {
    applyPlayerCurrentVitalLevelUpGains(previousMaxHp, previousMaxMana);
  }
  refreshPlayerVitalsUi();
};

const addLevelUpFeedback = (newLevel) => {
  if (!Number.isFinite(newLevel)) {
    return false;
  }
  const logMessage = getGameUiText("levelAdvanced")(newLevel);
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
  playGameSfx(GAME_SFX.levelUp);
};

const addSkillLevelUpFeedback = (skillKey, newLevel) => {
  const logMessage = getGameUiText("skillAdvanced")(getLocalizedSkillName(skillKey), newLevel);
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
};

/* ---------- UI - SCALE DU JEU ---------- */

const MOBILE_GAME_LAYOUT_QUERY = "(max-width: 900px), (max-width: 1024px) and (pointer: coarse)";
const MOBILE_JOYSTICK_DIAGONAL_HOLD_MS = 500;
const mobileGameLayoutMedia = window.matchMedia(MOBILE_GAME_LAYOUT_QUERY);

const mobileGameUiState = {
  openPanel: null,
  joystickPointerId: null,
  joystickWasMoving: false,
  joystickDiagonalCandidate: null,
  joystickDiagonalReady: false,
  joystickDiagonalTimeoutId: null,
  joystickClientX: null,
  joystickClientY: null,
};

const isMobileGameLayout = () => {
  return mobileGameLayoutMedia.matches;
};

const updateGameScale = () => {
  boitePrincipale.style.height = `calc(100vh - ${nav.clientHeight}px)`;
  const mobileLayout = isMobileGameLayout();
  if (mobileLayout) {
    const mobileViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--mobile-viewport-height", `${mobileViewportHeight}px`);
  }
  const freeWidthSpace = mobileLayout
    ? boiteJeux.clientWidth
    : boiteJeux.clientWidth - panneauGauche.clientWidth - panneauDroite.clientWidth;
  const freeHeightSpace = mobileLayout ? boiteJeux.clientHeight : boitePrincipale.clientHeight - minChatHeight;
  const logicWidthSpace = GAME_WIDTH;
  const logicHeightSpace = GAME_HEIGHT;
  const scaleWidth = freeWidthSpace / logicWidthSpace;
  const scaleHeight = freeHeightSpace / logicHeightSpace;
  const scale = mobileLayout ? Math.max(scaleWidth, scaleHeight) : Math.min(scaleWidth, scaleHeight);
  GAME_SCALE = scale;
  document.documentElement.style.setProperty("--game-scale", scale);
  const visualGameHeight = GAME_HEIGHT * scale;
  const gameTop = (boiteJeux.clientHeight - visualGameHeight) / 2;
  boiteJeuxInner.style.top = `${gameTop}px`;
};

const getMobilePanelElement = (panelName) => {
  const panelElementsByName = {
    map: playerMinimap,
    stats: playerStats,
    inventory: playerInventory,
    chat: boiteChat,
  };
  return panelElementsByName[panelName] ?? null;
};

const setOpenMobilePanel = (panelName = null) => {
  const nextPanelName = mobileGameUiState.openPanel === panelName ? null : panelName;
  mobileGameUiState.openPanel = nextPanelName;
  mobileGameControls?.classList.toggle("mobile-game-controls-panel-open", nextPanelName !== null);
  mobileGameControls?.classList.toggle("mobile-game-controls-chat-open", nextPanelName === "chat");
  mobilePanelCloseButton?.toggleAttribute("hidden", nextPanelName === null);

  for (const name of ["map", "stats", "inventory", "chat"]) {
    getMobilePanelElement(name)?.classList.toggle("mobile-panel-open", name === nextPanelName);
  }
  for (const button of mobilePanelButtons) {
    const isActive = button.dataset.mobilePanel === nextPanelName;
    button.classList.toggle("mobile-panel-button-active", isActive);
    button.setAttribute("aria-expanded", String(isActive));
  }

  if (nextPanelName !== "chat" && document.activeElement === chatInput) {
    blurChatInput();
  }
};

const setMobileHudProgress = (fillElement, valueElement, value, maximumValue) => {
  if (!fillElement || !valueElement || !Number.isFinite(value) || !Number.isFinite(maximumValue)) {
    return;
  }
  const safeMaximumValue = Math.max(maximumValue, 0);
  const progressRatio = safeMaximumValue > 0 ? clamp(value / safeMaximumValue, 0, 1) : 0;
  fillElement.style.width = `${progressRatio * 100}%`;
  valueElement.textContent = `${Math.max(Math.floor(value), 0)}/${Math.floor(safeMaximumValue)}`;
};

const syncMobilePlayerHud = () => {
  if (!mobilePlayerName || !mobilePlayerLevel) {
    return;
  }
  mobilePlayerName.textContent = playerState.name;
  mobilePlayerLevel.textContent = `Lv ${playerState.level}`;
  setMobileHudProgress(mobilePlayerHealthFill, mobilePlayerHealthValue, playerState.hp, playerState.maxHp);
  setMobileHudProgress(mobilePlayerManaFill, mobilePlayerManaValue, playerState.mana, playerState.maxMana);
  setMobileHudProgress(mobilePlayerSanityFill, mobilePlayerSanityValue, playerState.sanity, playerState.maxSanity);
};

const syncMobileTargetHud = () => {
  const monster = selectedMonsterUid === null ? null : (monstersByUid.get(selectedMonsterUid) ?? null);
  if (!monster || monster.z !== playerState.z) {
    mobileTargetHud?.toggleAttribute("hidden", true);
    return;
  }

  const monsterData = getMonsterData(monster.monsterId);
  const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
  if (!monsterData || !localizedMonsterData || !mobileTargetName || !mobileTargetValue || !mobileTargetHealthFill) {
    mobileTargetHud?.toggleAttribute("hidden", true);
    return;
  }

  const hpRatio = clamp(monster.hp / monsterData.maxHp, 0, 1);
  mobileTargetName.textContent = localizedMonsterData.name;
  mobileTargetValue.textContent = `${Math.max(monster.hp, 0)}/${monsterData.maxHp}`;
  mobileTargetHealthFill.style.width = `${hpRatio * 100}%`;
  mobileTargetHealthFill.style.setProperty("--mobile-target-hp-color", getHpColor(monster.hp, monsterData.maxHp));
  mobileTargetHud.toggleAttribute("hidden", false);
};

const syncMobileBackpackButton = () => {
  const backpackButton = document.querySelector('[data-mobile-action="toggle-backpack"]');
  const backpack = getEquipmentSlotItem("backpack");
  const isOpen = backpack ? findOpenedContainerWrapperByUid(backpack.uid) !== null : false;
  backpackButton?.classList.toggle("mobile-panel-button-active", isOpen);
  backpackButton?.setAttribute("aria-expanded", String(isOpen));
  backpackButton?.toggleAttribute("disabled", !backpack);
};

const syncMobileFollowButton = () => {
  const followButton = document.querySelector('[data-mobile-action="toggle-follow"]');
  const isActive = playerNavigationState.followEnabled;
  followButton?.classList.toggle("mobile-panel-button-active", isActive);
  followButton?.setAttribute("aria-pressed", String(isActive));
};

const toggleMobileBackpack = () => {
  const backpack = getEquipmentSlotItem("backpack");
  if (!backpack || !isOpenableContainerItem(backpack)) {
    showGameStatusMessage(getGameUiText("backpackRequired"));
    syncMobileBackpackButton();
    return;
  }

  const openedBackpack = findOpenedContainerWrapperByUid(backpack.uid);
  if (openedBackpack) {
    closeContainer(backpack);
    return;
  }

  setOpenMobilePanel(null);
  openContainer(backpack, getLocalizedItemName(backpack.itemId), "equipment", null);
};

const syncMobileGameLayout = () => {
  const mobileLayout = isMobileGameLayout();
  mobileGameControls?.setAttribute("aria-hidden", String(!mobileLayout));
  if (!mobileLayout) {
    setOpenMobilePanel(null);
    spellUiState.mobileAssignHotkeyIndex = null;
  }
  syncMobilePlayerHud();
  syncMobileTargetHud();
  syncMobileBackpackButton();
  syncMobileFollowButton();
  syncMobileStanceButton();
  syncItemUseSourceFeedback();
  renderSpellWindow();
  updateGameScale();
};

/* ---------- UI - MESSAGE DE STATUT ---------- */
const showGameStatusMessage = (text, durationMs = 2500) => {
  if (!gameStatusMessage || typeof text !== "string" || text === "") {
    return false;
  }

  if (gameStatusMessageTimeoutId !== null) {
    clearTimeout(gameStatusMessageTimeoutId);
  }

  gameStatusMessage.textContent = text;
  gameStatusMessage.classList.add("game-status-message-visible");
  gameStatusMessageTimeoutId = setTimeout(() => {
    gameStatusMessage.textContent = "";
    gameStatusMessage.classList.remove("game-status-message-visible");
    gameStatusMessageTimeoutId = null;
  }, durationMs);
  return true;
};

/* ---------- UI - TEXTE FLOTTANT ---------- */
const floatingTextState = {
  queuesByTargetKey: new Map(),
  combatEntries: new Set(),
};

const getFloatingTextTargetKey = (target) => {
  if (!target) {
    return null;
  }
  if (typeof target.speechAnchorKey === "string") {
    return `speech:${target.speechAnchorKey}`;
  }
  if (target === playerState) {
    return "player:self";
  }
  if ("uid" in target) {
    return "entity:" + target.uid;
  }
  if ("x" in target && "y" in target) {
    return "position:" + target.x + ":" + target.y;
  }
  return null;
};

const createSpeechFloatingTextTarget = (target) => {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return null;
  }

  const worldX = Number.isFinite(target.renderX) ? target.renderX : target.x;
  const worldY = Number.isFinite(target.renderY) ? target.renderY : target.y;
  const speakerUid = target === playerState ? playerState.uid : (target.uid ?? target.name);
  const speakerName = target === playerState ? playerState.name : target.name;
  return {
    x: worldX,
    y: worldY,
    z: target.z,
    fixedSurfaceOffsetY: getEntitySurfaceOffsetY(target),
    speechSpeakerName: speakerName,
    speechAnchorKey: `${speakerUid}:${worldX}:${worldY}:${target.z}`,
  };
};

const getFloatingTextQueueForTarget = (target) => {
  const targetKey = getFloatingTextTargetKey(target);
  if (!targetKey) {
    return null;
  }
  if (floatingTextState.queuesByTargetKey.has(targetKey)) {
    return floatingTextState.queuesByTargetKey.get(targetKey);
  } else {
    const queue = {
      target: target,
      queuesByType: new Map(),
      wrappersByType: new Map(),
    };
    floatingTextState.queuesByTargetKey.set(targetKey, queue);
    return queue;
  }
};

const getFloatingTextQueueForType = (targetQueue, textType) => {
  if (!targetQueue || !textType) {
    return null;
  }
  if (targetQueue.queuesByType.has(textType)) {
    return targetQueue.queuesByType.get(textType);
  } else {
    const textQueue = [];
    targetQueue.queuesByType.set(textType, textQueue);
    return textQueue;
  }
};

const getFloatingTextWrapperForType = (targetQueue, textType) => {
  if (!targetQueue || !textType) {
    return null;
  }
  if (targetQueue.wrappersByType.has(textType)) {
    return targetQueue.wrappersByType.get(textType);
  } else {
    const wrapper = document.createElement("div");
    wrapper.classList.add("floating-text-wrapper");
    wrapper.style.display = "none";
    game.appendChild(wrapper);
    targetQueue.wrappersByType.set(textType, wrapper);
    return wrapper;
  }
};

const createFloatingTextEntry = (text, offsetY, textType, durationMs) => {
  if (!text || !textType || isEmpty(text)) {
    return null;
  }
  let verifiedDurationMs = durationMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    verifiedDurationMs = 2000;
  }
  let verifiedOffsetY = offsetY;
  if (!Number.isFinite(offsetY)) {
    verifiedOffsetY = 95;
  }
  const createdAt = Date.now();
  const expiresAt = createdAt + verifiedDurationMs;
  return {
    text,
    offsetY: verifiedOffsetY,
    textType,
    durationMs: verifiedDurationMs,
    createdAt,
    expiresAt,
  };
};

const getFloatingTextScreenPosition = (target, offsetY) => {
  let left = 0;
  let top = 0;
  if (target) {
    const surfaceOffsetY = Number.isFinite(target.fixedSurfaceOffsetY)
      ? target.fixedSurfaceOffsetY
      : getEntitySurfaceOffsetY(target);
    if ("renderX" in target && "renderY" in target) {
      left = target.renderX - camera.x + TILE_SIZE / 2;
      top = target.renderY - camera.y - offsetY - surfaceOffsetY;
    } else {
      left = target.x - camera.x + TILE_SIZE / 2;
      top = target.y - camera.y - offsetY - surfaceOffsetY;
    }
  }
  return {
    left,
    top,
  };
};

const createFloatingTextElement = (entry) => {
  const div = document.createElement("div");
  div.classList.add("floating-text");
  div.classList.add(`floating-text-${entry.textType}`);
  div.style.setProperty("--floating-text-duration", entry.durationMs + "ms");
  div.textContent = `${entry.text}`;
  return div;
};

const getFloatingTextQueueHeaderText = (targetQueue, textType) => {
  if (!textType || !targetQueue || textType !== "speech") {
    return "";
  }
  if (targetQueue.target === playerState) {
    return `${playerState.name}:`;
  }
  if (targetQueue.target?.speechSpeakerName) {
    return `${targetQueue.target.speechSpeakerName}:`;
  }
  if (targetQueue.target?.npcId && targetQueue.target.name) {
    return `${targetQueue.target.name}:`;
  }
  return "";
};

const renderFloatingTextQueue = (targetQueue, textType) => {
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  const wrapper = getFloatingTextWrapperForType(targetQueue, textType);
  if (!wrapper) {
    return;
  }
  if (isEmpty(textQueue)) {
    wrapper.textContent = "";
    wrapper.style.display = "none";
    return;
  }

  const topLeftPosition = getFloatingTextScreenPosition(targetQueue.target, textQueue[0].offsetY);

  wrapper.style.left = `${topLeftPosition.left}px`;
  wrapper.style.top = `${topLeftPosition.top}px`;
  wrapper.textContent = "";
  const headerText = getFloatingTextQueueHeaderText(targetQueue, textType);
  if (!isEmpty(headerText)) {
    const headerElement = document.createElement("div");
    headerElement.classList.add("floating-text-header");
    headerElement.textContent = headerText;
    wrapper.appendChild(headerElement);
  }

  for (const entry of textQueue) {
    const textElement = createFloatingTextElement(entry);
    if (textElement) {
      wrapper.appendChild(textElement);
    }
  }
  wrapper.style.display = "block";
};

const removeExpiredFloatingTextEntries = (targetQueue, textType, now) => {
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  if (!textQueue) {
    return;
  }
  for (let i = textQueue.length - 1; i >= 0; i--) {
    const entry = textQueue[i];
    if (entry.expiresAt <= now) {
      textQueue.splice(i, 1);
    }
  }
  renderFloatingTextQueue(targetQueue, textType);
};

const updateCombatFloatingTextEntryPosition = (combatEntry) => {
  const target = combatEntry?.target;
  const element = combatEntry?.element;
  if (!target || !element) {
    return;
  }
  if (target.z !== playerState.z) {
    element.style.display = "none";
    return;
  }
  const monsterData = getMonsterData(target.monsterId);
  const renderX = Number.isFinite(target.renderX) ? target.renderX : target.x;
  const renderY = Number.isFinite(target.renderY) ? target.renderY : target.y;
  const drawOffsetX = monsterData?.drawOffsetX ?? 0;
  const drawOffsetY = monsterData?.drawOffsetY ?? 0;
  const drawWidth = monsterData?.drawWidth ?? TILE_SIZE;
  const surfaceOffsetY = getEntitySurfaceOffsetY(target);
  element.style.left = `${renderX + drawOffsetX - camera.x + drawWidth / 2}px`;
  element.style.top = `${renderY + drawOffsetY - camera.y - surfaceOffsetY}px`;
  element.style.display = "block";
};

const updateCombatFloatingTextPositions = () => {
  for (const combatEntry of floatingTextState.combatEntries) {
    updateCombatFloatingTextEntryPosition(combatEntry);
  }
};

const updateFloatingTextPositions = () => {
  for (const targetQueue of floatingTextState.queuesByTargetKey.values()) {
    for (const [textType, wrapper] of targetQueue.wrappersByType.entries()) {
      const textQueue = getFloatingTextQueueForType(targetQueue, textType);
      if (!wrapper || !Array.isArray(textQueue) || textQueue.length === 0) {
        continue;
      }
      if (Number.isInteger(targetQueue.target?.z) && targetQueue.target.z !== playerState.z) {
        wrapper.style.display = "none";
        continue;
      }
      const position = getFloatingTextScreenPosition(targetQueue.target, textQueue[0].offsetY);
      wrapper.style.left = `${position.left}px`;
      wrapper.style.top = `${position.top}px`;
      wrapper.style.display = "block";
    }
  }
  updateCombatFloatingTextPositions();
};

const showFloatingTextAboveTarget = (text, offsetY, target, textType = "look", durationMs = 2000) => {
  const floatingTextTarget = textType === "speech" ? createSpeechFloatingTextTarget(target) : target;
  const targetQueue = getFloatingTextQueueForTarget(floatingTextTarget);
  if (!targetQueue) {
    return;
  }
  const textQueue = getFloatingTextQueueForType(targetQueue, textType);
  if (!textQueue) {
    return;
  }
  const entry = createFloatingTextEntry(text, offsetY, textType, durationMs);
  if (!entry) {
    return;
  }
  if (textType === "look") {
    textQueue.length = 0;
    textQueue.push(entry);
  } else {
    textQueue.push(entry);
  }
  renderFloatingTextQueue(targetQueue, textType);
  setTimeout(() => {
    const now = Date.now();
    removeExpiredFloatingTextEntries(targetQueue, textType, now);
  }, entry.durationMs);
};

const showLookFloatingText = (lookInfo) => {
  if (!lookInfo) {
    return;
  }
  if ("customText" in lookInfo) {
    showFloatingTextAboveTarget(lookInfo.customText, 110, lookInfo.target, "look");
    return;
  }

  let text = "";
  let offsetY = 120;
  const isCarriedItem = lookInfo.sourceType === "equipmentSlot" || lookInfo.sourceType === "containerSlot";
  const isNearbyWorldItem =
    lookInfo.sourceType === "worldItem" && lookInfo.target.z === playerState.z && isNearPlayer(lookInfo.target, 1);

  if (lookInfo.weight !== undefined && (isCarriedItem || isNearbyWorldItem)) {
    offsetY = 105;
    let suffixName = lookInfo.suffix;
    let name = lookInfo.name;
    let weightText = getGameUiText("itemWeight")(lookInfo.weight);

    if (lookInfo.quantity && lookInfo.quantity > 1) {
      suffixName = lookInfo.quantity;
      name = lookInfo.pluralName ?? `${name}s`;
      weightText = getGameUiText("itemsWeight")(lookInfo.weight);
    }
    const detailLines = [];
    if (lookInfo.desc) {
      detailLines.push(lookInfo.desc);
    }
    const combatStats = [];
    if (Number.isFinite(lookInfo.attack)) {
      combatStats.push(`${getGameUiText("attack")}: ${lookInfo.attack}`);
    }
    if (Number.isFinite(lookInfo.defense)) {
      combatStats.push(`${getGameUiText("defense")}: ${lookInfo.defense}`);
    }
    if (combatStats.length > 0) {
      detailLines.push(combatStats.join(" | "));
    }
    if (lookInfo.charges) {
      detailLines.push(getGameUiText("itemCharges")(lookInfo.charges));
    }
    detailLines.push(weightText);
    text = `${getGameUiText("youSee")(suffixName, name)}\n${detailLines.join("\n")}`;
  } else {
    offsetY = 120;
    text = getGameUiText("youSee")(lookInfo.suffix, lookInfo.name);
  }
  showFloatingTextAboveTarget(text, offsetY, playerState);
};

const showFloatingTextAboveMonster = (monster, text, type) => {
  if (!monster || !game) {
    return;
  }
  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  game.appendChild(textElement);
  const combatEntry = {
    target: monster,
    element: textElement,
  };
  floatingTextState.combatEntries.add(combatEntry);
  updateCombatFloatingTextEntryPosition(combatEntry);
  setTimeout(() => {
    floatingTextState.combatEntries.delete(combatEntry);
    textElement.remove();
  }, 1300);
};

const showFloatingTextAbovePlayer = (text, type) => {
  const playerTextElement = playerRenderRefs.floatingText;
  if (!playerTextElement) {
    return;
  }
  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  playerTextElement.appendChild(textElement);
  setTimeout(() => {
    textElement.remove();
  }, 1300);
};

//#endregion  -----  UI - STATS, SCALE ET TEXTES FLOTTANTS  -----

/* ==================================================== */
//#region     -----  LIGHT - CANVAS  -----
/* ==================================================== */
lightCanvas.width = GAME_WIDTH;
lightCanvas.height = GAME_HEIGHT;
const ctx = lightCanvas.getContext("2d");

/* ---------- LUMIERE - AFFICHAGE ---------- */

const getLightSourceScreenPosition = (source, surfaceOffsetY = 0) => {
  const worldX = Number.isFinite(source?.renderX) ? source.renderX : source?.x;
  const worldY = Number.isFinite(source?.renderY) ? source.renderY : source?.y;
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return null;
  }
  return {
    screenX: worldX - camera.x + TILE_SIZE / 2,
    screenY: worldY - camera.y + TILE_SIZE / 2 - surfaceOffsetY,
  };
};

const getTorchLightRadius = (item) => {
  const itemData = getItemData(item?.itemId);
  const fuelStage = getTorchFuelStage(item);
  return itemData?.lightSource?.radiusByStage?.[fuelStage] ?? 0;
};

const getActiveTorchLightSources = () => {
  const lightSources = [];
  for (const item of activeLitTorchesByUid.values()) {
    if (!item.isLit || item.fuelRemainingMs <= 0) {
      continue;
    }

    if (playerState.equipment.ammo === item) {
      lightSources.push({ item, source: playerState, surfaceOffsetY: getEntitySurfaceOffsetY(playerState) });
      continue;
    }

    if (worldItemsByUid.get(item.uid) === item && item.z === playerState.z) {
      lightSources.push({ item, source: item, surfaceOffsetY: getWorldItemStackOffsetY(item) });
    }
  }
  return lightSources;
};

const drawDarknessCutout = (screenX, screenY, radius, centerOpacity) => {
  const gradient = ctx.createRadialGradient(screenX, screenY, 12, screenX, screenY, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${centerOpacity})`);
  gradient.addColorStop(0.65, `rgba(0, 0, 0, ${centerOpacity * 0.2})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
};

const drawTorchGlow = (screenX, screenY, radius) => {
  const glowRadius = radius * 0.85;
  const gradient = ctx.createRadialGradient(screenX, screenY, 16, screenX, screenY, glowRadius);
  gradient.addColorStop(0, "rgba(255, 246, 169, 0.015)");
  gradient.addColorStop(0.55, "rgba(255, 174, 45, 0.055)");
  gradient.addColorStop(1, "rgba(255, 70, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - glowRadius, screenY - glowRadius, glowRadius * 2, glowRadius * 2);
};

const getActivePlayerSpellLightRadius = (now) => {
  const lightEffect = playerState.spellEffects.light;
  if (!Number.isFinite(now) || lightEffect.expiresAt <= now) {
    return 0;
  }
  return lightEffect.radius;
};

const drawMagicLightGlow = (screenX, screenY, radius) => {
  const glowRadius = radius * 0.75;
  const gradient = ctx.createRadialGradient(screenX, screenY, 12, screenX, screenY, glowRadius);
  gradient.addColorStop(0, "rgba(222, 239, 255, 0.04)");
  gradient.addColorStop(0.6, "rgba(139, 194, 255, 0.025)");
  gradient.addColorStop(1, "rgba(90, 150, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - glowRadius, screenY - glowRadius, glowRadius * 2, glowRadius * 2);
};

const drawOutdoorSunlight = () => {
  const radius = Math.max(GAME_WIDTH, GAME_HEIGHT);
  const gradient = ctx.createRadialGradient(GAME_WIDTH * 0.18, 0, 0, GAME_WIDTH * 0.18, 0, radius);
  gradient.addColorStop(0, "rgba(255, 246, 197, 0.055)");
  gradient.addColorStop(1, "rgba(255, 236, 167, 0.012)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
};

const updateLight = (source) => {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalCompositeOperation = "source-over";

  if (playerState.z >= 0) {
    drawOutdoorSunlight();
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.995)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalCompositeOperation = "destination-out";

  const playerScreenPosition = getLightSourceScreenPosition(source, getEntitySurfaceOffsetY(source));
  if (playerScreenPosition) {
    drawDarknessCutout(
      playerScreenPosition.screenX,
      playerScreenPosition.screenY,
      TORCH_PLAYER_REVEAL_RADIUS,
      0.18,
    );
  }

  const spellLightRadius = getActivePlayerSpellLightRadius(Date.now());
  if (playerScreenPosition && spellLightRadius > 0) {
    drawDarknessCutout(playerScreenPosition.screenX, playerScreenPosition.screenY, spellLightRadius, 0.7);
  }

  const torchLights = getActiveTorchLightSources();
  for (const torchLight of torchLights) {
    const screenPosition = getLightSourceScreenPosition(torchLight.source, torchLight.surfaceOffsetY);
    const radius = getTorchLightRadius(torchLight.item);
    if (!screenPosition || radius <= 0) {
      continue;
    }
    drawDarknessCutout(screenPosition.screenX, screenPosition.screenY, radius, 0.69);
  }

  ctx.globalCompositeOperation = "source-over";
  for (const torchLight of torchLights) {
    const screenPosition = getLightSourceScreenPosition(torchLight.source, torchLight.surfaceOffsetY);
    const radius = getTorchLightRadius(torchLight.item);
    if (screenPosition && radius > 0) {
      drawTorchGlow(screenPosition.screenX, screenPosition.screenY, radius);
    }
  }
  if (playerScreenPosition && spellLightRadius > 0) {
    drawMagicLightGlow(playerScreenPosition.screenX, playerScreenPosition.screenY, spellLightRadius);
  }
};
//#endregion  -----  LIGHT - CANVAS  -----

/* ==================================================== */
//#region     -----  JOUEUR - MOUVEMENT  -----
/* ==================================================== */
const PLAYER_NAVIGATION_MODE = {
  click: "click",
  follow: "follow",
  action: "action",
};
const PLAYER_ACTION_TYPE = {
  itemDrag: "itemDrag",
  useWorldItem: "useWorldItem",
  targetItemUse: "targetItemUse",
  npcGreeting: "npcGreeting",
};
const PLAYER_ACTION_DISTANCE_TYPE = {
  square: "square",
  weighted: "weighted",
};
const PLAYER_AUTO_WALK_MAX_PATH_COST = MINIMAP_AUTOWALK_MAX_DISTANCE_TILES * 3;
const PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS = 300;
const PLAYER_ACTION_PATH_REFRESH_COOLDOWN_MS = 300;
const PLAYER_ACTION_EXECUTION_DELAY_MS = 100;

const playerNavigationState = {
  mode: null,
  path: [],
  destinationTile: null,
  followEnabled: false,
  pendingAction: null,
  actionExecuteAt: 0,
  nextPathRefreshAt: 0,
  lastFollowTargetTileKey: null,
  lastActionTargetTileKey: null,
  lastFailureKey: null,
};

const keysPressed = {
  right: false,
  left: false,
  up: false,
  down: false,
};

const resetMovementKeys = () => {
  keysPressed.right = false;
  keysPressed.left = false;
  keysPressed.up = false;
  keysPressed.down = false;
};

const resetMobileJoystickDiagonalHold = () => {
  if (mobileGameUiState.joystickDiagonalTimeoutId !== null) {
    clearTimeout(mobileGameUiState.joystickDiagonalTimeoutId);
  }
  mobileGameUiState.joystickDiagonalCandidate = null;
  mobileGameUiState.joystickDiagonalReady = false;
  mobileGameUiState.joystickDiagonalTimeoutId = null;
  mobileGameUiState.joystickClientX = null;
  mobileGameUiState.joystickClientY = null;
};

const resetMobileJoystick = () => {
  mobileGameUiState.joystickPointerId = null;
  mobileGameUiState.joystickWasMoving = false;
  resetMobileJoystickDiagonalHold();
  resetMovementKeys();
  if (mobileJoystickKnob) {
    mobileJoystickKnob.style.transform = "translate(0px, 0px)";
  }
  mobileJoystick?.classList.remove("mobile-joystick-diagonal-pending", "mobile-joystick-diagonal-ready");
};

const updateMobileJoystickFromPointer = (clientX, clientY) => {
  if (!mobileJoystick || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return;
  }

  const joystickRect = mobileJoystick.getBoundingClientRect();
  const centerX = joystickRect.left + joystickRect.width / 2;
  const centerY = joystickRect.top + joystickRect.height / 2;
  const maxDistance = joystickRect.width * 0.32;
  const rawDeltaX = clientX - centerX;
  const rawDeltaY = clientY - centerY;
  const rawDistance = Math.hypot(rawDeltaX, rawDeltaY);
  const distanceScale = rawDistance > maxDistance ? maxDistance / rawDistance : 1;
  const deltaX = rawDeltaX * distanceScale;
  const deltaY = rawDeltaY * distanceScale;
  const deadZone = maxDistance * 0.3;
  const absoluteDeltaX = Math.abs(deltaX);
  const absoluteDeltaY = Math.abs(deltaY);
  const dominantAxisDistance = Math.max(absoluteDeltaX, absoluteDeltaY);
  const secondaryAxisDistance = Math.min(absoluteDeltaX, absoluteDeltaY);
  const diagonalRatio = dominantAxisDistance > 0 ? secondaryAxisDistance / dominantAxisDistance : 0;
  let diagonalCandidate = null;
  if (dominantAxisDistance > deadZone && diagonalRatio >= 0.72) {
    const horizontalDirection = deltaX < 0 ? "left" : "right";
    const verticalDirection = deltaY < 0 ? "up" : "down";
    diagonalCandidate = `${horizontalDirection}:${verticalDirection}`;
  }

  mobileGameUiState.joystickClientX = clientX;
  mobileGameUiState.joystickClientY = clientY;

  if (diagonalCandidate !== mobileGameUiState.joystickDiagonalCandidate) {
    resetMobileJoystickDiagonalHold();
    mobileGameUiState.joystickClientX = clientX;
    mobileGameUiState.joystickClientY = clientY;
    if (diagonalCandidate) {
      mobileGameUiState.joystickDiagonalCandidate = diagonalCandidate;
      mobileGameUiState.joystickDiagonalTimeoutId = setTimeout(() => {
        if (
          mobileGameUiState.joystickPointerId === null ||
          mobileGameUiState.joystickDiagonalCandidate !== diagonalCandidate
        ) {
          return;
        }
        mobileGameUiState.joystickDiagonalReady = true;
        mobileGameUiState.joystickDiagonalTimeoutId = null;
        navigator.vibrate?.(8);
        updateMobileJoystickFromPointer(mobileGameUiState.joystickClientX, mobileGameUiState.joystickClientY);
      }, MOBILE_JOYSTICK_DIAGONAL_HOLD_MS);
    }
  }

  const shouldMoveDiagonally = diagonalCandidate !== null && mobileGameUiState.joystickDiagonalReady;
  mobileJoystick.classList.toggle("mobile-joystick-diagonal-pending", diagonalCandidate !== null && !shouldMoveDiagonally);
  mobileJoystick.classList.toggle("mobile-joystick-diagonal-ready", shouldMoveDiagonally);

  resetMovementKeys();
  if (dominantAxisDistance > deadZone) {
    if (shouldMoveDiagonally || absoluteDeltaX > absoluteDeltaY) {
      keysPressed.left = deltaX < 0;
      keysPressed.right = deltaX > 0;
    }
    if (shouldMoveDiagonally || absoluteDeltaY > absoluteDeltaX) {
      keysPressed.up = deltaY < 0;
      keysPressed.down = deltaY > 0;
    }
  }

  const isMoving = keysPressed.left || keysPressed.right || keysPressed.up || keysPressed.down;
  if (isMoving && !mobileGameUiState.joystickWasMoving) {
    cancelPlayerNavigationForManualMovement();
  }
  mobileGameUiState.joystickWasMoving = isMoving;

  if (mobileJoystickKnob) {
    mobileJoystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  }
};

const cancelPlayerNavigationForManualMovement = () => {
  const shouldCancelFollow = playerNavigationState.followEnabled && selectedMonsterUid !== null;
  if (shouldCancelFollow) {
    playerNavigationState.followEnabled = false;
  }
  stopPlayerNavigation();

  if (shouldCancelFollow) {
    updatePlayerInventory();
  }
};
/* ---------- JOUEUR - COOLDOWN ET DIRECTION ---------- */

const getPlayerMoveCooldown = () => {
  if (playerState.level < 100) {
    return PLAYER_MOVE_COOLDOWN_MS - playerState.level - playerState.speed;
  } else {
    return PLAYER_MOVE_COOLDOWN_MS - 100 - (playerState.level - 100) / 2 - playerState.speed;
  }
};

const getWantedMovement = () => {
  const deltaCol = Number(keysPressed.right) - Number(keysPressed.left);

  const deltaRow = Number(keysPressed.down) - Number(keysPressed.up);

  if (deltaCol === 0 && deltaRow === 0) {
    return null;
  }

  return {
    deltaCol,
    deltaRow,
    direction: getCardinalDirectionFromTileDelta(deltaCol, deltaRow, playerState.direction),
  };
};

/* ---------- JOUEUR - MISE A JOUR MOUVEMENT ---------- */

const updateMovement = (now) => {
  const keyboardMovement = getWantedMovement();
  const navigationMovement = keyboardMovement ? null : getPlayerNavigationMovement(now);
  const movement = keyboardMovement ?? navigationMovement;
  const isNavigationMovement = navigationMovement !== null;

  if (!movement) {
    playerState.walkFrame = 1;
    updatePlayerSprite();
    return;
  }

  if (now < nextPlayerMoveTime) {
    return;
  }

  const nextX = playerState.x + movement.deltaCol * MOVE_SPEED;
  const nextY = playerState.y + movement.deltaRow * MOVE_SPEED;

  const currentTile = getTilePosition(playerState);
  const nextTile = {
    col: nextX / TILE_SIZE,
    row: nextY / TILE_SIZE,
  };

  const movementCost = getTileMovementCost(currentTile, nextTile);
  const animationMultiplier = getTileMovementAnimationMultiplier(currentTile, nextTile);

  if (movementCost === null || animationMultiplier === null) {
    if (isNavigationMovement) {
      handleBlockedPlayerNavigationStep(now);
    }
    return;
  }

  const baseMoveCooldown = getPlayerMoveCooldown();
  const moveDuration = baseMoveCooldown * animationMultiplier;
  const moveCooldown = baseMoveCooldown * movementCost;
  nextPlayerMoveTime = now + moveCooldown;

  const canMove =
    canMoveTo(playerState.x, playerState.y, nextX, nextY) &&
    !isMonsterAtPosition(nextX, nextY) &&
    !isNpcAtPosition(nextX, nextY) &&
    !isBlockingItemAtPosition(nextX, nextY);

  if (canMove) {
    playerState.oldX = playerState.x;
    playerState.oldY = playerState.y;
    playerState.moveStartTime = now;
    playerState.moveDuration = moveDuration;
    playerState.x = nextX;
    playerState.y = nextY;
    playerState.direction = movement.direction;

    if (isNavigationMovement) {
      completePlayerNavigationStep();
    }

    const currentWorldMap = getCurrentWorldMap();
    const playerCol = playerState.x / TILE_SIZE;
    const playerRow = playerState.y / TILE_SIZE;
    const transition = findTransitionAtTile(currentWorldMap, playerCol, playerRow);

    if (transition) {
      applyWorldTransition(transition);
      resetMovementKeys();
      updatePlayerSprite();
      return;
    }

    updatePixiVisibleChunksAroundPlayer();

    playerState.walkFrame++;

    if (playerState.walkFrame >= PLAYER_ANIMATION_FRAMES) {
      playerState.walkFrame = 0;
    }
  } else if (isNavigationMovement) {
    handleBlockedPlayerNavigationStep(now);
  }

  updatePlayerSprite();
  closeFarOpenedContainers();
};
//#endregion  -----  JOUEUR - MOUVEMENT  -----

/* ==================================================== */
//#region     -----  INPUTS - CLAVIER / SOURIS / RESIZE  -----
/* ==================================================== */
/* ---------- INPUTS - ETAT CENTRAL ---------- */

const inputState = {
  isLeftClickDown: false,
  isRightClickDown: false,
  isLookComboTriggered: false,
  lastDetectedTarget: null,
  shouldBlockNextContextMenu: false,
  shouldBlockNextWorldClick: false,
};

const updateInputStateOnMouseDown = (e) => {
  if (e.button === 2) {
    inputState.isRightClickDown = true;
  }
  if (e.button === 0) {
    inputState.isLeftClickDown = true;
    inputState.shouldBlockNextWorldClick = false;
  }
  if (inputState.isLeftClickDown && inputState.isRightClickDown && !dragState.isDragging) {
    inputState.isLookComboTriggered = true;
    inputState.shouldBlockNextContextMenu = true;
  }
  inputState.lastDetectedTarget = getPointerTargetFromEvent(e);
};

const updateInputStateOnMouseUp = (e) => {
  if (e.button === 2) {
    inputState.isRightClickDown = false;
  }
  if (e.button === 0) {
    inputState.isLeftClickDown = false;
  }
  if (!inputState.isLeftClickDown || !inputState.isRightClickDown) {
    inputState.isLookComboTriggered = false;
  }
  if (!inputState.isLeftClickDown && !inputState.isRightClickDown) {
    inputState.lastDetectedTarget = null;
  }
};

const shouldBlockContextMenuAction = () => {
  if (inputState.shouldBlockNextContextMenu) {
    inputState.shouldBlockNextContextMenu = false;
    return true;
  } else {
    return false;
  }
};

const resetInputComboState = () => {
  inputState.isLookComboTriggered = false;
  inputState.shouldBlockNextContextMenu = false;
  inputState.lastDetectedTarget = null;
};

/* ---------- INPUTS - TOUCHE APPUYEE ---------- */

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    if (!e.repeat && !gameRuntimeState.isStarting) {
      toggleCharacterSelector();
    }
    return;
  }
  if (characterSelectorUiState.isOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCharacterSelector();
      return;
    }
    if (isTextInputFocused()) {
      return;
    }
    e.preventDefault();
    return;
  }
  if (!gameRuntimeState.isStarted) {
    e.preventDefault();
    return;
  }
  if (e.key === "Escape" && spellUiState.isOpen) {
    e.preventDefault();
    spellUiState.isOpen = false;
    spellUiState.selectedSpellId = null;
    spellUiState.mobileAssignHotkeyIndex = null;
    updatePlayerInventory();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrentCharacter();
    return;
  }
  if (isTextInputFocused()) {
    return;
  }
  e.preventDefault();
  if (e.repeat) {
    return;
  }
  if (castPlayerSpellFromHotkeyKey(e.key)) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key === "arrowright" || key === "d") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.right = true;
  } else if (key === "arrowleft" || key === "a") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.left = true;
  } else if (key === "arrowup" || key === "w") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.up = true;
  } else if (key === "arrowdown" || key === "s") {
    cancelPlayerNavigationForManualMovement();
    keysPressed.down = true;
  } else if (key === "enter") {
    if (!isChatInputFocused()) {
      e.preventDefault();

      focusChatInput();
      return;
    } else {
      return;
    }
  }
});

/* ---------- INPUTS - TOUCHE RELACHEE ---------- */

document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "arrowright" || key === "d") {
    keysPressed.right = false;
  } else if (key === "arrowleft" || key === "a") {
    keysPressed.left = false;
  } else if (key === "arrowup" || key === "w") {
    keysPressed.up = false;
  } else if (key === "arrowdown" || key === "s") {
    keysPressed.down = false;
  } else {
    return;
  }
  if (!isTextInputFocused()) {
    e.preventDefault();
  }
});

/* ---------- INPUTS - SAUVEGARDE AUTOMATIQUE ---------- */

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    resetMobileJoystick();
    autosaveCurrentCharacter();
  }
});

window.addEventListener("blur", resetMobileJoystick);

window.addEventListener("pagehide", () => {
  autosaveCurrentCharacter();
});

/* ---------- INPUTS - RESIZE FENETRE ---------- */

window.addEventListener("resize", () => {
  updateGameScale();
});
window.visualViewport?.addEventListener("resize", updateGameScale);
window.addEventListener("orientationchange", () => {
  resetMobileJoystick();
  requestAnimationFrame(updateGameScale);
});

/* ---------- INPUTS - SOURIS ---------- */
document.addEventListener("mousemove", (e) => {
  updateMousePositionInfo(e.clientX, e.clientY);
  handleItemUiMouseMove(e);
});

/* ---------- INPUTS - ACTIONS SOURIS ---------- */
const lookAtPointerTarget = (target) => {
  let lookInfo = {};

  if (target.monster) {
    const monsterData = getLocalizedMonsterData(target.monster.monsterId);
    if (!monsterData) {
      return null;
    }
    lookInfo = {
      name: monsterData.name,
      desc: monsterData.desc,
      suffix: monsterData.suffix,
      target: target.monster,
    };
    return lookInfo;
  } else if (target.player) {
    const customText = getPlayerLookDescription();
    if (isEmpty(customText)) {
      return null;
    }
    lookInfo = {
      customText,
      target: playerState,
    };
    return lookInfo;
  } else if (target.npc) {
    const npcData = getNpcData(target.npc.npcId);
    if (!npcData) {
      return null;
    }
    return {
      customText: getGameUiText("youSeeProperName")(npcData.name),
      target: target.npc,
    };
  } else if (target.item) {
    const itemData = getLocalizedItemData(target.item.itemId);
    if (!itemData) {
      return null;
    }
    lookInfo = {
      name: itemData.name,
      pluralName: itemData.pluralName,
      desc: itemData.desc,
      suffix: itemData.suffix,
      quantity: target.item.quantity,
      weight: getItemTotalWeight(target.item),
      target: target.item,
      sourceType: target.itemSlotInfo.itemLocation.locationType,
      charges: target.item.charges,
      attack: itemData.combat?.attack,
      defense: itemData.combat?.defense,
    };
    return lookInfo;
  } else if (target.interactable) {
    const interactable = target.interactable;
    const isFrench = getCurrentGameLanguage() === "fr";
    const displayName =
      (isFrench ? interactable.properties?.displayNameFr : interactable.properties?.displayName) ??
      interactable.properties?.displayName;
    const lookText =
      (isFrench ? interactable.properties?.lookTextFr : interactable.properties?.lookText) ??
      interactable.properties?.lookText;

    if (!displayName && !lookText) {
      return null;
    }

    let customText = "";
    if (displayName) {
      customText += getGameUiText("youSeeProperName")(displayName);
    }
    if (lookText) {
      customText += `\n${lookText}`;
    }

    lookInfo = {
      customText,
      target: playerState,
    };
    return lookInfo;
  } else if (target.tile) {
    lookInfo = {
      name: getGameUiText("tileName"),
      desc: getGameUiText("tileDescription"),
      suffix: getCurrentGameLanguage() === "fr" ? "une" : "a",
      target: target.tile,
    };
    return lookInfo;
  } else {
    return null;
  }
};

const getPlayerLookDescription = () => {
  const level = playerState.level;
  const classData = getPlayerClassData();
  if (!Number.isFinite(level) || !classData) {
    return null;
  }
  if (!("classId" in playerState) || playerState.classId === "noClass") {
    return getGameUiText("youSeeYourself")(level);
  } else {
    const localizedClassData = getLocalizedClassData(playerState.classId) ?? classData;
    return getGameUiText("youSeeYourselfClass")(localizedClassData.name, level);
  }
};

const handleLookCombo = () => {
  const target = inputState.lastDetectedTarget;
  if (!target) {
    return false;
  }
  const lookInfo = lookAtPointerTarget(target);
  if (!lookInfo) {
    return false;
  }
  showLookFloatingText(lookInfo);
  return true;
};

/* ---------- INPUTS - DRAG ITEM UI ---------- */
const isTextInputFocused = () => {
  const activeElement = document.activeElement;
  return activeElement === chatInput || activeElement?.matches("input, textarea") === true;
};

const blurActiveTextInput = () => {
  const activeElement = document.activeElement;
  if (activeElement?.matches("input, textarea")) {
    activeElement.blur();
    if (gameRuntimeState.isStarted && !characterSelectorUiState.isOpen) {
      game.focus({ preventScroll: true });
    }
  }
};

const getContainerSourceFromSlotElement = (slotElement) => {
  if (!slotElement) {
    return null;
  }
  const containerUid = Number(slotElement.getAttribute("data-container-uid"));
  const slotIndex = Number(slotElement.getAttribute("data-container-slot-index"));
  if (!Number.isInteger(containerUid) || !Number.isInteger(slotIndex)) {
    return null;
  }
  return {
    locationType: "containerSlot",
    parentContainerUid: containerUid,
    slotIndex,
  };
};

const getEquipmentSourceFromSlotElement = (slotElement) => {
  if (!slotElement) {
    return null;
  }
  const slotName = slotElement.getAttribute("data-equipment-slot");
  if (!slotName || !(slotName in playerState.equipment)) {
    return null;
  }
  return {
    locationType: "equipmentSlot",
    equipmentSlotName: slotName,
  };
};

const getWorldSourceFromItemElement = (itemElement) => {
  if (!itemElement) {
    return null;
  }
  const itemUid = Number(itemElement.getAttribute("data-item-uid"));
  if (!Number.isInteger(itemUid)) {
    return null;
  }
  return {
    locationType: "worldItem",
    itemUid: itemUid,
  };
};

const getWorldDestinationFromMousePosition = () => {
  if (!isMouseInsideMap(mousePosition)) {
    return null;
  }
  const x = mousePosition.col * TILE_SIZE;
  const y = mousePosition.row * TILE_SIZE;
  return {
    locationType: "worldTile",
    x,
    y,
    z: playerState.z,
  };
};

const getItemSlotInfoFromEvent = (e) => {
  const containerSlotElement = e.target.closest(".container-slot");
  if (containerSlotElement) {
    const itemLocation = getContainerSourceFromSlotElement(containerSlotElement);
    return {
      slotElement: containerSlotElement,
      itemLocation,
    };
  }
  const equipmentSlotElement = e.target.closest("[data-equipment-slot]");
  if (equipmentSlotElement) {
    const itemLocation = getEquipmentSourceFromSlotElement(equipmentSlotElement);
    return {
      slotElement: equipmentSlotElement,
      itemLocation,
    };
  }
  const worldSlotElement = e.target.closest(".hitbox");
  if (worldSlotElement) {
    const clickedLocation = getWorldSourceFromItemElement(worldSlotElement);
    const clickedItem = getDragSourceItem(clickedLocation);
    if (!clickedItem) {
      return null;
    }
    const topItem = getTopWorldItemAtTile(clickedItem.x, clickedItem.y, clickedItem.z);
    if (!topItem) {
      return null;
    }
    const itemLocation = {
      locationType: "worldItem",
      itemUid: topItem.uid,
    };
    return {
      slotElement: worldSlotElement,
      itemLocation,
    };
  }
  return null;
};

const getPointerTargetFromEvent = (e) => {
  updateMousePositionInfo(e.clientX, e.clientY);
  const itemSlotInfo = getItemSlotInfoFromEvent(e);
  let item = null;
  if (itemSlotInfo && itemSlotInfo.itemLocation) {
    item = getDragSourceItem(itemSlotInfo.itemLocation);
  }
  if (
    itemSlotInfo &&
    (itemSlotInfo.itemLocation.locationType === "equipmentSlot" ||
      itemSlotInfo.itemLocation.locationType === "containerSlot")
  ) {
    return {
      itemSlotInfo: itemSlotInfo,
      item,
      player: null,
      monster: null,
      npc: null,
      interactable: null,
      tile: null,
      pointerInsideMap: false,
    };
  }
  const row = mousePosition.row;
  const col = mousePosition.col;
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const pointerInsideMap = mousePosition.isInsideMap;
  let tile = null;
  let monster = null;
  let npc = null;
  let player = null;
  let interactable = null;
  const currentWorldMap = getCurrentWorldMap();
  if (pointerInsideMap) {
    interactable = findInteractableAtTile(currentWorldMap, col, row);
    tile = { row, col, x, y };
    monster = findMonsterAtPosition(x, y);
    npc = findNpcAtClientPosition(e.clientX, e.clientY) ?? findNpcAtPosition(x, y);
    if (isPlayerAtPosition(x, y)) {
      player = playerState;
    }
  }

  return {
    itemSlotInfo: itemSlotInfo,
    item,
    player,
    monster: monster,
    npc,
    interactable,
    tile,
    pointerInsideMap,
  };
};

const handleItemUiMouseDown = (e) => {
  if (e.button !== 0) {
    return;
  }
  const info = getItemSlotInfoFromEvent(e);
  if (!info || !info.itemLocation || !info.slotElement) {
    return;
  }
  e.preventDefault();
  dragState.pendingSourceLocation = info.itemLocation;
  dragState.pendingSlotElement = info.slotElement;
  dragState.startScreenX = e.clientX;
  dragState.startScreenY = e.clientY;
};

const handleItemUiMouseMove = (e) => {
  if (!dragState.pendingSourceLocation || !inputState.isLeftClickDown || inputState.isLookComboTriggered) {
    return;
  }
  const mouseMoveDistance = Math.abs(dragState.startScreenX - e.clientX) + Math.abs(dragState.startScreenY - e.clientY);
  if (mouseMoveDistance < 5) {
    return;
  }
  const item = getDragSourceItem(dragState.pendingSourceLocation);
  if (
    !item ||
    (dragState.pendingSourceLocation.locationType === "worldItem" &&
      !isWorldItemAvailableForInteraction(item))
  ) {
    resetDragState();
    resetDragStatePending();
    return;
  }
  startItemDrag(dragState.pendingSourceLocation);
  if (dragState.isDragging === true) {
    if (dragState.pendingSourceLocation.locationType === "worldItem") {
      const itemUid = dragState.pendingSourceLocation.itemUid;
      setPixiWorldItemSelected(itemUid, true);
    } else {
      dragState.pendingSlotElement.classList.add("container-slot-dragging");
    }
  }
  resetDragStatePending();
};

const handleItemUiMouseUp = (e) => {
  if (e.button !== 0 || !dragState.isDragging) {
    return;
  }

  const info = getItemSlotInfoFromEvent(e);
  if (!info && e.target.closest(".jeux-gauche, .jeux-droite, .navbar, .entete-jeux, #boite-chat")) {
    cancelItemDrag();
    return;
  }

  if (info && info.itemLocation && info.slotElement) {
    if (["containerSlot", "equipmentSlot"].includes(info.itemLocation.locationType)) {
      e.preventDefault();
      completeItemDrag(info.itemLocation);
      return;
    }

    if (info.itemLocation.locationType === "worldItem") {
      const worldDestination = getWorldDestinationFromMousePosition();
      if (worldDestination) {
        e.preventDefault();
        completeItemDrag(worldDestination);
        return;
      }
    }
  }

  const worldDestination = getWorldDestinationFromMousePosition();
  if (worldDestination) {
    e.preventDefault();
    completeItemDrag(worldDestination);
    return;
  }

  cancelItemDrag();
};

document.addEventListener("mousedown", (e) => {
  updateInputStateOnMouseDown(e);
  if (inputState.isLookComboTriggered) {
    e.preventDefault();
    inputState.shouldBlockNextWorldClick = true;
    handleLookCombo();
    return;
  }

  if (dragState.isDragging && e.button === 2) {
    e.preventDefault();
    inputState.shouldBlockNextContextMenu = true;
    cancelItemDrag();
    return;
  }
  if (itemUseState.isUsingItem) {
    if (inputState.isLookComboTriggered || inputState.isRightClickDown || dragState.isDragging) {
      inputState.shouldBlockNextContextMenu = true;
      cancelItemUse();
      return;
    }
    if (inputState.isLeftClickDown) {
      inputState.shouldBlockNextWorldClick = true;
      completeItemUseFromEvent(e);
      return;
    }

    return;
  }
  handleItemUiMouseDown(e);
});

document.addEventListener("mouseup", (e) => {
  handleItemUiMouseUp(e);
  updateInputStateOnMouseUp(e);
});

/* ---------- INPUTS - MOBILE TACTILE ---------- */

const mobileTouchInputState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  didMove: false,
  didLongPress: false,
  longPressTimeoutId: null,
};

const isMobileTouchGameTarget = (target) => {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("button, input, textarea, select, #mobile-game-controls, #boite-chat, .minimap-panel")) {
    return false;
  }
  return target.closest("#game, .container-slot, .equipment-slot") !== null;
};

const resetMobileTouchInput = () => {
  if (mobileTouchInputState.longPressTimeoutId !== null) {
    clearTimeout(mobileTouchInputState.longPressTimeoutId);
  }
  mobileTouchInputState.pointerId = null;
  mobileTouchInputState.didMove = false;
  mobileTouchInputState.didLongPress = false;
  mobileTouchInputState.longPressTimeoutId = null;
  inputState.isLeftClickDown = false;
  inputState.lastDetectedTarget = null;
};

const createTouchReleaseEvent = (pointerEvent) => {
  return {
    button: 0,
    clientX: pointerEvent.clientX,
    clientY: pointerEvent.clientY,
    target: document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY) ?? pointerEvent.target,
    preventDefault: () => pointerEvent.preventDefault(),
    stopPropagation: () => pointerEvent.stopPropagation(),
  };
};

const getMobileWorldContainerSourceAtTarget = (target) => {
  if (!target?.tile || target.monster) {
    return null;
  }

  const item = getTopWorldItemAtTile(target.tile.x, target.tile.y, playerState.z);
  if (!item || !isOpenableContainerItem(item)) {
    return null;
  }

  const source = {
    locationType: "worldItem",
    itemUid: item.uid,
  };
  return canInteractWithWorldItemSource(source) ? source : null;
};

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && isMobileGameLayout() && mobileGameUiState.openPanel !== null) {
    const openPanelElement = getMobilePanelElement(mobileGameUiState.openPanel);
    const clickedPanelButton = event.target instanceof Element && event.target.closest(".mobile-panel-buttons");
    const clickedContainerWindow = event.target instanceof Element && event.target.closest("#player-containers");
    if (!openPanelElement?.contains(event.target) && !clickedPanelButton && !clickedContainerWindow) {
      event.preventDefault();
      setOpenMobilePanel(null);
      return;
    }
  }

  if (
    event.pointerType !== "touch" ||
    !isMobileGameLayout() ||
    !gameRuntimeState.isStarted ||
    characterSelectorUiState.isOpen ||
    mobileTouchInputState.pointerId !== null ||
    !isMobileTouchGameTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  mobileTouchInputState.pointerId = event.pointerId;
  mobileTouchInputState.startX = event.clientX;
  mobileTouchInputState.startY = event.clientY;
  mobileTouchInputState.didMove = false;
  mobileTouchInputState.didLongPress = false;
  updateMousePositionInfo(event.clientX, event.clientY);
  updateInputStateOnMouseDown(event);

  if (itemUseState.isUsingItem) {
    inputState.shouldBlockNextWorldClick = true;
    completeItemUseFromEvent(event);
    resetMobileTouchInput();
    return;
  }

  handleItemUiMouseDown(event);
  mobileTouchInputState.longPressTimeoutId = setTimeout(() => {
    if (
      mobileTouchInputState.pointerId !== event.pointerId ||
      mobileTouchInputState.didMove ||
      dragState.isDragging
    ) {
      return;
    }
    if (handleNpcGreetingFromPointerTarget(inputState.lastDetectedTarget) || handleLookCombo()) {
      mobileTouchInputState.didLongPress = true;
      inputState.shouldBlockNextWorldClick = true;
      navigator.vibrate?.(12);
    }
  }, 450);
}, { passive: false });

document.addEventListener("pointermove", (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }

  event.preventDefault();
  updateMousePositionInfo(event.clientX, event.clientY);
  const distance =
    Math.abs(event.clientX - mobileTouchInputState.startX) +
    Math.abs(event.clientY - mobileTouchInputState.startY);
  if (distance >= 5) {
    mobileTouchInputState.didMove = true;
    if (mobileTouchInputState.longPressTimeoutId !== null) {
      clearTimeout(mobileTouchInputState.longPressTimeoutId);
      mobileTouchInputState.longPressTimeoutId = null;
    }
  }
  handleItemUiMouseMove(event);
}, { passive: false });

const finishMobileTouchInput = (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }

  event.preventDefault();
  const releaseEvent = createTouchReleaseEvent(event);
  const pendingSource = dragState.pendingSourceLocation;
  const target = mobileTouchInputState.didMove ? null : getPointerTargetFromEvent(releaseEvent);

  if (mobileTouchInputState.didLongPress) {
    cancelItemDrag();
  } else if (dragState.isDragging) {
    handleItemUiMouseUp(releaseEvent);
  } else if (target?.monster) {
    resetDragStatePending();
    selectMonster(target.monster);
  } else if (pendingSource && !mobileTouchInputState.didMove) {
    resetDragStatePending();
    handleUseItemFromSource(pendingSource);
  } else if (!mobileTouchInputState.didMove) {
    const worldContainerSource = getMobileWorldContainerSourceAtTarget(target);
    if (worldContainerSource) {
      handleUseItemFromSource(worldContainerSource);
    } else if (handleInteractableContextMenu(target) || handleTransitionContextMenu(target)) {
      inputState.shouldBlockNextWorldClick = true;
    } else if (target?.pointerInsideMap && target.tile) {
      startPlayerClickNavigation(target.tile);
    }
  }

  resetDragStatePending();
  resetMobileTouchInput();
};

document.addEventListener("pointerup", finishMobileTouchInput, { passive: false });
document.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== mobileTouchInputState.pointerId) {
    return;
  }
  cancelItemDrag();
  resetDragStatePending();
  resetMobileTouchInput();
}, { passive: false });

mobileJoystick?.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  mobileGameUiState.joystickPointerId = event.pointerId;
  mobileJoystick.setPointerCapture(event.pointerId);
  updateMobileJoystickFromPointer(event.clientX, event.clientY);
});

mobileJoystick?.addEventListener("pointermove", (event) => {
  if (event.pointerId !== mobileGameUiState.joystickPointerId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  updateMobileJoystickFromPointer(event.clientX, event.clientY);
});

const finishMobileJoystickInput = (event) => {
  if (event.pointerId !== mobileGameUiState.joystickPointerId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  resetMobileJoystick();
};

mobileJoystick?.addEventListener("pointerup", finishMobileJoystickInput);
mobileJoystick?.addEventListener("pointercancel", finishMobileJoystickInput);

for (const button of mobilePanelButtons) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenMobilePanel(button.dataset.mobilePanel);
  });
}

for (const button of mobileActionButtons) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.mobileAction === "toggle-backpack") {
      toggleMobileBackpack();
    } else if (button.dataset.mobileAction === "toggle-follow") {
      togglePlayerFollow();
      syncMobileFollowButton();
    } else if (button.dataset.mobileAction === "cycle-stance") {
      cycleMobileCombatMode();
    } else if (button.dataset.mobileAction === "toggle-spells") {
      toggleSpellWindow();
    }
  });
}

mobileItemUseIndicator?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  cancelItemUse();
});

mobilePanelCloseButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setOpenMobilePanel(null);
});

mobileGameLayoutMedia.addEventListener("change", syncMobileGameLayout);
syncMobileGameLayout();

//#endregion  -----  INPUTS - CLAVIER / SOURIS / RESIZE  -----

/* ==================================================== */
//#region     -----  PATHFINDING A*  -----
/* ==================================================== */
/* ---------- PATHFINDING - POSITIONS ET VOISINS ---------- */

const getTilePosition = (source) => {
  const col = source.x / TILE_SIZE;
  const row = source.y / TILE_SIZE;
  return { col, row };
};

const getWorldPosition = (tile) => {
  const tileX = tile.col * TILE_SIZE;
  const tileY = tile.row * TILE_SIZE;
  return { tileX, tileY };
};

const getTileMovementCost = (fromTile, toTile) => {
  if (
    !Number.isInteger(fromTile?.col) ||
    !Number.isInteger(fromTile?.row) ||
    !Number.isInteger(toTile?.col) ||
    !Number.isInteger(toTile?.row)
  ) {
    return null;
  }

  const distanceCol = Math.abs(toTile.col - fromTile.col);
  const distanceRow = Math.abs(toTile.row - fromTile.row);

  if (distanceCol > 1 || distanceRow > 1 || (distanceCol === 0 && distanceRow === 0)) {
    return null;
  }

  return distanceCol === 1 && distanceRow === 1 ? 3 : 1;
};

const getTileMovementAnimationMultiplier = (fromTile, toTile) => {
  const movementCost = getTileMovementCost(fromTile, toTile);

  if (movementCost === null) {
    return null;
  }

  return movementCost === 3 ? 2 : 1;
};

const getCardinalDirectionFromTileDelta = (deltaCol, deltaRow, fallbackDirection = "down") => {
  if (deltaCol > 0) {
    return "right";
  }

  if (deltaCol < 0) {
    return "left";
  }

  if (deltaRow < 0) {
    return "up";
  }

  if (deltaRow > 0) {
    return "down";
  }

  return fallbackDirection;
};

const getPathMovementCost = (startTile, path) => {
  if (!startTile || !Array.isArray(path)) {
    return Number.POSITIVE_INFINITY;
  }

  let totalCost = 0;
  let previousTile = startTile;

  for (const tile of path) {
    const movementCost = getTileMovementCost(previousTile, tile);

    if (movementCost === null) {
      return Number.POSITIVE_INFINITY;
    }

    totalCost += movementCost;
    previousTile = tile;
  }

  return totalCost;
};

const hasLineOfSightBetweenTiles = (worldMap, fromTile, toTile) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    !Number.isInteger(fromTile?.col) ||
    !Number.isInteger(fromTile?.row) ||
    !Number.isInteger(toTile?.col) ||
    !Number.isInteger(toTile?.row)
  ) {
    return false;
  }

  let currentCol = fromTile.col;
  let currentRow = fromTile.row;

  const distanceCol = Math.abs(toTile.col - currentCol);
  const distanceRow = -Math.abs(toTile.row - currentRow);

  const stepCol = currentCol < toTile.col ? 1 : -1;
  const stepRow = currentRow < toTile.row ? 1 : -1;

  let error = distanceCol + distanceRow;

  while (currentCol !== toTile.col || currentRow !== toTile.row) {
    const doubledError = error * 2;

    if (doubledError >= distanceRow) {
      error += distanceRow;
      currentCol += stepCol;
    }

    if (doubledError <= distanceCol) {
      error += distanceCol;
      currentRow += stepRow;
    }

    if (isTiledCollisionAtTile(worldMap, currentCol, currentRow)) {
      return false;
    }
  }

  return true;
};

const hasPlayerLineOfSightToEntity = (entity) => {
  return hasPlayerLineOfSightToWorldPosition(entity);
};

const hasPlayerLineOfSightToWorldPosition = (worldPosition) => {
  if (!worldPosition || worldPosition.z !== playerState.z) {
    return false;
  }
  const worldMap = getCurrentWorldMap();
  if (!worldMap) {
    return false;
  }
  return hasLineOfSightBetweenTiles(worldMap, getTilePosition(playerState), getTilePosition(worldPosition));
};

const getNeighbors = (tile) => {
  return [
    { row: tile.row - 1, col: tile.col - 1 },
    { row: tile.row - 1, col: tile.col },
    { row: tile.row - 1, col: tile.col + 1 },
    { row: tile.row, col: tile.col - 1 },
    { row: tile.row, col: tile.col + 1 },
    { row: tile.row + 1, col: tile.col - 1 },
    { row: tile.row + 1, col: tile.col },
    { row: tile.row + 1, col: tile.col + 1 },
  ];
};

const isTilePathTraversable = (row, col, fromTile = null) => {
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return false;
  }

  const currentWorldMap = getCurrentWorldMap();
  if (!currentWorldMap) {
    return false;
  }

  const worldChunk = getWorldChunkForTilePosition(currentWorldMap, col, row);
  if (!worldChunk) {
    return false;
  }

  if (isTiledCollisionAtTile(currentWorldMap, col, row)) {
    return false;
  }

  const tileX = col * TILE_SIZE;
  const tileY = row * TILE_SIZE;

  if (isBlockingItemAtPosition(tileX, tileY)) {
    return false;
  }

  if (fromTile) {
    const fromWorld = getWorldPosition(fromTile);
    const toWorld = getWorldPosition({ row, col });

    if (!canStepFromTileToTile(fromWorld.tileX, fromWorld.tileY, toWorld.tileX, toWorld.tileY, playerState.z)) {
      return false;
    }
  }

  return true;
};

const isTileOccupiedByCreature = (row, col) => {
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return false;
  }

  const tileX = col * TILE_SIZE;
  const tileY = row * TILE_SIZE;

  return isMonsterAtPosition(tileX, tileY) || isNpcAtPosition(tileX, tileY) || isPlayerAtPosition(tileX, tileY);
};

const isWalkableTile = (row, col, fromTile = null) => {
  return isTilePathTraversable(row, col, fromTile) && !isTileOccupiedByCreature(row, col);
};

const getDistance = (a, b) => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

const getDistanceToClosestTile = (tile, targetTiles) => {
  if (
    !Number.isInteger(tile?.col) ||
    !Number.isInteger(tile?.row) ||
    !Array.isArray(targetTiles) ||
    targetTiles.length === 0
  ) {
    return Number.POSITIVE_INFINITY;
  }

  let closestDistance = Number.POSITIVE_INFINITY;

  for (const targetTile of targetTiles) {
    if (!Number.isInteger(targetTile?.col) || !Number.isInteger(targetTile?.row)) {
      continue;
    }

    closestDistance = Math.min(closestDistance, getDistance(tile, targetTile));
  }

  return closestDistance;
};

const getNeighborNodes = (tile, targetTiles, avoidCreatures = false) => {
  const neighborsTile = getNeighbors(tile);
  const neighborsNodes = [];
  neighborsTile.forEach((neighbors) => {
    const canTraverse = avoidCreatures
      ? isWalkableTile(neighbors.row, neighbors.col, tile)
      : isTilePathTraversable(neighbors.row, neighbors.col, tile);

    if (canTraverse) {
      const movementCost = getTileMovementCost(tile, neighbors);

      if (movementCost === null) {
        return;
      }

      const g = tile.g + movementCost;
      const h = getDistanceToClosestTile(neighbors, targetTiles);
      const node = {
        row: neighbors.row,
        col: neighbors.col,
        g: g,
        h: h,
        f: g + h,
        parent: tile,
      };
      neighborsNodes.push(node);
    }
  });
  return neighborsNodes;
};

/* ---------- PATHFINDING - NODES ET MIN-HEAP ---------- */

const isPathNodeHigherPriority = (nodeA, nodeB) => {
  if (nodeA.f !== nodeB.f) {
    return nodeA.f < nodeB.f;
  }
  if (nodeA.h !== nodeB.h) {
    return nodeA.h < nodeB.h;
  }
  return nodeA.openOrder < nodeB.openOrder;
};

const pushPathNodeToMinHeap = (minHeap, node) => {
  minHeap.push(node);
  let nodeIndex = minHeap.length - 1;

  while (nodeIndex > 0) {
    const parentIndex = Math.floor((nodeIndex - 1) / 2);
    if (!isPathNodeHigherPriority(minHeap[nodeIndex], minHeap[parentIndex])) {
      break;
    }

    [minHeap[nodeIndex], minHeap[parentIndex]] = [minHeap[parentIndex], minHeap[nodeIndex]];
    nodeIndex = parentIndex;
  }
};

const popPathNodeFromMinHeap = (minHeap) => {
  if (minHeap.length === 0) {
    return null;
  }

  const smallestNode = minHeap[0];
  const lastNode = minHeap.pop();

  if (minHeap.length === 0) {
    return smallestNode;
  }

  minHeap[0] = lastNode;
  let nodeIndex = 0;

  while (true) {
    const leftChildIndex = nodeIndex * 2 + 1;
    const rightChildIndex = nodeIndex * 2 + 2;
    let smallestIndex = nodeIndex;

    if (leftChildIndex < minHeap.length && isPathNodeHigherPriority(minHeap[leftChildIndex], minHeap[smallestIndex])) {
      smallestIndex = leftChildIndex;
    }

    if (
      rightChildIndex < minHeap.length &&
      isPathNodeHigherPriority(minHeap[rightChildIndex], minHeap[smallestIndex])
    ) {
      smallestIndex = rightChildIndex;
    }

    if (smallestIndex === nodeIndex) {
      break;
    }

    [minHeap[nodeIndex], minHeap[smallestIndex]] = [minHeap[smallestIndex], minHeap[nodeIndex]];
    nodeIndex = smallestIndex;
  }

  return smallestNode;
};

const buildPath = (currentNode) => {
  let path = [];
  while (currentNode.parent) {
    path.push(currentNode);
    currentNode = currentNode.parent;
  }
  return path.reverse();
};

/* ---------- PATHFINDING - DESTINATION ET CHEMIN ---------- */

const getPathTraversableAdjacentTiles = (tile) => {
  if (!Number.isInteger(tile?.col) || !Number.isInteger(tile?.row)) {
    return [];
  }

  return getNeighbors(tile).filter((neighbor) => {
    return isTilePathTraversable(neighbor.row, neighbor.col);
  });
};

const findPathToAnyTarget = (
  startTile,
  targetTiles,
  avoidCreatures = false,
  maxPathCost = Number.POSITIVE_INFINITY,
) => {
  if (
    !Number.isInteger(startTile?.col) ||
    !Number.isInteger(startTile?.row) ||
    !Array.isArray(targetTiles) ||
    targetTiles.length === 0 ||
    (maxPathCost !== Number.POSITIVE_INFINITY && (!Number.isFinite(maxPathCost) || maxPathCost < 0))
  ) {
    return [];
  }

  const validTargetTiles = targetTiles.filter((targetTile) => {
    return Number.isInteger(targetTile?.col) && Number.isInteger(targetTile?.row);
  });

  if (validTargetTiles.length === 0) {
    return [];
  }

  const targetKeys = new Set(
    validTargetTiles.map((targetTile) => {
      return `${targetTile.col}:${targetTile.row}`;
    }),
  );
  const openHeap = [];
  const closedTileKeys = new Set();
  const bestGByTileKey = new Map();
  let nextOpenOrder = 0;
  const g = 0;
  const h = getDistanceToClosestTile(startTile, validTargetTiles);
  const startNode = {
    row: startTile.row,
    col: startTile.col,
    g: g,
    h: h,
    f: g + h,
    parent: null,
    openOrder: nextOpenOrder++,
  };
  const startNodeKey = `${startNode.col}:${startNode.row}`;
  bestGByTileKey.set(startNodeKey, startNode.g);
  pushPathNodeToMinHeap(openHeap, startNode);

  while (openHeap.length > 0) {
    const currentNode = popPathNodeFromMinHeap(openHeap);
    if (!currentNode) {
      break;
    }

    const currentNodeKey = `${currentNode.col}:${currentNode.row}`;

    if (closedTileKeys.has(currentNodeKey) || currentNode.g !== bestGByTileKey.get(currentNodeKey)) {
      continue;
    }

    closedTileKeys.add(currentNodeKey);

    if (targetKeys.has(currentNodeKey)) {
      return buildPath(currentNode);
    } else {
      const neighborsNodes = getNeighborNodes(currentNode, validTargetTiles, avoidCreatures);
      neighborsNodes.forEach((node) => {
        if (node.g > maxPathCost) {
          return;
        }
        const nodeKey = `${node.col}:${node.row}`;
        if (closedTileKeys.has(nodeKey)) {
          return;
        }

        const bestKnownG = bestGByTileKey.get(nodeKey);
        if (bestKnownG !== undefined && node.g >= bestKnownG) {
          return;
        }

        bestGByTileKey.set(nodeKey, node.g);
        node.openOrder = nextOpenOrder++;
        pushPathNodeToMinHeap(openHeap, node);
      });
    }
  }
  return [];
};

const findPath = (startTile, targetTile, avoidCreatures = false, maxPathCost = Number.POSITIVE_INFINITY) => {
  return findPathToAnyTarget(startTile, [targetTile], avoidCreatures, maxPathCost);
};

/* ---------- PATHFINDING - NAVIGATION JOUEUR ---------- */

const stopPlayerNavigation = () => {
  playerNavigationState.mode = null;
  playerNavigationState.path = [];
  playerNavigationState.destinationTile = null;
  playerNavigationState.pendingAction = null;
  playerNavigationState.actionExecuteAt = 0;
  playerNavigationState.nextPathRefreshAt = 0;
  playerNavigationState.lastFollowTargetTileKey = null;
  playerNavigationState.lastActionTargetTileKey = null;
  playerNavigationState.lastFailureKey = null;
};

const setPlayerNavigationPath = (path) => {
  if (!Array.isArray(path)) {
    playerNavigationState.path = [];
    return false;
  }

  playerNavigationState.path = path.map((tile) => {
    return { col: tile.col, row: tile.row };
  });
  return true;
};

const showPlayerNavigationFailure = (failureKey) => {
  if (playerNavigationState.lastFailureKey === failureKey) {
    return;
  }
  playerNavigationState.lastFailureKey = failureKey;
  showGameStatusMessage(getGameUiText("noPath"));
};

const refreshPlayerClickNavigationPath = () => {
  const destinationTile = playerNavigationState.destinationTile;
  const playerTile = getTilePosition(playerState);

  if (!destinationTile || !playerTile) {
    stopPlayerNavigation();
    return false;
  }

  if (playerTile.col === destinationTile.col && playerTile.row === destinationTile.row) {
    stopPlayerNavigation();
    return true;
  }

  const path = findPath(playerTile, destinationTile, true, PLAYER_AUTO_WALK_MAX_PATH_COST);
  if (path.length === 0) {
    const failureKey = `click:${playerState.z}:${destinationTile.col}:${destinationTile.row}`;
    stopPlayerNavigation();
    showPlayerNavigationFailure(failureKey);
    return false;
  }

  playerNavigationState.lastFailureKey = null;
  return setPlayerNavigationPath(path);
};

const startPlayerClickNavigation = (destinationTile) => {
  if (!Number.isInteger(destinationTile?.col) || !Number.isInteger(destinationTile?.row)) {
    return false;
  }

  playerNavigationState.mode = PLAYER_NAVIGATION_MODE.click;
  playerNavigationState.pendingAction = null;
  playerNavigationState.actionExecuteAt = 0;
  playerNavigationState.destinationTile = {
    col: destinationTile.col,
    row: destinationTile.row,
  };
  playerNavigationState.path = [];
  playerNavigationState.nextPathRefreshAt = 0;
  playerNavigationState.lastFollowTargetTileKey = null;
  playerNavigationState.lastActionTargetTileKey = null;
  return refreshPlayerClickNavigationPath();
};

const handleMinimapNavigationClick = (event) => {
  if (!gameRuntimeState.isStarted || characterSelectorUiState.isOpen || !minimapCanvas) {
    return false;
  }
  if (minimapRenderState.viewZ !== playerState.z) {
    showGameStatusMessage(getGameUiText("minimapWrongFloor"));
    return false;
  }
  const canvasRect = minimapCanvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return false;
  }

  const canvasX = (event.clientX - canvasRect.left) * (minimapCanvas.width / canvasRect.width);
  const canvasY = (event.clientY - canvasRect.top) * (minimapCanvas.height / canvasRect.height);
  const minimapCol = Math.floor(canvasX / minimapRenderState.cellSize);
  const minimapRow = Math.floor(canvasY / minimapRenderState.cellSize);
  if (
    minimapCol < 0 ||
    minimapCol >= minimapRenderState.visibleCols ||
    minimapRow < 0 ||
    minimapRow >= minimapRenderState.visibleRows ||
    !Number.isInteger(minimapRenderState.firstCol) ||
    !Number.isInteger(minimapRenderState.firstRow)
  ) {
    return false;
  }

  const playerTile = getTilePosition(playerState);
  const destinationTile = {
    col: minimapRenderState.firstCol + minimapCol,
    row: minimapRenderState.firstRow + minimapRow,
  };
  const distance = Math.max(
    Math.abs(destinationTile.col - playerTile.col),
    Math.abs(destinationTile.row - playerTile.row),
  );
  if (distance > MINIMAP_AUTOWALK_MAX_DISTANCE_TILES) {
    showGameStatusMessage(getGameUiText("destinationTooFar"));
    return false;
  }
  return startPlayerClickNavigation(destinationTile);
};

const startMinimapPan = (event) => {
  if (event.button !== 0 || !minimapCanvas) {
    return;
  }
  const playerTile = getTilePosition(playerState);
  minimapRenderState.panPointerId = event.pointerId;
  minimapRenderState.panStartClientX = event.clientX;
  minimapRenderState.panStartClientY = event.clientY;
  minimapRenderState.panStartCenterCol = minimapRenderState.centerCol ?? playerTile.col;
  minimapRenderState.panStartCenterRow = minimapRenderState.centerRow ?? playerTile.row;
  minimapRenderState.didPan = false;
  minimapCanvas.setPointerCapture(event.pointerId);
};

const updateMinimapPan = (event) => {
  if (event.pointerId !== minimapRenderState.panPointerId || !minimapCanvas) {
    return;
  }
  const deltaClientX = event.clientX - minimapRenderState.panStartClientX;
  const deltaClientY = event.clientY - minimapRenderState.panStartClientY;
  if (!minimapRenderState.didPan && Math.abs(deltaClientX) + Math.abs(deltaClientY) < 4) {
    return;
  }
  const canvasRect = minimapCanvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return;
  }
  const deltaCanvasX = deltaClientX * (minimapCanvas.width / canvasRect.width);
  const deltaCanvasY = deltaClientY * (minimapCanvas.height / canvasRect.height);
  minimapRenderState.didPan = true;
  minimapRenderState.isFollowingPlayer = false;
  minimapRenderState.centerCol = minimapRenderState.panStartCenterCol - Math.round(deltaCanvasX / minimapRenderState.cellSize);
  minimapRenderState.centerRow = minimapRenderState.panStartCenterRow - Math.round(deltaCanvasY / minimapRenderState.cellSize);
  minimapCanvas.classList.add("minimap-canvas-panning");
  renderPlayerMinimap(true);
};

const finishMinimapPan = (event, shouldNavigate) => {
  if (event.pointerId !== minimapRenderState.panPointerId || !minimapCanvas) {
    return;
  }
  const didPan = minimapRenderState.didPan;
  if (minimapCanvas.hasPointerCapture(event.pointerId)) {
    minimapCanvas.releasePointerCapture(event.pointerId);
  }
  minimapCanvas.classList.remove("minimap-canvas-panning");
  minimapRenderState.panPointerId = null;
  minimapRenderState.didPan = false;
  if (shouldNavigate && !didPan) {
    handleMinimapNavigationClick(event);
  }
};

const startPlayerFollowNavigation = () => {
  if (!playerNavigationState.followEnabled || selectedMonsterUid === null) {
    return false;
  }

  playerNavigationState.mode = PLAYER_NAVIGATION_MODE.follow;
  playerNavigationState.pendingAction = null;
  playerNavigationState.actionExecuteAt = 0;
  playerNavigationState.path = [];
  playerNavigationState.destinationTile = null;
  playerNavigationState.nextPathRefreshAt = 0;
  playerNavigationState.lastFollowTargetTileKey = null;
  playerNavigationState.lastActionTargetTileKey = null;
  playerNavigationState.lastFailureKey = null;
  return true;
};

const updatePlayerFollowNavigation = (now, forceRefresh = false) => {
  if (playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.follow) {
    return;
  }

  const monster = findMonsterByUid(selectedMonsterUid);
  if (!monster || monster.hp <= 0 || monster.z !== playerState.z) {
    loseSelectedMonsterTarget();
    return;
  }

  const monsterTile = getTilePosition(monster);
  const targetTileKey = `${monster.z}:${monsterTile.col}:${monsterTile.row}`;

  if (isNearPlayer(monster, 1)) {
    playerNavigationState.path = [];
    playerNavigationState.lastFollowTargetTileKey = targetTileKey;
    playerNavigationState.lastFailureKey = null;
    playerNavigationState.nextPathRefreshAt = now + PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS;
    return;
  }

  const targetMoved = targetTileKey !== playerNavigationState.lastFollowTargetTileKey;
  if (
    !forceRefresh &&
    !targetMoved &&
    now < playerNavigationState.nextPathRefreshAt
  ) {
    return;
  }

  const playerTile = getTilePosition(playerState);
  const targetTiles = getPathTraversableAdjacentTiles(monsterTile).filter((tile) => {
    return !isTileOccupiedByCreature(tile.row, tile.col) || (tile.row === playerTile.row && tile.col === playerTile.col);
  });
  const path = findPathToAnyTarget(playerTile, targetTiles, true, PLAYER_AUTO_WALK_MAX_PATH_COST);

  playerNavigationState.path = [];
  playerNavigationState.lastFollowTargetTileKey = targetTileKey;
  playerNavigationState.nextPathRefreshAt = now + PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS;

  if (path.length === 0) {
    showPlayerNavigationFailure(`follow:${monster.uid}:${targetTileKey}`);
    playerNavigationState.followEnabled = false;
    stopPlayerNavigation();
    updatePlayerInventory();
    return;
  }

  playerNavigationState.lastFailureKey = null;
  setPlayerNavigationPath(path);
};

const isTileWithinPlayerActionRange = (fromTile, targetTile, range, distanceType) => {
  if (
    !Number.isInteger(fromTile?.col) ||
    !Number.isInteger(fromTile?.row) ||
    !Number.isInteger(targetTile?.col) ||
    !Number.isInteger(targetTile?.row) ||
    !Number.isFinite(range)
  ) {
    return false;
  }
  const distanceCol = Math.abs(fromTile.col - targetTile.col);
  const distanceRow = Math.abs(fromTile.row - targetTile.row);
  if (distanceType === PLAYER_ACTION_DISTANCE_TYPE.weighted) {
    return distanceCol + distanceRow <= range;
  }
  return Math.max(distanceCol, distanceRow) <= range;
};

const isPlayerWithinActionRange = (target, range, distanceType = PLAYER_ACTION_DISTANCE_TYPE.square) => {
  if (!target || target.z !== playerState.z) {
    return false;
  }
  return isTileWithinPlayerActionRange(getTilePosition(playerState), getTilePosition(target), range, distanceType);
};

const resolvePlayerActionNavigationTarget = (action) => {
  if (!action) {
    return null;
  }

  if (action.type === PLAYER_ACTION_TYPE.itemDrag) {
    const currentSource = findItemLocationByUid(action.itemUid);
    const item = getItemFromLocation(currentSource);
    if (!item || !areItemLocationsEqual(action.source, currentSource)) {
      return null;
    }
    if (currentSource.locationType === "worldItem") {
      if (!isWorldItemAvailableForInteraction(item)) {
        return null;
      }
      if (!isNearPlayer(item, 1)) {
        return { target: item, range: 1, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
      }
    }
    if (action.destination?.locationType === "worldTile") {
      const destination = action.destination;
      if (destination.z !== playerState.z) {
        return null;
      }
      if (!isNearPlayer(destination, WORLD_ITEM_THROW_RANGE)) {
        return {
          target: destination,
          range: WORLD_ITEM_THROW_RANGE,
          distanceType: PLAYER_ACTION_DISTANCE_TYPE.square,
          requireLineOfSight: true,
        };
      }
    }
    return { isReady: true };
  }

  if (action.type === PLAYER_ACTION_TYPE.useWorldItem) {
    const item = findWorldItemByUid(action.itemUid);
    if (!isWorldItemAvailableForInteraction(item)) {
      return null;
    }
    return isNearPlayer(item, 1)
      ? { isReady: true }
      : { target: item, range: 1, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
  }

  if (action.type === PLAYER_ACTION_TYPE.targetItemUse) {
    const source = findItemLocationByUid(action.itemUid);
    const item = getItemFromLocation(source);
    const useData = getItemUseData(item);
    if (!source || !item || useData?.mode !== "target" || !Number.isFinite(useData.range)) {
      return null;
    }
    if (action.targetType === "monster") {
      const monster = findMonsterByUid(action.targetUid);
      if (useData.action !== "attackRune" || !monster || monster.hp <= 0 || monster.z !== playerState.z) {
        return null;
      }
      return isNearPlayer(monster, useData.range)
        ? { isReady: true }
        : {
            target: monster,
            range: useData.range,
            distanceType: PLAYER_ACTION_DISTANCE_TYPE.square,
            requireLineOfSight: true,
          };
    }
    if (action.targetType === "tile") {
      const targetTile = action.targetTile;
      if (useData.action !== "drinkPotion" || targetTile?.z !== playerState.z) {
        return null;
      }
      return isNearPlayer(targetTile, useData.range)
        ? { isReady: true }
        : { target: targetTile, range: useData.range, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
    }
    return null;
  }

  if (action.type === PLAYER_ACTION_TYPE.npcGreeting) {
    const npc = npcsByUid.get(action.npcUid) ?? null;
    if (!npc || npc.z !== playerState.z) {
      return null;
    }
    return isPlayerWithinActionRange(npc, NPC_DIALOGUE_CONFIG.talkRange, PLAYER_ACTION_DISTANCE_TYPE.weighted)
      ? { isReady: true }
      : { target: npc, range: NPC_DIALOGUE_CONFIG.talkRange, distanceType: PLAYER_ACTION_DISTANCE_TYPE.weighted };
  }

  return null;
};

const executePlayerPendingAction = (action) => {
  if (action.type === PLAYER_ACTION_TYPE.itemDrag) {
    const source = findItemLocationByUid(action.itemUid);
    const item = getItemFromLocation(source);
    if (!item || !areItemLocationsEqual(action.source, source)) {
      return false;
    }
    startItemDrag(source);
    completeItemDrag(action.destination);
    return true;
  }

  if (action.type === PLAYER_ACTION_TYPE.useWorldItem) {
    const source = findItemLocationByUid(action.itemUid);
    if (source?.locationType !== "worldItem") {
      return false;
    }
    handleUseItemFromSource(source);
    return true;
  }

  if (action.type === PLAYER_ACTION_TYPE.targetItemUse) {
    const source = findItemLocationByUid(action.itemUid);
    const item = getItemFromLocation(source);
    const useData = getItemUseData(item);
    if (!source || !item || useData?.mode !== "target") {
      return false;
    }
    if (action.targetType === "monster") {
      const monster = findMonsterByUid(action.targetUid);
      if (!monster) {
        return false;
      }
      handleRuneUse(source, item, useData, { monster });
      return true;
    }
    if (action.targetType === "tile" && action.targetTile) {
      handleDrinkPotionUse(source, item, useData, { tile: action.targetTile });
      return true;
    }
    return false;
  }

  if (action.type === PLAYER_ACTION_TYPE.npcGreeting) {
    const npc = npcsByUid.get(action.npcUid) ?? null;
    return sayGreetingToNpc(npc, playerState);
  }

  return false;
};

const getPlayerActionApproachPath = (actionTarget) => {
  const playerTile = getTilePosition(playerState);
  const targetTile = getTilePosition(actionTarget.target);
  const pathTargetTiles = getPathTraversableAdjacentTiles(targetTile).filter((tile) => {
    return !isTileOccupiedByCreature(tile.row, tile.col) || (tile.col === playerTile.col && tile.row === playerTile.row);
  });
  if (isTilePathTraversable(targetTile.row, targetTile.col) && !isTileOccupiedByCreature(targetTile.row, targetTile.col)) {
    pathTargetTiles.push(targetTile);
  }

  const path = findPathToAnyTarget(playerTile, pathTargetTiles, true, PLAYER_AUTO_WALK_MAX_PATH_COST);
  const worldMap = getCurrentWorldMap();
  const actionTileIndex = path.findIndex((tile) => {
    if (!isTileWithinPlayerActionRange(tile, targetTile, actionTarget.range, actionTarget.distanceType)) {
      return false;
    }
    return !actionTarget.requireLineOfSight || hasLineOfSightBetweenTiles(worldMap, tile, targetTile);
  });
  return actionTileIndex === -1 ? [] : path.slice(0, actionTileIndex + 1);
};

const refreshPlayerActionNavigationPath = (now) => {
  const action = playerNavigationState.pendingAction;
  const actionTarget = resolvePlayerActionNavigationTarget(action);
  if (!actionTarget) {
    stopPlayerNavigation();
    return false;
  }
  if (actionTarget.isReady) {
    return schedulePlayerPendingActionExecution(now);
  }

  const targetTile = getTilePosition(actionTarget.target);
  const targetTileKey = `${actionTarget.target.z}:${targetTile.col}:${targetTile.row}`;
  const path = getPlayerActionApproachPath(actionTarget);
  if (path.length === 0) {
    const failureKey = `action:${action.type}:${targetTileKey}`;
    stopPlayerNavigation();
    showPlayerNavigationFailure(failureKey);
    return false;
  }

  playerNavigationState.lastActionTargetTileKey = targetTileKey;
  playerNavigationState.destinationTile = { ...path[path.length - 1] };
  playerNavigationState.nextPathRefreshAt = now + PLAYER_ACTION_PATH_REFRESH_COOLDOWN_MS;
  playerNavigationState.lastFailureKey = null;
  return setPlayerNavigationPath(path);
};

const schedulePlayerPendingActionExecution = (now) => {
  const movementEndTime = playerState.moveStartTime + playerState.moveDuration;
  playerNavigationState.path = [];
  playerNavigationState.destinationTile = null;
  playerNavigationState.actionExecuteAt = Math.max(now, movementEndTime) + PLAYER_ACTION_EXECUTION_DELAY_MS;
  return true;
};

const startPlayerActionNavigation = (action) => {
  if (!action || !Object.values(PLAYER_ACTION_TYPE).includes(action.type)) {
    return false;
  }
  playerNavigationState.mode = PLAYER_NAVIGATION_MODE.action;
  playerNavigationState.path = [];
  playerNavigationState.destinationTile = null;
  playerNavigationState.pendingAction = action;
  playerNavigationState.actionExecuteAt = 0;
  playerNavigationState.nextPathRefreshAt = 0;
  playerNavigationState.lastFollowTargetTileKey = null;
  playerNavigationState.lastActionTargetTileKey = null;
  playerNavigationState.lastFailureKey = null;
  return refreshPlayerActionNavigationPath(Date.now());
};

const updatePlayerActionNavigation = (now) => {
  if (playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.action || !playerNavigationState.pendingAction) {
    return;
  }
  const actionTarget = resolvePlayerActionNavigationTarget(playerNavigationState.pendingAction);
  if (!actionTarget) {
    stopPlayerNavigation();
    return;
  }
  if (actionTarget.isReady) {
    if (playerNavigationState.actionExecuteAt === 0) {
      schedulePlayerPendingActionExecution(now);
      return;
    }
    if (now < playerNavigationState.actionExecuteAt) {
      return;
    }
    const action = playerNavigationState.pendingAction;
    stopPlayerNavigation();
    executePlayerPendingAction(action);
    return;
  }

  playerNavigationState.actionExecuteAt = 0;
  const targetTile = getTilePosition(actionTarget.target);
  const targetTileKey = `${actionTarget.target.z}:${targetTile.col}:${targetTile.row}`;
  const targetMoved = targetTileKey !== playerNavigationState.lastActionTargetTileKey;
  if (playerNavigationState.path.length === 0 || (targetMoved && now >= playerNavigationState.nextPathRefreshAt)) {
    refreshPlayerActionNavigationPath(now);
  }
};

const getPlayerNavigationMovement = (now) => {
  const nextTile = playerNavigationState.path[0];
  if (!nextTile) {
    return null;
  }

  const playerTile = getTilePosition(playerState);
  const deltaCol = nextTile.col - playerTile.col;
  const deltaRow = nextTile.row - playerTile.row;

  if (Math.abs(deltaCol) > 1 || Math.abs(deltaRow) > 1 || (deltaCol === 0 && deltaRow === 0)) {
    handleBlockedPlayerNavigationStep(now);
    return null;
  }

  return {
    deltaCol,
    deltaRow,
    direction: getCardinalDirectionFromTileDelta(deltaCol, deltaRow, playerState.direction),
  };
};

const completePlayerNavigationStep = () => {
  playerNavigationState.path.shift();

  if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.click && playerNavigationState.path.length === 0) {
    stopPlayerNavigation();
  }
};

const handleBlockedPlayerNavigationStep = (now) => {
  playerNavigationState.path = [];

  if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.click) {
    refreshPlayerClickNavigationPath();
  } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
    playerNavigationState.nextPathRefreshAt = 0;
    updatePlayerFollowNavigation(now, true);
  } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.action) {
    refreshPlayerActionNavigationPath(now);
  }
};
//#endregion  -----  PATHFINDING A*  -----

/* ==================================================== */
//#region     -----  NPCS  -----
/* ==================================================== */
/* ---------- NPCS - DONNEES ET CREATION ---------- */

const getNpcData = (npcId) => {
  return npcsDatabase[npcId] ?? null;
};

const getNpcTextureUrlsById = () => {
  const textureUrlsById = {};
  for (const npcData of Object.values(npcsDatabase)) {
    textureUrlsById[npcData.npcId] = npcData.textureUrl;
  }
  return textureUrlsById;
};

const getNpcTileKey = (x, y, z) => {
  return getWorldTileStackKey(x, y, z);
};

const createNpcFromWorldObject = (worldNpcObject) => {
  const npcId = worldNpcObject?.properties?.npcId;
  const npcData = getNpcData(npcId);
  if (!npcData || !Number.isInteger(worldNpcObject?.col) || !Number.isInteger(worldNpcObject?.row)) {
    return null;
  }

  const x = worldNpcObject.col * TILE_SIZE;
  const y = worldNpcObject.row * TILE_SIZE;
  return {
    uid: `npc:${worldNpcObject.z}:${worldNpcObject.tiledObjectId}:${npcId}`,
    npcId,
    name: npcData.name,
    x,
    y,
    z: worldNpcObject.z,
    spawnX: x,
    spawnY: y,
    oldX: x,
    oldY: y,
    renderX: x,
    renderY: y,
    moveStartTime: 0,
    moveDuration: 0,
    nextWanderAt: Date.now() + getRandomInt(npcData.movement.intervalMinMs, npcData.movement.intervalMaxMs),
    hp: npcData.maxHp,
    direction: npcData.direction,
    walkFrame: 1,
  };
};

const createNpcConversationState = () => {
  return {
    activePlayerUid: null,
    waitingPlayerUids: [],
    queuedReplies: [],
    pendingAction: null,
    activeMenu: null,
    nextReplyAt: 0,
    lastInteractionAt: 0,
  };
};

const addNpcToState = (npc) => {
  const tileKey = getNpcTileKey(npc?.x, npc?.y, npc?.z);
  if (!npc || typeof npc.uid !== "string" || !tileKey || npcsByUid.has(npc.uid) || npcUidByTileKey.has(tileKey)) {
    return false;
  }
  npcsByUid.set(npc.uid, npc);
  npcUidByTileKey.set(tileKey, npc.uid);
  npcConversationStatesByUid.set(npc.uid, createNpcConversationState());
  return true;
};

const initializeNpcsForWorldMaps = (worldMapsByZ) => {
  if (!(worldMapsByZ instanceof Map)) {
    return false;
  }

  for (const worldMap of worldMapsByZ.values()) {
    for (const chunk of worldMap.chunksByKey.values()) {
      if (!Array.isArray(chunk.npcs)) {
        continue;
      }
      for (const worldNpcObject of chunk.npcs) {
        const npc = createNpcFromWorldObject(worldNpcObject);
        if (npc) {
          addNpcToState(npc);
        }
      }
    }
  }
  return true;
};

const findNpcAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  const tileKey = getNpcTileKey(x, y, z);
  const npcUid = tileKey ? npcUidByTileKey.get(tileKey) : null;
  return npcUid ? (npcsByUid.get(npcUid) ?? null) : null;
};

const isNpcAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  return findNpcAtPosition(x, y, z) !== null;
};

const findNpcAtClientPosition = (clientX, clientY) => {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  let frontNpc = null;
  let frontNpcSortY = Number.NEGATIVE_INFINITY;
  for (const [npcUid, refs] of npcElementsByUid.entries()) {
    const npc = npcsByUid.get(npcUid);
    const rootElement = refs?.root;
    if (!npc || npc.z !== playerState.z || !rootElement) {
      continue;
    }
    const bounds = rootElement.getBoundingClientRect();
    const isInsideBounds =
      clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
    if (!isInsideBounds) {
      continue;
    }
    const npcSortY = getEntityRenderSortY(npc);
    if (npcSortY >= frontNpcSortY) {
      frontNpc = npc;
      frontNpcSortY = npcSortY;
    }
  }
  return frontNpc;
};

/* ---------- NPCS - RENDU ---------- */

const updateNpcSprite = (npc) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData) {
    return false;
  }

  const directionRow = getDirectionRow(npc.direction);
  const surfaceOffsetY = getEntitySurfaceOffsetY(npc);
  return upsertPixiNpcVisual({
    uid: npc.uid,
    npcId: npc.npcId,
    sourceX: npc.walkFrame * PLAYER_FRAME_WIDTH,
    sourceY: directionRow * PLAYER_FRAME_HEIGHT,
    sourceWidth: PLAYER_FRAME_WIDTH,
    sourceHeight: PLAYER_FRAME_HEIGHT,
    width: npcData.drawWidth,
    height: npcData.drawHeight,
    x: npc.renderX,
    y: npc.renderY - TILE_SIZE - surfaceOffsetY,
    zIndex: getWorldRenderZIndex(getEntityRenderSortY(npc), WORLD_RENDER_LAYER_CREATURE),
  });
};

const isNpcInsideVisibleChunkRange = (npc) => {
  if (!npc || npc.z !== pixiWorldRenderState.currentZ) {
    return false;
  }
  const playerChunk = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  const npcChunk = getChunkPositionFromWorldPosition(npc.x, npc.y);
  if (!playerChunk || !npcChunk) {
    return false;
  }
  return (
    Math.abs(npcChunk.chunkX - playerChunk.chunkX) <= pixiWorldRenderState.visibleRadiusChunks &&
    Math.abs(npcChunk.chunkY - playerChunk.chunkY) <= pixiWorldRenderState.visibleRadiusChunks
  );
};

const renderNpc = (npc) => {
  if (!isNpcInsideVisibleChunkRange(npc) || npcElementsByUid.has(npc.uid)) {
    return;
  }

  if (updateEntityRenderPosition(npc, Date.now())) {
    npc.walkFrame = 1;
  }

  const npcData = getNpcData(npc.npcId);
  if (!npcData) {
    return;
  }

  const rootElement = document.createElement("div");
  rootElement.classList.add("npc");
  rootElement.style.width = `${npcData.drawWidth}px`;
  rootElement.style.height = `${npcData.drawHeight}px`;
  const nameElement = document.createElement("div");
  nameElement.classList.add("npc-name");
  nameElement.textContent = npcData.name;
  const hpContainerElement = document.createElement("div");
  hpContainerElement.classList.add("hp-bar");
  const hpElement = document.createElement("div");
  hpElement.classList.add("hp-red");
  hpElement.style.width = `${(npc.hp / npcData.maxHp) * 100}%`;
  hpElement.style.setProperty("--hp-color", getHpColor(npc.hp, npcData.maxHp));
  hpContainerElement.appendChild(hpElement);
  rootElement.append(nameElement, hpContainerElement);
  game.appendChild(rootElement);
  npcElementsByUid.set(npc.uid, { root: rootElement, name: nameElement, hp: hpElement });
  updateNpcSprite(npc);
};

const removeNpcRender = (npcUid) => {
  const refs = npcElementsByUid.get(npcUid);
  refs?.root?.remove();
  npcElementsByUid.delete(npcUid);
  removePixiNpcVisual(npcUid);
};

const syncVisibleNpcRendersAroundPlayer = () => {
  const visibleNpcUids = new Set();
  for (const npc of npcsByUid.values()) {
    if (isNpcInsideVisibleChunkRange(npc)) {
      visibleNpcUids.add(npc.uid);
      renderNpc(npc);
    }
  }
  for (const npcUid of npcElementsByUid.keys()) {
    if (!visibleNpcUids.has(npcUid)) {
      removeNpcRender(npcUid);
    }
  }
};

const updateNpcPosition = () => {
  for (const [npcUid, refs] of npcElementsByUid.entries()) {
    const npc = npcsByUid.get(npcUid);
    if (!npc) {
      removeNpcRender(npcUid);
      continue;
    }
    const surfaceOffsetY = getEntitySurfaceOffsetY(npc);
    const renderY = npc.renderY - TILE_SIZE - surfaceOffsetY;
    const zIndex = getWorldRenderZIndex(getEntityRenderSortY(npc), WORLD_RENDER_LAYER_CREATURE);
    updatePixiNpcTransform(npc.uid, npc.renderX, renderY, zIndex);
    refs.root.style.left = `${npc.renderX - camera.x}px`;
    refs.root.style.top = `${renderY - camera.y}px`;
    refs.root.style.zIndex = zIndex;
  }
};

const updateNpcDirectionToPlayer = (npc) => {
  const npcTile = getTilePosition(npc);
  const playerTile = getTilePosition(playerState);
  npc.direction = getCardinalDirectionFromTileDelta(
    playerTile.col - npcTile.col,
    playerTile.row - npcTile.row,
    npc.direction,
  );
  updateNpcSprite(npc);
};

/* ---------- NPCS - MOUVEMENT ---------- */

const moveNpcInTileIndex = (npc, nextX, nextY) => {
  const currentTileKey = getNpcTileKey(npc?.x, npc?.y, npc?.z);
  const nextTileKey = getNpcTileKey(nextX, nextY, npc?.z);
  if (!currentTileKey || !nextTileKey || (npcUidByTileKey.has(nextTileKey) && nextTileKey !== currentTileKey)) {
    return false;
  }

  if (npcUidByTileKey.get(currentTileKey) === npc.uid) {
    npcUidByTileKey.delete(currentTileKey);
  }
  npcUidByTileKey.set(nextTileKey, npc.uid);
  return true;
};

const getRandomNpcWanderTile = (npc) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData?.movement?.enabled) {
    return null;
  }

  const npcTile = getTilePosition(npc);
  const spawnCol = npc.spawnX / TILE_SIZE;
  const spawnRow = npc.spawnY / TILE_SIZE;
  const possibleTiles = getNeighbors(npcTile).filter((tile) => {
    const isCardinalStep = getTileMovementCost(npcTile, tile) === 1;
    const isInsideRoamRange =
      Math.abs(tile.col - spawnCol) <= npcData.movement.roamRadiusTiles &&
      Math.abs(tile.row - spawnRow) <= npcData.movement.roamRadiusTiles;
    return isCardinalStep && isInsideRoamRange && isWalkableTile(tile.row, tile.col, npcTile);
  });

  if (possibleTiles.length === 0) {
    return null;
  }
  return possibleTiles[getRandomInt(0, possibleTiles.length - 1)];
};

const moveNpcToTile = (npc, tile, now) => {
  const npcData = getNpcData(npc?.npcId);
  if (!npcData?.movement || !tile || !Number.isFinite(now)) {
    return false;
  }

  const npcTile = getTilePosition(npc);
  if (!isWalkableTile(tile.row, tile.col, npcTile)) {
    return false;
  }

  const { tileX, tileY } = getWorldPosition(tile);
  if (!moveNpcInTileIndex(npc, tileX, tileY)) {
    return false;
  }

  npc.direction = getCardinalDirectionFromTileDelta(tile.col - npcTile.col, tile.row - npcTile.row, npc.direction);
  npc.walkFrame = (npc.walkFrame + 1) % npcData.animationFrames;
  npc.oldX = npc.x;
  npc.oldY = npc.y;
  npc.moveStartTime = now;
  npc.moveDuration = npcData.movement.moveCooldownMs;
  npc.x = tileX;
  npc.y = tileY;
  updateNpcSprite(npc);
  return true;
};

const updateNpcMovement = (now) => {
  for (const npc of npcsByUid.values()) {
    const npcData = getNpcData(npc.npcId);
    const conversationState = npcConversationStatesByUid.get(npc.uid);
    if (
      npc.z !== playerState.z ||
      !npcData?.movement?.enabled ||
      conversationState?.activePlayerUid !== null ||
      now < npc.nextWanderAt
    ) {
      continue;
    }

    npc.nextWanderAt =
      now + getRandomInt(npcData.movement.intervalMinMs, npcData.movement.intervalMaxMs);
    const nextTile = getRandomNpcWanderTile(npc);
    if (nextTile) {
      moveNpcToTile(npc, nextTile, now);
    }
  }
};

/* ---------- NPCS - CONVERSATIONS ---------- */

const getPlayerEntityByUid = (playerUid) => {
  return playerState.uid === playerUid ? playerState : null;
};

const isPlayerWithinNpcTalkRange = (player, npc) => {
  if (!player || !npc || player.z !== npc.z) {
    return false;
  }
  const distanceCol = Math.abs(player.x - npc.x) / TILE_SIZE;
  const distanceRow = Math.abs(player.y - npc.y) / TILE_SIZE;
  return distanceCol + distanceRow <= NPC_DIALOGUE_CONFIG.talkRange;
};

const sayGreetingToNpc = (npc, player, now = Date.now()) => {
  if (!npc || !player || !isPlayerWithinNpcTalkRange(player, npc)) {
    return false;
  }
  const greeting = getCurrentGameLanguage() === "fr" ? "Salut" : "Hi";
  const message = addChatMessage("local", "player", greeting, player);
  if (!message) {
    return false;
  }
  showFloatingTextAboveTarget(greeting, 70, player, "speech", 4000);
  if (activeChatChannelId === "local") {
    renderActiveChatMessages();
  }
  startNpcConversation(npc, player, now);
  return true;
};

const handleNpcGreetingFromPointerTarget = (target) => {
  const npc = target?.npc;
  if (!npc) {
    return false;
  }
  if (isPlayerWithinNpcTalkRange(playerState, npc)) {
    sayGreetingToNpc(npc, playerState);
  } else if (npc.z === playerState.z) {
    startPlayerActionNavigation({
      type: PLAYER_ACTION_TYPE.npcGreeting,
      npcUid: npc.uid,
    });
  }
  return true;
};

const normalizeNpcSpeechText = (text) => {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
};

const getNpcSpeechWords = (text) => {
  return new Set(normalizeNpcSpeechText(text).match(/[\p{L}]+/gu) ?? []);
};

const areNpcSpeechWordsEquivalent = (speechWord, keywordWord) => {
  return speechWord === keywordWord || speechWord === `${keywordWord}s` || keywordWord === `${speechWord}s`;
};

const hasNpcSpeechKeyword = (speechWords, keywords) => {
  if (!(speechWords instanceof Set) || !Array.isArray(keywords)) {
    return false;
  }
  return keywords.some((keyword) => {
    const keywordWords = getNpcSpeechWords(keyword);
    return (
      keywordWords.size > 0 &&
      [...keywordWords].every((keywordWord) =>
        [...speechWords].some((speechWord) => areNpcSpeechWordsEquivalent(speechWord, keywordWord)),
      )
    );
  });
};

const getNpcDialogueData = (npcData) => {
  const language = getCurrentGameLanguage();
  return npcData?.dialogue?.[language] ?? npcData?.dialogue?.en ?? null;
};

const formatNpcDialogueText = (text, player, replacements = {}) => {
  let formattedText = text.replaceAll("{playerName}", player.name);
  for (const [placeholder, value] of Object.entries(replacements)) {
    formattedText = formattedText.replaceAll(`{${placeholder}}`, String(value));
  }
  return formattedText;
};

const getNpcReplySuggestions = (suggestions) => {
  if (!Array.isArray(suggestions)) {
    return [];
  }
  return [
    ...new Set(
      suggestions.filter((suggestion) => typeof suggestion === "string").map((suggestion) => suggestion.trim()),
    ),
  ].filter(Boolean);
};

const queueNpcReply = (
  npc,
  player,
  text,
  now,
  endConversation = false,
  replacements = {},
  suggestions = [],
) => {
  const state = npcConversationStatesByUid.get(npc?.uid);
  if (!state || !player || typeof text !== "string" || state.queuedReplies.length >= NPC_DIALOGUE_CONFIG.maxQueuedReplies) {
    return false;
  }
  state.queuedReplies.push({
    playerUid: player.uid,
    text: formatNpcDialogueText(text, player, replacements),
    endConversation,
    suggestions: getNpcReplySuggestions(suggestions),
  });
  if (state.nextReplyAt === 0) {
    state.nextReplyAt = now + NPC_DIALOGUE_CONFIG.responseDelayMs;
  }
  return true;
};

const showNpcSpeech = (npc, text, suggestions = []) => {
  if (npc.z === playerState.z) {
    showFloatingTextAboveTarget(text, 70, npc, "speech", 4000);
  }
  addChatMessage("local", "npc", text, npc, suggestions);
  if (activeChatChannelId === "local") {
    renderActiveChatMessages();
  }
};

const promoteNextNpcConversation = (npc, state, now) => {
  while (state.waitingPlayerUids.length > 0) {
    const playerUid = state.waitingPlayerUids.shift();
    const player = getPlayerEntityByUid(playerUid);
    if (!isPlayerWithinNpcTalkRange(player, npc)) {
      continue;
    }
    state.activePlayerUid = playerUid;
    state.activeMenu = null;
    state.lastInteractionAt = now;
    const npcData = getNpcData(npc.npcId);
    const dialogue = getNpcDialogueData(npcData);
    queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
    return true;
  }
  return false;
};

const releaseNpcConversation = (npc, state, now, reason = "farewell") => {
  const player = getPlayerEntityByUid(state.activePlayerUid);
  const npcData = getNpcData(npc?.npcId);
  const dialogue = getNpcDialogueData(npcData);
  if (player && dialogue && reason === "outOfRange") {
    showNpcSpeech(npc, formatNpcDialogueText(dialogue.rudeDeparture, player));
  } else if (player && dialogue && reason === "timeout") {
    showNpcSpeech(npc, formatNpcDialogueText(dialogue.timeoutFarewell, player));
  }

  state.activePlayerUid = null;
  state.queuedReplies.length = 0;
  state.pendingAction = null;
  state.activeMenu = null;
  state.nextReplyAt = 0;
  state.lastInteractionAt = 0;
  promoteNextNpcConversation(npc, state, now);
};

const startNpcConversation = (npc, player, now) => {
  const state = npcConversationStatesByUid.get(npc.uid);
  const npcData = getNpcData(npc.npcId);
  const dialogue = getNpcDialogueData(npcData);
  if (!state || !npcData || !dialogue) {
    return false;
  }
  if (state.activePlayerUid !== null && state.activePlayerUid !== player.uid) {
    if (!state.waitingPlayerUids.includes(player.uid)) {
      state.waitingPlayerUids.push(player.uid);
    }
    const queuePosition = state.waitingPlayerUids.indexOf(player.uid) + 1;
    showGameStatusMessage(getGameUiText("npcQueue")(npcData.name, queuePosition));
    return false;
  }
  state.activePlayerUid = player.uid;
  state.activeMenu = null;
  state.lastInteractionAt = now;
  updateNpcDirectionToPlayer(npc);
  return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
};

const findNpcTalkingToPlayer = (player) => {
  for (const npc of npcsByUid.values()) {
    const state = npcConversationStatesByUid.get(npc.uid);
    if (state?.activePlayerUid === player.uid && isPlayerWithinNpcTalkRange(player, npc)) {
      return npc;
    }
  }
  return null;
};

const findNearestNpcInTalkRange = (player) => {
  let nearestNpc = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const npc of npcsByUid.values()) {
    if (!isPlayerWithinNpcTalkRange(player, npc)) {
      continue;
    }
    const distance = (Math.abs(player.x - npc.x) + Math.abs(player.y - npc.y)) / TILE_SIZE;
    if (distance < nearestDistance) {
      nearestNpc = npc;
      nearestDistance = distance;
    }
  }
  return nearestNpc;
};

const getNpcTradeQuantity = (text) => {
  const quantityMatch = typeof text === "string" ? text.match(/\b(\d{1,3})\b/) : null;
  return quantityMatch ? clamp(Number(quantityMatch[1]), 1, MAX_ITEM_STACK_SIZE) : 1;
};

const findNpcShopOffer = (npcData, speechWords) => {
  const offers = npcData?.service?.offers;
  if (!offers || !(speechWords instanceof Set)) {
    return null;
  }
  for (const [itemId, offer] of Object.entries(offers)) {
    if (offer.keywords?.some((keyword) => hasNpcSpeechKeyword(speechWords, [keyword]))) {
      return { itemId, ...offer };
    }
  }
  return null;
};

const getNpcMenuNavigationSuggestions = () => {
  return getCurrentGameLanguage() === "fr" ? ["Retour", "Bye"] : ["Back", "Bye"];
};

const getNpcShopMenuSuggestions = (npcData, tradeType) => {
  const priceKey = tradeType === "sell" ? "sellPrice" : "buyPrice";
  const itemSuggestions = Object.entries(npcData?.service?.offers ?? [])
    .filter(([, offer]) => Number.isInteger(offer?.[priceKey]) && offer[priceKey] > 0)
    .map(([itemId]) => getLocalizedItemName(itemId));
  return [...itemSuggestions, ...getNpcMenuNavigationSuggestions()];
};

const getNpcSpellMenuSuggestions = (npcData) => {
  const spellSuggestions = (npcData?.service?.spellIds ?? [])
    .map((spellId) => getLocalizedSpellData(spellId)?.name)
    .filter(Boolean);
  return [...spellSuggestions, ...getNpcMenuNavigationSuggestions()];
};

const buyItemFromNpc = (npc, player, npcData, dialogue, offer, quantity, now) => {
  if (!Number.isInteger(offer?.buyPrice) || offer.buyPrice <= 0) {
    return queueNpcReply(npc, player, dialogue.unavailable, now);
  }
  const totalPrice = offer.buyPrice * quantity;
  if (getPlayerGoldAmount() < totalPrice) {
    return queueNpcReply(npc, player, dialogue.notEnoughGold, now);
  }

  const paymentPlan = createPlayerBackpackItemRemovalPlan("goldCoin", totalPrice);
  if (!paymentPlan.success || !commitPlayerBackpackItemRemovalPlan(paymentPlan)) {
    return queueNpcReply(npc, player, dialogue.notEnoughGold, now);
  }
  const grantResult = grantRewardItemsToPlayer([{ itemId: offer.itemId, quantity }]);
  if (!grantResult.success) {
    rollbackPlayerBackpackItemRemovalPlan(paymentPlan);
    return queueNpcReply(npc, player, dialogue.noRoom, now);
  }

  refreshInventoryUi();
  autosaveCurrentCharacter();
  return queueNpcReply(
    npc,
    player,
    dialogue.bought,
    now,
    false,
    {
      quantity,
      itemName: getLocalizedItemName(offer.itemId, quantity),
      price: totalPrice,
    },
    getNpcShopMenuSuggestions(npcData, "buy"),
  );
};

const sellItemToNpc = (npc, player, npcData, dialogue, offer, quantity, now) => {
  if (!Number.isInteger(offer?.sellPrice) || offer.sellPrice <= 0) {
    return queueNpcReply(npc, player, dialogue.unavailable, now);
  }
  const itemRemovalPlan = createPlayerBackpackItemRemovalPlan(offer.itemId, quantity);
  if (!itemRemovalPlan.success || !commitPlayerBackpackItemRemovalPlan(itemRemovalPlan)) {
    return queueNpcReply(npc, player, dialogue.missingItem, now);
  }

  const totalPrice = offer.sellPrice * quantity;
  const grantResult = grantRewardItemsToPlayer([{ itemId: "goldCoin", quantity: totalPrice }]);
  if (!grantResult.success) {
    rollbackPlayerBackpackItemRemovalPlan(itemRemovalPlan);
    return queueNpcReply(npc, player, dialogue.noRoom, now);
  }

  refreshInventoryUi();
  autosaveCurrentCharacter();
  return queueNpcReply(
    npc,
    player,
    dialogue.sold,
    now,
    false,
    {
      quantity,
      itemName: getLocalizedItemName(offer.itemId, quantity),
      price: totalPrice,
    },
    getNpcShopMenuSuggestions(npcData, "sell"),
  );
};

const setNpcItemTradePendingAction = (npc, player, dialogue, offer, quantity, tradeType, now) => {
  const state = npcConversationStatesByUid.get(npc?.uid);
  const unitPrice = tradeType === "buyItem" ? offer?.buyPrice : offer?.sellPrice;
  if (!state || !Number.isInteger(unitPrice) || unitPrice <= 0) {
    return queueNpcReply(npc, player, dialogue.unavailable, now);
  }

  const totalPrice = unitPrice * quantity;
  state.pendingAction = {
    type: tradeType,
    itemId: offer.itemId,
    quantity,
  };
  state.activeMenu = tradeType === "sellItem" ? "sell" : "buy";
  const confirmationText = tradeType === "buyItem" ? dialogue.confirmBuy : dialogue.confirmSell;
  return queueNpcReply(
    npc,
    player,
    confirmationText,
    now,
    false,
    {
      quantity,
      itemName: getLocalizedItemName(offer.itemId, quantity),
      price: totalPrice,
    },
    dialogue.confirmationSuggestions,
  );
};

const handleNpcItemShopSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
  const wantsTrade = hasNpcSpeechKeyword(speechWords, ["trade", "shop", "offer", "offers", "offres", "magasin"]);
  const wantsBuy = hasNpcSpeechKeyword(speechWords, ["buy", "purchase", "achat", "acheter", "achete"]);
  const wantsSell = hasNpcSpeechKeyword(speechWords, ["sell", "sale", "vente", "vendre", "vends"]);
  const offer = findNpcShopOffer(npcData, speechWords);
  const state = npcConversationStatesByUid.get(npc.uid);
  if (wantsBuy && !offer) {
    state.activeMenu = "buy";
    return queueNpcReply(npc, player, dialogue.buyMenu, now, false, {}, getNpcShopMenuSuggestions(npcData, "buy"));
  }
  if (wantsSell && !offer) {
    state.activeMenu = "sell";
    return queueNpcReply(npc, player, dialogue.sellMenu, now, false, {}, getNpcShopMenuSuggestions(npcData, "sell"));
  }
  if (wantsTrade && !wantsBuy && !wantsSell && !offer) {
    return queueNpcReply(npc, player, dialogue.trade, now, false, {}, dialogue.greetingSuggestions);
  }
  if (!offer) {
    return wantsBuy || wantsSell ? queueNpcReply(npc, player, dialogue.unavailable, now) : false;
  }
  const quantity = getNpcTradeQuantity(text);
  if (wantsSell || (!wantsBuy && state.activeMenu === "sell")) {
    return setNpcItemTradePendingAction(npc, player, dialogue, offer, quantity, "sellItem", now);
  }
  return setNpcItemTradePendingAction(npc, player, dialogue, offer, quantity, "buyItem", now);
};

const findNpcTeacherSpell = (npcData, text) => {
  const speechWords = getNpcSpeechWords(text);
  for (const spellId of npcData?.service?.spellIds ?? []) {
    const spellData = spellsDatabase[spellId];
    const aliases = [spellData?.name, spellData?.nameFr, ...(spellData?.learningKeywords ?? [])].filter(Boolean);
    if (aliases.some((alias) => hasNpcSpeechKeyword(speechWords, [alias]))) {
      return spellData;
    }
  }
  return null;
};

const learnPlayerSpell = (spellId) => {
  if (!(spellId in spellsDatabase) || isPlayerSpellLearned(spellId)) {
    return false;
  }
  playerState.spellbook.learnedSpellIds.push(spellId);
  const emptyHotkeyIndex = playerState.spellbook.hotkeySpellIds.indexOf(null);
  if (emptyHotkeyIndex !== -1) {
    playerState.spellbook.hotkeySpellIds[emptyHotkeyIndex] = spellId;
  }
  autosaveCurrentCharacter();
  renderSpellWindow();
  return true;
};

const learnSpellFromNpc = (npc, player, npcData, dialogue, spellData, now) => {
  if (!spellData || isPlayerSpellLearned(spellData.spellId)) {
    return queueNpcReply(npc, player, dialogue.alreadyLearned, now);
  }
  if (getPlayerGoldAmount() < spellData.learnPrice) {
    return queueNpcReply(npc, player, dialogue.notEnoughGold, now, false, { price: spellData.learnPrice });
  }
  if (!spendPlayerGold(spellData.learnPrice) || !learnPlayerSpell(spellData.spellId)) {
    return queueNpcReply(npc, player, dialogue.unavailable, now);
  }

  refreshInventoryUi();
  return queueNpcReply(
    npc,
    player,
    dialogue.learned,
    now,
    false,
    {
      spellName: getLocalizedSpellData(spellData.spellId).name.toLocaleLowerCase(),
      incantation: spellData.incantation,
    },
    getNpcSpellMenuSuggestions(npcData),
  );
};

const handleNpcSpellTeacherSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
  const asksAboutSpells = hasNpcSpeechKeyword(speechWords, ["spell", "spells", "sort", "sorts", "magic", "magie"]);
  const spellData = findNpcTeacherSpell(npcData, text);
  if (!spellData) {
    if (!asksAboutSpells) {
      return false;
    }
    const state = npcConversationStatesByUid.get(npc.uid);
    state.activeMenu = "spells";
    return queueNpcReply(npc, player, dialogue.spells, now, false, {}, getNpcSpellMenuSuggestions(npcData));
  }
  if (isPlayerSpellLearned(spellData.spellId)) {
    return queueNpcReply(npc, player, dialogue.alreadyLearned, now);
  }

  const state = npcConversationStatesByUid.get(npc.uid);
  state.activeMenu = "spells";
  state.pendingAction = {
    type: "learnSpell",
    spellId: spellData.spellId,
  };
  return queueNpcReply(
    npc,
    player,
    dialogue.confirmLearn,
    now,
    false,
    {
      spellName: getLocalizedSpellData(spellData.spellId).name.toLocaleLowerCase(),
      price: spellData.learnPrice,
    },
    dialogue.confirmationSuggestions,
  );
};

const isNpcConfirmationSpeech = (speechWords) => {
  return (
    hasNpcSpeechKeyword(speechWords, [
      "yes",
      "yeah",
      "yep",
      "yup",
      "sure",
      "okay",
      "ok",
      "oui",
      "ouais",
      "parfait",
      "absolument",
      "certainement",
      "daccord",
      "certain",
    ]) ||
    (speechWords.has("bien") && speechWords.has("sur")) ||
    (speechWords.has("bien") && speechWords.has("entendu")) ||
    (speechWords.has("d") && speechWords.has("accord")) ||
    (speechWords.has("of") && speechWords.has("course"))
  );
};

const isNpcRejectionSpeech = (speechWords) => {
  return hasNpcSpeechKeyword(speechWords, ["no", "nope", "nah", "cancel", "non", "annule", "annuler"]);
};

const executeNpcPendingAction = (npc, player, npcData, dialogue, state, now) => {
  const pendingAction = state.pendingAction;
  state.pendingAction = null;
  if (!pendingAction) {
    return false;
  }

  if (pendingAction.type === "buyItem" || pendingAction.type === "sellItem") {
    const offerData = npcData.service?.offers?.[pendingAction.itemId];
    const offer = offerData ? { itemId: pendingAction.itemId, ...offerData } : null;
    if (!offer) {
      return queueNpcReply(npc, player, dialogue.unavailable, now);
    }
    if (pendingAction.type === "buyItem") {
      return buyItemFromNpc(npc, player, npcData, dialogue, offer, pendingAction.quantity, now);
    }
    return sellItemToNpc(npc, player, npcData, dialogue, offer, pendingAction.quantity, now);
  }

  if (pendingAction.type === "learnSpell") {
    const spellData = spellsDatabase[pendingAction.spellId];
    return learnSpellFromNpc(npc, player, npcData, dialogue, spellData, now);
  }
  return false;
};

const handleNpcPendingActionSpeech = (npc, player, npcData, dialogue, state, speechWords, now) => {
  if (!state.pendingAction) {
    return false;
  }
  if (isNpcConfirmationSpeech(speechWords)) {
    return executeNpcPendingAction(npc, player, npcData, dialogue, state, now);
  }
  if (isNpcRejectionSpeech(speechWords)) {
    const pendingAction = state.pendingAction;
    state.pendingAction = null;
    if (pendingAction.type === "buyItem" || pendingAction.type === "sellItem") {
      const tradeType = pendingAction.type === "sellItem" ? "sell" : "buy";
      state.activeMenu = tradeType;
      return queueNpcReply(
        npc,
        player,
        dialogue.cancelled,
        now,
        false,
        {},
        getNpcShopMenuSuggestions(npcData, tradeType),
      );
    }
    if (pendingAction.type === "learnSpell") {
      state.activeMenu = "spells";
      return queueNpcReply(npc, player, dialogue.cancelled, now, false, {}, getNpcSpellMenuSuggestions(npcData));
    }
    return queueNpcReply(npc, player, dialogue.cancelled, now, false, {}, dialogue.greetingSuggestions);
  }
  return queueNpcReply(npc, player, dialogue.confirmRequired, now, false, {}, dialogue.confirmationSuggestions);
};

const handleNpcServiceSpeech = (npc, player, npcData, dialogue, text, speechWords, now) => {
  if (npcData.service?.type === "itemShop") {
    return handleNpcItemShopSpeech(npc, player, npcData, dialogue, text, speechWords, now);
  }
  if (npcData.service?.type === "spellTeacher") {
    return handleNpcSpellTeacherSpeech(npc, player, npcData, dialogue, text, speechWords, now);
  }
  return false;
};

const handleNpcPlayerSpeech = (text, player, now) => {
  const speechWords = getNpcSpeechWords(text);
  const isGreeting = hasNpcSpeechKeyword(speechWords, ["hi", "hello", "hey", "salut", "bonjour", "allo"]);
  let npc = findNpcTalkingToPlayer(player);

  if (!npc && isGreeting) {
    npc = findNearestNpcInTalkRange(player);
    if (npc) {
      return startNpcConversation(npc, player, now);
    }
  }
  if (!npc) {
    return false;
  }

  const state = npcConversationStatesByUid.get(npc.uid);
  const npcData = getNpcData(npc.npcId);
  const dialogue = getNpcDialogueData(npcData);
  if (!state || !npcData || !dialogue) {
    return false;
  }
  state.lastInteractionAt = now;
  updateNpcDirectionToPlayer(npc);

  if (isGreeting) {
    state.activeMenu = null;
    return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
  }
  if (hasNpcSpeechKeyword(speechWords, ["bye", "farewell", "ciao", "revoir"])) {
    return queueNpcReply(npc, player, dialogue.farewell, now, true);
  }
  if (state.pendingAction) {
    return handleNpcPendingActionSpeech(npc, player, npcData, dialogue, state, speechWords, now);
  }
  if (hasNpcSpeechKeyword(speechWords, ["back", "retour"])) {
    state.activeMenu = null;
    return queueNpcReply(npc, player, dialogue.greeting, now, false, {}, dialogue.greetingSuggestions);
  }
  if (hasNpcSpeechKeyword(speechWords, ["name", "nom"])) {
    return queueNpcReply(npc, player, dialogue.name, now);
  }
  if (hasNpcSpeechKeyword(speechWords, ["job", "work", "travail", "metier"])) {
    return queueNpcReply(npc, player, dialogue.job, now);
  }
  if (hasNpcSpeechKeyword(speechWords, ["help", "aide"])) {
    return queueNpcReply(npc, player, dialogue.help, now, false, {}, dialogue.greetingSuggestions);
  }
  if (handleNpcServiceSpeech(npc, player, npcData, dialogue, text, speechWords, now)) {
    return true;
  }
  return queueNpcReply(npc, player, dialogue.unknown, now, false, {}, dialogue.greetingSuggestions);
};

const updateNpcConversations = (now) => {
  for (const [npcUid, state] of npcConversationStatesByUid.entries()) {
    if (state.activePlayerUid === null) {
      continue;
    }
    const npc = npcsByUid.get(npcUid);
    const player = getPlayerEntityByUid(state.activePlayerUid);
    if (!npc) {
      state.activePlayerUid = null;
      state.queuedReplies.length = 0;
      state.pendingAction = null;
      state.nextReplyAt = 0;
      state.lastInteractionAt = 0;
      continue;
    }
    if (!isPlayerWithinNpcTalkRange(player, npc)) {
      const farewellReply = state.queuedReplies.find((reply) => reply.endConversation);
      if (farewellReply) {
        showNpcSpeech(npc, farewellReply.text, farewellReply.suggestions);
        releaseNpcConversation(npc, state, now, "farewell");
      } else {
        releaseNpcConversation(npc, state, now, "outOfRange");
      }
      continue;
    }
    if (
      state.queuedReplies.length === 0 &&
      now - state.lastInteractionAt >= NPC_DIALOGUE_CONFIG.conversationTimeoutMs
    ) {
      releaseNpcConversation(npc, state, now, "timeout");
      continue;
    }
    if (state.queuedReplies.length === 0 || now < state.nextReplyAt) {
      continue;
    }

    const reply = state.queuedReplies.shift();
    showNpcSpeech(npc, reply.text, reply.suggestions);
    state.nextReplyAt = state.queuedReplies.length > 0 ? now + NPC_DIALOGUE_CONFIG.lineIntervalMs : 0;
    if (reply.endConversation) {
      releaseNpcConversation(npc, state, now, "farewell");
    }
  }
};

//#endregion  -----  NPCS  -----

/* ==================================================== */
//#region     -----  MONSTRES  -----
/* ==================================================== */
/* ---------- MONSTRES - CREATION ET AFFICHAGE ---------- */

const monsterHpRefresh = (monster) => {
  const monsterHp = findMonsterHpElement(monster.uid);
  if (monsterHp) {
    const monsterData = getMonsterData(monster.monsterId);
    monsterHp.style.width = `${(monster.hp / monsterData.maxHp) * 100}%`;
    monsterHp.style.setProperty("--hp-color", getHpColor(monster.hp, monsterData.maxHp));
  }
  if (monster?.uid === selectedMonsterUid) {
    syncMobileTargetHud();
  }
};

const createMonster = (monsterId, x, y, z) => {
  const monsterData = getMonsterData(monsterId);
  if (!monsterData) {
    return null;
  }
  const monster = {
    monsterId,
    x,
    y,
    z,
    oldX: x,
    oldY: y,
    renderX: x,
    renderY: y,
    moveStartTime: 0,
    moveDuration: 0,
    hp: monsterData.maxHp,
    uid: nextMonsterUid++,
    nextMoveTime: 0,
    nextAttackTime: 0,
    path: [],
    nextPathRefreshTime: 0,
    direction: "down",
    walkFrame: 1,
    state: MONSTER_AI_STATE.idle,
    isAwake: false,
    targetUid: null,
    roamCenterX: x,
    roamCenterY: y,
    badPathStartedAt: null,
    nextCombatDanceAt: 0,
    nextBlockedChaseMoveAt: 0,
    nextDynamicPathRefreshTime: 0,
    nextAggroCheckAt: 0,
    nextWanderAt: 0,
    wanderStepsRemaining: 0,
  };
  return monster;
};

const renderMonsters = (monstersList) => {
  for (let i = 0; i < monstersList.length; i++) {
    const monster = monstersList[i];
    if (!isMonsterInsideVisibleChunkRange(monster) || monsterElementsByUid.has(monster.uid)) {
      continue;
    }
    if (updateEntityRenderPosition(monster, Date.now())) {
      monster.walkFrame = 1;
    }
    const div = document.createElement("div");
    const monsterData = getMonsterData(monster.monsterId);
    div.classList.add("monster");
    div.style.width = `${monsterData.drawWidth}px`;
    div.style.height = `${monsterData.drawHeight}px`;
    const monsterText = document.createElement("div");
    monsterText.classList.add("monster-floating-text-layer");
    const monsterName = document.createElement("div");
    monsterName.classList.add("monster-name");
    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    monsterName.textContent = localizedMonsterData.name;
    const hpContainer = document.createElement("div");
    hpContainer.classList.add("hp-bar");
    const hpRed = document.createElement("div");
    hpRed.classList.add("hp-red");
    hpRed.style.width = `${(monster.hp / monsterData.maxHp) * 100}%`;
    hpRed.style.setProperty("--hp-color", getHpColor(monster.hp, monsterData.maxHp));
    div.setAttribute("data-monster-uid", monster.uid);
    hpRed.setAttribute("data-monster-uid", monster.uid);
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (shouldBlockContextMenuAction()) {
        return;
      }

      selectMonster(monster);
    });
    const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
    div.style.left = `${monster.x - camera.x + monsterData.drawOffsetX}px`;
    div.style.top = `${monster.y - camera.y + monsterData.drawOffsetY - surfaceOffsetY}px`;
    div.style.zIndex = getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE);
    hpContainer.appendChild(hpRed);
    div.appendChild(monsterText);
    div.appendChild(monsterName);
    div.appendChild(hpContainer);
    monsterElementsByUid.set(monster.uid, {
      root: div,
      hp: hpRed,
      floatingText: monsterText,
    });
    game.appendChild(div);
    updateMonsterSprite(monster);
  }
};

const updateMonsterSprite = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  const col = monsterData.atlasCol + monster.walkFrame;
  const row = monsterData.atlasRow + getDirectionRow(monster.direction);
  const source = getAtlasSource(col, row, monsterData.spriteSize);
  const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
  upsertPixiMonsterVisual({
    uid: monster.uid,
    sourceX: source.sourceX,
    sourceY: source.sourceY,
    sourceWidth: source.sourceWidth,
    sourceHeight: source.sourceHeight,
    width: monsterData.drawWidth,
    height: monsterData.drawHeight,
    x: monster.renderX + monsterData.drawOffsetX,
    y: monster.renderY + monsterData.drawOffsetY - surfaceOffsetY,
    zIndex: getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE),
    selected: monster.uid === selectedMonsterUid,
  });
};

/* ---------- MONSTRES - COLLECTE DES DONNEES ---------- */

const getMonsterData = (monsterId) => {
  if (monstersDatabase[monsterId]) {
    return monstersDatabase[monsterId];
  } else {
    console.error(`monsterId: ${monsterId} n'existe pas dans monstersDatabase`);
    return null;
  }
};

/* ---------- MONSTRES - DETECTION ET DIRECTION ---------- */

const getMonsterTileKey = (x, y, z) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(z)) {
    return null;
  }

  return getWorldTileStackKey(x, y, z);
};

const getMonsterChunkKeyByGridPosition = (chunkX, chunkY, z) => {
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || !Number.isInteger(z)) {
    return null;
  }

  return `${z}:${chunkX}:${chunkY}`;
};

const getMonsterChunkKey = (x, y, z) => {
  if (!Number.isInteger(z)) {
    return null;
  }

  const chunkPosition = getChunkPositionFromWorldPosition(x, y);
  if (!chunkPosition) {
    return null;
  }

  return getMonsterChunkKeyByGridPosition(chunkPosition.chunkX, chunkPosition.chunkY, z);
};

const addMonsterUidToChunkIndex = (monster) => {
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  if (!Number.isInteger(monster?.uid) || !chunkKey) {
    return false;
  }

  let monsterUids = monsterUidsByChunkKey.get(chunkKey);
  if (!monsterUids) {
    monsterUids = new Set();
    monsterUidsByChunkKey.set(chunkKey, monsterUids);
  }

  monsterUids.add(monster.uid);
  return true;
};

const removeMonsterUidFromChunkIndex = (monster) => {
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  if (!Number.isInteger(monster?.uid) || !chunkKey) {
    return false;
  }

  const monsterUids = monsterUidsByChunkKey.get(chunkKey);
  if (!monsterUids || !monsterUids.delete(monster.uid)) {
    return false;
  }

  if (monsterUids.size === 0) {
    monsterUidsByChunkKey.delete(chunkKey);
  }

  return true;
};

const getMonstersInChunkRadius = (x, y, z, radiusChunks) => {
  if (!Number.isInteger(z) || !Number.isInteger(radiusChunks) || radiusChunks < 0) {
    return [];
  }

  const centerChunk = getChunkPositionFromWorldPosition(x, y);
  if (!centerChunk) {
    return [];
  }

  const nearbyMonsters = [];

  for (let chunkY = centerChunk.chunkY - radiusChunks; chunkY <= centerChunk.chunkY + radiusChunks; chunkY++) {
    for (let chunkX = centerChunk.chunkX - radiusChunks; chunkX <= centerChunk.chunkX + radiusChunks; chunkX++) {
      const chunkKey = getMonsterChunkKeyByGridPosition(chunkX, chunkY, z);
      const monsterUids = monsterUidsByChunkKey.get(chunkKey);
      if (!monsterUids) {
        continue;
      }

      for (const monsterUid of monsterUids) {
        const monster = monstersByUid.get(monsterUid);
        if (monster) {
          nearbyMonsters.push(monster);
        }
      }
    }
  }

  return nearbyMonsters;
};

const getActiveMonstersAroundPlayer = () => {
  return getMonstersInChunkRadius(playerState.x, playerState.y, playerState.z, MONSTER_AI_CHUNK_RADIUS);
};

const isMonsterInsideVisibleChunkRange = (monster) => {
  if (!monster || monster.z !== pixiWorldRenderState.currentZ) {
    return false;
  }

  const playerChunk = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  const monsterChunk = getChunkPositionFromWorldPosition(monster.x, monster.y);
  if (!playerChunk || !monsterChunk) {
    return false;
  }

  return (
    Math.abs(monsterChunk.chunkX - playerChunk.chunkX) <= pixiWorldRenderState.visibleRadiusChunks &&
    Math.abs(monsterChunk.chunkY - playerChunk.chunkY) <= pixiWorldRenderState.visibleRadiusChunks
  );
};

const syncMonsterRenderVisibility = (monster) => {
  if (!monster) {
    return;
  }

  if (isMonsterInsideVisibleChunkRange(monster)) {
    renderMonsters([monster]);
    return;
  }

  removeMonsterRender(monster.uid);
};

const syncVisibleMonsterRendersAroundPlayer = () => {
  const visibleMonsters = getMonstersInChunkRadius(
    playerState.x,
    playerState.y,
    pixiWorldRenderState.currentZ,
    pixiWorldRenderState.visibleRadiusChunks,
  );
  const visibleMonsterUids = new Set(visibleMonsters.map((monster) => monster.uid));

  for (const monsterUid of monsterElementsByUid.keys()) {
    if (!visibleMonsterUids.has(monsterUid)) {
      removeMonsterRender(monsterUid);
    }
  }

  renderMonsters(visibleMonsters);
};

const addMonsterToState = (monster) => {
  const tileKey = getMonsterTileKey(monster?.x, monster?.y, monster?.z);
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);

  if (
    !Number.isInteger(monster?.uid) ||
    !tileKey ||
    !chunkKey ||
    monstersByUid.has(monster.uid) ||
    monsterUidByTileKey.has(tileKey)
  ) {
    return false;
  }

  monstersByUid.set(monster.uid, monster);
  monsterUidByTileKey.set(tileKey, monster.uid);
  addMonsterUidToChunkIndex(monster);
  return true;
};

const moveMonsterInTileIndex = (monster, nextX, nextY) => {
  const currentTileKey = getMonsterTileKey(monster?.x, monster?.y, monster?.z);
  const nextTileKey = getMonsterTileKey(nextX, nextY, monster?.z);
  const currentChunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  const nextChunkKey = getMonsterChunkKey(nextX, nextY, monster?.z);

  if (!currentTileKey || !nextTileKey || !currentChunkKey || !nextChunkKey) {
    return false;
  }

  const occupyingMonsterUid = monsterUidByTileKey.get(nextTileKey);
  if (occupyingMonsterUid !== undefined && occupyingMonsterUid !== monster.uid) {
    return false;
  }

  if (monsterUidByTileKey.get(currentTileKey) === monster.uid) {
    monsterUidByTileKey.delete(currentTileKey);
  }

  monsterUidByTileKey.set(nextTileKey, monster.uid);

  if (currentChunkKey !== nextChunkKey) {
    removeMonsterUidFromChunkIndex(monster);

    let nextChunkMonsterUids = monsterUidsByChunkKey.get(nextChunkKey);
    if (!nextChunkMonsterUids) {
      nextChunkMonsterUids = new Set();
      monsterUidsByChunkKey.set(nextChunkKey, nextChunkMonsterUids);
    }
    nextChunkMonsterUids.add(monster.uid);
  }

  return true;
};

const isMonsterAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  const tileKey = getMonsterTileKey(x, y, z);
  return tileKey ? monsterUidByTileKey.has(tileKey) : false;
};

const findMonsterAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  const tileKey = getMonsterTileKey(x, y, z);
  if (!tileKey) {
    return null;
  }

  const monsterUid = monsterUidByTileKey.get(tileKey);
  return monsterUid === undefined ? null : (monstersByUid.get(monsterUid) ?? null);
};

const selectMonster = (monster) => {
  if (!monster) {
    return;
  }
  clearMonsterSelection();
  if (monster.uid === selectedMonsterUid) {
    selectedMonsterUid = null;
    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
      stopPlayerNavigation();
    }
    syncMobileTargetHud();
    return;
  }
  selectedMonsterUid = monster.uid;
  selectMonsterElement(selectedMonsterUid);
  syncMobileTargetHud();
  if (playerNavigationState.followEnabled) {
    startPlayerFollowNavigation();
  }
};

const loseSelectedMonsterTarget = () => {
  if (selectedMonsterUid === null) {
    return false;
  }

  selectedMonsterUid = null;
  clearMonsterSelection();
  syncMobileTargetHud();

  const wasFollowing =
    playerNavigationState.followEnabled || playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow;

  playerNavigationState.followEnabled = false;
  stopPlayerNavigation();

  if (wasFollowing) {
    updatePlayerInventory();
  }

  showGameStatusMessage(getGameUiText("targetLost"));
  return true;
};

const isPlayerAtPosition = (x, y, z = pixiWorldRenderState.currentZ) => {
  return playerState.z === z && playerState.x === x && playerState.y === y;
};

const updateMonsterDirectionToPlayer = (monster) => {
  const monsterTile = getTilePosition(monster);
  const playerTile = getTilePosition(playerState);
  const diffCol = playerTile.col - monsterTile.col;
  const diffRow = playerTile.row - monsterTile.row;
  if (Math.abs(diffCol) > Math.abs(diffRow)) {
    if (diffCol > 0) {
      monster.direction = "right";
    } else if (diffCol < 0) {
      monster.direction = "left";
    }
  } else {
    if (diffRow > 0) {
      monster.direction = "down";
    } else if (diffRow < 0) {
      monster.direction = "up";
    }
  }
};

const removeMonsterFromState = (monsterUid) => {
  const monster = monstersByUid.get(monsterUid);
  if (!monster) {
    return false;
  }

  const tileKey = getMonsterTileKey(monster.x, monster.y, monster.z);
  if (tileKey && monsterUidByTileKey.get(tileKey) === monsterUid) {
    monsterUidByTileKey.delete(tileKey);
  }

  removeMonsterUidFromChunkIndex(monster);
  monstersByUid.delete(monsterUid);

  return true;
};

const removeMonsterRender = (monsterUid) => {
  const monsterElement = findMonsterElement(monsterUid);
  if (monsterElement) {
    monsterElement.remove();
  }
  removePixiMonsterVisual(monsterUid);
  monsterElementsByUid.delete(monsterUid);
};
const removeMonster = (monsterUid) => {
  removeMonsterFromState(monsterUid);
  removeMonsterRender(monsterUid);
};
const clearMonsters = () => {
  for (const refs of monsterElementsByUid.values()) {
    refs?.root?.remove();
  }
  monsterElementsByUid.clear();
  clearPixiMonsterVisuals();
};

const updateMonsterDirection = (monster, tile) => {
  if (!monster || !tile) {
    return;
  }

  const monsterTile = getTilePosition(monster);
  const deltaCol = tile.col - monsterTile.col;
  const deltaRow = tile.row - monsterTile.row;

  monster.direction = getCardinalDirectionFromTileDelta(deltaCol, deltaRow, monster.direction);
};

/* ---------- MONSTRES - SELECTION ET MORT ---------- */

const clearMonsterSelection = () => {
  clearPixiMonsterSelection();
};

const createMonsterCorpse = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData || !monsterData.corpseItemId) {
    return;
  }
  const lootContent = generateMonsterLoot(monsterData);
  const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
  addLootLogMessage(lootContent, localizedMonsterData.name);

  const corpse = createGroundItem(monsterData.corpseItemId, 1, monster.x, monster.y, monster.z, lootContent);
  if (!corpse) {
    return;
  }
  addGroundItem(corpse);
};

const isMonsterDead = (monster) => {
  return monster.hp <= 0;
};
const clearSelectedMonsterIfNeeded = (monster) => {
  if (!monster || selectedMonsterUid === null) {
    return;
  }
  if (selectedMonsterUid === monster.uid) {
    selectedMonsterUid = null;
    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
      stopPlayerNavigation();
    }
    syncMobileTargetHud();
  }
};

const handleMonsterDeath = (monster) => {
  setMonsterDeadState(monster);
  createMonsterCorpse(monster);
  if (decreaseMonsterSpawnAliveCount(monster)) {
    scheduleMonsterRespawn(monster.spawnId, Date.now());
  }
  removeMonster(monster.uid);
  clearSelectedMonsterIfNeeded(monster);
};

const spawnInitialMonstersForWorldMap = (worldMap) => {
  const spawnZones = getMonsterSpawnZonesFromWorldMap(worldMap);

  for (const spawnZone of spawnZones) {
    const spawnDefinition = registerMonsterSpawnDefinition(worldMap, spawnZone);
    if (!spawnDefinition) {
      continue;
    }

    for (let i = 0; i < spawnDefinition.maxCount; i++) {
      const monster = spawnMonsterFromZone(worldMap, spawnZone);
      if (!monster) {
        scheduleMonsterRespawnAt(
          spawnDefinition.spawnId,
          Date.now() + MONSTER_RESPAWN_CONFIG.blockedRetryMs,
        );
      }
    }
  }
};

const spawnInitialMonstersForWorldMaps = (worldMapsByZ) => {
  if (!(worldMapsByZ instanceof Map)) {
    return;
  }

  for (const worldMap of worldMapsByZ.values()) {
    spawnInitialMonstersForWorldMap(worldMap);
  }
};

const setMonsterDeadState = (monster) => {
  monster.hp = 0;
};

const findNearMonster = (monsterList) => {
  const nearMonsterIndex = monsterList.findIndex((monster) => {
    return isNearPlayer(monster);
  });
  return nearMonsterIndex;
};

const findMonsterByUid = (monsterUid) => {
  return monstersByUid.get(monsterUid) ?? null;
};

const selectMonsterElement = (monsterUid) => {
  setPixiMonsterSelected(monsterUid, true);
};

const findMonsterElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;

  return refs?.root ?? null;
};

const findMonsterHpElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;
  return refs?.hp ?? null;
};

const findMonsterFloatingTextElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;
  return refs?.floatingText ?? null;
};

const generateMonsterLoot = (monsterData) => {
  const lootContent = [];
  if (!monsterData.loot || !Array.isArray(monsterData.loot)) {
    return lootContent;
  }
  monsterData.loot.forEach((loot) => {
    const random = getRandomInt(1, 100);
    if (random <= loot.chance) {
      const quantity = getRandomInt(loot.minQuantity, loot.maxQuantity);
      const item = createItemInstance(loot.itemId, quantity);
      if (item) {
        lootContent.push(item);
      }
    }
  });
  return lootContent;
};

const formatLootItemText = (lootItem) => {
  if (!lootItem) {
    return getGameUiText("unknownItem");
  }
  const itemData = getLocalizedItemData(lootItem.itemId);
  if (!itemData) {
    return getGameUiText("unknownItem");
  }
  if ("quantity" in lootItem && lootItem.quantity > 1) {
    return `${lootItem.quantity} ${getLocalizedItemName(lootItem.itemId, lootItem.quantity)}`;
  } else {
    return `${itemData.name}`;
  }
};

const formatLootLogMessage = (lootItems, sourceName = null) => {
  if (!lootItems || isEmpty(lootItems)) {
    if (sourceName != null) {
      return getGameUiText("lootFromNothing")(sourceName);
    } else {
      return getGameUiText("lootNothing");
    }
  }

  const lootItemsList = [];
  for (const lootItem of lootItems) {
    lootItemsList.push(formatLootItemText(lootItem));
  }
  const itemsText = lootItemsList.join(", ");
  return sourceName != null
    ? getGameUiText("lootFromList")(sourceName, itemsText)
    : getGameUiText("lootList")(itemsText);
};

const addLootLogMessage = (lootItems, sourceName = null) => {
  const logMessage = formatLootLogMessage(lootItems, sourceName);
  addLogMessage(logMessage, "loot");
};

/* ---------- MONSTRES - COMBAT POSITION MOUVEMENT ---------- */
const isEntityInsideMonsterRange = (monster, entity, rangeX, rangeY) => {
  if (
    !monster ||
    !entity ||
    monster.z !== entity.z ||
    !Number.isFinite(monster.x) ||
    !Number.isFinite(monster.y) ||
    !Number.isFinite(entity.x) ||
    !Number.isFinite(entity.y) ||
    !Number.isFinite(rangeX) ||
    !Number.isFinite(rangeY)
  ) {
    return false;
  }

  const distanceX = Math.abs(entity.x - monster.x) / TILE_SIZE;
  const distanceY = Math.abs(entity.y - monster.y) / TILE_SIZE;

  return distanceX <= rangeX && distanceY <= rangeY;
};

const isPlayerInsideMonsterRange = (monster, rangeX, rangeY) => {
  return isEntityInsideMonsterRange(monster, playerState, rangeX, rangeY);
};

const isPlayerInsideMonsterWakeRange = (monster) => {
  return isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.wakeRangeX, MONSTER_AI_CONFIG.wakeRangeY);
};

const isPlayerInsideMonsterSleepRange = (monster) => {
  return isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.sleepRangeX, MONSTER_AI_CONFIG.sleepRangeY);
};

const deactivateMonsterAi = (monster) => {
  if (!monster) {
    return;
  }

  monster.isAwake = false;
  monster.path = [];
  monster.badPathStartedAt = null;
  monster.state = MONSTER_AI_STATE.idle;
  monster.nextWanderAt = 0;
  monster.wanderStepsRemaining = 0;
  monster.nextBlockedChaseMoveAt = 0;
  monster.nextDynamicPathRefreshTime = 0;
};

const updateMonsterActivityState = (monster) => {
  if (!monster || monster.z !== playerState.z) {
    return false;
  }

  if (!monster.isAwake) {
    if (!isPlayerInsideMonsterWakeRange(monster)) {
      return false;
    }

    monster.isAwake = true;
    return true;
  }

  if (monster.targetUid === null && !isPlayerInsideMonsterSleepRange(monster)) {
    deactivateMonsterAi(monster);
    return false;
  }

  return true;
};

const updateMonsterCombat = (now, activeMonsters) => {
  activeMonsters.forEach((monster) => {
    if (
      !monster.isAwake ||
      monster.state !== MONSTER_AI_STATE.combat ||
      monster.targetUid !== playerState.uid ||
      monster.z !== playerState.z
    ) {
      return;
    }

    if (!isNearPlayer(monster, 1)) {
      monster.state = MONSTER_AI_STATE.chase;
      return;
    }

    if (now < monster.nextAttackTime) {
      return;
    }

    const monsterData = getMonsterData(monster.monsterId);
    if (!monsterData) {
      return;
    }

    monster.nextAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;

    const attackResult = calculateDamageTakenByPlayer(monsterData.combat, now);

    if (attackResult.finalDamage > 0) {
      playerState.hp -= attackResult.finalDamage;
      const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
      const logMessage = getGameUiText("damageTaken")(attackResult.finalDamage, localizedMonsterData.name);
      addLogMessage(logMessage, "combat");
    }

    showFloatingTextAbovePlayer(attackResult.text, attackResult.textType);
    if (attackResult.textType === "block") {
      playGameSfx(GAME_SFX.block);
    } else if (attackResult.textType === "absorb") {
      playGameSfx(GAME_SFX.armorBlock);
    }
    refreshPlayerVitalsUi();

    if (playerState.hp <= 0) {
      playerState.hp = 0;
      refreshPlayerVitalsUi();
      playerDead();
    }
  });
};

const canMonsterSeePlayer = (monster) => {
  if (!isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.visionX, MONSTER_AI_CONFIG.visionY)) {
    return false;
  }

  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return false;
  }

  const worldMap = pixiWorldRenderState.worldMapsByZ.get(monster.z);
  if (!worldMap) {
    return false;
  }

  return hasLineOfSightBetweenTiles(worldMap, getTilePosition(monster), getTilePosition(playerState));
};

const getMonsterPathToPlayerAdjacentTile = (monster) => {
  if (!monster || monster.z !== playerState.z) {
    return null;
  }

  if (isNearPlayer(monster, 1)) {
    return [];
  }

  const monsterTile = getTilePosition(monster);
  const playerTile = getTilePosition(playerState);
  const targetTiles = getPathTraversableAdjacentTiles(playerTile);

  if (targetTiles.length === 0) {
    return null;
  }

  const path = findPathToAnyTarget(monsterTile, targetTiles);

  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  return path;
};

const getMonsterHearingPathToPlayer = (monster) => {
  if (!isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.hearingScanRange, MONSTER_AI_CONFIG.hearingScanRange)) {
    return null;
  }

  const path = getMonsterPathToPlayerAdjacentTile(monster);

  const pathCost = getPathMovementCost(getTilePosition(monster), path);

  if (path === null || pathCost > MONSTER_AI_CONFIG.maxHearingPathLength) {
    return null;
  }

  return path;
};

const getMonsterTarget = (monster) => {
  if (!monster || monster.targetUid === null) {
    return null;
  }

  if (monster.targetUid === playerState.uid) {
    return playerState;
  }

  return null;
};

const setMonsterTarget = (monster, target) => {
  if (!monster || target?.uid == null) {
    return false;
  }

  monster.targetUid = target.uid;
  monster.path = [];
  monster.badPathStartedAt = null;
  monster.state = MONSTER_AI_STATE.chase;
  monster.nextWanderAt = 0;
  monster.wanderStepsRemaining = 0;
  monster.nextBlockedChaseMoveAt = 0;
  monster.nextDynamicPathRefreshTime = 0;
  return true;
};

const clearMonsterTarget = (monster) => {
  if (!monster) {
    return;
  }

  monster.targetUid = null;
  monster.path = [];
  monster.badPathStartedAt = null;
  monster.roamCenterX = monster.x;
  monster.roamCenterY = monster.y;
  monster.state = MONSTER_AI_STATE.wander;
  monster.nextWanderAt = 0;
  monster.wanderStepsRemaining = 0;
  monster.nextBlockedChaseMoveAt = 0;
  monster.nextDynamicPathRefreshTime = 0;
};

const isMonsterTargetValid = (monster, target) => {
  if (!monster || !target || target.hp <= 0 || monster.z !== target.z) {
    return false;
  }

  return isEntityInsideMonsterRange(monster, target, MONSTER_AI_CONFIG.deaggroX, MONSTER_AI_CONFIG.deaggroY);
};

const updateMonsterTargetState = (monster, now) => {
  if (!monster || !Number.isFinite(now)) {
    return false;
  }

  if (monster.targetUid !== null) {
    const target = getMonsterTarget(monster);

    if (!isMonsterTargetValid(monster, target)) {
      clearMonsterTarget(monster);
      return false;
    }

    return true;
  }

  if (now < monster.nextAggroCheckAt) {
    return false;
  }

  monster.nextAggroCheckAt =
    now + getRandomInt(MONSTER_AI_CONFIG.aggroCheckCooldownMinMs, MONSTER_AI_CONFIG.aggroCheckCooldownMaxMs);

  if (canMonsterSeePlayer(monster)) {
    return setMonsterTarget(monster, playerState);
  }

  const hearingPath = getMonsterHearingPathToPlayer(monster);
  if (hearingPath === null) {
    return false;
  }

  if (!setMonsterTarget(monster, playerState)) {
    return false;
  }

  monster.path = hearingPath;
  return true;
};

const updateMonsterPosition = () => {
  for (const [monsterUid, refs] of monsterElementsByUid.entries()) {
    const monster = monstersByUid.get(monsterUid);
    if (!monster) {
      removeMonsterRender(monsterUid);
      continue;
    }
    const surfaceOffsetY = getEntitySurfaceOffsetY(monster);
    const monsterData = getMonsterData(monster.monsterId);
    const monsterElement = refs.root;
    const renderX = monster.renderX + monsterData.drawOffsetX;
    const renderY = monster.renderY + monsterData.drawOffsetY - surfaceOffsetY;
    const zIndex = getWorldRenderZIndex(getEntityRenderSortY(monster), WORLD_RENDER_LAYER_CREATURE);

    updatePixiMonsterTransform(monster.uid, renderX, renderY, zIndex);

    if (monsterElement) {
      monsterElement.style.left = `${renderX - camera.x}px`;
      monsterElement.style.top = `${renderY - camera.y}px`;
      monsterElement.style.zIndex = zIndex;
    }
  }
};

const hasMonsterBadPathTimedOut = (monster, now) => {
  if (!monster || monster.badPathStartedAt === null) {
    return false;
  }

  return now - monster.badPathStartedAt >= MONSTER_AI_CONFIG.maxBadPathDurationMs;
};

const handleMonsterBadPath = (monster, now) => {
  if (!monster || !Number.isFinite(now)) {
    return false;
  }

  monster.path = [];

  if (monster.badPathStartedAt === null) {
    monster.badPathStartedAt = now;
  }

  if (hasMonsterBadPathTimedOut(monster, now)) {
    clearMonsterTarget(monster);
  }

  return false;
};

const shouldRefreshMonsterChasePath = (monster, targetTiles, now, forceRefresh = false) => {
  if (!monster || !Array.isArray(targetTiles) || targetTiles.length === 0 || !Number.isFinite(now)) {
    return false;
  }

  if (forceRefresh) {
    return true;
  }

  if (now >= monster.nextPathRefreshTime) {
    return true;
  }

  if (!Array.isArray(monster.path) || monster.path.length === 0) {
    return false;
  }

  const currentPathEnd = monster.path[monster.path.length - 1];
  return getDistanceToClosestTile(currentPathEnd, targetTiles) > 2;
};

const updateMonsterChasePath = (monster, now, forceRefresh = false, avoidCreatures = false) => {
  const target = getMonsterTarget(monster);
  const monsterData = getMonsterData(monster?.monsterId);

  if (!monster || !target || !monsterData || !Number.isFinite(now)) {
    return false;
  }

  if (isNearPlayer(monster, 1)) {
    monster.path = [];
    monster.badPathStartedAt = null;
    return true;
  }

  if (hasMonsterBadPathTimedOut(monster, now)) {
    clearMonsterTarget(monster);
    return false;
  }

  if (monster.badPathStartedAt !== null && now < monster.nextPathRefreshTime && !forceRefresh) {
    return false;
  }

  const monsterTile = getTilePosition(monster);
  const targetTile = getTilePosition(target);
  const targetTiles = getPathTraversableAdjacentTiles(targetTile);

  if (targetTiles.length === 0) {
    monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;
    return handleMonsterBadPath(monster, now);
  }

  if (!shouldRefreshMonsterChasePath(monster, targetTiles, now, forceRefresh)) {
    return monster.path.length > 0;
  }

  monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;

  const newPath = findPathToAnyTarget(monsterTile, targetTiles, avoidCreatures);
  const newPathCost = getPathMovementCost(monsterTile, newPath);

  const hasValidPath =
    Array.isArray(newPath) && newPath.length > 0 && newPathCost <= MONSTER_AI_CONFIG.maxChasePathLength;

  if (!hasValidPath) {
    if (avoidCreatures) {
      return false;
    }

    return handleMonsterBadPath(monster, now);
  }

  monster.path = newPath;
  monster.badPathStartedAt = null;
  return true;
};

const setMonsterIdleState = (monster, now) => {
  if (!monster || !Number.isFinite(now)) {
    return;
  }

  monster.state = MONSTER_AI_STATE.idle;
  monster.wanderStepsRemaining = 0;
  monster.nextWanderAt = now + getRandomInt(MONSTER_AI_CONFIG.idleDurationMinMs, MONSTER_AI_CONFIG.idleDurationMaxMs);
};

const startMonsterWanderState = (monster) => {
  if (!monster) {
    return;
  }

  monster.state = MONSTER_AI_STATE.wander;
  monster.wanderStepsRemaining = getRandomInt(MONSTER_AI_CONFIG.wanderStepsMin, MONSTER_AI_CONFIG.wanderStepsMax);
};

const isTileInsideMonsterRoamRange = (monster, tile) => {
  if (!monster || !Number.isInteger(tile?.col) || !Number.isInteger(tile?.row)) {
    return false;
  }

  const roamCenterCol = monster.roamCenterX / TILE_SIZE;
  const roamCenterRow = monster.roamCenterY / TILE_SIZE;

  return (
    Math.abs(tile.col - roamCenterCol) <= MONSTER_AI_CONFIG.wanderRadiusTiles &&
    Math.abs(tile.row - roamCenterRow) <= MONSTER_AI_CONFIG.wanderRadiusTiles
  );
};

const getRandomMonsterWanderTile = (monster) => {
  if (!monster) {
    return null;
  }

  const monsterTile = getTilePosition(monster);

  const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
    return isTileInsideMonsterRoamRange(monster, tile) && isWalkableTile(tile.row, tile.col, monsterTile);
  });

  if (possibleTiles.length === 0) {
    return null;
  }

  const cardinalTiles = possibleTiles.filter((tile) => {
    return getTileMovementCost(monsterTile, tile) === 1;
  });
  const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

  return preferredTiles[getRandomInt(0, preferredTiles.length - 1)];
};

const getRandomMonsterCombatDanceTile = (monster) => {
  if (!monster || monster.targetUid !== playerState.uid || monster.z !== playerState.z) {
    return null;
  }

  const monsterTile = getTilePosition(monster);
  const playerTile = getTilePosition(playerState);

  const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
    const distanceCol = Math.abs(tile.col - playerTile.col);
    const distanceRow = Math.abs(tile.row - playerTile.row);
    const isPlayerTile = distanceCol === 0 && distanceRow === 0;
    const remainsAdjacent = distanceCol <= 1 && distanceRow <= 1;

    return !isPlayerTile && remainsAdjacent && isWalkableTile(tile.row, tile.col, monsterTile);
  });

  if (possibleTiles.length === 0) {
    return null;
  }

  const cardinalTiles = possibleTiles.filter((tile) => {
    return getTileMovementCost(monsterTile, tile) === 1;
  });
  const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

  return preferredTiles[getRandomInt(0, preferredTiles.length - 1)];
};

const moveMonsterToTile = (monster, tile, now, moveDuration) => {
  if (!monster || !tile || !Number.isFinite(now) || !Number.isFinite(moveDuration)) {
    return false;
  }

  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return false;
  }

  const monsterTile = getTilePosition(monster);

  if (!isWalkableTile(tile.row, tile.col, monsterTile)) {
    return false;
  }

  const movementCost = getTileMovementCost(monsterTile, tile);
  const animationMultiplier = getTileMovementAnimationMultiplier(monsterTile, tile);

  if (movementCost === null || animationMultiplier === null) {
    return false;
  }

  const finalMoveDuration = moveDuration * animationMultiplier;
  const finalMoveCooldown = moveDuration * movementCost;
  const { tileX, tileY } = getWorldPosition(tile);

  if (!moveMonsterInTileIndex(monster, tileX, tileY)) {
    return false;
  }

  updateMonsterDirection(monster, tile);

  monster.walkFrame++;

  if (monster.walkFrame >= monsterData.animationFrames) {
    monster.walkFrame = 0;
  }

  updateMonsterSprite(monster);

  monster.oldX = monster.x;
  monster.oldY = monster.y;
  monster.moveStartTime = now;
  monster.moveDuration = finalMoveDuration;
  monster.nextMoveTime = now + finalMoveCooldown;
  monster.x = tileX;
  monster.y = tileY;
  syncMonsterRenderVisibility(monster);

  return true;
};

const updateMonsterCombatDance = (monster, now) => {
  if (
    !monster ||
    !Number.isFinite(now) ||
    monster.state !== MONSTER_AI_STATE.combat ||
    monster.targetUid !== playerState.uid
  ) {
    return false;
  }

  if (monster.nextCombatDanceAt === 0) {
    monster.nextCombatDanceAt =
      now + getRandomInt(MONSTER_AI_CONFIG.combatDanceCooldownMinMs, MONSTER_AI_CONFIG.combatDanceCooldownMaxMs);
    return false;
  }

  if (now < monster.nextCombatDanceAt || now < monster.nextMoveTime) {
    return false;
  }

  monster.nextCombatDanceAt =
    now + getRandomInt(MONSTER_AI_CONFIG.combatDanceCooldownMinMs, MONSTER_AI_CONFIG.combatDanceCooldownMaxMs);

  const danceTile = getRandomMonsterCombatDanceTile(monster);
  const monsterData = getMonsterData(monster.monsterId);

  if (!danceTile || !monsterData) {
    return false;
  }

  return moveMonsterToTile(monster, danceTile, now, monsterData.moveCooldown);
};

const getMonsterChaseRepositionTile = (monster) => {
  const target = getMonsterTarget(monster);

  if (!monster || !target || monster.z !== target.z) {
    return null;
  }

  const monsterTile = getTilePosition(monster);
  const targetTile = getTilePosition(target);

  const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
    return isWalkableTile(tile.row, tile.col, monsterTile);
  });

  if (possibleTiles.length === 0) {
    return null;
  }

  const cardinalTiles = possibleTiles.filter((tile) => {
    return getTileMovementCost(monsterTile, tile) === 1;
  });
  const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

  let bestDistance = Number.POSITIVE_INFINITY;
  const closestTiles = [];

  for (const tile of preferredTiles) {
    const distance = getDistance(tile, targetTile);

    if (distance < bestDistance) {
      bestDistance = distance;
      closestTiles.length = 0;
      closestTiles.push(tile);
    } else if (distance === bestDistance) {
      closestTiles.push(tile);
    }
  }

  return closestTiles[getRandomInt(0, closestTiles.length - 1)] ?? null;
};

const updateMonsterBlockedChaseMovement = (monster, now) => {
  if (!monster || !Number.isFinite(now) || monster.state !== MONSTER_AI_STATE.chase || monster.targetUid === null) {
    return false;
  }

  if (monster.nextBlockedChaseMoveAt === 0) {
    monster.nextBlockedChaseMoveAt =
      now +
      getRandomInt(MONSTER_AI_CONFIG.blockedChaseMoveCooldownMinMs, MONSTER_AI_CONFIG.blockedChaseMoveCooldownMaxMs);
    return false;
  }

  if (now < monster.nextBlockedChaseMoveAt || now < monster.nextMoveTime) {
    return false;
  }

  monster.nextBlockedChaseMoveAt =
    now +
    getRandomInt(MONSTER_AI_CONFIG.blockedChaseMoveCooldownMinMs, MONSTER_AI_CONFIG.blockedChaseMoveCooldownMaxMs);

  const repositionTile = getMonsterChaseRepositionTile(monster);
  const monsterData = getMonsterData(monster.monsterId);

  if (!repositionTile || !monsterData) {
    return false;
  }

  return moveMonsterToTile(monster, repositionTile, now, monsterData.moveCooldown);
};

const updateMonsterWanderMovement = (monster, now) => {
  if (!monster || !Number.isFinite(now)) {
    return;
  }

  if (monster.state === MONSTER_AI_STATE.idle) {
    if (monster.nextWanderAt === 0) {
      setMonsterIdleState(monster, now);
      return;
    }

    if (now < monster.nextWanderAt) {
      return;
    }

    startMonsterWanderState(monster);
  }

  if (monster.state !== MONSTER_AI_STATE.wander) {
    return;
  }

  if (monster.wanderStepsRemaining <= 0) {
    startMonsterWanderState(monster);
  }

  if (now < monster.nextMoveTime) {
    return;
  }

  const wanderTile = getRandomMonsterWanderTile(monster);

  if (!wanderTile) {
    setMonsterIdleState(monster, now);
    return;
  }

  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return;
  }

  const monsterTile = getTilePosition(monster);
  const movementCost = getTileMovementCost(monsterTile, wanderTile);

  if (movementCost === null) {
    return;
  }

  const wanderCooldown =
    getRandomInt(MONSTER_AI_CONFIG.wanderStepCooldownMinMs, MONSTER_AI_CONFIG.wanderStepCooldownMaxMs) * movementCost;

  if (!moveMonsterToTile(monster, wanderTile, now, monsterData.moveCooldown)) {
    return;
  }

  monster.wanderStepsRemaining--;

  monster.nextMoveTime = Math.max(monster.nextMoveTime, now + wanderCooldown);

  if (monster.wanderStepsRemaining <= 0) {
    setMonsterIdleState(monster, now);
  }
};

const updateMonsterMovement = (now, activeMonsters) => {
  activeMonsters.forEach((monster) => {
    if (!updateMonsterActivityState(monster)) {
      return;
    }

    if (!updateMonsterTargetState(monster, now)) {
      updateMonsterWanderMovement(monster, now);
      return;
    }
    if (isNearPlayer(monster, 1)) {
      monster.state = MONSTER_AI_STATE.combat;
      monster.path = [];
      monster.badPathStartedAt = null;
      updateMonsterCombatDance(monster, now);
      return;
    }

    monster.state = MONSTER_AI_STATE.chase;

    if (monster.nextMoveTime > now) {
      return;
    }

    const monsterData = getMonsterData(monster.monsterId);
    if (!monsterData) {
      return;
    }

    if (!updateMonsterChasePath(monster, now)) {
      updateMonsterBlockedChaseMovement(monster, now);
      return;
    }

    let nextStep = monster.path[0];

    if (!nextStep) {
      updateMonsterBlockedChaseMovement(monster, now);
      return;
    }

    const monsterTile = getTilePosition(monster);

    if (!isTilePathTraversable(nextStep.row, nextStep.col, monsterTile)) {
      if (!updateMonsterChasePath(monster, now, true)) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }

      nextStep = monster.path[0];

      if (!nextStep || !isTilePathTraversable(nextStep.row, nextStep.col, monsterTile)) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }
    }

    if (isTileOccupiedByCreature(nextStep.row, nextStep.col)) {
      let foundDynamicPath = false;

      if (now >= monster.nextDynamicPathRefreshTime) {
        monster.nextDynamicPathRefreshTime = now + MONSTER_AI_CONFIG.dynamicPathRefreshCooldownMs;
        foundDynamicPath = updateMonsterChasePath(monster, now, true, true);
      }

      if (!foundDynamicPath) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }

      nextStep = monster.path[0];

      if (!nextStep || !isWalkableTile(nextStep.row, nextStep.col, monsterTile)) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }
    }

    if (moveMonsterToTile(monster, nextStep, now, monsterData.moveCooldown)) {
      monster.nextBlockedChaseMoveAt = 0;
      monster.nextDynamicPathRefreshTime = 0;
      monster.path.shift();
    }
  });
};
//#endregion  -----  MONSTRES  -----

/* ==================================================== */
//#region     -----  RENDER - POSITIONS VISUELLES ET UPDATE MONDE  -----
/* ==================================================== */
/* ---------- RENDER - INITIALISATION DU MONDE ---------- */

const renderInitialWorld = () => {
  renderGroundItems(worldItemsByUid.values());
  syncGroundEffectRenderForCurrentZ();
  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  updateWorldRender();
};

/* ---------- RENDER - INTERPOLATION VISUELLE ---------- */

const updateEntityRenderPosition = (entity, now) => {
  if (entity.moveDuration <= 0) {
    entity.renderX = entity.x;
    entity.renderY = entity.y;
    return false;
  } else {
    const rawProgress = (now - entity.moveStartTime) / entity.moveDuration;
    const progress = clamp(rawProgress, 0, 1);
    const distanceX = entity.x - entity.oldX;
    const distanceY = entity.y - entity.oldY;
    entity.renderX = entity.oldX + distanceX * progress;
    entity.renderY = entity.oldY + distanceY * progress;
    if (progress >= 1) {
      entity.moveDuration = 0;
      return true;
    }
  }
  return false;
};

const updateRenderPositions = (now) => {
  updateEntityRenderPosition(playerState, now);

  for (const monsterUid of monsterElementsByUid.keys()) {
    const monster = monstersByUid.get(monsterUid);
    if (monster) {
      const didFinishMoving = updateEntityRenderPosition(monster, now);
      if (didFinishMoving && monster.walkFrame !== 1) {
        monster.walkFrame = 1;
        updateMonsterSprite(monster);
      }
    }
  }

  for (const npcUid of npcElementsByUid.keys()) {
    const npc = npcsByUid.get(npcUid);
    if (npc) {
      const didFinishMoving = updateEntityRenderPosition(npc, now);
      if (didFinishMoving && npc.walkFrame !== 1) {
        npc.walkFrame = 1;
        updateNpcSprite(npc);
      }
    }
  }
};

/* ---------- RENDER - GROUPES DE MISE A JOUR ---------- */

const updateRenderCamera = () => {
  updateCamera();
  updatePixiCamera(camera.x, camera.y);
  if (mousePosition.screenX !== null && mousePosition.screenY !== null) {
    updateMousePositionInfo(mousePosition.screenX, mousePosition.screenY);
  }
};

const updateRenderWorldItems = () => {
  updateItemPosition();
};

const updateRenderCreatures = () => {
  updateMonsterPosition();
  updateNpcPosition();
  updatePlayerPosition();
};

const updateRenderLight = () => {
  updateLight(playerState);
};

const updatePixiVisibleChunksAroundPlayer = async () => {
  if (!(pixiWorldRenderState?.worldMapsByZ instanceof Map)) {
    return;
  }
  const actualMap = pixiWorldRenderState.worldMapsByZ.get(pixiWorldRenderState.currentZ);
  const playerChunkPosition = getChunkPositionFromWorldPosition(playerState.x, playerState.y);
  if (!actualMap || !playerChunkPosition) {
    return;
  }
  if (
    pixiWorldRenderState.currentZ === pixiWorldRenderState.lastPlayerZ &&
    playerChunkPosition.chunkX === pixiWorldRenderState.lastPlayerChunkX &&
    playerChunkPosition.chunkY === pixiWorldRenderState.lastPlayerChunkY
  ) {
    return;
  }

  await renderPixiVisibleWorldChunks(
    actualMap,
    playerChunkPosition.chunkX,
    playerChunkPosition.chunkY,
    pixiWorldRenderState.visibleRadiusChunks,
  );

  syncVisibleMonsterRendersAroundPlayer();
  syncVisibleNpcRendersAroundPlayer();
  pixiWorldRenderState.lastPlayerZ = pixiWorldRenderState.currentZ;
  pixiWorldRenderState.lastPlayerChunkX = playerChunkPosition.chunkX;
  pixiWorldRenderState.lastPlayerChunkY = playerChunkPosition.chunkY;
};

const updateWorldRender = () => {
  updateRenderCamera();
  renderPlayerMinimap();
  updateFloatingTextPositions();
  updateRenderWorldItems();
  updateRenderCreatures();
  if (itemUseState.isUsingItem) {
    syncItemUseTargetIndicators();
  }
  updateRenderLight();
};
//#endregion  -----  RENDER - POSITIONS VISUELLES ET UPDATE MONDE  -----

/* ==================================================== */
//#region     -----  COMBAT - JOUEUR, MONSTRES ET RUNES  -----
/* ==================================================== */
/* ---------- COMBAT - STATS ET FORMULES ---------- */
const getCombatModeData = () => {
  const combatMode = playerState.combatMode;
  if (combatMode === "fullAttack") {
    return {
      attackMultiplier: 1.15,
      defenseMultiplier: 0.8,
      blockChanceMultiplier: 0.8,
      armorMultiplier: 0.95,
    };
  } else if (combatMode === "fullDefense") {
    return {
      attackMultiplier: 0.85,
      defenseMultiplier: 1.35,
      blockChanceMultiplier: 1.3,
      armorMultiplier: 1.1,
    };
  } else {
    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      blockChanceMultiplier: 1,
      armorMultiplier: 1,
    };
  }
};

const getSkillExperienceGainFromAttack = (attackResult, skillKey, now) => {
  if (!skillKey || !(skillKey in playerState.skills) || !attackResult || !attackResult.didHit) {
    return 0;
  }
  const baseGain = SKILL_EXPERIENCE_GAIN_PER_TRY;
  const expMultiplier = getSkillExperienceGainMultiplier(skillKey);
  const finalExp = normalizeSkillExperienceGain(baseGain * expMultiplier);

  if (attackResult.finalDamage > 0) {
    refreshSkillTrainingTimer(now);
    return finalExp;
  } else {
    if (isSkillTrainingTimerActive(now)) {
      return finalExp;
    }
  }
  return 0;
};

const applySkillExperienceFromAttack = (attackResult, skillKey, now) => {
  const finalExp = getSkillExperienceGainFromAttack(attackResult, skillKey, now);
  if (!finalExp) {
    return false;
  }
  applyExperienceToPlayerSkill(skillKey, finalExp);
  return true;
};

const getEquippedWeapon = () => {
  if (!playerState.equipment.weapon) {
    return null;
  }
  const weapon = playerState.equipment.weapon;
  return weapon;
};

const getEquippedWeaponCombatData = () => {
  const weapon = getEquippedWeapon();
  if (!weapon) {
    return null;
  }
  const weaponData = getItemData(weapon.itemId);
  if (!weaponData || !weaponData.combat) {
    return null;
  }
  return weaponData.combat;
};

const getPlayerWeaponAttack = () => {
  const weaponCombatData = getEquippedWeaponCombatData();
  if (!weaponCombatData || !Number.isFinite(weaponCombatData.attack)) {
    return playerState.damage;
  }
  return weaponCombatData.attack;
};

const getPlayerAttackRange = () => {
  const weaponCombatData = getEquippedWeaponCombatData();
  if (!Number.isFinite(weaponCombatData?.range) || weaponCombatData.range < 1) {
    return 1;
  }
  return weaponCombatData.range;
};

const consumePlayerWeaponAmmunition = () => {
  const weaponCombatData = getEquippedWeaponCombatData();
  const ammunitionItemId = weaponCombatData?.ammunitionItemId;
  if (!ammunitionItemId) {
    return true;
  }

  const ammunition = playerState.equipment.shield;
  if (ammunition?.itemId !== ammunitionItemId || ammunition.quantity <= 0) {
    showGameStatusMessage(getGameUiText("arrowsRequired"));
    return false;
  }

  if (ammunition.quantity > 1) {
    ammunition.quantity -= 1;
  } else {
    playerState.equipment.shield = null;
  }
  refreshInventoryUi();
  return true;
};

const playPlayerWeaponProjectile = (target) => {
  const weaponCombatData = getEquippedWeaponCombatData();
  if (!weaponCombatData?.projectileItemId || !target) {
    return false;
  }
  const projectileParts = getItemRenderData({
    itemId: weaponCombatData.projectileItemId,
    quantity: 1,
  });
  const projectilePart = projectileParts[0];
  const playerRenderPosition = getItemUseTargetRenderPosition(playerState);
  const targetRenderPosition = getItemUseTargetRenderPosition(target);
  if (!projectilePart || !playerRenderPosition || !targetRenderPosition) {
    return false;
  }

  return playPixiItemProjectile({
    sourceX: projectilePart.sourceX,
    sourceY: projectilePart.sourceY,
    sourceWidth: projectilePart.sourceWidth,
    sourceHeight: projectilePart.sourceHeight,
    startX: playerRenderPosition.x + TILE_SIZE / 2,
    startY: playerRenderPosition.y + TILE_SIZE / 2,
    targetX: targetRenderPosition.x + TILE_SIZE / 2,
    targetY: targetRenderPosition.y + TILE_SIZE / 2,
    displaySize: 48,
    rotationOffset: Math.PI / 4,
    speedPixelsPerSecond: 1000,
  });
};

const getPlayerAttackSkillKey = () => {
  const combatData = getEquippedWeaponCombatData();

  if (combatData && combatData.skillName) {
    return combatData.skillName;
  } else {
    return "fist";
  }
};

const getPlayerAttackSkill = () => {
  const skillKey = getPlayerAttackSkillKey();
  if (!(skillKey in playerState.skills)) {
    return 1;
  }
  return playerState.skills[skillKey].level;
};

const getPlayerTotalArmor = () => {
  let totalArmor = 0;
  for (const equipment of Object.values(playerState.equipment)) {
    if (!equipment) {
      continue;
    }
    const itemData = getItemData(equipment.itemId);
    if (!itemData || !itemData.combat || !Number.isFinite(itemData.combat.armor)) {
      continue;
    }
    totalArmor += itemData.combat.armor;
  }
  return totalArmor;
};

const getPlayerShieldDefense = () => {
  if (playerState.equipment.shield) {
    const shield = playerState.equipment.shield;
    const shieldData = getItemData(shield.itemId);
    if (shieldData && shieldData.combat && Number.isFinite(shieldData.combat.shieldDefense)) {
      return shieldData.combat.shieldDefense;
    }
  } else {
    if (playerState.equipment.weapon) {
      const weaponCombatData = getEquippedWeaponCombatData();
      if (weaponCombatData && Number.isFinite(weaponCombatData.defense)) {
        return weaponCombatData.defense;
      }
    }
  }
  return 0;
};

const getTargetCombatData = (target) => {
  if (!target || !target.monsterId) {
    return {
      attack: 0,
      armor: 0,
      defense: 0,
      blockChance: 0,
      hitChance: 0,
    };
  }
  const monsterData = getMonsterData(target.monsterId);
  if (!monsterData || !monsterData.combat) {
    return {
      attack: 0,
      armor: 0,
      defense: 0,
      blockChance: 0,
      hitChance: 0,
    };
  }
  const targetCombatData = monsterData.combat;
  return targetCombatData;
};

const calculatePlayerAttackResult = (target) => {
  const combatModeData = getCombatModeData();
  const targetCombatData = getTargetCombatData(target);
  const weaponCombatData = getEquippedWeaponCombatData();
  const weaponAttack = getPlayerWeaponAttack();
  const attackSkill = getPlayerAttackSkill();
  const hitChanceModifier = Number.isFinite(weaponCombatData?.hitChanceModifier)
    ? weaponCombatData.hitChanceModifier
    : 0;
  const baseHitChance = 65;
  //!!!!! HIT CHANCE !!!!
  let hitChance =
    baseHitChance +
    attackSkill * 1.2 +
    weaponAttack * 1.5 -
    targetCombatData.defense * 2 -
    targetCombatData.blockChance * 0.5;
  hitChance *= combatModeData.attackMultiplier;
  hitChance += hitChanceModifier;
  hitChance = clamp(hitChance, 35, 95);
  //!!!!! ROLL POUR MISS !!!!
  const roll = getRandomInt(1, 100);
  if (roll > hitChance)
    return {
      didHit: false,
      wasBlocked: false,
      finalDamage: 0,
      text: "miss",
      textType: "miss",
    };
  //!!!!! RAW DAMAGE !!!!
  const levelBonus = playerState.level * 0.2;
  let minDamage = levelBonus + attackSkill * 0.25 + weaponAttack * 0.4;
  let maxDamage = levelBonus + attackSkill * 0.6 + weaponAttack * 1.1;
  minDamage = minDamage * combatModeData.attackMultiplier;
  maxDamage = maxDamage * combatModeData.attackMultiplier;
  const rawDamage = getRandomFloat(minDamage, maxDamage);
  //!!!!! BLOCK CHANCE && DAMAGE REDUCTION !!!!
  let wasBlocked = false;
  let blockChance = targetCombatData.blockChance;
  blockChance = clamp(blockChance, 0, 60);
  let defenseReduction = 0;
  const rollBlock = getRandomInt(1, 100);
  if (rollBlock <= blockChance) {
    wasBlocked = true;
    defenseReduction = targetCombatData.defense * getRandomFloat(0.6, 1.2);
  }
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "block",
      textType: "block",
    };
  }
  //!!!!! ARMOR REDUCTION !!!!
  const armorReductionMin = targetCombatData.armor * 0.45;
  const armorReductionMax = targetCombatData.armor * 0.9;
  const armorReduction = getRandomFloat(armorReductionMin, armorReductionMax);
  const damageAfterArmor = damageAfterDefense - armorReduction;
  const finalDamage = Math.max(0, Math.floor(damageAfterArmor));
  if (finalDamage <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "0",
      textType: "absorb",
    };
  } else {
    return {
      didHit: true,
      wasBlocked,
      rawDamage,
      defenseReduction,
      armorReduction,
      finalDamage,
      text: finalDamage,
      textType: "damage",
    };
  }
};

const hasPlayerBlockSource = () => {
  const shield = playerState.equipment.shield;
  const shieldData = shield ? getItemData(shield.itemId) : null;
  if (Number.isFinite(shieldData?.combat?.shieldDefense)) {
    return true;
  }
  const weaponCombatData = getEquippedWeaponCombatData();
  if (weaponCombatData && Number.isFinite(weaponCombatData.defense)) {
    return true;
  }
  return false;
};

const calculateDamageTakenByPlayer = (attackerCombatData, now) => {
  const combatModeData = getCombatModeData();
  const playerArmor = getPlayerTotalArmor();
  const playerShieldDefense = getPlayerShieldDefense();
  const shielding = playerState.skills.shielding.level;
  //!!!!! CHANCE MONSTRE HIT !!!!
  let hitChance = attackerCombatData.hitChance - shielding * 0.4;
  hitChance = clamp(hitChance, 35, 95);
  const roll = getRandomInt(1, 100);
  if (roll > hitChance)
    return {
      didHit: false,
      wasBlocked: false,
      finalDamage: 0,
      text: "miss",
      textType: "miss",
    };
  //!!!!! BLOCK CHANCE && DAMAGE REDUCTION !!!!
  let attackerAttack = 1;
  if (attackerCombatData && Number.isFinite(attackerCombatData.attack)) {
    attackerAttack = Math.max(1, attackerCombatData.attack);
  }
  const rawDamage = getRandomFloat(1, attackerAttack);
  let wasBlocked = false;
  let blockChance = 10 + shielding * 0.8 + playerShieldDefense * 0.8;
  blockChance *= combatModeData.blockChanceMultiplier;
  blockChance = clamp(blockChance, 5, 70);
  let defensePower = 0;
  let defenseReduction = 0;
  if (hasPlayerBlockSource() && canUseShieldingBlock(now)) {
    recordShieldingBlock(now);
    const shield = playerState.equipment.shield;
    const shieldData = shield ? getItemData(shield.itemId) : null;
    if (Number.isFinite(shieldData?.combat?.shieldDefense)) {
      applyShieldingExperienceFromBlockAttempt(now);
    }
    const rollBlock = getRandomInt(1, 100);
    if (rollBlock <= blockChance) {
      wasBlocked = true;
      defensePower = playerShieldDefense * 0.25 + shielding * 0.1;
      defensePower *= combatModeData.defenseMultiplier;
      defenseReduction = getRandomFloat(defensePower * 0.6, defensePower * 1.2);
    }
  }
  const damageAfterDefense = rawDamage - defenseReduction;
  if (damageAfterDefense <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "block",
      textType: "block",
    };
  }
  //!!!!! ARMOR REDUCTION !!!!
  const armorPower = playerArmor * combatModeData.armorMultiplier;
  const armorReductionMin = armorPower * 0.2;
  const armorReductionMax = armorPower * 0.45;
  const armorReduction = getRandomFloat(armorReductionMin, armorReductionMax);
  const damageAfterArmor = damageAfterDefense - armorReduction;
  const finalDamage = Math.max(0, Math.floor(damageAfterArmor));
  if (finalDamage <= 0) {
    return {
      didHit: true,
      wasBlocked,
      finalDamage: 0,
      text: "0",
      textType: "absorb",
    };
  } else {
    return {
      didHit: true,
      wasBlocked,
      rawDamage,
      defenseReduction,
      armorReduction,
      finalDamage,
      text: finalDamage,
      textType: "damage",
    };
  }
};

const calculateRuneAttackResult = (useData) => {
  const runeDamage = useData.damage;
  const magicLevel = playerState.skills.magic.level;
  const level = playerState.level;
  const minDamage = runeDamage + magicLevel * 0.35 + level * 0.1;
  const maxDamage = runeDamage + magicLevel * 0.85 + level * 0.25;
  const finalDamage = Math.floor(getRandomFloat(minDamage, maxDamage));
  return {
    finalDamage,
    text: finalDamage,
    textType: "fire",
  };
};

/* ---------- COMBAT - SORTS ---------- */

const normalizeSpellIncantation = (text) => {
  if (typeof text !== "string") {
    return "";
  }
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
};

const spellsByIncantation = new Map(
  Object.values(spellsDatabase).map((spellData) => [normalizeSpellIncantation(spellData.incantation), spellData]),
);

const getSpellFromChatText = (text) => {
  const normalizedIncantation = normalizeSpellIncantation(text);
  return spellsByIncantation.get(normalizedIncantation) ?? null;
};

const getSpellPowerAmount = (spellData) => {
  const power = spellData?.power;
  const magicLevel = playerState.skills.magic.level;
  if (
    !Number.isFinite(power?.min) ||
    !Number.isFinite(power?.max) ||
    !Number.isFinite(power?.magicLevelMultiplier) ||
    !Number.isFinite(power?.levelMultiplier)
  ) {
    return 0;
  }

  const minimumPower = power.min + magicLevel * power.magicLevelMultiplier + playerState.level * power.levelMultiplier;
  const maximumPower = power.max + magicLevel * power.magicLevelMultiplier + playerState.level * power.levelMultiplier;
  return Math.max(1, Math.floor(getRandomFloat(minimumPower, maximumPower)));
};

const castSelfHealingSpell = (spellData) => {
  if (playerState.hp >= playerState.maxHp) {
    showGameStatusMessage(getGameUiText("fullHealth"));
    return false;
  }

  const restoredAmount = Math.min(getSpellPowerAmount(spellData), playerState.maxHp - playerState.hp);
  playerState.hp += restoredAmount;
  showFloatingTextAbovePlayer(restoredAmount, spellData.textType);
  return true;
};

const castPlayerLightSpell = (spellData) => {
  if (!Number.isFinite(spellData?.durationMs) || !Number.isFinite(spellData?.lightRadius)) {
    return false;
  }
  playerState.spellEffects.light.radius = spellData.lightRadius;
  playerState.spellEffects.light.expiresAt = Date.now() + spellData.durationMs;
  return true;
};

const applyMagicExperienceFromSpell = () => {
  const experienceMultiplier = getSkillExperienceGainMultiplier("magic");
  const experienceAmount = normalizeSkillExperienceGain(SKILL_EXPERIENCE_GAIN_PER_TRY * experienceMultiplier);
  applyExperienceToPlayerSkill("magic", experienceAmount);
};

const castPlayerSpell = (spellData) => {
  if (!spellData) {
    return false;
  }
  if (Array.isArray(spellData.allowedClassIds) && !spellData.allowedClassIds.includes(playerState.classId)) {
    showGameStatusMessage(getGameUiText("spellWrongClass"));
    return false;
  }
  if (playerState.skills.magic.level < spellData.requiredMagicLevel) {
    showGameStatusMessage(getGameUiText("spellMagicLevelRequired")(spellData.requiredMagicLevel));
    return false;
  }
  if (!isUseCooldownReady(spellData.cooldownGroup)) {
    showGameStatusMessage(getGameUiText("exhausted"));
    return false;
  }
  if (playerState.mana < spellData.manaCost) {
    showGameStatusMessage(getGameUiText("spellNotEnoughMana"));
    return false;
  }

  let didCastSpell = false;
  if (spellData.action === "healSelf") {
    didCastSpell = castSelfHealingSpell(spellData);
  } else if (spellData.action === "lightSelf") {
    didCastSpell = castPlayerLightSpell(spellData);
  }
  if (!didCastSpell) {
    return false;
  }

  playerState.mana -= spellData.manaCost;
  startUseCooldown(spellData.cooldownGroup);
  applyMagicExperienceFromSpell();
  refreshPlayerVitalsUi();
  playGameSfx(GAME_SFX.runeUse);
  return true;
};

const playPlayerSpellEffect = (spellData, success) => {
  const surfaceOffsetY = getEntitySurfaceOffsetY(playerState);
  return playPixiSpellEffect({
    x: playerState.x + TILE_SIZE / 2,
    y: playerState.y + TILE_SIZE / 2 - surfaceOffsetY,
    color: spellData?.effectColor,
    success,
  });
};

const announceSuccessfulPlayerSpell = (spellData) => {
  const text = spellData.incantation;
  const message = addChatMessage("local", "player", text, playerState);
  if (!message) {
    return false;
  }
  showFloatingTextAboveTarget(text, 70, playerState, "speech", 4000);
  if (activeChatChannelId === "local") {
    renderActiveChatMessages();
  }
  return true;
};

const castLearnedPlayerSpellById = (spellId) => {
  const spellData = spellsDatabase[spellId] ?? null;
  if (!spellData || !isPlayerSpellLearned(spellId)) {
    showGameStatusMessage(getGameUiText("spellNotLearned"));
    playPlayerSpellEffect(spellData, false);
    return false;
  }

  const didCastSpell = castPlayerSpell(spellData);
  playPlayerSpellEffect(spellData, didCastSpell);
  if (!didCastSpell) {
    return false;
  }
  announceSuccessfulPlayerSpell(spellData);
  return true;
};

const castPlayerSpellFromHotkeyKey = (key) => {
  const hotkeyIndex = SPELL_HOTKEY_KEYS.indexOf(key);
  if (hotkeyIndex === -1) {
    return false;
  }
  const spellId = playerState.spellbook.hotkeySpellIds[hotkeyIndex];
  if (spellId) {
    castLearnedPlayerSpellById(spellId);
  }
  return true;
};

const getExperienceRewardFromMonster = (monster) => {
  if (!monster) {
    return 0;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return 0;
  }
  if (!("experience" in monsterData)) {
    return 0;
  }
  return monsterData.experience;
};

const addExperienceGainFeedback = (experienceAmount, sourceName = null) => {
  if (!Number.isFinite(experienceAmount)) {
    return;
  }
  let logMessage = getGameUiText("experienceGained")(experienceAmount);
  if (sourceName != null) {
    logMessage = getGameUiText("experienceGainedFrom")(experienceAmount, sourceName);
  }
  addLogMessage(logMessage, "experience");
};

const applyExperienceToPlayer = (experience) => {
  if (!Number.isFinite(experience) || experience <= 0) {
    return false;
  }

  playerState.experience += experience;
  return true;
};

const applyExperienceToPlayerFromMonster = (monster) => {
  if (!monster) {
    return false;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return false;
  }
  const monsterExperienceReward = getExperienceRewardFromMonster(monster);
  if (monsterExperienceReward <= 0) {
    return false;
  }
  if (applyExperienceToPlayer(monsterExperienceReward)) {
    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    addExperienceGainFeedback(monsterExperienceReward, localizedMonsterData.name);
    return true;
  }
  return false;
};

const getDamageAppliedToMonster = (monster, attackResult) => {
  if (!monster || !attackResult) {
    return 0;
  }
  return clamp(attackResult.finalDamage, 0, monster.hp);
};

const createMonsterBloodPuddle = (monster, monsterData, decayStage) => {
  if (!monster || typeof monsterData?.bloodEffectId !== "string") {
    return null;
  }
  return createFluidPuddle(monsterData.bloodEffectId, monster.x, monster.y, monster.z, decayStage);
};

const applyDamageToMonster = (monster, attackResult) => {
  if (!monster || monster.hp <= 0) {
    return;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return;
  }
  const damageAmount = getDamageAppliedToMonster(monster, attackResult);

  if (Number.isFinite(damageAmount) && damageAmount > 0) {
    const bloodDecayStage = damageAmount >= monster.hp ? 0 : 1;
    createMonsterBloodPuddle(monster, monsterData, bloodDecayStage);
    monster.hp -= damageAmount;

    const localizedMonsterData = getLocalizedMonsterData(monster.monsterId) ?? monsterData;
    const logMessage = getGameUiText("damageDealt")(damageAmount, localizedMonsterData.name);
    addLogMessage(logMessage, "combat");
    showFloatingTextAboveMonster(monster, damageAmount, attackResult.textType);
    monsterHpRefresh(monster);
    if (isMonsterDead(monster)) {
      handleMonsterKilledByPlayer(monster);
    }
  }
};

const handleMonsterKilledByPlayer = (monster) => {
  if (!monster) {
    return;
  }
  const deathSfxByMonsterId = {
    rat: GAME_SFX.ratDeath,
    spider: GAME_SFX.spiderDeath,
  };
  const deathSfx = deathSfxByMonsterId[monster.monsterId];
  if (deathSfx) {
    playGameSfx(deathSfx);
  }
  handleMonsterDeath(monster);
  if (applyExperienceToPlayerFromMonster(monster)) {
    updatePlayerExperience();
  }
};

/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const playPlayerAttackResultSfx = (attackResult) => {
  if (!attackResult?.didHit) {
    return false;
  }
  if (attackResult.textType === "block") {
    return playGameSfx(GAME_SFX.block);
  }
  if (attackResult.textType === "absorb") {
    return playGameSfx(GAME_SFX.armorBlock);
  }
  if (attackResult.finalDamage <= 0) {
    return false;
  }

  const weaponType = getEquippedWeaponCombatData()?.weaponType ?? "fist";
  const attackSfxByWeaponType = {
    bow: GAME_SFX.arrowAttack,
    sword: GAME_SFX.swordSlice,
    mace: GAME_SFX.maceSlice,
    axe: GAME_SFX.axeSlice,
  };
  const attackSfx = attackSfxByWeaponType[weaponType];
  if (!attackSfx) {
    return false;
  }
  return playGameSfx(attackSfx);
};

const attackMonster = (monster, now) => {
  if (
    playerNavigationState.followEnabled &&
    selectedMonsterUid === monster.uid &&
    playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.follow
  ) {
    startPlayerFollowNavigation();
  }

  if (!consumePlayerWeaponAmmunition()) {
    return;
  }

  playPlayerWeaponProjectile(monster);
  const attackResult = calculatePlayerAttackResult(monster);
  const skillKey = getPlayerAttackSkillKey();
  applySkillExperienceFromAttack(attackResult, skillKey, now);

  if (attackResult.finalDamage > 0) {
    applyDamageToMonster(monster, attackResult);
    playPlayerAttackResultSfx(attackResult);
    return;
  }
  showFloatingTextAboveMonster(monster, attackResult.text, attackResult.textType);
  playPlayerAttackResultSfx(attackResult);
};

const updateCombat = (now) => {
  if (selectedMonsterUid === null) {
    return;
  }
  const monster = findMonsterByUid(selectedMonsterUid);
  if (!monster) {
    loseSelectedMonsterTarget();
    return;
  }
  if (!isNearPlayer(monster, getPlayerAttackRange())) {
    return;
  }
  if (now < nextPlayerAttackTime) {
    return;
  }
  const weaponCombatData = getEquippedWeaponCombatData();
  if (weaponCombatData?.projectileItemId && !hasPlayerLineOfSightToEntity(monster)) {
    return;
  }
  attackMonster(monster, now);
  nextPlayerAttackTime = now + PLAYER_ATTACK_COOLDOWN_MS;
};
//#endregion  -----  COMBAT - JOUEUR, MONSTRES ET RUNES  -----

/* ==================================================== */
//#region     -----  CHAT / MESSAGE  -----
/* ==================================================== */
/* ---------- CHAT / MESSAGE ---------- */
const chatChannels = {
  local: { channelId: "local", labelKey: "localChannel", canSendMessage: true, maxMessages: 100 },
  global: { channelId: "global", labelKey: "globalChannel", canSendMessage: true, maxMessages: 100 },
  trade: { channelId: "trade", labelKey: "tradeChannel", canSendMessage: true, maxMessages: 100 },
  logs: { channelId: "logs", labelKey: "logsChannel", canSendMessage: false, maxMessages: 100 },
};

const chatMessages = {
  local: [],
  global: [],
  trade: [],
  logs: [],
};

const chatUi = {
  root: chat,
  tabsRoot: chatTabs,
  input: chatInput,
};

const chatInputHistoryState = {
  entries: [],
  cursorIndex: 0,
  draft: "",
  maxEntries: 50,
};

let activeChatChannelId = "local";

const getChatChannelData = (channelId) => {
  if (!channelId || !isValidChatChannel(channelId)) {
    return null;
  }
  return chatChannels[channelId];
};

const isValidChatChannel = (channelId) => {
  return channelId in chatChannels;
};

const setActiveChatChannel = (channelId) => {
  if (!channelId || !isValidChatChannel(channelId)) {
    return;
  }
  activeChatChannelId = channelId;
};

const createChatMessage = (channelId, messageType, text, speakerData = null, speechSuggestions = []) => {
  const now = Date.now();
  if (!speakerData) {
    return {
      channelId,
      messageType,
      text,
      speakerName: null,
      speakerLevel: null,
      speechSuggestions: getNpcReplySuggestions(speechSuggestions),
      createdAt: now,
    };
  } else {
    return {
      channelId,
      messageType,
      text,
      speakerName: speakerData.name,
      speakerLevel: speakerData.level,
      speechSuggestions: getNpcReplySuggestions(speechSuggestions),
      createdAt: now,
    };
  }
};

const addChatMessage = (channelId, messageType, text, speakerData = null, speechSuggestions = []) => {
  if (!channelId || !isValidChatChannel(channelId) || isEmpty(text)) {
    return null;
  }
  const chatMessage = createChatMessage(channelId, messageType, text, speakerData, speechSuggestions);
  if (!chatMessage) {
    return null;
  }
  const channelData = getChatChannelData(channelId);
  if (!channelData) {
    return null;
  }
  const chatMessageTab = getChatMessagesForChannel(channelId);
  if (!chatMessageTab) {
    return null;
  }
  chatMessageTab.push(chatMessage);
  while (chatMessageTab.length > channelData.maxMessages) {
    chatMessageTab.shift();
  }
  return chatMessage;
};

const getChatMessagesForChannel = (channelId) => {
  if (!channelId || !(channelId in chatMessages)) {
    return [];
  }
  return chatMessages[channelId];
};

const formatChatMessageTime = (chatMessage) => {
  if (!chatMessage || !("createdAt" in chatMessage)) {
    return "XX:XX";
  }
  const timestamp = chatMessage.createdAt;
  if (!Number.isFinite(timestamp)) {
    return "XX:XX";
  }
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatChatSpeakerLabel = (chatMessage) => {
  if (!chatMessage || !("speakerName" in chatMessage) || !chatMessage.speakerName) {
    return "";
  }
  if (!("speakerLevel" in chatMessage) || !Number.isFinite(chatMessage.speakerLevel)) {
    return `${chatMessage.speakerName}:`;
  }
  return `${chatMessage.speakerName} [${chatMessage.speakerLevel}]:`;
};

const formatChatMessageText = (chatMessage) => {
  const messageTime = formatChatMessageTime(chatMessage);
  const speakerLabel = formatChatSpeakerLabel(chatMessage);
  let text = "";
  if ("text" in chatMessage && !isEmpty(chatMessage.text)) {
    text = chatMessage.text;
  }
  return `${messageTime} ${speakerLabel} ${text}`;
};

const createChatMessageElement = (chatMessage) => {
  if (!chatMessage || !("messageType" in chatMessage)) {
    return null;
  }
  const text = formatChatMessageText(chatMessage);
  const chatElement = document.createElement("div");
  chatElement.classList.add("chat-message");
  chatElement.classList.add(`chat-message-${chatMessage.messageType}`);
  const textElement = document.createElement("span");
  textElement.textContent = text;
  chatElement.appendChild(textElement);

  if (Array.isArray(chatMessage.speechSuggestions) && chatMessage.speechSuggestions.length > 0) {
    const suggestionsElement = document.createElement("span");
    suggestionsElement.classList.add("npc-dialogue-suggestions");
    const suggestionsLabelElement = document.createElement("span");
    suggestionsLabelElement.classList.add("npc-dialogue-suggestions-label");
    suggestionsLabelElement.textContent = getGameUiText("npcOptionsLabel");
    suggestionsElement.appendChild(suggestionsLabelElement);
    for (const suggestion of chatMessage.speechSuggestions) {
      const optionButton = document.createElement("button");
      optionButton.classList.add("npc-dialogue-option");
      optionButton.type = "button";
      optionButton.textContent = suggestion;
      optionButton.setAttribute("aria-label", getGameUiText("sayNpcOption")(suggestion));
      optionButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (sendPlayerChatMessage(suggestion)) {
          addChatInputHistoryEntry(suggestion);
        }
      });
      suggestionsElement.appendChild(optionButton);
    }
    chatElement.appendChild(suggestionsElement);
  }
  return chatElement;
};

const renderActiveChatMessages = () => {
  chatUi.root.textContent = "";
  const messages = getChatMessagesForChannel(activeChatChannelId);
  for (const message of messages) {
    const messageElement = createChatMessageElement(message);
    if (messageElement) {
      chatUi.root.appendChild(messageElement);
    }
  }
  chatUi.root.scrollTop = chatUi.root.scrollHeight;
};

const getActiveChatChannelData = () => {
  const activeChatChannelData = getChatChannelData(activeChatChannelId);
  if (activeChatChannelData) {
    return activeChatChannelData;
  }
  return null;
};

const canSendMessageInActiveChatChannel = () => {
  const activeChatChannelData = getActiveChatChannelData();
  if (!activeChatChannelData || !("canSendMessage" in activeChatChannelData)) {
    return false;
  }
  return activeChatChannelData.canSendMessage === true;
};

const sendPlayerChatMessage = (text) => {
  if (!text || !canSendMessageInActiveChatChannel()) {
    return false;
  }
  if (activeChatChannelId === "local") {
    const spellData = getSpellFromChatText(text);
    if (spellData) {
      castLearnedPlayerSpellById(spellData.spellId);
      return true;
    }
  }
  const message = addChatMessage(activeChatChannelId, "player", text, playerState);
  if (!message) {
    return false;
  }
  if (activeChatChannelId === "local") {
    showFloatingTextAboveTarget(text, 70, playerState, "speech", 4000);
    handleNpcPlayerSpeech(text, playerState, Date.now());
  }
  renderActiveChatMessages();
  return true;
};

const createChatTabButtonElement = (channelData) => {
  if (!channelData) {
    return null;
  }
  const bouton = document.createElement("div");
  bouton.classList.add("chat-tab-bouton");
  bouton.textContent = getGameUiText(channelData.labelKey);
  if (channelData.channelId === activeChatChannelId) {
    bouton.classList.add("chat-tab-bouton-active");
  }
  bouton.addEventListener("click", (e) => {
    setActiveChatChannel(channelData.channelId);
    refreshChatUi();
  });
  return bouton;
};

const renderChatTabs = () => {
  chatUi.tabsRoot.textContent = "";
  for (const tab of Object.values(chatChannels)) {
    const tabElement = createChatTabButtonElement(tab);
    if (!tabElement) {
      continue;
    }
    chatUi.tabsRoot.appendChild(tabElement);
  }
};

const refreshChatUi = () => {
  renderChatTabs();
  renderActiveChatMessages();
};

const clearChatInput = () => {
  chatUi.input.value = "";
};

const addChatInputHistoryEntry = (text) => {
  if (typeof text !== "string" || text === "") {
    return;
  }
  if (chatInputHistoryState.entries.at(-1) !== text) {
    chatInputHistoryState.entries.push(text);
  }
  while (chatInputHistoryState.entries.length > chatInputHistoryState.maxEntries) {
    chatInputHistoryState.entries.shift();
  }
  chatInputHistoryState.cursorIndex = chatInputHistoryState.entries.length;
  chatInputHistoryState.draft = "";
};

const navigateChatInputHistory = (direction) => {
  const history = chatInputHistoryState.entries;
  if (history.length === 0 || (direction !== -1 && direction !== 1)) {
    return false;
  }

  if (chatInputHistoryState.cursorIndex === history.length) {
    chatInputHistoryState.draft = chatUi.input.value;
  }

  chatInputHistoryState.cursorIndex = clamp(chatInputHistoryState.cursorIndex + direction, 0, history.length);
  chatUi.input.value =
    chatInputHistoryState.cursorIndex === history.length
      ? chatInputHistoryState.draft
      : history[chatInputHistoryState.cursorIndex];
  chatUi.input.setSelectionRange(chatUi.input.value.length, chatUi.input.value.length);
  return true;
};

const handleChatInputSubmit = () => {
  const text = chatUi.input.value;
  if (sendPlayerChatMessage(text)) {
    addChatInputHistoryEntry(text);
    clearChatInput();
  }
};

/* ---------- CHAT / MESSAGE ---------- */
const focusChatInput = () => {
  resetMovementKeys();
  chatUi.input.focus();
};

const blurChatInput = () => {
  chatUi.input.blur();
  if (gameRuntimeState.isStarted && !characterSelectorUiState.isOpen) {
    game.focus({ preventScroll: true });
  }
};

const isChatInputFocused = () => {
  return document.activeElement === chatUi.input;
};

const addLogMessage = (text, messageType) => {
  if (!text) {
    return false;
  }
  const message = addChatMessage("logs", messageType, text);
  if (!message) {
    return false;
  }
  if (activeChatChannelId === "logs") {
    renderActiveChatMessages();
  }
  return true;
};

//#endregion  -----  CHAT / MESSAGE  -----

/* ==================================================== */
//#region     -----  EVENEMENTS DU JEU  -----
/* ==================================================== */
/* ---------- EVENEMENTS - SOURIS ET MENU CONTEXTE ---------- */

const handlePlayerNavigationClick = (e) => {
  if (
    !gameRuntimeState.isStarted ||
    characterSelectorUiState.isOpen ||
    e.button !== 0 ||
    e.target.closest(".quest-window") ||
    e.target.closest(".options-window")
  ) {
    return false;
  }

  if (inputState.shouldBlockNextWorldClick) {
    inputState.shouldBlockNextWorldClick = false;
    return true;
  }

  if (dragState.isDragging || itemUseState.isUsingItem || inputState.isLookComboTriggered) {
    return false;
  }

  const target = getPointerTargetFromEvent(e);
  if (!target?.pointerInsideMap || !target.tile) {
    return false;
  }

  startPlayerClickNavigation(target.tile);
  return true;
};

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!gameRuntimeState.isStarted || characterSelectorUiState.isOpen) {
    return;
  }
  if (shouldBlockContextMenuAction()) {
    return;
  }
  const target = getPointerTargetFromEvent(e);
  if (handleNpcGreetingFromPointerTarget(target)) {
    return;
  }
  if (handleInteractableContextMenu(target)) {
    return;
  }
  if (handleTransitionContextMenu(target)) {
    return;
  }
});
boiteJeux.addEventListener("mousedown", (e) => {
  e.preventDefault();
  blurActiveTextInput();
});
boiteJeux.addEventListener("mouseup", (e) => {
  e.preventDefault();
});
game.addEventListener("click", (e) => {
  e.preventDefault();
  handlePlayerNavigationClick(e);
});
minimapCanvas?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startMinimapPan(e);
});
minimapCanvas?.addEventListener("pointermove", (e) => {
  e.preventDefault();
  e.stopPropagation();
  updateMinimapPan(e);
});
minimapCanvas?.addEventListener("pointerup", (e) => {
  e.preventDefault();
  e.stopPropagation();
  finishMinimapPan(e, true);
});
minimapCanvas?.addEventListener("pointercancel", (e) => {
  e.preventDefault();
  e.stopPropagation();
  finishMinimapPan(e, false);
});
minimapCanvas?.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    adjustMinimapZoom(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);
minimapZoomOutButton?.addEventListener("click", (e) => {
  e.preventDefault();
  adjustMinimapZoom(-1);
});
minimapZoomInButton?.addEventListener("click", (e) => {
  e.preventDefault();
  adjustMinimapZoom(1);
});
minimapCenterButton?.addEventListener("click", (e) => {
  e.preventDefault();
  centerMinimapOnPlayer();
});
minimapFloorUpButton?.addEventListener("click", (e) => {
  e.preventDefault();
  changeMinimapFloor(1);
});
minimapFloorDownButton?.addEventListener("click", (e) => {
  e.preventDefault();
  changeMinimapFloor(-1);
});
boiteJeux.addEventListener("click", (e) => {
  e.preventDefault();
});
characterSelector?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("click", (e) => {
  e.stopPropagation();
});
characterSelector?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("click", (e) => {
  e.stopPropagation();
});
gameOptionsWindow?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
playerSpells?.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("pointerup", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("click", (e) => {
  e.stopPropagation();
});
playerSpells?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleChatInputSubmit();
    blurChatInput();
    return;
  } else if (e.key === "ArrowUp") {
    if (navigateChatInputHistory(-1)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  } else if (e.key === "ArrowDown") {
    if (navigateChatInputHistory(1)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    blurChatInput();
    return;
  }
});

document.addEventListener("focusin", (e) => {
  if (e.target?.matches("input, textarea")) {
    resetMovementKeys();
  }
});

document.addEventListener("mouseup", (e) => {
  if (!dragState.isDragging) {
    resetDragStatePending();
    return;
  }

  if (e.target.closest(".container-slot") || e.target.closest("[data-equipment-slot]") || e.target.closest(".hitbox")) {
    return;
  }

  cancelItemDrag();
});
//#endregion  -----  EVENEMENTS DU JEU  -----

/* ==================================================== */
//#region     -----  BOUCLE DE JEU  -----
/* ==================================================== */
/* ---------- BOUCLE DE JEU - UPDATE PRINCIPAL ---------- */
const updateFpsCounter = (frameTime) => {
  if (!fpsCounter) {
    return;
  }
  fpsFrameCount++;
  if (fpsLastUpdateTime === 0) {
    fpsLastUpdateTime = frameTime;
  }
  const elapsed = frameTime - fpsLastUpdateTime;
  if (elapsed >= 1000) {
    currentFps = Math.round((fpsFrameCount * 1000) / elapsed);
    fpsCounter.textContent = `FPS: ${currentFps}`;
    fpsFrameCount = 0;
    fpsLastUpdateTime = frameTime;
  }
};

const updateGameLogic = (now) => {
  updatePlayerFollowNavigation(now);
  updatePlayerActionNavigation(now);
  updateMovement(now);
  updateCombat(now);
  updatePlayerRegeneration(now);
  updateNpcConversations(now);
  updateNpcMovement(now);

  const activeMonsters = getActiveMonstersAroundPlayer();
  updateMonsterMovement(now, activeMonsters);
  updateMonsterCombat(now, activeMonsters);
  updateMonsterRespawns(now);
  updateCorpseDecay(now);
  updateGroundEffectDecay(now);
  updateTorchFuel(now);
};

const renderGameFrame = (now) => {
  updateRenderPositions(now);
  updateWorldRender();
  updateItemCooldownOverlays(now);
};

const gameLoop = (frameTime) => {
  if (previousFrameTime === null) {
    previousFrameTime = frameTime;
    requestAnimationFrame(gameLoop);
    return;
  }
  const frameDelta = Math.min(frameTime - previousFrameTime, MAX_FRAME_DELTA_MS);
  previousFrameTime = frameTime;
  accumulatedLogicTime += frameDelta;
  const logicNow = Date.now();
  let logicSteps = 0;
  while (accumulatedLogicTime >= GAME_LOGIC_STEP_MS && logicSteps < MAX_LOGIC_STEPS_PER_FRAME) {
    updateGameLogic(logicNow);
    accumulatedLogicTime -= GAME_LOGIC_STEP_MS;
    logicSteps++;
  }
  if (logicSteps >= MAX_LOGIC_STEPS_PER_FRAME) {
    accumulatedLogicTime = 0;
  }
  const renderNow = Date.now();
  renderGameFrame(renderNow);
  updateFpsCounter(frameTime);
  requestAnimationFrame(gameLoop);
};

//#endregion  -----  BOUCLE DE JEU  -----

/* ==================================================== */
//#region     -----  INITIALISATION DU JEU  -----
/* ==================================================== */
/* ---------- INITIALISATION - DONNEES TEST ---------- */
const setupTestWorld = () => {
  addGroundItem(createGroundItem("smallBox", 1, 13 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 14 * TILE_SIZE, 9 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("box", 1, 14 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("fireRune", 1, 14 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 14 * TILE_SIZE, 11 * TILE_SIZE, playerState.z));
  addGroundItem(createGroundItem("smallBox", 1, 15 * TILE_SIZE, 10 * TILE_SIZE, playerState.z));
};

const setupTestPlayerInventory = () => {
  playerState.equipment.backpack = createItemInstance("bag", 1);
  playerState.equipment.backpack.content[0] = createItemInstance("apple", 1);
  playerState.equipment.backpack.content[1] = createItemInstance("healthPotion", 1);
  playerState.equipment.backpack.content[2] = createItemInstance("manaPotion", 1);
  playerState.equipment.weapon = createItemInstance("mace", 1);
  playerState.equipment.ammo = createItemInstance("torch", 1);
};

/* ---------- INITIALISATION - UI JOUEUR ---------- */
const initializePlayerUi = () => {
  initializePlayerRenderRefs();
  applyGameOptions();
  refreshChatUi();
  updateGameScale();
  showPlayerName(playerState.name);
  updatePlayerSprite();
  refreshInventoryUi();
  syncPlayerDerivedStats();
  refreshPlayerVitalsUi();
};

/* ---------- INITIALISATION - DEMARRAGE ---------- */
const startGame = async () => {
  if (gameRuntimeState.isStarting || gameRuntimeState.isStarted) {
    return false;
  }
  gameRuntimeState.isStarting = true;

  try {
    const loadedCharacterSnapshot = loadInitialCharacterSnapshot();
    if (!loadedCharacterSnapshot) {
      setupTestPlayerInventory();
    }
    setupTestWorld();
    const worldMapsByZ = loadWorldMaps();

    await initializePixiRenderer({
      htmlParentElement: game,
      gameWidth: GAME_WIDTH,
      gameHeight: GAME_HEIGHT,
    });
    await loadPixiWorldEntityTextures({
      playerTextureUrl: getPlayerAppearanceData().textureUrl,
      itemTextureUrl: getAtlasPath("items"),
      monsterTextureUrl: getAtlasPath("monsters"),
      npcTextureUrlsById: getNpcTextureUrlsById(),
    });

    pixiWorldRenderState.worldMapsByZ = worldMapsByZ;
    const didRestoreSavedPosition =
      loadedCharacterSnapshot && applyCharacterSavePosition(loadedCharacterSnapshot, worldMapsByZ);
    if (!didRestoreSavedPosition) {
      playerState.z = playerState.spawn.z;
      pixiWorldRenderState.currentZ = playerState.z;
      const worldMap = worldMapsByZ.get(playerState.spawn.z);
      const playerSpawn = findPlayerSpawnInWorldMap(worldMap, playerState.spawn.spawnId);
      applyPlayerSpawn(playerSpawn);
    }
    initializeNpcsForWorldMaps(worldMapsByZ);
    spawnInitialMonstersForWorldMaps(worldMapsByZ);
    await updatePixiVisibleChunksAroundPlayer();

    initializePlayerUi();

    if (!loadedCharacterSnapshot) {
      saveCharacterSnapshot(createCharacterSaveSnapshot());
    }

    renderInitialWorld();
    gameRuntimeState.isStarted = true;
    preloadGameSfx();
    startGameMusic();
    startCharacterAutosave();
    if (!gameRuntimeState.isLoopRunning) {
      gameRuntimeState.isLoopRunning = true;
      requestAnimationFrame(gameLoop);
    }
    return true;
  } finally {
    gameRuntimeState.isStarting = false;
  }
};

const shouldEnterGameImmediately = initializeGameWelcome();
if (shouldEnterGameImmediately) {
  startGame();
}

//#endregion  -----  INITIALISATION DU JEU  -----

/* ==================================================== */
//#region     -----  DEBUG CONSOLE  -----
/* ==================================================== */
/* ---------- DEBUG - LOGS TEMPORAIRES ---------- */

//#endregion  -----  DEBUG CONSOLE  -----
