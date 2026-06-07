/* ==================================================== */
//#region     -----  BASE - ELEMENTS HTML  -----

/* ==================================================== */
const panneauGauche = document.querySelector(".jeux-gauche");
const panneauDroite = document.querySelector(".jeux-droite");
const boitePrincipale = document.querySelector("#boite-principal");
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const playerContainers = document.querySelector("#player-containers");
const hpbar = document.querySelector("#player");
const player = document.querySelector("#player");
const game = document.querySelector("#game");
const boiteJeux = document.querySelector("#boite-jeux");
const nav = document.querySelector(".navbar");
const entete = document.querySelector(".entete-jeux");
const boiteChat = document.querySelector("#boite-chat");
const boiteJeuxInner = document.querySelector(".boite-jeux-inner");
const lightCanvas = document.querySelector("#light-canvas");
//#endregion  -----  BASE - ELEMENTS HTML  -----

/* ==================================================== */
//#region     -----  BASE - CONFIGURATION ET ETAT GLOBAL  -----
/* ==================================================== */
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

const FLOOR = 0;
const WALL = 1;

let nextItemInstanceId = 1;
let nextMonsterId = 1;
let selectedMonsterId = null;

const worldItems = [];
const decayingItems = [];
const monsters = [];
const openedContainers = [];

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

const playerSpawnX = 13 * TILE_SIZE;
const playerSpawnY = 8 * TILE_SIZE;

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
    stackable: true,
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
      heal: 25,
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
      skillName: "swordSkill",
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
const GAME_LOOP_MS = 10;

const DECAY_REFRESH_COOLDOWN_MS = 1000;
let nextDecayRefresh = 0;
let corpseDecayCooldown = {
  player: {
    stage0: 9000,
    stage1: 9000,
    stage2: 6000,
  },
  monster: {
    stage0: 1500,
    stage1: 1500,
    stage2: 1800,
  },
};

let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;

let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;

const MONSTER_ATTACK_COOLDOWN_MS = 1500;

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
  name: "Charles",
  hp: 30,
  maxHp: 30,
  level: 0,
  experience: 0,
  gold: 0,
  damage: 4,
  magicSkill: 0,
  swordSkill: 1,
  maceSkill: 1,
  axeSkill: 1,
  distanceSkill: 1,
  shieldSkill: 1,
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
  player.style.left = `${playerState.x - camera.x}px`;
  player.style.top = `${playerState.y - camera.y - TILE_SIZE}px`;
  player.style.zIndex = playerState.y;
};

/* ---------- JOUEUR - VIE ET MORT ---------- */

const hpRefresh = () => {
  const playerHp = document.querySelector(".php-red");
  if (playerHp) {
    playerHp.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
    playerHp.style.setProperty("--hp-color", getHpColor(playerState.hp, playerState.maxHp));
  }
};

const playerDead = () => {
  const bag = getEquipmentSlotItem("backpack");
  if (bag) {
    closeContainer(bag);
    playerState.equipment.backpack = null;
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y, [bag]));
  } else {
    addGroundItem(createGroundItem("playerCorpse", 1, playerState.x, playerState.y));
  }

  refreshItemUiAfterDrag();

  playerState.experience = Math.floor(playerState.experience * 0.9);
  if (playerState.experience < 0) {
    playerState.experience = 0;
  }
  playerState.hp = playerState.maxHp;
  playerState.x = playerSpawnX;
  playerState.y = playerSpawnY;
  resetAfterDeath();
};

const resetAfterDeath = () => {
  selectedMonsterId = null;
  cancelItemDrag();
  cancelItemUse();
  clearMonsterSelection();
  updateWorldPosition();
  updatePlayerExperience();
  hpRefresh();
};

//#endregion  -----  PLAYER  -----

/* ==================================================== */
//#region     -----  CAMERA  -----
/* ==================================================== */
/* ---------- CAMERA - POSITION ---------- */

const updateCamera = () => {
  camera.x = playerState.x + TILE_SIZE / 2 - GAME_WIDTH / 2;
  camera.y = playerState.y + TILE_SIZE / 2 - GAME_HEIGHT / 2;
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
  const tiles = document.querySelectorAll(".tile");
  tiles.forEach((tile) => {
    const row = Number(tile.getAttribute("data-row"));
    const col = Number(tile.getAttribute("data-col"));
    const worldX = col * TILE_SIZE;
    const worldY = row * TILE_SIZE;
    tile.style.left = `${worldX - camera.x}px`;
    tile.style.top = `${worldY - camera.y}px`;
  });
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

/* ---------- OUTILS - MISE A JOUR DU MONDE ---------- */

const updateWorldPosition = () => {
  updateCamera();
  if (mousePosition.screenX !== null && mousePosition.screenY !== null) {
    updateMousePositionInfo(mousePosition.screenX, mousePosition.screenY);
  }
  updateMapPosition();
  updateItemPosition();
  updateMonsterPosition();
  updatePlayerPosition();
  updateLight(playerState);
};
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
  enrichedParts.forEach((enrichedPart, index) => {
    const div = createItemPartElement(item, enrichedPart, index);
    const position = getItemRenderPartPosition(item, enrichedPart);
    applyItemRenderPartPosition(div, position);
    game.appendChild(div);
  });
  game.appendChild(createWorldItemHitbox(item));
};

/* ---------- ITEMS - AFFICHAGE DOM ---------- */

const renderGroundItems = (items) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    renderGroundItemParts(item);
  }
};

/* ---------- ITEMS - AJOUT ET RETRAIT MONDE ---------- */

const addGroundItem = (worldItem) => {
  if (isValidWorldItem(worldItem)) {
    worldItems.push(worldItem);
    renderGroundItems([worldItem]);
  }
};

const removeGroundItemRender = (itemUid) => {
  const itemElements = document.querySelectorAll(`.world-item-part[data-item-uid="${itemUid}"]`);
  itemElements.forEach((itemElement) => {
    itemElement.remove();
  });
  const itemHitboxElements = document.querySelectorAll(`.hitbox[data-item-uid="${itemUid}"]`);
  itemHitboxElements.forEach((itemElement) => {
    itemElement.remove();
  });
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
//#region     -----  INVENTAIRE - POIDS ET RAFRAICHISSEMENT  -----
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

/* ---------- INVENTAIRE - MISE A JOUR ITEMS ---------- */

const updateItemPosition = () => {
  worldItems.forEach((item) => {
    const positions = getItemRenderPartsPositions(item);
    if (!positions || positions.length <= 0) {
      return;
    }
    const itemElements = document.querySelectorAll(`.world-item-part[data-item-uid="${item.uid}"]`);
    const itemHitboxElements = document.querySelectorAll(`.hitbox[data-item-uid="${item.uid}"]`);
    itemElements.forEach((element) => {
      const partIndex = Number(element.getAttribute("data-part-index"));
      const position = positions[partIndex];
      if (!position) {
        return;
      }
      applyItemRenderPartPosition(element, position);
    });
    itemHitboxElements.forEach((element) => {
      const positionHitbox = {
        left: item.x - camera.x,
        top: item.y - camera.y,
        zIndex: item.y,
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      };
      applyItemRenderPartPosition(element, positionHitbox);
    });
  });
};

const updateCorpseDecay = () => {
  if (nextDecayRefresh < Date.now()) {
    nextDecayRefresh = Date.now() + DECAY_REFRESH_COOLDOWN_MS;

    for (let i = decayingItems.length - 1; i >= 0; i--) {
      const item = decayingItems[i];

      if ("nextDecayAt" in item) {
        const now = Date.now();
        if (now < item.nextDecayAt) {
          continue;
        }
        const itemData = getItemData(item.itemId);
        if (!itemData || !itemData.decayType) {
          continue;
        }
        const decayType = itemData.decayType;
        if (!(decayType in corpseDecayCooldown)) {
          continue;
        }
        const profile = corpseDecayCooldown[decayType];

        if (item.decayStage === 0) {
          item.decayStage = 1;
          item.nextDecayAt = now + profile.stage1;
          refreshAllByUid(item.uid);
        } else if (item.decayStage === 1) {
          item.decayStage = 2;
          item.nextDecayAt = now + profile.stage2;
          closeContainer(item);
          refreshAllByUid(item.uid);
        } else if (item.decayStage === 2) {
          removeAllByUid(item.uid);
        }
      }
    }
  }
};

//#endregion  -----  INVENTAIRE - POIDS ET RAFRAICHISSEMENT  -----

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
  const draggingWorld = document.querySelectorAll(".world-item-selected");

  draggingSlots.forEach((slot) => {
    slot.classList.remove("container-slot-dragging");
  });
  draggingWorld.forEach((worldItem) => {
    worldItem.classList.remove("world-item-selected");
  });
  resetDragState();
  resetDragStatePending();
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
    const location = findItemLocationByUid(source.parentContainerUid);
    if (!location) {
      return null;
    }
    const parentContainer = getItemFromLocation(location);

    if (!parentContainer || !parentContainer.content) {
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

const removeItemFromDragSource = (source) => {
  if (!source) {
    return null;
  }
  const item = getDragSourceItem(source);
  if (!item) {
    return null;
  }
  if (source.locationType === "containerSlot") {
    const location = findItemLocationByUid(source.parentContainerUid);
    if (!location) {
      return null;
    }
    const parentContainer = getItemFromLocation(location);

    if (!parentContainer || !parentContainer.content) {
      return null;
    }
    parentContainer.content[source.slotIndex] = null;
    return item;
  } else if (source.locationType === "equipmentSlot") {
    const slotName = source.equipmentSlotName;
    playerState.equipment[slotName] = null;
    return item;
  } else if (source.locationType === "worldItem") {
    const itemIndex = worldItems.findIndex((worldItem) => {
      return worldItem.uid === source.itemUid;
    });

    if (itemIndex === -1) {
      return null;
    }
    worldItems.splice(itemIndex, 1);
    removeGroundItemRender(item.uid);
    return item;
  } else {
    return null;
  }
};

/* ---------- DRAG - DESTINATION ---------- */

const placeItemInDragDestination = (destination, item) => {
  if (!destination || !item) {
    return null;
  }
  if (destination.locationType === "containerSlot") {
    const location = findItemLocationByUid(destination.parentContainerUid);
    if (!location) {
      return null;
    }
    const parentContainer = getItemFromLocation(location);

    if (!parentContainer || !parentContainer.content) {
      return null;
    }

    if (!parentContainer.content[destination.slotIndex]) {
      parentContainer.content[destination.slotIndex] = item;
      return true;
    } else {
      const existingItem = parentContainer.content[destination.slotIndex];
      parentContainer.content[destination.slotIndex] = item;
      return existingItem;
    }
  } else if (destination.locationType === "equipmentSlot") {
    if (
      !destination.equipmentSlotName ||
      !(destination.equipmentSlotName in playerState.equipment) ||
      !canPlaceItemInEquipmentSlot(item, destination.equipmentSlotName)
    ) {
      return null;
    }

    if (!playerState.equipment[destination.equipmentSlotName]) {
      playerState.equipment[destination.equipmentSlotName] = item;
      return true;
    } else {
      const existingItem = playerState.equipment[destination.equipmentSlotName];
      playerState.equipment[destination.equipmentSlotName] = item;
      return existingItem;
    }
  } else if (destination.locationType === "worldTile") {
    const tilePosition = getTilePosition(destination);
    if (
      !Number.isInteger(destination.x) ||
      !Number.isInteger(destination.y) ||
      !isInsideMap(destination.x, destination.y) ||
      gameMap[tilePosition.row][tilePosition.col] !== FLOOR
    ) {
      return null;
    }

    item.x = destination.x;
    item.y = destination.y;
    addGroundItem(item);
    return true;
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

/* ---------- DRAG - VALIDATION ACTION COMPLETE ---------- */
const refreshItemUiAfterDrag = () => {
  renderContainerDock();
  updatePlayerCarriedWeight();
  updatePlayerInventory();
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

const closeFarOpenedContainers = () => {
  openedContainers.forEach((container) => {
    if (container.sourceType === "world" && !isNearPlayer(container.item, 1)) {
      closeContainer(container.item);
    }
  });
};

const updateOpenedContainerSourceType = (item, sourceType) => {
  openedContainers.forEach((container) => {
    if (container.item.uid === item.uid) {
      container.sourceType = sourceType;
    }
  });
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
        const location = findItemLocationByUid(destination.parentContainerUid);
        if (!location) {
          refreshItemUiAfterDrag();
          return true;
        }
        const parentContainer = getItemFromLocation(location);

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
            placeItemInDragDestination(rollbackDestination, removedItem);
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
  if (destinationItem && isContainerItem(destinationItem)) {
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
    const location = findItemLocationByUid(destination.parentContainerUid);
    if (!location) {
      cancelItemDrag();
      return true;
    }
    const destinationContainer = getItemFromLocation(location);

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
        placeItemInDragDestination(oldSource, removedItem);
        refreshItemUiAfterDrag();
        return true;
      } else {
        placeItemInDragDestination(source, removedItem);
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
    const location = findItemLocationByUid(itemLocation.parentContainerUid);
    if (!location) {
      return false;
    }
    const parentContainer = getItemFromLocation(location);

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
    const parentContainerLocation = findItemLocationByUid(itemLocation.parentContainerUid);
    const parentContainer = getItemFromLocation(parentContainerLocation);
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
    const itemElements = document.querySelectorAll(`.world-item-part[data-item-uid="${uid}"]`);
    const parts = getItemRenderData(item);
    itemElements.forEach((element) => {
      const partIndex = Number(element.getAttribute("data-part-index"));
      const part = parts[partIndex];
      if (part) {
        element.style.backgroundPosition = `-${part.sourceX}px -${part.sourceY}px`;
      }
    });
    return;
  }
  renderContainerDock();
  updatePlayerInventory();
  updatePlayerCarriedWeight();
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
    closeContainer(item);
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
    const index = worldItems.findIndex((worldItem) => {
      return worldItem.uid === item.uid;
    });
    if (index !== -1) {
      worldItems.splice(index, 1);
      removeGroundItemRender(uid);
    }
  } else if (location.locationType === "equipmentSlot") {
    playerState.equipment[location.equipmentSlotName] = null;
  } else if (location.locationType === "containerSlot") {
    const parentContainerLocation = findItemLocationByUid(location.parentContainerUid);
    if (!parentContainerLocation) {
      return;
    }
    const parentContainer = getItemFromLocation(parentContainerLocation);
    if (!parentContainer || !parentContainer.content) {
      return;
    }
    parentContainer.content[location.slotIndex] = null;
  } else {
    return;
  }
  renderContainerDock();
  updatePlayerInventory();
  updatePlayerCarriedWeight();
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
    const location = findItemLocationByUid(destination.parentContainerUid);
    if (!location) {
      cancelItemDrag();
      return;
    }
    destinationContainer = getItemFromLocation(location);

    if (!destinationContainer || !destinationContainer.content) {
      cancelItemDrag();
      return;
    }
  }

  if (isContainerMoveIntoItself(sourceItem, destinationContainer)) {
    cancelItemDrag();
    return;
  }

  if (tryStackItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
    return;
  }

  if (isContainerMoveIntoContainerItemItself(sourceItem, destinationItem)) {
    cancelItemDrag();
    return;
  }

  if (tryMoveItemOnContainerItemDuringDrag(source, sourceItem, destinationItem)) {
    return;
  }

  if (tryMoveItemToEmptySlotDuringDrag(source, sourceItem, destination, destinationItem)) {
    return;
  }

  if (tryMoveEquipmentItemToContainerWhenSwapInvalidDuringDrag(source, destination, destinationItem)) {
    return;
  }

  if (trySwapItemsDuringDrag(source, sourceItem, destination, destinationItem)) {
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
        const parentAlreadyOpen = openedContainers.find((container) => {
          return container.item.uid === parentWrapper.item.uid;
        });
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

const closeContainer = (containerItem) => {
  const index = openedContainers.findIndex((openedContainer) => {
    return containerItem.uid === openedContainer.item.uid;
  });
  if (index === -1) {
    return;
  }
  openedContainers.splice(index, 1);
  renderContainerDock();
};

const openContainer = (containerItem, title, source, parent) => {
  if (
    !isContainerItem(containerItem) ||
    (source === "world" && !isNearPlayer(containerItem, 1)) ||
    !isOpenableContainerItem(containerItem)
  ) {
    return;
  }

  const alreadyOpen = openedContainers.some((openedContainer) => {
    return containerItem.uid === openedContainer.item.uid;
  });
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
  const openedContainer = openedContainers.find((openedContainer) => {
    return openedContainer.item.uid === containerUid;
  });
  if (!openedContainer) {
    return null;
  }
  return openedContainer.item;
};

const toggleContainerMinimized = (containerItem) => {
  const openedContainer = openedContainers.find((openedContainer) => {
    return openedContainer.item.uid === containerItem.uid;
  });
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
  if (!item.charges) {
    return;
  }
  if (item.charges >= 1) {
    item.charges -= 1;
  }
  if (item.charges <= 0) {
    removeItemFromDragSource(source);
  }
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

const handleOpenContainerUse = (source, item, itemData, context = {}) => {
  let parentWrapper = null;
  if (source.locationType === "equipmentSlot") {
    openContainer(item, itemData.name, "equipment", null);
    return;
  } else if (source.locationType === "worldItem") {
    openContainer(item, itemData.name, "world", null);
    return;
  } else if (source.locationType === "containerSlot") {
    openedContainers.forEach((container) => {
      if (container.item.uid === source.parentContainerUid) {
        parentWrapper = container;
      }
    });

    if (!parentWrapper) {
      return;
    }
    let alreadyOpen = false;
    if (itemData) {
      openedContainers.forEach((container) => {
        if (container.item.uid === item.uid) {
          alreadyOpen = true;
        }
      });

      if (alreadyOpen) {
        openContainer(item, itemData.name, "container", parentWrapper);
        return;
      }

      closeContainer(parentWrapper.item);
      openContainer(item, itemData.name, "container", parentWrapper);
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
      playerState.hp = playerState.maxHp;
    } else {
      healAmount = useData.heal;
      playerState.hp += healAmount;
    }
    startUseCooldown(cooldownGroup);
    showFloatingTextAbovePlayer(healAmount, "heal");
    consumeOneItemFromSource(source, item);
    hpRefresh();
    updatePlayerStats();
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
    const attackResult = calculateRuneAttackResult(useData);
    applyDamageToMonster(target.monster, attackResult);
    startUseCooldown(cooldownGroup);
    consumeOneChargeFromRune(item, source);
    refreshItemUiAfterDrag();
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
    return;
  }
  if (!item.quantity || item.quantity <= 1) {
    removeItemFromDragSource(source);
    refreshItemUiAfterDrag();
  } else if (item.quantity > 1) {
    item.quantity -= 1;
    refreshItemUiAfterDrag();
  }
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

const updatePlayerStats = () => {
  playerStats.innerHTML = `<div class="boite-boite">
                              <div class="boite-jeux-titre">Stats</div>
                              <div class="separateur-panneau"></div>
                              <div class="boite-row"><span>Name:</span><span>${playerState.name}</span></div>
                              <div class="boite-row"><span>Level:</span><span>${playerState.level}</span></div>
                              <div class="boite-row"><span>HP:</span><span>${playerState.hp}/${playerState.maxHp}</span></div>
                              <div class="boite-row"><span>EXP:</span><span>${playerState.experience}</span></div>
                              <div class="boite-row"><span>Gold:</span><span>${playerState.gold}</span></div>
                              <div class="boite-row"><span>Magic Level:</span><span>${playerState.magicSkill}</span></div>
                              <div class="boite-row"><span>Sword Fighting:</span><span>${playerState.swordSkill}</span></div>
                              <div class="boite-row"><span>Mace Fighting:</span><span>${playerState.maceSkill}</span></div>
                              <div class="boite-row"><span>Axe Fighting:</span><span>${playerState.axeSkill}</span></div>
                              <div class="boite-row"><span>Distance:</span><span>${playerState.distanceSkill}</span></div>
                              <div class="boite-row"><span>Shielding:</span><span>${playerState.shieldSkill}</span></div>
                              
                            </div>`;
};

const updatePlayerExperience = () => {
  const EXP_PER_LEVEL = 100;
  playerState.level = Math.floor(playerState.experience / EXP_PER_LEVEL);
  const currentLevelExp = playerState.experience % EXP_PER_LEVEL;
  updatePlayerStats();
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
const showFloatingTextAboveTarget = (text, offsetY, target) => {
  const wrapper = document.createElement("div");
  wrapper.classList.add("floating-text-wrapper");
  wrapper.style.left = `${target.x - camera.x + TILE_SIZE / 2}px`;
  wrapper.style.top = `${target.y - camera.y - offsetY}px`;

  const div = document.createElement("div");
  div.classList.add("floating-text");
  div.textContent = `${text}`;

  wrapper.appendChild(div);
  game.appendChild(wrapper);
  setTimeout(() => {
    wrapper.remove();
  }, 2000);
};

const showLookFloatingText = (lookInfo) => {
  if (!lookInfo) {
    return;
  }
  let text = "";
  let offsetY = 130;
  const isCarriedItem = lookInfo.sourceType === "equipmentSlot" || lookInfo.sourceType === "containerSlot";
  const isNearbyWorldItem = lookInfo.sourceType === "worldItem" && isNearPlayer(lookInfo.target, 1);

  if (lookInfo.weight !== undefined && (isCarriedItem || isNearbyWorldItem)) {
    offsetY = 100;
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
    offsetY = 115;
    text = `You see ${lookInfo.suffix} ${lookInfo.name}.`;
  }
  showFloatingTextAboveTarget(text, offsetY, playerState);
};

const showFloatingTextAboveMonster = (monster, text, type) => {
  const monsterElement = findMonsterElement(monster.uid);
  if (!monsterElement) {
    return;
  }
  const monsterTextElement = monsterElement.querySelector(".monster-floating-text-layer");
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
  const playerElement = game.querySelector("#player");
  if (!playerElement) {
    return;
  }
  const playerTextElement = playerElement.querySelector(".player-floating-text-layer");
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
    const screenX = source.x - camera.x + TILE_SIZE / 2;
    const screenY = source.y - camera.y + TILE_SIZE / 2;
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

const updateMovement = () => {
  const direction = getWantedDirection();
  if (!direction) {
    playerState.walkFrame = 1;
    updatePlayerSprite();
    return;
  }

  const now = Date.now();
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
    playerState.x = nextX;
    playerState.y = nextY;
    playerState.direction = direction;
    playerState.walkFrame += 1;
    if (playerState.walkFrame >= PLAYER_ANIMATION_FRAMES) {
      playerState.walkFrame = 0;
    }
  }
  updatePlayerSprite();
  updateWorldPosition();
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

/* ---------- INPUTS - TOUCHE APPUYEE ---------- */

document.addEventListener("keydown", (e) => {
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
  } else {
    return;
  }
});

/* ---------- INPUTS - TOUCHE RELACHEE ---------- */

document.addEventListener("keyup", (e) => {
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
      const parts = document.querySelectorAll(`.world-item-part[data-item-uid="${itemUid}"]`);
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
  const monsterHp = document.querySelector(`.hp-red[data-monster-uid="${monster.uid}"]`);
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
    hp: monsterData.maxHp,
    uid: nextMonsterId++,
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
    if (monster.uid === selectedMonsterId) {
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
    game.appendChild(div);
    updateMonsterSprite(monster);
  }
};

const updateMonsterSprite = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  const col = monsterData.atlasCol + monster.walkFrame;
  const row = monsterData.atlasRow + getDirectionRow(monster.direction);
  const monsterElement = findMonsterElement(monster.uid);
  const monsterSpriteElement = monsterElement.querySelector(".monster-sprite");
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
  if (monster.uid === selectedMonsterId) {
    selectedMonsterId = null;
    return;
  }
  selectedMonsterId = monster.uid;
  selectMonsterElement(selectedMonsterId);
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

const removeMonster = (monsterId) => {
  const monsterElement = document.querySelector(`.monster[data-monster-uid="${monsterId}"]`);
  if (monsterElement) {
    monsterElement.remove();
  }
  const monsterIndex = monsters.findIndex((monster) => {
    return monsterId === monster.uid;
  });
  if (monsterIndex != -1) {
    monsters.splice(monsterIndex, 1);
  }
};

const clearMonsters = () => {
  const monstersElements = document.querySelectorAll(".monster");
  monstersElements.forEach((monster) => {
    monster.remove();
  });
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
  const monsterSelection = document.querySelectorAll(".monster-selected");
  monsterSelection.forEach((monster) => {
    monster.classList.remove("monster-selected");
  });
};

const deadMonster = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  const lootContent = generateMonsterLoot(monsterData);
  addGroundItem(createGroundItem(monsterData.corpseItemId, 1, monster.x, monster.y, lootContent));
  removeMonster(monster.uid);
  selectedMonsterId = null;
};

const findNearMonster = (monsterList) => {
  const nearMonsterIndex = monsterList.findIndex((monster) => {
    return isNearPlayer(monster);
  });
  return nearMonsterIndex;
};

const findMonsterById = (monsterId) => {
  const monster = monsters.find((monster) => {
    return monsterId === monster.uid;
  });
  return monster;
};

const selectMonsterElement = (monsterId) => {
  const monsterElement = document.querySelector(`.monster[data-monster-uid="${monsterId}"]`);
  if (monsterElement) {
    monsterElement.classList.add("monster-selected");
  }
};

const findMonsterElement = (monsterUid) => {
  const monsterElement = document.querySelector(`.monster[data-monster-uid="${monsterUid}"]`);
  return monsterElement;
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

/* ---------- MONSTRES - COMBAT POSITION MOUVEMENT ---------- */

const updateMonsterCombat = () => {
  monsters.forEach((monster) => {
    if (isNearPlayer(monster)) {
      const monsterData = getMonsterData(monster.monsterId);
      const now = Date.now();
      if (now < monster.nextAttackTime) {
        return;
      }
      monster.nextAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;
      const attackResult = calculateDamageTakenByPlayer(monsterData.combat);
      if (attackResult.finalDamage > 0) {
        playerState.hp -= attackResult.finalDamage;
      }
      showFloatingTextAbovePlayer(attackResult.text, attackResult.textType);
      updatePlayerStats();
      hpRefresh();
      if (playerState.hp <= 0) {
        playerState.hp = 0;
        hpRefresh();
        playerDead();
      }
      return;
    }
  });
};

const updateMonsterPosition = () => {
  monsters.forEach((monster) => {
    const monsterData = getMonsterData(monster.monsterId);
    const monsterElement = document.querySelector(`.monster[data-monster-uid="${monster.uid}"]`);
    if (monsterElement) {
      monsterElement.style.left = `${monster.x - camera.x + monsterData.drawOffsetX}px`;
      monsterElement.style.top = `${monster.y - camera.y + monsterData.drawOffsetY}px`;
      monsterElement.style.zIndex = monster.y;
    }
  });
};

const updateMonsterMovement = () => {
  const date = Date.now();
  monsters.forEach((monster) => {
    if (!isNearPlayer(monster, 12)) {
      return;
    }
    if (isNearPlayer(monster, 1)) {
      return;
    }
    if (monster.nextMoveTime > date) {
      return;
    }
    const monsterData = getMonsterData(monster.monsterId);
    monster.nextMoveTime = date + monsterData.moveCooldown;
    const monsterPosition = getTilePosition(monster);
    const destination = pathDestination(monsterPosition, getTilePosition(playerState));
    if (destination !== null) {
      if (monster.path.length <= 0) {
        monster.path = findPath(monsterPosition, destination);
        monster.nextPathRefreshTime = date + monsterData.pathRefreshCooldown;
      } else {
        const oldPathEnd = monster.path[monster.path.length - 1];

        if (getDistance(oldPathEnd, destination) > 2) {
          const newPath = findPath(monsterPosition, destination);
          if (newPath.length > 0) {
            monster.path = newPath;
            monster.nextPathRefreshTime = date + monsterData.pathRefreshCooldown;
          }
        } else if (date >= monster.nextPathRefreshTime) {
          const newPath = findPath(monsterPosition, destination);
          monster.nextPathRefreshTime = date + monsterData.pathRefreshCooldown;
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
      monster.x = tileX;
      monster.y = tileY;
    }
  });
  updateMonsterPosition();
};
//#endregion  -----  MONSTRES  -----

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

const getPlayerAttackSkill = () => {
  const combatData = getEquippedWeaponCombatData();
  if (!combatData || !combatData.skillName) {
    return 1;
  }
  const skillName = combatData.skillName;
  if (!(skillName in playerState)) {
    return 1;
  }
  return playerState[skillName];
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

const calculateDamageTakenByPlayer = (attackerCombatData) => {
  const combatModeData = getCombatModeData();
  const playerArmor = getPlayerTotalArmor();
  const playerShieldDefense = getPlayerShieldDefense();
  const shieldSkill = playerState.shieldSkill;
  //!!!!! CHANCE MONSTRE HIT !!!!
  let hitChance = attackerCombatData.hitChance - shieldSkill * 0.4;
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
  let blockChance = 10 + shieldSkill * 0.8 + playerShieldDefense * 0.8;
  blockChance *= combatModeData.blockChanceMultiplier;
  blockChance = clamp(blockChance, 5, 70);
  let defensePower = 0;
  let defenseReduction = 0;
  const rollBlock = getRandomInt(1, 100);
  if (rollBlock <= blockChance) {
    wasBlocked = true;
    defensePower = playerShieldDefense * 0.25 + shieldSkill * 0.1;
    defensePower *= combatModeData.defenseMultiplier;
    defenseReduction = getRandomFloat(defensePower * 0.6, defensePower * 1.2);
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
  const magicLevel = playerState.magicSkill;
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

const applyDamageToMonster = (monster, attackResult) => {
  if (!monster || monster.hp <= 0) {
    return;
  }
  const monsterData = getMonsterData(monster.monsterId);
  if (!monsterData) {
    return;
  }
  let damageAmount = 0;
  if (monster.hp - attackResult.finalDamage <= 0) {
    damageAmount = monster.hp;
  } else {
    damageAmount = attackResult.finalDamage;
  }
  if (Number.isFinite(damageAmount) && damageAmount > 0) {
    monster.hp -= damageAmount;
    showFloatingTextAboveMonster(monster, damageAmount, attackResult.textType);
    monsterHpRefresh(monster);
    if (monster.hp <= 0) {
      monster.hp = 0;
      deadMonster(monster);
      playerState.experience += monsterData.experience;
      updatePlayerExperience();
    }
  }
};

/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const attackMonster = (monster) => {
  const attackResult = calculatePlayerAttackResult(monster);
  if (attackResult.finalDamage > 0) {
    applyDamageToMonster(monster, attackResult);
    return;
  }
  showFloatingTextAboveMonster(monster, attackResult.text, attackResult.textType);
};

const updateCombat = () => {
  if (selectedMonsterId === null) {
    return;
  }
  const monster = findMonsterById(selectedMonsterId);
  if (!monster) {
    return;
  }
  if (!isNearPlayer(monster)) {
    return;
  }
  const now = Date.now();
  if (now < nextPlayerAttackTime) {
    return;
  }
  attackMonster(monster);
  nextPlayerAttackTime = now + PLAYER_ATTACK_COOLDOWN_MS;
};
//#endregion  -----  COMBAT - JOUEUR, MONSTRES ET RUNES  -----

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
});
boiteJeux.addEventListener("mouseup", (e) => {
  e.preventDefault();
});
boiteJeux.addEventListener("click", (e) => {
  e.preventDefault();
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

const gameLoop = () => {
  updateMovement();
  updateCombat();
  updateMonsterMovement();
  updateMonsterCombat();
  updateCorpseDecay();
};

setInterval(gameLoop, GAME_LOOP_MS);
//#endregion  -----  BOUCLE DE JEU  -----

/* ==================================================== */
//#region     -----  INITIALISATION DU JEU  -----
/* ==================================================== */
/* ---------- INITIALISATION - DEMARRAGE ---------- */

updateGameScale();
showPlayerName(playerState.name);
updatePlayerSprite();

renderMap(gameMap);

playerState.equipment.backpack = createItemInstance("bag", 1);
playerState.equipment.backpack.content[0] = createItemInstance("apple", 1);
playerState.equipment.backpack.content[1] = createItemInstance("healthPotion", 1);
playerState.equipment.backpack.content[4] = createItemInstance("healthPotion", 1);
playerState.equipment.backpack.content[5] = createItemInstance("healthPotion", 1);
playerState.equipment.backpack.content[2] = createItemInstance("goldCoin", 1);
playerState.equipment.backpack.content[3] = createItemInstance("fireRune", 1);

updatePlayerCarriedWeight();
updatePlayerInventory();
renderContainerDock();
updatePlayerStats();

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

renderMonsters(monsters);
updateWorldPosition();
updateLight(playerState);
//#endregion  -----  INITIALISATION DU JEU  -----

/* ==================================================== */
//#region     -----  DEBUG CONSOLE  -----
/* ==================================================== */
/* ---------- DEBUG - LOGS TEMPORAIRES ---------- */

console.log(gameMap);
console.log(player);

//#endregion  -----  DEBUG CONSOLE  -----
