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
//#region     -----  BASE - CONSTANTES ET VARIABLES  -----
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
const monsters = [];
const openedContainers = [];

const dragState = {
  isDragging: false,
  item: null,
  sourceType: null,
  sourceSlotIndex: null,
  sourceSlotName: null,
  sourceContainerUid: null,
  sourceWorldItemUid: null,
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
//#endregion  -----  BASE - CONSTANTES ET VARIABLES  -----

/* ==================================================== */
//#region     -----  BASE DE DONNEES  -----
/* ==================================================== */
const itemsDatabase = {
  apple: {
    itemId: "apple",
    name: "Apple",
    desc: "An apple.",
    type: "food",
    weight: 10,
    stackable: true,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 0,
          atlasRow: 0,
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
  },
  ratCorpse: {
    itemId: "ratCorpse",
    name: "Rat Corpse",
    desc: "A dead rat.",
    type: "corpse",
    weight: 75,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 5,
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
    type: "sword",
    equipmentSlot: ["weapon"],
    weight: 30,
    stackable: false,
    blockMovement: false,
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
  spiderCorpse: {
    itemId: "spiderCorpse",
    name: "Spider Corpse",
    desc: "A dead spider.",
    type: "corpse",
    weight: 100,
    stackable: false,
    blockMovement: false,
    container: true,
    capacity: 5,
    render: {
      atlas: "items",
      parts: [
        {
          atlasCol: 1,
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
};

const monstersDatabase = {
  rat: {
    monsterId: "rat",
    name: "Rat",
    desc: "A rat.",
    maxHp: 20,
    damage: 2,
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
    loot: [
      {
        itemId: "goldCoin",
        chance: 80,
        minQuantity: 1,
        maxQuantity: 4,
      },
      {
        itemId: "apple",
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
    maxHp: 50,
    damage: 4,
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
    loot: [
      {
        itemId: "goldCoin",
        chance: 80,
        minQuantity: 1,
        maxQuantity: 7,
      },
      {
        itemId: "sword",
        chance: 100,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
};
//#endregion  -----  BASE DE DONNEES  -----

/* ==================================================== */
//#region     -----  CORE - TIMING  -----
/* ==================================================== */
const GAME_LOOP_MS = 10;

let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;

let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;
let nextMonsterAttackTime = 0;

const MONSTER_ATTACK_COOLDOWN_MS = 1500;
//#endregion  -----  CORE - TIMING  -----

/* ==================================================== */
//#region     -----  PLAYER - CONSTANTES SPRITE  -----
/* ==================================================== */
const PLAYER_FRAME_WIDTH = TILE_SIZE;
const PLAYER_FRAME_HEIGHT = TILE_SIZE * 2;
const PLAYER_ANIMATION_FRAMES = 3;
//#endregion  -----  PLAYER - CONSTANTES SPRITE  -----

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
  damage: 10,
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
  playerState.experience = Math.floor(playerState.experience * 0.9);
  if (playerState.experience < 0) {
    playerState.experience = 0;
  }
  playerState.hp = playerState.maxHp;
  playerState.x = playerSpawnX;
  playerState.y = playerSpawnY;
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
//#region     -----  ITEMS  -----
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

const getItemRenderData = (itemId) => {
  const parts = getItemRenderParts(itemId);
  const enrichedParts = parts.map((part) => {
    const source = getAtlasSource(part.atlasCol, part.atlasRow, SPRITE_SIZE);
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
  const parts = getItemRenderData(item.itemId);
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
//#endregion  -----  ITEMS  -----

/* ==================================================== */
//#region     -----  ITEMS - MONDE ET RENDU DOM  -----
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
  if (itemData.container) {
    itemInstance.content = content;
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

    const monster = findMonsterAtPosition(item.x, item.y);
    if (monster) {
      selectMonster(monster);
      return;
    }

    if (!itemData) {
      return;
    }

    openContainer(item, itemData.name, "world", null);
  });
  return hitbox;
};

const renderGroundItemParts = (item) => {
  if (!item) {
    return;
  }
  const enrichedParts = getItemRenderData(item.itemId);
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
//#endregion  -----  ITEMS - MONDE ET RENDU DOM  -----

/* ==================================================== */
//#region     -----  ITEMS - INVENTAIRE - DONNEES ET INTERACTIONS  -----
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
//#endregion  -----  ITEMS - INVENTAIRE - DONNEES ET INTERACTIONS  -----

/* ==================================================== */
//#region     -----  DRAG AND DROP - DONNEES ET ACTIONS  -----
/* ==================================================== */

/* ---------- DRAG - ETAT ---------- */

const resetDragState = () => {
  dragState.isDragging = false;
  dragState.item = null;
  dragState.sourceType = null;
  dragState.sourceSlotIndex = null;
  dragState.sourceSlotName = null;
  dragState.sourceContainerUid = null;
  dragState.sourceWorldItemUid = null;
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

  if (source.type === "container") {
    dragState.sourceType = "container";
    dragState.sourceContainerUid = source.containerUid;
    dragState.sourceSlotIndex = source.slotIndex;
  } else if (source.type === "equipment") {
    dragState.sourceType = "equipment";
    dragState.sourceSlotName = source.slotName;
  } else if (source.type === "world") {
    dragState.sourceType = "world";
    dragState.sourceWorldItemUid = source.worldItemUid;
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
  if (dragState.sourceType === "container") {
    return {
      type: dragState.sourceType,
      containerUid: dragState.sourceContainerUid,
      slotIndex: dragState.sourceSlotIndex,
    };
  } else if (dragState.sourceType === "equipment") {
    return {
      type: dragState.sourceType,
      slotName: dragState.sourceSlotName,
    };
  } else if (dragState.sourceType === "world") {
    return {
      type: dragState.sourceType,
      worldItemUid: dragState.sourceWorldItemUid,
    };
  } else {
    return null;
  }
};

const getDragSourceItem = (source) => {
  if (!source) {
    return null;
  }

  if (source.type === "container") {
    const container = findOpenedContainerItemByUid(source.containerUid);
    if (!container || !container.content) {
      return null;
    }
    return container.content[source.slotIndex];
  } else if (source.type === "equipment") {
    const item = getEquipmentSlotItem(source.slotName);
    return item;
  } else if (source.type === "world") {
    const item = worldItems.find((item) => {
      return item.uid === source.worldItemUid;
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
  if (source.type === "container") {
    const container = findOpenedContainerItemByUid(source.containerUid);
    if (!container || !container.content) {
      return null;
    }
    container.content[source.slotIndex] = null;
    return item;
  } else if (source.type === "equipment") {
    const slotName = source.slotName;
    playerState.equipment[slotName] = null;
    return item;
  } else if (source.type === "world") {
    const itemIndex = worldItems.findIndex((worldItem) => {
      return worldItem.uid === source.worldItemUid;
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
  if (destination.type === "container") {
    let container = null;
    if (destination.containerItem) {
      container = destination.containerItem;
    } else {
      container = findOpenedContainerItemByUid(destination.containerUid);
    }
    if (!container || !container.content) {
      return null;
    }
    if (!container.content[destination.slotIndex]) {
      container.content[destination.slotIndex] = item;
      return true;
    } else {
      const existingItem = container.content[destination.slotIndex];
      container.content[destination.slotIndex] = item;
      return existingItem;
    }
  } else if (destination.type === "equipment") {
    if (
      !destination.slotName ||
      !(destination.slotName in playerState.equipment) ||
      !canPlaceItemInEquipmentSlot(item, destination.slotName)
    ) {
      return null;
    }

    if (!playerState.equipment[destination.slotName]) {
      playerState.equipment[destination.slotName] = item;
      return true;
    } else {
      const existingItem = playerState.equipment[destination.slotName];
      playerState.equipment[destination.slotName] = item;
      return existingItem;
    }
  } else if (destination.type === "world") {
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

const tryStackItemsDuringDrag = (source, sourceItem, destinationItem) => {
  if (destinationItem && sourceItem.itemId === destinationItem.itemId) {
    const itemData = getItemData(sourceItem.itemId);
    if (itemData && itemData.stackable) {
      const freeStackSpace = 100 - destinationItem.quantity;

      if (freeStackSpace <= 0) {
        return false;
      }

      if (sourceItem.quantity <= freeStackSpace) {
        destinationItem.quantity += sourceItem.quantity;
        removeItemFromDragSource(source);
        refreshItemUiAfterDrag();
        return true;
      }

      if (sourceItem.quantity > freeStackSpace) {
        destinationItem.quantity += freeStackSpace;
        sourceItem.quantity -= freeStackSpace;
        refreshItemUiAfterDrag();
        return true;
      }
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
      type: "container",
      containerItem: destinationItem,
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

const tryMoveItemToEmptySlotDuringDrag = (source, sourceItem, destination, destinationItem) => {
  if (
    !destinationItem &&
    (destination.type === "container" ||
      (destination.type === "equipment" && canPlaceItemInEquipmentSlot(sourceItem, destination.slotName)))
  ) {
    const removedItem = removeItemFromDragSource(source);
    if (!removedItem) {
      cancelItemDrag();
      return true;
    }
    placeItemInDragDestination(destination, removedItem);
    if (isContainerItem(removedItem)) {
      if (destination.type === "container") {
        updateOpenedContainerSourceType(removedItem, "container");
      } else if (destination.type === "equipment") {
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
    source.type === "equipment" &&
    destination.type === "container" &&
    destinationItem &&
    !canPlaceItemInEquipmentSlot(destinationItem, source.slotName)
  ) {
    const destinationContainer = findOpenedContainerItemByUid(destination.containerUid);
    if (!destinationContainer) {
      cancelItemDrag();
      return true;
    }
    const emptySlot = findFirstEmptyContainerSlot(destinationContainer);
    if (emptySlot === null) {
      cancelItemDrag();
      return true;
    }

    const destinationSlotContainer = {
      type: "container",
      containerUid: destination.containerUid,
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
    (destination.type === "container" ||
      (destination.type === "equipment" && canPlaceItemInEquipmentSlot(sourceItem, destination.slotName))) &&
    (source.type === "container" ||
      (source.type === "equipment" && canPlaceItemInEquipmentSlot(destinationItem, source.slotName)))
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
      updateOpenedContainerSourceType(removedSource, destination.type);
    }
    placeItemInDragDestination(source, removedDestination);
    if (isContainerItem(removedDestination)) {
      updateOpenedContainerSourceType(removedDestination, source.type);
    }
    refreshItemUiAfterDrag();
    return true;
  }
  return false;
};

const tryMoveItemToWorldDuringDrag = (source, sourceItem, destination) => {
  if (destination.type === "world") {
    if (!isNearPlayer(destination, 9)) {
      cancelItemDrag();
      return true;
    }
    const oldSource = {
      type: "world",
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
      if (source.type === "world") {
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

const isDragAddressCarriedByPlayer = (adress) => {
  if (adress.type === "equipment") {
    return true;
  }
  if (adress.type === "world") {
    return false;
  }
  if (adress.type === "container") {
    const container = openedContainers.find((container) => {
      return adress.containerUid === container.item.uid;
    });
    return isOpenedContainerCarriedByPlayer(container);
  }
  return false;
};
const isOpenedContainerCarriedByPlayer = (openedContainer) => {
  if (!openedContainer) {
    return false;
  }

  if (openedContainer.sourceType === "equipment") {
    return true;
  }
  if (openedContainer.sourceType === "world") {
    return false;
  }
  if (openedContainer.sourceType === "container") {
    if (openedContainer.parent !== null) {
      return isOpenedContainerCarriedByPlayer(openedContainer.parent);
    }
  }
  return false;
};

const isExceedCapacity = (source, destination, item) => {
  const sourceCarried = isDragAddressCarriedByPlayer(source);
  const destinationCarried = isDragAddressCarriedByPlayer(destination);
  if (!sourceCarried && destinationCarried) {
    if (playerState.capacity - playerState.carriedWeight < getItemTotalWeight(item)) {
      return true;
    }
  }
  return false;
};

const isSameDragSourceAndDestination = (source, destination) => {
  if (
    source.type === "container" &&
    destination.type === "container" &&
    source.containerUid === destination.containerUid &&
    source.slotIndex === destination.slotIndex
  ) {
    return true;
  }
  if (source.type === "equipment" && destination.type === "equipment" && source.slotName === destination.slotName) {
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
  if (source.type === "world" && !isNearPlayer(sourceItem, 1)) {
    cancelItemDrag();
    return;
  }

  if (tryMoveItemToWorldDuringDrag(source, sourceItem, destination)) {
    return;
  }

  if (isExceedCapacity(source, destination, sourceItem)) {
    cancelItemDrag();
    return;
  }

  const destinationItem = getDragSourceItem(destination);

  if (isSameDragSourceAndDestination(source, destination)) {
    cancelItemDrag();
    return;
  }

  let destinationContainer = null;
  if (destination.type === "container") {
    destinationContainer = findOpenedContainerItemByUid(destination.containerUid);
  }

  if (isContainerMoveIntoItself(sourceItem, destinationContainer)) {
    cancelItemDrag();
    return;
  }

  if (tryStackItemsDuringDrag(source, sourceItem, destinationItem)) {
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
//#endregion  -----  DRAG AND DROP - DONNEES ET ACTIONS  -----

/* ==================================================== */
//#region     -----  UI  -----
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
  const enrichedParts = getItemRenderData(item.itemId);
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
    if (isContainerItem(item)) {
      equipmentElement.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const itemData = getItemData(item.itemId);
        if (!itemData) {
          return;
        }
        openContainer(item, itemData.name, "equipment", null);
      });
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
                    <div class="equipment-icon-grid">
                      <div class="equipment-icon-button"></div>
                      <div class="equipment-icon-button"></div>
                      <div class="equipment-icon-button"></div>
                      <div class="equipment-icon-button"></div>
                      <div class="equipment-icon-button"></div>
                      <div class="equipment-icon-button"></div>
                    </div>

                    <button class="equipment-ui-button">Follow</button>
                    <button class="equipment-ui-button">PVP</button>
                    <button class="equipment-ui-button">Friends</button>
                    <button class="equipment-ui-button">Options</button>
                    <button class="equipment-ui-button">Logout</button>
                  </div>
                </div>
              </div>
            </div>`;

  playerInventory.innerHTML = html;
  renderEquipmentSlots();
};

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
      if (isContainerItem(slotItem)) {
        let parentWrapper = null;

        openedContainers.forEach((container) => {
          if (container.item.uid === containerItem.uid) {
            parentWrapper = container;
          }
        });
        slot.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const itemData = getItemData(slotItem.itemId);

          if (itemData && parentWrapper) {
            let alreadyOpen = false;
            openedContainers.forEach((container) => {
              if (container.item.uid === slotItem.uid) {
                alreadyOpen = true;
              }
            });
            if (alreadyOpen) {
              openContainer(slotItem, itemData.name, "container", parentWrapper);
              return;
            }
            closeContainer(parentWrapper.item);
            openContainer(slotItem, itemData.name, "container", parentWrapper);
          }
        });
      }
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
  if (!isContainerItem(containerItem) || (source === "world" && !isNearPlayer(containerItem, 1))) {
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
//#endregion  -----  UI  -----

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
game.addEventListener("mousemove", (e) => {
  updateMousePositionInfo(e.clientX, e.clientY);
});

game.addEventListener("click", (e) => {
  console.log(
    mousePosition.col,
    mousePosition.row,
    mousePosition.gameX,
    mousePosition.gameY,
    mousePosition.screenX,
    mousePosition.screenY,
    mousePosition.worldX,
    mousePosition.worldY,
    mousePosition.isInsideMap,
  );
});

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
    type: "container",
    containerUid,
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
    type: "equipment",
    slotName,
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
    type: "world",
    worldItemUid: itemUid,
  };
};

const getWorldDestinationFromMousePosition = () => {
  if (!isMouseInsideMap(mousePosition)) {
    return null;
  }
  const x = mousePosition.col * TILE_SIZE;
  const y = mousePosition.row * TILE_SIZE;
  return {
    type: "world",
    x,
    y,
  };
};

const getItemSlotInfoFromEvent = (e) => {
  const containerSlotElement = e.target.closest(".container-slot");
  if (containerSlotElement) {
    const address = getContainerSourceFromSlotElement(containerSlotElement);
    return {
      slotElement: containerSlotElement,
      address,
    };
  }
  const equipmentSlotElement = e.target.closest(".equipment-slot");
  if (equipmentSlotElement) {
    const address = getEquipmentSourceFromSlotElement(equipmentSlotElement);
    return {
      slotElement: equipmentSlotElement,
      address,
    };
  }
  const worldSlotElement = e.target.closest(".hitbox");
  if (worldSlotElement) {
    const address = getWorldSourceFromItemElement(worldSlotElement);
    return {
      slotElement: worldSlotElement,
      address,
    };
  }
  return null;
};

const handleItemUiMouseDown = (e) => {
  const info = getItemSlotInfoFromEvent(e);
  if (!info || !info.address || !info.slotElement) {
    return;
  }
  e.preventDefault();
  startItemDrag(info.address);
  if (dragState.isDragging === true) {
    if (info.address.type === "world") {
      if (!isNearPlayer(dragState.item, 1)) {
        resetDragState();
        return;
      }
      const worldItemUid = info.address.worldItemUid;
      const parts = document.querySelectorAll(`.world-item-part[data-item-uid="${worldItemUid}"]`);
      parts.forEach((part) => {
        part.classList.add("world-item-selected");
      });
    } else {
      info.slotElement.classList.add("container-slot-dragging");
    }
  }
};

const handleItemUiMouseUp = (e) => {
  if (!dragState.isDragging) {
    return;
  }

  const info = getItemSlotInfoFromEvent(e);
  if (!info && e.target.closest(".jeux-gauche, .jeux-droite, .navbar, .entete-jeux, #boite-chat")) {
    cancelItemDrag();
    return;
  }

  if (info && info.address && info.slotElement) {
    if (["container", "equipment"].includes(info.address.type)) {
      e.preventDefault();
      completeItemDrag(info.address);
      return;
    }

    if (info.address.type === "world") {
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
document.addEventListener("mousedown", handleItemUiMouseDown);
document.addEventListener("mouseup", handleItemUiMouseUp);

//#endregion  -----  INPUTS - CLAVIER / SOURIS / RESIZE  -----

/* ==================================================== */
//#region     -----  MONSTRES  -----
/* ==================================================== */
/* ---------- MONSTRES - CREATION ET AFFICHAGE ---------- */

const MonsterHpRefresh = (monster) => {
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
      selectMonster(monster);
    });
    div.style.left = `${monster.x - camera.x + monsterData.drawOffsetX}px`;
    div.style.top = `${monster.y - camera.y + monsterData.drawOffsetY}px`;
    div.style.zIndex = monster.y;
    hpContainer.appendChild(hpRed);
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

const findMonsterElement = (monsterId) => {
  const monsterElement = document.querySelector(`.monster[data-monster-uid="${monsterId}"]`);
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
      if (now < nextMonsterAttackTime) {
        return;
      }
      nextMonsterAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;
      playerState.hp -= getRandomInt(1, monsterData.damage);
      updatePlayerStats();
      hpRefresh();
      console.log(`hp : ${playerState.hp}`);
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
//#region     -----  PLAYER - COMBAT  -----
/* ==================================================== */
/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const attackMonster = (monster) => {
  const monsterData = getMonsterData(monster.monsterId);
  monster.hp -= getRandomInt(1, playerState.damage);
  if (monster.hp <= 0) {
    monster.hp = 0;
    MonsterHpRefresh(monster);
    deadMonster(monster);
    playerState.experience += monsterData.experience;
    updatePlayerExperience();
    return;
  }
  MonsterHpRefresh(monster);
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
//#endregion  -----  PLAYER - COMBAT  -----

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
//#region     -----  EVENEMENTS DU JEU  -----
/* ==================================================== */
/* ---------- EVENEMENTS - SOURIS ET MENU CONTEXTE ---------- */

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
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
playerState.equipment.backpack.content[1] = createItemInstance("goldCoin", 1);

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
