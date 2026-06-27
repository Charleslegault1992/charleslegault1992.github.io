/* ==================================================== */
//#region     -----  BASE - ELEMENTS HTML  -----
/* ==================================================== */
const panneauGauche = document.querySelector(".jeux-gauche");
const panneauDroite = document.querySelector(".jeux-droite");
const boitePrincipale = document.querySelector("#boite-principal");
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
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
//#endregion  -----  BASE - ELEMENTS HTML  -----

/* ==================================================== */
//#region     -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----
/* ==================================================== */
/* ---------- BASE - DIMENSIONS ET ATLAS ---------- */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
let GAME_SCALE = 1;
const TILE_SIZE = 64;
const PLAYER_SIZE = TILE_SIZE;
const MOVE_SPEED = TILE_SIZE;
const MAP_COLS = GAME_WIDTH / TILE_SIZE;
const MAP_ROWS = GAME_HEIGHT / TILE_SIZE;
const SPRITE_SIZE = 64;
const ATLAS_CELL_SIZE = 66;
const ATLAS_PADDING = 1;

/* ---------- BASE - TILES ---------- */

const FLOOR = 0;
const WALL = 1;

/* ---------- BASE - UID ET SELECTION ---------- */

let nextItemInstanceId = 1;
let nextMonsterUid = 1;
let selectedMonsterUid = null;

/* ---------- BASE - COLLECTIONS MONDE ---------- */
const monsterElementsByUid = new Map();
const worldItemElementsByUid = new Map();
const tileRenderRefs = [];
const renderState = {
  lastCameraX: null,
  lastCameraY: null,
};
const worldItems = [];
const decayingItems = [];
const monsters = [];
const openedContainers = [];

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
const playerSpawnX = 13 * TILE_SIZE;
const playerSpawnY = 8 * TILE_SIZE;

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

/* ---------- BASE - ETAT ITEM USE ---------- */

const itemUseState = {
  isUsingItem: false,
  source: null,
  item: null,
  useData: null,
  startedAt: null,
};

//#endregion  -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----

/* ==================================================== */
//#region     -----  BASE DE DONNEES  -----
/* ==================================================== */
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
    blockMovement: true,
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
      heal: 100,
      range: 1,
      cooldownGroup: "item",
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
    desc: "An old rusty sword. (ATK: 6)",
    type: "weapon",
    equipmentSlot: ["weapon"],
    suffix: "a",
    weight: 25,
    stackable: false,
    blockMovement: false,
    combat: {
      weaponType: "sword",
      attack: 6,
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
        chance: 30,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
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

/* ---------- TIMING - MONSTRES ---------- */

const MONSTER_ATTACK_COOLDOWN_MS = 1500;

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
//#endregion  -----  PLAYER - CONFIG SPRITE  -----

/* ==================================================== */
//#region     -----  PLAYER  -----
/* ==================================================== */
/* ---------- JOUEUR - DONNEES ---------- */

const playerState = {
  x: playerSpawnX,
  y: playerSpawnY,
  oldX: playerSpawnX,
  oldY: playerSpawnY,
  renderX: playerSpawnX,
  renderY: playerSpawnY,
  moveStartTime: 0,
  moveDuration: 0,
  name: "Charles",
  hp: 100,
  maxHp: 100,
  mana: 0,
  maxMana: 0,
  level: 0,
  experience: 0,
  classId: "noClass",
  gold: 0,
  damage: 5,
  skillTraining: {
    lastEffectiveHitAt: 0,
    shieldingBlockCount: 0,
    shieldingBlockCooldownStartedAt: 0,
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
  light: 900,
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
  const x = -colonne * PLAYER_FRAME_WIDTH;
  const y = -ligne * PLAYER_FRAME_HEIGHT;
  player.style.backgroundPosition = `${x}px ${y}px`;
};

const updatePlayerPosition = () => {
  player.style.left = `${playerState.renderX - camera.x}px`;
  player.style.top = `${playerState.renderY - camera.y - TILE_SIZE}px`;
  player.style.zIndex = playerState.y;
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
  },
};

const getPlayerClassData = () => {
  const classId = playerState.classId;
  if (classId in playerClassesDatabase) {
    return playerClassesDatabase[classId];
  }
  return playerClassesDatabase.noClass;
};

const getPlayerBaseStats = () => {
  return {
    maxHp: 100,
    maxMana: 0,
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
  const capacity = baseStats.capacity + level * classData.levelUpGains.capacity;

  return {
    maxHp,
    maxMana,
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
  playerState.capacity = playerDerivedStats.capacity;
  if (playerState.hp > playerState.maxHp) {
    playerState.hp = playerState.maxHp;
  }
  if (playerState.mana > playerState.maxMana) {
    playerState.mana = playerState.maxMana;
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
  playerState.x = playerSpawnX;
  playerState.y = playerSpawnY;
  playerState.renderX = playerSpawnX;
  playerState.renderY = playerSpawnY;
  playerState.oldX = playerSpawnX;
  playerState.oldY = playerSpawnY;
  playerState.moveStartTime = 0;
  playerState.moveDuration = 0;
};

const hpRefresh = () => {
  const playerHp = playerRenderRefs.hp;
  if (playerHp) {
    playerHp.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
    playerHp.style.setProperty("--hp-color", getHpColor(playerState.hp, playerState.maxHp));
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
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, [bag]));
  } else {
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y));
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
  cancelItemDrag();
  cancelItemUse();
  clearMonsterSelection();
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

/* ---------- MAP - AFFICHAGE DOM ---------- */

const renderMap = (map) => {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const tileValue = map[row][col];
      const div = document.createElement("div");
      div.classList.add("tile");
      div.setAttribute("data-row", row);
      div.setAttribute("data-col", col);
      if (tileValue === FLOOR) {
        div.classList.add("floor");
      } else if (tileValue === WALL) {
        div.classList.add("wall");
      }
      const worldX = col * TILE_SIZE;
      const worldY = row * TILE_SIZE;
      div.style.left = `${worldX - camera.x}px`;
      div.style.top = `${worldY - camera.y}px`;
      game.appendChild(div);
      tileRenderRefs.push({
        element: div,
        row,
        col,
      });
    }
  }
};

/* ---------- MAP - COLLISIONS ET LIMITES ---------- */

const isInsideMap = (testX, testY) => {
  return testX >= 0 && testX <= mapWidth - PLAYER_SIZE && testY >= 0 && testY <= mapHeight - PLAYER_SIZE;
};

const canMoveTo = (testX, testY) => {
  if (!isInsideMap(testX, testY)) {
    return false;
  }
  const nextCol = testX / TILE_SIZE;
  const nextRow = testY / TILE_SIZE;
  const nextTile = gameMap[nextRow][nextCol];
  return nextTile === FLOOR;
};

const updateMapPosition = () => {
  for (const tileRef of tileRenderRefs) {
    const tile = tileRef?.element ?? null;
    const row = tileRef?.row ?? null;
    const col = tileRef?.col ?? null;
    if (!tile || row === null || col === null) {
      continue;
    }
    const worldX = col * TILE_SIZE;
    const worldY = row * TILE_SIZE;
    tile.style.left = `${worldX - camera.x}px`;
    tile.style.top = `${worldY - camera.y}px`;
  }
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
    return "./images/items/items-sheet.png";
  }
  if (atlasName === "monsters") {
    return "./images/monstres/monsters-sheet.png";
  }
  console.error(`atlasName: ${atlasName} n'existe pas`);
};

/* ---------- OUTILS - SOURIS ---------- */
const isMouseInsideMap = (mousePosition) => {
  if (!mousePosition || !Number.isFinite(mousePosition.worldX) || !Number.isFinite(mousePosition.worldY)) {
    return false;
  }
  return (
    mousePosition.worldX >= 0 &&
    mousePosition.worldX < mapWidth &&
    mousePosition.worldY >= 0 &&
    mousePosition.worldY < mapHeight
  );
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
    if (itemData.stackable) {
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

const getItemRenderPartPosition = (item, part) => {
  return {
    left: item.x - camera.x + part.offsetX,
    top: item.y - camera.y + part.offsetY,
    zIndex: item.y + part.zOffset - 1,
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  };
};

const getItemRenderPartsPositions = (item) => {
  if (!item) {
    return [];
  }
  const parts = getItemRenderData(item);
  return parts.map((part) => {
    return getItemRenderPartPosition(item, part);
  });
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

const createGroundItem = (itemId, quantity, x, y, content = []) => {
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
  return worldItem;
};

/* ---------- ITEMS - CREATION DOM ---------- */

const createItemPartElement = (item, part, partIndex) => {
  const itemData = getItemData(item.itemId);
  const atlasPath = getAtlasPath(itemData.render.atlas);
  const div = document.createElement("div");
  div.classList.add("world-item-part");
  div.style.backgroundImage = `url("${atlasPath}")`;
  div.setAttribute("data-item-uid", item.uid);
  div.setAttribute("data-part-index", partIndex);

  div.style.backgroundPosition = `-${part.sourceX}px -${part.sourceY}px`;
  div.style.backgroundRepeat = "no-repeat";
  return div;
};

const createWorldItemHitbox = (item) => {
  const itemData = getItemData(item.itemId);
  const hitbox = document.createElement("div");
  hitbox.setAttribute("data-item-uid", item.uid);
  hitbox.classList.add("hitbox");
  hitbox.style.width = `${TILE_SIZE}px`;
  hitbox.style.height = `${TILE_SIZE}px`;
  hitbox.style.left = `${item.x - camera.x}px`;
  hitbox.style.top = `${item.y - camera.y}px`;
  hitbox.style.zIndex = `${item.y}`;

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

    if (!itemData) {
      return;
    }

    const source = {
      locationType: "worldItem",
      itemUid: item.uid,
    };
    handleUseItemFromSource(source);
  });
  return hitbox;
};

const renderGroundItemParts = (item) => {
  if (!item) {
    return;
  }
  const enrichedParts = getItemRenderData(item);
  if (enrichedParts.length <= 0) {
    return;
  }
  const partElements = [];
  enrichedParts.forEach((enrichedPart, index) => {
    const div = createItemPartElement(item, enrichedPart, index);
    const position = getItemRenderPartPosition(item, enrichedPart);
    applyItemRenderPartPosition(div, position);
    partElements.push(div);
    game.appendChild(div);
  });

  const hitbox = createWorldItemHitbox(item);
  game.appendChild(hitbox);
  worldItemElementsByUid.set(item.uid, {
    parts: partElements,
    hitbox,
  });
};

const findWorldItemRenderRefs = (itemUid) => {
  return worldItemElementsByUid.get(itemUid) ?? null;
};

const findWorldItemPartElements = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  return refs?.parts ?? [];
};

const findWorldItemHitboxElement = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  return refs?.hitbox ?? null;
};
/* ---------- ITEMS - AFFICHAGE DOM ---------- */

const renderGroundItems = (items) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    renderGroundItemParts(item);
  }
};

/* ---------- ITEMS - AJOUT ET RETRAIT MONDE ---------- */

const addWorldItemToState = (worldItem) => {
  if (!isValidWorldItem(worldItem)) {
    return false;
  }
  worldItems.push(worldItem);
  return true;
};

const addGroundItem = (worldItem) => {
  const wasAdded = addWorldItemToState(worldItem);
  if (wasAdded) {
    renderGroundItems([worldItem]);
  }
};

const removeWorldItemFromState = (itemUid) => {
  const index = worldItems.findIndex((worldItem) => {
    return worldItem.uid === itemUid;
  });
  if (index !== -1) {
    worldItems.splice(index, 1);
    return true;
  }
  return false;
};

const removeGroundItemRender = (itemUid) => {
  const refs = findWorldItemRenderRefs(itemUid);
  const parts = refs?.parts ?? [];

  for (const part of parts) {
    part.remove();
  }
  refs?.hitbox?.remove();

  worldItemElementsByUid.delete(itemUid);
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
  worldItems.forEach((item) => {
    const positions = getItemRenderPartsPositions(item);
    if (!positions || positions.length <= 0) {
      return;
    }
    const itemElements = findWorldItemPartElements(item.uid);
    const itemHitboxElement = findWorldItemHitboxElement(item.uid);
    itemElements.forEach((element) => {
      const partIndex = Number(element.getAttribute("data-part-index"));
      const position = positions[partIndex];
      if (!position) {
        return;
      }
      applyItemRenderPartPosition(element, position);
    });
    if (itemHitboxElement) {
      const positionHitbox = {
        left: item.x - camera.x,
        top: item.y - camera.y,
        zIndex: item.y,
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      };
      applyItemRenderPartPosition(itemHitboxElement, positionHitbox);
    }
  });
};

const refreshGroundItemRender = (item) => {
  const itemElements = findWorldItemPartElements(item.uid);
  const parts = getItemRenderData(item);
  itemElements.forEach((element) => {
    const partIndex = Number(element.getAttribute("data-part-index"));
    const part = parts[partIndex];
    if (part) {
      element.style.backgroundPosition = `-${part.sourceX}px -${part.sourceY}px`;
    }
  });
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
  closeContainerAndChildren(item);
  cancelItemDrag();
  cancelItemUse();
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

const isBlockingItemAtPosition = (x, y) => {
  return worldItems.some((item) => {
    const itemData = getItemData(item.itemId);
    if (itemData) {
      return itemData.blockMovement && item.x === x && item.y === y;
    } else {
      return false;
    }
  });
};
//#endregion  -----  ITEMS - INSTANCES, MONDE ET RENDU DOM  -----

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

  for (const refs of worldItemElementsByUid.values()) {
    const parts = refs?.parts ?? [];
    for (const part of parts) {
      part.classList.remove("world-item-selected");
    }
  }

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
    const item = worldItems.find((item) => {
      return item.uid === source.itemUid;
    });
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
  if (!item || !destination) {
    return false;
  }
  const tilePosition = getTilePosition(destination);
  if (
    !Number.isInteger(destination.x) ||
    !Number.isInteger(destination.y) ||
    !isInsideMap(destination.x, destination.y) ||
    gameMap[tilePosition.row][tilePosition.col] !== FLOOR
  ) {
    return false;
  }

  item.x = destination.x;
  item.y = destination.y;
  return true;
};
/* ---------- DRAG - VALIDATION ACTION COMPLETE ---------- */
const refreshInventoryUi = () => {
  updatePlayerCarriedWeight();
  updatePlayerInventory();
  renderContainerDock();
};

const refreshItemUiAfterDrag = () => {
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
  return itemData.equipmentSlot.includes(slotName);
};

const findFirstEmptyContainerSlot = (containerItem) => {
  if (!containerItem || !containerItem.content) {
    return null;
  }
  const itemData = getItemData(containerItem.itemId);
  if (!itemData || !itemData.capacity) {
    return null;
  }
  for (let index = 0; index < itemData.capacity; index++) {
    if (!containerItem.content[index]) {
      return index;
    }
  }
  return null;
};

const shouldCloseOpenedContainerByDistance = (containerWrapper) => {
  if (!containerWrapper) {
    return false;
  }
  return containerWrapper.sourceType === "world" && !isNearPlayer(containerWrapper.item, 1);
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
        canMoveRestToFreeSlot = maxQuantityByCapacity >= sourceItem.quantity;
        quantityAllowed = Math.min(freeStackSpace, maxQuantityByCapacity);
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

    const emptySlot = findFirstEmptyContainerSlot(destinationItem);
    if (emptySlot === null) {
      cancelItemDrag();
      return true;
    }

    const destinationSlotContainer = {
      locationType: "containerSlot",
      parentContainerUid: destinationItem.uid,
      slotIndex: emptySlot,
    };

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
    if (!isNearPlayer(destination, 9)) {
      cancelItemDrag();
      return true;
    }
    const oldSource = {
      locationType: "worldTile",
      x: sourceItem.x,
      y: sourceItem.y,
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
    for (const worldItem of worldItems) {
      if (itemLocation.itemUid === worldItem.uid) {
        return worldItem;
      }
    }
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
  for (let i = 0; i < worldItems.length; i++) {
    const item = worldItems[i];
    if (item.uid === uid) {
      return {
        locationType: "worldItem",
        itemUid: item.uid,
      };
    }
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
  if (source.locationType === "worldItem" && !isNearPlayer(sourceItem, 1)) {
    cancelItemDrag();
    return;
  }

  if (tryMoveItemToWorldDuringDrag(source, sourceItem, destination)) {
    return;
  }

  const destinationItem = getDragSourceItem(destination);

  if (!isDropStackToStack(sourceItem, destinationItem)) {
    if (isExceedCapacity(source, destination, sourceItem)) {
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
    cancelItemDrag();
    return;
  }

  if (tryStackItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    refreshItemUiAfterDrag();
    return;
  }

  if (isContainerMoveIntoContainerItemItself(sourceItem, destinationItem)) {
    cancelItemDrag();
    return;
  }

  if (tryMoveItemOnContainerItemDuringDrag(source, sourceItem, destinationItem)) {
    refreshItemUiAfterDrag();
    return;
  }

  if (tryMoveItemToEmptySlotDuringDrag(source, sourceItem, destination, destinationItem)) {
    refreshItemUiAfterDrag();
    return;
  }

  if (tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag(source, destination, destinationItem)) {
    refreshItemUiAfterDrag();
    return;
  }

  if (trySwapItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    refreshItemUiAfterDrag();
    return;
  }
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
};

const renderEquipmentSlots = () => {
  const equipmentsElement = document.querySelectorAll(".equipment-slot");
  equipmentsElement.forEach((equipmentElement) => {
    const slotName = equipmentElement.getAttribute("data-equipment-slot");
    const item = getEquipmentSlotItem(slotName);
    renderItemIcon(equipmentElement, item, 48);
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

const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
              <div class="equipment-panel">
                <div class="boite-jeux-titre">Equipments</div>
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
                      <div class="equipment-small-slot equipment-cap-slot">Cap:<br />${getPlayerRemainingCapacity()}</div>
                    </div>
                  </div>

                  <div class="equipment-right-bar">
                    <button class="equipment-ui-button">Follow</button>
                    <button class="equipment-ui-button">PVP</button>
                    <button class="equipment-ui-button">Friends</button>
                    <button class="equipment-ui-button">Options</button>
                    <button class="equipment-ui-button">Logout</button>
                  </div>
                </div>
               <div class="stance-bar">
                  <button class="stance-button" data-combat-mode="fullAttack">Full Attack</button>
                  <button class="stance-button stance-button-active" data-combat-mode="balanced">Balanced</button>
                  <button class="stance-button" data-combat-mode="fullDefense">Full Defense</button>
                </div>
              </div>
            </div>`;

  playerInventory.innerHTML = html;
  renderEquipmentSlots();
  bindCombatModeButtons();
  refreshCombatModeButtons();
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

const renderContainerDock = () => {
  if (!playerContainers) {
    return;
  }
  playerContainers.innerHTML = ``;
  openedContainers.forEach((container) => {
    let backButton = null;
    const div = document.createElement("div");
    div.classList.add("container-window");
    const header = document.createElement("div");
    header.classList.add("container-window-header");
    const button = document.createElement("button");
    button.classList.add("container-minimize-button");
    const closeButton = document.createElement("button");
    closeButton.classList.add("container-minimize-button");
    closeButton.innerText = "X";
    const title = document.createElement("div");
    title.classList.add("boite-jeux-titre");
    title.textContent = container.title;
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
      button.textContent = "+";
      div.append(header);
    } else {
      const separateur = document.createElement("div");
      separateur.classList.add("separateur-panneau");
      button.textContent = "-";
      const body = document.createElement("div");
      body.classList.add("container-window-body");
      renderContainerSlots(body, container.item);
      div.append(header, separateur, body);
    }

    playerContainers.append(div);
  });
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
  });

  renderContainerDock();

  while (openedContainers.length > 1 && playerContainers.scrollHeight > playerContainers.clientHeight) {
    openedContainers.splice(openedContainers.length - 2, 1);
    renderContainerDock();
  }
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
};

/* ---------- ITEM USE - ETAT / ROUTAGE ET ACTIONS ---------- */
const addUseCursorClass = () => {
  boitePrincipale.classList.add("item-use-cursor");
};

const removeUseCursorClass = () => {
  boitePrincipale.classList.remove("item-use-cursor");
};

const cancelItemUse = () => {
  itemUseState.isUsingItem = false;
  itemUseState.source = null;
  itemUseState.item = null;
  itemUseState.useData = null;
  itemUseState.startedAt = null;
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
};

const isUsingItem = () => {
  return itemUseState.isUsingItem;
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
    openContainer(item, itemData.name, "equipment", null);
    return;
  } else if (source.locationType === "worldItem") {
    openContainer(item, itemData.name, "world", null);
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
      openContainer(item, itemData.name, parentWrapper.sourceType, parentWrapper);
      return;
    } else {
      closeContainer(parentWrapper.item);
      openContainer(item, itemData.name, parentWrapper.sourceType, parentWrapper);
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
  if (source.locationType === "worldItem" && !isNearPlayer(item, 1)) {
    return;
  }
  const useData = getItemUseData(item);
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

const handleDrinkPotionUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    cancelItemUse();
    return;
  }
  if (target.player) {
    if (playerState.hp >= playerState.maxHp) {
      cancelItemUse();
      return;
    }
    let healAmount = 0;
    if (playerState.hp + useData.heal > playerState.maxHp) {
      healAmount = playerState.maxHp - playerState.hp;
    } else {
      healAmount = useData.heal;
    }
    if (!consumeOneItemFromSource(source, item)) {
      cancelItemUse();
      return;
    }
    playerState.hp += healAmount;
    startUseCooldown(cooldownGroup);
    showFloatingTextAbovePlayer(healAmount, "heal");
    refreshPlayerVitalsUi();
  } else if (target.tile && isNearPlayer(target.tile, useData.range)) {
    console.log("La potion est verser par terre");
    consumeOneItemFromSource(source, item);
  }

  cancelItemUse();
};

const handleRuneUse = (source, item, useData, target) => {
  const cooldownGroup = getUseCooldownGroup(useData);
  if (!isUseCooldownReady(cooldownGroup)) {
    cancelItemUse();
    return;
  }
  if (target.monster && isNearPlayer(target.monster, useData.range)) {
    if (!consumeOneChargeFromRune(item, source)) {
      cancelItemUse();
      return;
    }
    const attackResult = calculateRuneAttackResult(useData);
    applyDamageToMonster(target.monster, attackResult);
    startUseCooldown(cooldownGroup);
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
  if (source.locationType === "worldItem" && !isNearPlayer(item, 1)) {
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

const executeDirectItemUse = (item, source) => {
  if (!item) {
    return;
  }
  const useData = getItemUseData(item);
  if (!useData || !useData.action) {
    return;
  }
  if (useData.action === "eat") {
    consumeOneItemFromSource(source, item);
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
    experience: null,
    gold: null,
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
  setProgressTooltipText(row.tooltipElement, `${skillProgressData.experienceNeededForNextLevel} XP left to go.`);
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
  titleElement.textContent = "Stats";
  const separatorElement = document.createElement("div");
  separatorElement.classList.add("separateur-panneau");
  const nameElement = createSimpleStatRowElement("name", "Name:");
  const hpElement = createSimpleStatRowElement("hp", "Hp:");
  const manaElement = createSimpleStatRowElement("mana", "Mana:");
  const goldElement = createSimpleStatRowElement("gold", "Gold:");
  const experienceElement = createSimpleStatRowElement("experience", "Experience:");
  const levelElement = createProgressStatRowElement("level", "Level:");
  const magicElement = createProgressStatRowElement("magic", "Magic:");
  const fistElement = createProgressStatRowElement("fist", "Fist Fighting:");
  const swordElement = createProgressStatRowElement("sword", "Sword Fighting:");
  const maceElement = createProgressStatRowElement("mace", "Mace Fighting:");
  const axeElement = createProgressStatRowElement("axe", "Axe Fighting:");
  const distanceElement = createProgressStatRowElement("distance", "Distance:");
  const shieldingElement = createProgressStatRowElement("shielding", "Shielding:");
  if (
    !nameElement ||
    !hpElement ||
    !manaElement ||
    !goldElement ||
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
    goldElement,
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
  if (!rows.name || !rows.hp || !rows.mana || !rows.gold || !rows.experience || !rows.level) {
    return;
  }

  rows.name.valueElement.textContent = playerState.name;
  rows.hp.valueElement.textContent = `${playerState.hp}/${playerState.maxHp}`;
  rows.mana.valueElement.textContent = `${playerState.mana}/${playerState.maxMana}`;
  rows.gold.valueElement.textContent = playerState.gold;
  rows.experience.valueElement.textContent = playerState.experience;
  rows.level.valueElement.textContent = progressData.level;
  const level = rows.level;
  setProgressBarValue(level.progressBarRefs, progressData.progressRatio);
  setProgressTooltipText(level.tooltipElement, `${progressData.experienceNeededForNextLevel} Xp left to go.`);
  for (const skillKey of Object.keys(playerState.skills)) {
    updateSkillStatRow(skillKey);
  }
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

const updatePlayerExperience = () => {
  const progressData = getPlayerExperienceProgressData();
  if (!progressData) {
    return;
  }
  if (playerState.level < progressData.level) {
    addLevelUpFeedback(progressData.level);
  }
  playerState.level = progressData.level;
  syncPlayerDerivedStats();
  updatePlayerStats();
};

const addLevelUpFeedback = (newLevel) => {
  if (!Number.isFinite(newLevel)) {
    return false;
  }
  const logMessage = `You advanced to level ${newLevel}.`;
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
};

const addSkillLevelUpFeedback = (skillKey, newLevel) => {
  const logMessage = `Your ${skillKey} skill advanced to level ${newLevel}.`;
  addLogMessage(logMessage, "level");
  showFloatingTextAboveTarget(logMessage, -90, playerState, "level", 4000);
};

/* ---------- UI - SCALE DU JEU ---------- */

const updateGameScale = () => {
  boitePrincipale.style.height = `calc(100vh - ${nav.clientHeight}px)`;
  const freeWidthSpace = boiteJeux.clientWidth - panneauGauche.clientWidth - panneauDroite.clientWidth;
  const freeHeightSpace = boitePrincipale.clientHeight - minChatHeight;
  const logicWidthSpace = GAME_WIDTH;
  const logicHeightSpace = GAME_HEIGHT;
  const scaleWidth = freeWidthSpace / logicWidthSpace;
  const scaleHeight = freeHeightSpace / logicHeightSpace;
  const scale = Math.min(scaleWidth, scaleHeight);
  GAME_SCALE = scale;
  document.documentElement.style.setProperty("--game-scale", scale);
  const visualGameHeight = GAME_HEIGHT * scale;
  const gameTop = (boiteJeux.clientHeight - visualGameHeight) / 2;
  boiteJeuxInner.style.top = `${gameTop}px`;
};

/* ---------- UI - TEXTE FLOTTANT ---------- */
const floatingTextState = {
  queuesByTargetKey: new Map(),
};

const getFloatingTextTargetKey = (target) => {
  if (!target) {
    return null;
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
    if ("renderX" in target && "renderY" in target) {
      left = target.renderX - camera.x + TILE_SIZE / 2;
      top = target.renderY - camera.y - offsetY;
    } else {
      left = target.x - camera.x + TILE_SIZE / 2;
      top = target.y - camera.y - offsetY;
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

const showFloatingTextAboveTarget = (text, offsetY, target, textType = "look", durationMs = 2000) => {
  const targetQueue = getFloatingTextQueueForTarget(target);
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
  const isNearbyWorldItem = lookInfo.sourceType === "worldItem" && isNearPlayer(lookInfo.target, 1);

  if (lookInfo.weight !== undefined && (isCarriedItem || isNearbyWorldItem)) {
    offsetY = 105;
    let suffixName = lookInfo.suffix;
    let name = lookInfo.name;
    let suffixWeight = "It weighs";

    if (lookInfo.quantity && lookInfo.quantity > 1) {
      suffixName = lookInfo.quantity;
      name += "s";
      suffixWeight = "They weigh";
    }
    if (lookInfo.charges) {
      let charges = `It has ${lookInfo.charges} charge`;
      if (lookInfo.charges > 1) {
        charges += "s";
      }
      text = `You see ${suffixName} ${name}.\n${lookInfo.desc}\n${charges}\n${suffixWeight} ${lookInfo.weight.toFixed(1)} oz.`;
    } else {
      text = `You see ${suffixName} ${name}.\n${lookInfo.desc}\n${suffixWeight} ${lookInfo.weight.toFixed(1)} oz.`;
    }
  } else {
    offsetY = 120;
    text = `You see ${lookInfo.suffix} ${lookInfo.name}.`;
  }
  showFloatingTextAboveTarget(text, offsetY, playerState);
};

const showFloatingTextAboveMonster = (monster, text, type) => {
  const monsterTextElement = findMonsterFloatingTextElement(monster.uid);
  if (!monsterTextElement) {
    return;
  }
  const textElement = document.createElement("div");
  textElement.classList.add("floating-combat-text");
  textElement.classList.add(`floating-combat-text-${type}`);
  textElement.textContent = `${text}`;
  monsterTextElement.appendChild(textElement);
  setTimeout(() => {
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

const updateLight = (source) => {
  if (currentMap.dark) {
    let lightRadius = 0;
    let screenX = 0;
    let screenY = 0;
    if ("renderX" in source && "renderY" in source) {
      screenX = source.renderX - camera.x + TILE_SIZE / 2;
      screenY = source.renderY - camera.y + TILE_SIZE / 2;
    } else {
      screenX = source.x - camera.x + TILE_SIZE / 2;
      screenY = source.y - camera.y + TILE_SIZE / 2;
    }

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (source.light <= 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.96)";
    } else {
      ctx.fillStyle = "rgb(0, 0, 0)";
    }
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.globalCompositeOperation = "destination-out";
    if (source.light <= 0) {
      lightRadius = 70;
      const gradient = ctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, lightRadius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.08)");
      gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.04)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;

      ctx.fillRect(screenX - lightRadius, screenY - lightRadius, lightRadius * 2, lightRadius * 2);
    } else {
      const gradient = ctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, source.light);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.69)");
      gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;

      ctx.fillRect(screenX - source.light, screenY - source.light, source.light * 2, source.light * 2);
      const bright = ctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, source.light * 0.85);
      ctx.globalCompositeOperation = "source-over";
      bright.addColorStop(0, "rgba(251, 255, 137, 0)");
      bright.addColorStop(0.4, "rgba(247, 255, 2, 0.04)");
      bright.addColorStop(0.7, "rgba(249, 97, 2, 0.07)");
      bright.addColorStop(0.8, "rgba(249, 2, 2, 0.07)");
      bright.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = bright;

      ctx.fillRect(
        screenX - source.light * 0.85,
        screenY - source.light * 0.85,
        source.light * 2 * 0.85,
        source.light * 2 * 0.85,
      );
    }
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
};
//#endregion  -----  LIGHT - CANVAS  -----

/* ==================================================== */
//#region     -----  JOUEUR - MOUVEMENT  -----
/* ==================================================== */
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
/* ---------- JOUEUR - COOLDOWN ET DIRECTION ---------- */

const getPlayerMoveCooldown = () => {
  if (playerState.level < 100) {
    return PLAYER_MOVE_COOLDOWN_MS - playerState.level - playerState.speed;
  } else {
    return PLAYER_MOVE_COOLDOWN_MS - 100 - (playerState.level - 100) / 2 - playerState.speed;
  }
};

const getWantedDirection = () => {
  if (keysPressed.right) {
    return "right";
  } else if (keysPressed.left) {
    return "left";
  } else if (keysPressed.up) {
    return "up";
  } else if (keysPressed.down) {
    return "down";
  } else {
    return;
  }
};

/* ---------- JOUEUR - MISE A JOUR MOUVEMENT ---------- */

const updateMovement = (now) => {
  const direction = getWantedDirection();
  if (!direction) {
    playerState.walkFrame = 1;
    updatePlayerSprite();
    return;
  }

  if (now < nextPlayerMoveTime) {
    return;
  }
  let nextX = playerState.x;
  let nextY = playerState.y;
  if (direction === "right") {
    nextX += MOVE_SPEED;
  } else if (direction === "left") {
    nextX -= MOVE_SPEED;
  } else if (direction === "up") {
    nextY -= MOVE_SPEED;
  } else if (direction === "down") {
    nextY += MOVE_SPEED;
  } else {
    return;
  }

  if (canMoveTo(nextX, nextY) && !isMonsterAtPosition(nextX, nextY) && !isBlockingItemAtPosition(nextX, nextY)) {
    playerState.oldX = playerState.x;
    playerState.oldY = playerState.y;
    playerState.moveStartTime = now;
    playerState.moveDuration = getPlayerMoveCooldown();
    playerState.x = nextX;
    playerState.y = nextY;
    playerState.direction = direction;
    playerState.walkFrame += 1;
    if (playerState.walkFrame >= PLAYER_ANIMATION_FRAMES) {
      playerState.walkFrame = 0;
    }
  }
  updatePlayerSprite();
  nextPlayerMoveTime = now + getPlayerMoveCooldown();
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
};

const updateInputStateOnMouseDown = (e) => {
  if (e.button === 2) {
    inputState.isRightClickDown = true;
  }
  if (e.button === 0) {
    inputState.isLeftClickDown = true;
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
  if (isTextInputFocused()) {
    return;
  }
  e.preventDefault();
  if (e.repeat) {
    return;
  }
  if (e.key === "ArrowRight" || e.key === "d") {
    keysPressed.right = true;
  } else if (e.key === "ArrowLeft" || e.key === "a") {
    keysPressed.left = true;
  } else if (e.key === "ArrowUp" || e.key === "w") {
    keysPressed.up = true;
  } else if (e.key === "ArrowDown" || e.key === "s") {
    keysPressed.down = true;
  } else if (e.key === "Enter") {
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
  if (isTextInputFocused()) {
    return;
  }
  e.preventDefault();
  if (e.key === "ArrowRight" || e.key === "d") {
    keysPressed.right = false;
  } else if (e.key === "ArrowLeft" || e.key === "a") {
    keysPressed.left = false;
  } else if (e.key === "ArrowUp" || e.key === "w") {
    keysPressed.up = false;
  } else if (e.key === "ArrowDown" || e.key === "s") {
    keysPressed.down = false;
  } else {
    return;
  }
});

/* ---------- INPUTS - RESIZE FENETRE ---------- */

window.addEventListener("resize", () => {
  updateGameScale();
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
    const monsterData = getMonsterData(target.monster.monsterId);
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
  } else if (target.item) {
    const itemData = getItemData(target.item.itemId);
    if (!itemData) {
      return null;
    }
    lookInfo = {
      name: itemData.name,
      desc: itemData.desc,
      suffix: itemData.suffix,
      quantity: target.item.quantity,
      weight: getItemTotalWeight(target.item),
      target: target.item,
      sourceType: target.itemSlotInfo.itemLocation.locationType,
      charges: target.item.charges,
    };
    return lookInfo;
  } else if (target.tile) {
    lookInfo = {
      name: "Tile",
      desc: "A tile.",
      suffix: "a",
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
    return `You see yourself. You are level ${level}.`;
  } else {
    return `You see yourself. You are a ${classData.name} level ${level}.`;
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
  return document.activeElement === chatInput;
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
  const equipmentSlotElement = e.target.closest(".equipment-slot");
  if (equipmentSlotElement) {
    const itemLocation = getEquipmentSourceFromSlotElement(equipmentSlotElement);
    return {
      slotElement: equipmentSlotElement,
      itemLocation,
    };
  }
  const worldSlotElement = e.target.closest(".hitbox");
  if (worldSlotElement) {
    const itemLocation = getWorldSourceFromItemElement(worldSlotElement);
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
  let player = null;
  if (pointerInsideMap) {
    tile = { row, col, x, y };
    monster = findMonsterAtPosition(x, y);
    if (isPlayerAtPosition(x, y)) {
      player = playerState;
    }
  }

  return {
    itemSlotInfo: itemSlotInfo,
    item,
    player,
    monster: monster,
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
  if (!item || (dragState.pendingSourceLocation.locationType === "worldItem" && !isNearPlayer(item, 1))) {
    resetDragState();
    resetDragStatePending();
    return;
  }
  startItemDrag(dragState.pendingSourceLocation);
  if (dragState.isDragging === true) {
    if (dragState.pendingSourceLocation.locationType === "worldItem") {
      const itemUid = dragState.pendingSourceLocation.itemUid;
      const parts = findWorldItemPartElements(itemUid);
      parts.forEach((part) => {
        part.classList.add("world-item-selected");
      });
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

const getNeighbors = (tile) => {
  return [
    { row: tile.row, col: tile.col - 1 },
    { row: tile.row, col: tile.col + 1 },
    { row: tile.row - 1, col: tile.col },
    { row: tile.row + 1, col: tile.col },
  ];
};

const isWalkableTile = (row, col) => {
  const tileX = col * TILE_SIZE;
  const tileY = row * TILE_SIZE;
  if (!isInsideMap(tileX, tileY)) {
    return false;
  }
  const nextTile = gameMap[row][col];

  if (
    nextTile === FLOOR &&
    !isMonsterAtPosition(tileX, tileY) &&
    !isBlockingItemAtPosition(tileX, tileY) &&
    !isPlayerAtPosition(tileX, tileY)
  ) {
    return true;
  } else {
    return false;
  }
};

const getDistance = (a, b) => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

const getNeighborNodes = (tile, targetTile) => {
  const neighborsTile = getNeighbors(tile);
  const neighborsNodes = [];
  neighborsTile.forEach((neighbors) => {
    if (isWalkableTile(neighbors.row, neighbors.col)) {
      const g = tile.g + 1;
      const h = getDistance(neighbors, targetTile);
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

/* ---------- PATHFINDING - NODES ET LISTES ---------- */

const getSmallerF = (nodesList) => {
  if (nodesList.length > 0) {
    let smallF = nodesList[0];
    nodesList.forEach((node) => {
      if (node.f < smallF.f) {
        smallF = node;
      } else if (node.f === smallF.f) {
        if (node.h < smallF.h) {
          smallF = node;
        }
      }
    });
    return smallF;
  }
};

const isNodeInList = (node, list) => {
  let nodeInList = false;
  list.forEach((nodeList) => {
    if (nodeList.row === node.row && nodeList.col === node.col) {
      nodeInList = true;
    }
  });
  return nodeInList;
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

const pathDestination = (selfTile, destinationTile) => {
  const neighbors = getNeighbors(destinationTile);
  const possibleNeighbors = [];
  let bestDistance = null;
  let bestNeighbor = null;
  neighbors.forEach((neighbor) => {
    if (isWalkableTile(neighbor.row, neighbor.col)) {
      possibleNeighbors.push(neighbor);
    }
  });
  possibleNeighbors.forEach((possibleNeighbor) => {
    const distance = getDistance(selfTile, possibleNeighbor);
    if (bestDistance === null || distance < bestDistance) {
      bestDistance = distance;
      bestNeighbor = possibleNeighbor;
    }
  });

  return bestNeighbor;
};

const findPath = (startTile, targetTile) => {
  const openList = [];
  const closedList = [];
  const g = 0;
  const h = getDistance(startTile, targetTile);
  const startNode = {
    row: startTile.row,
    col: startTile.col,
    g: g,
    h: h,
    f: g + h,
    parent: null,
  };
  openList.push(startNode);

  while (openList.length > 0) {
    let currentNode = getSmallerF(openList);
    const index = openList.indexOf(currentNode);
    if (index > -1) {
      openList.splice(index, 1);
    }
    closedList.push(currentNode);
    if (currentNode.row === targetTile.row && currentNode.col === targetTile.col) {
      return buildPath(currentNode);
    } else {
      const neighborsNodes = getNeighborNodes(currentNode, targetTile);
      neighborsNodes.forEach((node) => {
        if (!isNodeInList(node, closedList) && !isNodeInList(node, openList)) {
          openList.push(node);
        }
      });
    }
  }
  return [];
};
//#endregion  -----  PATHFINDING A*  -----

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
};

const createMonster = (monsterId, x, y) => {
  const monsterData = getMonsterData(monsterId);
  if (!monsterData) {
    return null;
  }
  const monster = {
    monsterId,
    x,
    y,
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
  };
  return monster;
};

const renderMonsters = (monstersList) => {
  for (let i = 0; i < monstersList.length; i++) {
    const div = document.createElement("div");
    const monster = monstersList[i];
    const monsterData = getMonsterData(monster.monsterId);
    div.classList.add("monster");
    div.style.width = `${monsterData.drawWidth}px`;
    div.style.height = `${monsterData.drawHeight}px`;
    if (monster.uid === selectedMonsterUid) {
      div.classList.add("monster-selected");
    }
    const monsterText = document.createElement("div");
    monsterText.classList.add("monster-floating-text-layer");
    const monsterName = document.createElement("div");
    monsterName.classList.add("monster-name");
    monsterName.textContent = `${monsterData.name}`;
    const hpContainer = document.createElement("div");
    hpContainer.classList.add("hp-bar");
    const hpRed = document.createElement("div");
    hpRed.classList.add("hp-red");
    div.setAttribute("data-monster-uid", monster.uid);
    hpRed.setAttribute("data-monster-uid", monster.uid);
    const monsterSprite = document.createElement("div");
    monsterSprite.classList.add("monster-sprite");
    const atlasPath = getAtlasPath(monsterData.atlas);
    monsterSprite.style.backgroundImage = `url("${atlasPath}")`;
    monsterSprite.style.width = `${monsterData.drawWidth}px`;
    monsterSprite.style.height = `${monsterData.drawHeight}px`;
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (shouldBlockContextMenuAction()) {
        return;
      }

      selectMonster(monster);
    });
    div.style.left = `${monster.x - camera.x + monsterData.drawOffsetX}px`;
    div.style.top = `${monster.y - camera.y + monsterData.drawOffsetY}px`;
    div.style.zIndex = monster.y;
    hpContainer.appendChild(hpRed);
    div.appendChild(monsterText);
    div.appendChild(monsterName);
    div.appendChild(hpContainer);
    div.appendChild(monsterSprite);
    monsterElementsByUid.set(monster.uid, {
      root: div,
      sprite: monsterSprite,
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
  const monsterSpriteElement = findMonsterSpriteElement(monster.uid);
  if (!monsterSpriteElement) {
    return;
  }
  const source = getAtlasSource(col, row, monsterData.spriteSize);
  monsterSpriteElement.style.backgroundPosition = `-${source.sourceX}px -${source.sourceY}px`;
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

const isMonsterAtPosition = (x, y) => {
  return monsters.some((monster) => {
    return monster.x === x && monster.y === y;
  });
};
const findMonsterAtPosition = (x, y) => {
  return monsters.find((monster) => {
    return monster.x === x && monster.y === y;
  });
};

const selectMonster = (monster) => {
  if (!monster) {
    return;
  }
  clearMonsterSelection();
  if (monster.uid === selectedMonsterUid) {
    selectedMonsterUid = null;
    return;
  }
  selectedMonsterUid = monster.uid;
  selectMonsterElement(selectedMonsterUid);
};

const isPlayerAtPosition = (x, y) => {
  return playerState.x === x && playerState.y === y;
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
  const monsterIndex = monsters.findIndex((monster) => {
    return monsterUid === monster.uid;
  });
  if (monsterIndex != -1) {
    monsters.splice(monsterIndex, 1);
  }
};

const removeMonsterRender = (monsterUid) => {
  const monsterElement = findMonsterElement(monsterUid);
  if (monsterElement) {
    monsterElement.remove();
  }
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
};

const updateMonsterDirection = (selfMonster, tile) => {
  const monsterTile = getTilePosition(selfMonster);
  if (tile) {
    if (monsterTile.col > tile.col && monsterTile.row === tile.row) {
      selfMonster.direction = "left";
    } else if (monsterTile.col < tile.col && monsterTile.row === tile.row) {
      selfMonster.direction = "right";
    } else if (monsterTile.col === tile.col && monsterTile.row < tile.row) {
      selfMonster.direction = "down";
    } else if (monsterTile.col === tile.col && monsterTile.row > tile.row) {
      selfMonster.direction = "up";
    }
  }
};

/* ---------- MONSTRES - SELECTION ET MORT ---------- */

const clearMonsterSelection = () => {
  for (const refs of monsterElementsByUid.values()) {
    if (refs.root) {
      refs.root.classList.remove("monster-selected");
    }
  }
};

const createMonsterCorpse = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData || !monsterData.corpseItemId) {
    return;
  }
  const lootContent = generateMonsterLoot(monsterData);
  addLootLogMessage(lootContent, monsterData.name);
  addGroundItem(createGroundItem(monsterData.corpseItemId, 1, monster.x, monster.y, lootContent));
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
  }
};

const handleMonsterDeath = (monster) => {
  setMonsterDeadState(monster);
  createMonsterCorpse(monster);
  removeMonster(monster.uid);
  clearSelectedMonsterIfNeeded(monster);
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
  const monster = monsters.find((monster) => {
    return monsterUid === monster.uid;
  });
  return monster;
};

const selectMonsterElement = (monsterUid) => {
  const monsterElement = findMonsterElement(monsterUid);
  if (monsterElement) {
    monsterElement.classList.add("monster-selected");
  }
};

const findMonsterElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;

  return refs?.root ?? null;
};

const findMonsterSpriteElement = (monsterUid) => {
  const refs = monsterElementsByUid.get(monsterUid) ?? null;
  return refs?.sprite ?? null;
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
    return "unknown item";
  }
  const itemData = getItemData(lootItem.itemId);
  if (!itemData) {
    return "unknown item";
  }
  if ("quantity" in lootItem && lootItem.quantity > 1) {
    return `${lootItem.quantity} ${itemData.name}s`;
  } else {
    return `${itemData.name}`;
  }
};

const formatLootLogMessage = (lootItems, sourceName = null) => {
  let logMessage = `Loot `;
  if (!lootItems || isEmpty(lootItems)) {
    if (sourceName != null) {
      return `Loot from ${sourceName}: nothing.`;
    } else {
      return `Loot: nothing.`;
    }
  }
  if (sourceName != null) {
    logMessage += `from ${sourceName}`;
  }
  logMessage += `: `;

  const lootItemsList = [];
  for (const lootItem of lootItems) {
    lootItemsList.push(formatLootItemText(lootItem));
  }
  logMessage += `${lootItemsList.join(", ")}.`;
  return logMessage;
};

const addLootLogMessage = (lootItems, sourceName = null) => {
  const logMessage = formatLootLogMessage(lootItems, sourceName);
  addLogMessage(logMessage, "loot");
};

/* ---------- MONSTRES - COMBAT POSITION MOUVEMENT ---------- */

const updateMonsterCombat = (now) => {
  monsters.forEach((monster) => {
    if (isNearPlayer(monster)) {
      const monsterData = getMonsterData(monster.monsterId);
      if (now < monster.nextAttackTime) {
        return;
      }
      monster.nextAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;
      const attackResult = calculateDamageTakenByPlayer(monsterData.combat, now);
      if (attackResult.finalDamage > 0) {
        playerState.hp -= attackResult.finalDamage;
        const logMessage = `You took ${attackResult.finalDamage} damage from ${monsterData.name}.`;
        addLogMessage(logMessage, "combat");
      }
      showFloatingTextAbovePlayer(attackResult.text, attackResult.textType);
      refreshPlayerVitalsUi();
      if (playerState.hp <= 0) {
        playerState.hp = 0;
        refreshPlayerVitalsUi();
        playerDead();
      }
      return;
    }
  });
};

const updateMonsterPosition = () => {
  monsters.forEach((monster) => {
    const monsterData = getMonsterData(monster.monsterId);
    const monsterElement = findMonsterElement(monster.uid);
    if (monsterElement) {
      monsterElement.style.left = `${monster.renderX - camera.x + monsterData.drawOffsetX}px`;
      monsterElement.style.top = `${monster.renderY - camera.y + monsterData.drawOffsetY}px`;
      monsterElement.style.zIndex = monster.y;
    }
  });
};

const updateMonsterMovement = (now) => {
  monsters.forEach((monster) => {
    if (!isNearPlayer(monster, 12)) {
      return;
    }
    if (isNearPlayer(monster, 1)) {
      return;
    }
    if (monster.nextMoveTime > now) {
      return;
    }
    const monsterData = getMonsterData(monster.monsterId);
    monster.nextMoveTime = now + monsterData.moveCooldown;
    const monsterPosition = getTilePosition(monster);
    const destination = pathDestination(monsterPosition, getTilePosition(playerState));
    if (destination !== null) {
      if (monster.path.length <= 0) {
        monster.path = findPath(monsterPosition, destination);
        monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;
      } else {
        const oldPathEnd = monster.path[monster.path.length - 1];

        if (getDistance(oldPathEnd, destination) > 2) {
          const newPath = findPath(monsterPosition, destination);
          if (newPath.length > 0) {
            monster.path = newPath;
            monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;
          }
        } else if (now >= monster.nextPathRefreshTime) {
          const newPath = findPath(monsterPosition, destination);
          monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;
          if (getDistance(oldPathEnd, destination) > 1 && newPath && newPath.length > 0) {
            monster.path = newPath;
          }
        }
      }

      if (monster.path.length <= 0) {
        return;
      }

      const nextStep = monster.path[0];
      if (!isWalkableTile(nextStep.row, nextStep.col)) {
        const newPath = findPath(monsterPosition, destination);
        if (newPath.length <= 0) {
          return;
        } else {
          monster.path = newPath;
        }
      }
      if (monster.path.length <= 0) {
        return;
      }
      updateMonsterDirection(monster, monster.path[0]);
      monster.walkFrame += 1;
      if (monster.walkFrame >= monsterData.animationFrames) {
        monster.walkFrame = 0;
      }
      updateMonsterSprite(monster);
      const { tileX, tileY } = getWorldPosition(monster.path[0]);
      monster.path.shift();
      monster.oldX = monster.x;
      monster.oldY = monster.y;
      monster.moveStartTime = now;
      monster.moveDuration = monsterData.moveCooldown;
      monster.x = tileX;
      monster.y = tileY;
    }
  });
};
//#endregion  -----  MONSTRES  -----

/* ==================================================== */
//#region     -----  RENDER - POSITIONS VISUELLES ET UPDATE MONDE  -----
/* ==================================================== */
/* ---------- RENDER - INITIALISATION DU MONDE ---------- */

const renderInitialWorld = () => {
  renderMap(gameMap);
  renderMonsters(monsters);
  updateWorldRender();
};

/* ---------- RENDER - INTERPOLATION VISUELLE ---------- */

const updateEntityRenderPosition = (entity, now) => {
  if (entity.moveDuration <= 0) {
    entity.renderX = entity.x;
    entity.renderY = entity.y;
  } else {
    const rawProgress = (now - entity.moveStartTime) / entity.moveDuration;
    const progress = clamp(rawProgress, 0, 1);
    const distanceX = entity.x - entity.oldX;
    const distanceY = entity.y - entity.oldY;
    entity.renderX = entity.oldX + distanceX * progress;
    entity.renderY = entity.oldY + distanceY * progress;
  }
};

const updateRenderPositions = (now) => {
  updateEntityRenderPosition(playerState, now);

  for (const monster of monsters) {
    updateEntityRenderPosition(monster, now);
  }
};

/* ---------- RENDER - GROUPES DE MISE A JOUR ---------- */

const updateRenderCamera = () => {
  updateCamera();
  if (mousePosition.screenX !== null && mousePosition.screenY !== null) {
    updateMousePositionInfo(mousePosition.screenX, mousePosition.screenY);
  }
};

const updateRenderMap = () => {
  if (camera.x === renderState.lastCameraX && camera.y === renderState.lastCameraY) {
    return;
  }
  updateMapPosition();
  renderState.lastCameraX = camera.x;
  renderState.lastCameraY = camera.y;
};

const updateRenderWorldItems = () => {
  updateItemPosition();
};

const updateRenderCreatures = () => {
  updateMonsterPosition();
  updatePlayerPosition();
};

const updateRenderLight = () => {
  updateLight(playerState);
};

const updateWorldRender = () => {
  updateRenderCamera();
  updateRenderMap();
  updateRenderWorldItems();
  updateRenderCreatures();
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
  const weaponAttack = getPlayerWeaponAttack();
  const attackSkill = getPlayerAttackSkill();
  const baseHitChance = 65;
  //!!!!! HIT CHANCE !!!!
  let hitChance =
    baseHitChance +
    attackSkill * 1.2 +
    weaponAttack * 1.5 -
    targetCombatData.defense * 2 -
    targetCombatData.blockChance * 0.5;
  hitChance *= combatModeData.attackMultiplier;
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
  if (playerState.equipment.shield) {
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
    if (playerState.equipment.shield) {
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
  let logMessage = `You gained ${experienceAmount} experience.`;
  if (sourceName != null) {
    logMessage = `You gained ${experienceAmount} experience from ${sourceName}.`;
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
    addExperienceGainFeedback(monsterExperienceReward, monsterData.name);
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
    monster.hp -= damageAmount;

    const logMessage = `You dealt ${damageAmount} damage to ${monsterData.name}.`;
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
  handleMonsterDeath(monster);
  if (applyExperienceToPlayerFromMonster(monster)) {
    updatePlayerExperience();
  }
};

/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const attackMonster = (monster, now) => {
  const attackResult = calculatePlayerAttackResult(monster);
  const skillKey = getPlayerAttackSkillKey();
  applySkillExperienceFromAttack(attackResult, skillKey, now);

  if (attackResult.finalDamage > 0) {
    applyDamageToMonster(monster, attackResult);
    return;
  }
  showFloatingTextAboveMonster(monster, attackResult.text, attackResult.textType);
};

const updateCombat = (now) => {
  if (selectedMonsterUid === null) {
    return;
  }
  const monster = findMonsterByUid(selectedMonsterUid);
  if (!monster) {
    return;
  }
  if (!isNearPlayer(monster)) {
    return;
  }
  if (now < nextPlayerAttackTime) {
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
  local: { channelId: "local", label: "Local", canSendMessage: true, maxMessages: 100 },
  global: { channelId: "global", label: "Global", canSendMessage: true, maxMessages: 100 },
  trade: { channelId: "trade", label: "Trade", canSendMessage: true, maxMessages: 100 },
  logs: { channelId: "logs", label: "Logs", canSendMessage: false, maxMessages: 100 },
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

const createChatMessage = (channelId, messageType, text, speakerData = null) => {
  const now = Date.now();
  if (!speakerData) {
    return {
      channelId,
      messageType,
      text,
      speakerName: null,
      speakerLevel: null,
      createdAt: now,
    };
  } else {
    return {
      channelId,
      messageType,
      text,
      speakerName: speakerData.name,
      speakerLevel: speakerData.level,
      createdAt: now,
    };
  }
};

const addChatMessage = (channelId, messageType, text, speakerData = null) => {
  if (!channelId || !isValidChatChannel(channelId) || isEmpty(text)) {
    return null;
  }
  const chatMessage = createChatMessage(channelId, messageType, text, speakerData);
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
    return `${chatMessage.speakerName}`;
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
  chatElement.textContent = text;
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
  const message = addChatMessage(activeChatChannelId, "player", text, playerState);
  if (!message) {
    return false;
  }
  if (activeChatChannelId === "local") {
    showFloatingTextAboveTarget(text, 70, playerState, "speech", 4000);
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
  bouton.textContent = channelData.label;
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

const handleChatInputSubmit = () => {
  const text = chatUi.input.value;
  if (sendPlayerChatMessage(text)) {
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

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (shouldBlockContextMenuAction()) {
    return;
  }
});
boiteJeux.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (isChatInputFocused()) {
    blurChatInput();
  }
});
boiteJeux.addEventListener("mouseup", (e) => {
  e.preventDefault();
});
boiteJeux.addEventListener("click", (e) => {
  e.preventDefault();
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleChatInputSubmit();
    blurChatInput();
    return;
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    blurChatInput();
    return;
  }
});

document.addEventListener("mouseup", (e) => {
  if (!dragState.isDragging) {
    resetDragStatePending();
    return;
  }

  if (e.target.closest(".container-slot") || e.target.closest(".equipment-slot") || e.target.closest(".hitbox")) {
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
  updateMovement(now);
  updateCombat(now);
  updateMonsterMovement(now);
  updateMonsterCombat(now);
  updateCorpseDecay(now);
};

const renderGameFrame = (now) => {
  updateRenderPositions(now);
  updateWorldRender();
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

requestAnimationFrame(gameLoop);
//#endregion  -----  BOUCLE DE JEU  -----

/* ==================================================== */
//#region     -----  INITIALISATION DU JEU  -----
/* ==================================================== */
/* ---------- INITIALISATION - DONNEES TEST ---------- */
const setupTestWorld = () => {
  addGroundItem(createGroundItem("box", 1, 20 * TILE_SIZE, 23 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 20 * TILE_SIZE, 22 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 20 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 19 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 18 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 17 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 16 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 15 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 14 * TILE_SIZE, 21 * TILE_SIZE));
  addGroundItem(createGroundItem("box", 1, 20 * TILE_SIZE, 24 * TILE_SIZE));

  addGroundItem(createGroundItem("healthPotion", 1, 14 * TILE_SIZE, 24 * TILE_SIZE));
  monsters.push(createMonster("rat", 30 * TILE_SIZE, 20 * TILE_SIZE));
  monsters.push(createMonster("rat", 33 * TILE_SIZE, 23 * TILE_SIZE));
  monsters.push(createMonster("spider", 34 * TILE_SIZE, 24 * TILE_SIZE));
};

const setupTestPlayerInventory = () => {
  playerState.equipment.backpack = createItemInstance("bag", 1);
  playerState.equipment.backpack.content[0] = createItemInstance("apple", 1);
  playerState.equipment.backpack.content[1] = createItemInstance("healthPotion", 1);
  playerState.equipment.backpack.content[4] = createItemInstance("healthPotion", 1);
  playerState.equipment.backpack.content[5] = createItemInstance("healthPotion", 1);
  playerState.equipment.backpack.content[2] = createItemInstance("goldCoin", 1);
  playerState.equipment.backpack.content[3] = createItemInstance("fireRune", 1);
  playerState.equipment.weapon = createItemInstance("sword", 1);
  playerState.equipment.shield = createItemInstance("woodenShield", 1);
};

/* ---------- INITIALISATION - UI JOUEUR ---------- */
const initializePlayerUi = () => {
  initializePlayerRenderRefs();
  refreshChatUi();
  updateGameScale();
  showPlayerName(playerState.name);
  updatePlayerSprite();
  refreshInventoryUi();
  syncPlayerDerivedStats();
  refreshPlayerVitalsUi();
};

/* ---------- INITIALISATION - DEMARRAGE ---------- */
const startGame = () => {
  setupTestPlayerInventory();
  setupTestWorld();

  initializePlayerUi();

  renderInitialWorld();
};

startGame();

//#endregion  -----  INITIALISATION DU JEU  -----

/* ==================================================== */
//#region     -----  DEBUG CONSOLE  -----
/* ==================================================== */
/* ---------- DEBUG - LOGS TEMPORAIRES ---------- */

console.log(gameMap);
console.log(player);

//#endregion  -----  DEBUG CONSOLE  -----
