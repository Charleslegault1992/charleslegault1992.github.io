/* =====================================================
   BASE - ELEMENTS HTML
===================================================== */

const panneauGauche = document.querySelector(".jeux-gauche");
const panneauDroite = document.querySelector(".jeux-droite");
const boitePrincipale = document.querySelector("#boite-principal");
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const player = document.querySelector("#player");
const game = document.querySelector("#game");
const boiteJeux = document.querySelector("#boite-jeux");
const nav = document.querySelector(".navbar");
const entete = document.querySelector(".entete-jeux");
const boiteChat = document.querySelector("#boite-chat");
const boiteJeuxInner = document.querySelector(".boite-jeux-inner");
const lightCanvas = document.querySelector("#light-canvas");

/* =====================================================
   BASE - CONSTANTES ET VARIABLES
===================================================== */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const TILE_SIZE = 64;
const PLAYER_SIZE = TILE_SIZE;
const MOVE_SPEED = TILE_SIZE;
const MAP_COLS = GAME_WIDTH / TILE_SIZE;
const MAP_ROWS = GAME_HEIGHT / TILE_SIZE;
const ITEM_ATLAS_CELL_SIZE = 66;
const ITEM_SPRITE_SIZE = 64;
const ITEM_ATLAS_PADDING = 1;

const FLOOR = 0;
const WALL = 1;

let nextWorldItemId = 1;
let nextMonsterId = 1;
let selectedMonsterId = null;

const worldItems = [];
const monsters = [];

const playerSpawnX = 13 * TILE_SIZE;
const playerSpawnY = 8 * TILE_SIZE;

const camera = {
  x: 0,
  y: 0,
};

const minChatHeight = 120;

/* =====================================================
   ITEMS - BASE DE DONNEES
===================================================== */
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
          spriteCol: 0,
          spriteRow: 0,
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
    weight: 50,
    stackable: false,
    blockMovement: true,
    render: {
      atlas: "items",
      parts: [
        {
          spriteCol: 0,
          spriteRow: 2,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
        {
          spriteCol: 1,
          spriteRow: 2,
          offsetX: 0,
          offsetY: -ITEM_SPRITE_SIZE,
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
    weight: 10,
    stackable: true,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [
        {
          spriteCol: 0,
          spriteRow: 1,
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
    weight: 20,
    stackable: false,
    blockMovement: false,
    render: {
      atlas: "items",
      parts: [
        {
          spriteCol: 0,
          spriteRow: 3,
          offsetX: 0,
          offsetY: 0,
          zOffset: -1,
        },
        {
          spriteCol: 1,
          spriteRow: 3,
          offsetX: 0,
          offsetY: ITEM_SPRITE_SIZE,
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
    weight: 20,
    stackable: false,
    blockMovement: false,
    weaponType: "sword",
    render: {
      atlas: "items",
      parts: [
        {
          spriteCol: 0,
          spriteRow: 4,
          offsetX: 0,
          offsetY: 0,
          zOffset: 0,
        },
      ],
    },
  },
};

/* =====================================================
   CORE - TIMING
===================================================== */

const GAME_LOOP_MS = 10;

let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;

let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;
let nextMonsterAttackTime = 0;

const MONSTER_ATTACK_COOLDOWN_MS = 1500;

/* =====================================================
   PLAYER - CONSTANTES SPRITE
===================================================== */

const PLAYER_FRAME_WIDTH = TILE_SIZE;
const PLAYER_FRAME_HEIGHT = TILE_SIZE * 2;
const PLAYER_ANIMATION_FRAMES = 3;

/* =====================================================
   PLAYER
===================================================== */

/* ---------- JOUEUR - DONNEES ---------- */

const playerState = {
  x: playerSpawnX,
  y: playerSpawnY,
  name: "Charles",
  hp: 25,
  maxHp: 25,
  level: 0,
  experience: 0,
  gold: 0,
  damage: 9,
  magicSkill: 0,
  swordSkill: 1,
  maceSkill: 1,
  axeSkill: 1,
  distanceSkill: 1,
  shieldSkill: 1,
  weight: 400,
  speed: 1,
  direction: "down",
  walkFrame: 1,
  light: 900,
  inventory: [
    {
      itemId: "sword",
      quantity: 1,
    },
    {
      itemId: "healthPotion",
      quantity: 1,
    },
    {
      itemId: "apple",
      quantity: 1,
    },
  ],
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

/* =====================================================
   CAMERA
===================================================== */

/* ---------- CAMERA - POSITION ---------- */

const updateCamera = () => {
  camera.x = playerState.x + TILE_SIZE / 2 - GAME_WIDTH / 2;
  camera.y = playerState.y + TILE_SIZE / 2 - GAME_HEIGHT / 2;
};

/* =====================================================
   MAP
===================================================== */

/* ---------- MAP - DONNEES ---------- */

const gameMap = [
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
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
  return (
    testX >= 0 &&
    testX <= mapWidth - PLAYER_SIZE &&
    testY >= 0 &&
    testY <= mapHeight - PLAYER_SIZE
  );
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

/* =====================================================
   CORE - OUTILS / HELPERS
===================================================== */

/* ---------- OUTILS - MATH ET DISTANCE ---------- */

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const isNearPlayer = (target, range = 1) => {
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const targetCol = target.x / TILE_SIZE;
  const targetRow = target.y / TILE_SIZE;

  return (
    Math.abs(playerCol - targetCol) <= range &&
    Math.abs(playerRow - targetRow) <= range
  );
};

/* ---------- OUTILS - MISE A JOUR DU MONDE ---------- */

const updateWorldPosition = () => {
  updateCamera();
  updateMapPosition();
  updateItemPosition();
  updateMonsterPosition();
  updatePlayerPosition();
  updateLight(playerState);
};

/* =====================================================
   ITEMS
===================================================== */

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
    const source = getItemAtlasSource(part);
    return {
      ...part,
      ...source,
    };
  });
  return enrichedParts;
};

const getItemAtlasSource = (part) => {
  return {
    sourceX: part.spriteCol * ITEM_ATLAS_CELL_SIZE + ITEM_ATLAS_PADDING,
    sourceY: part.spriteRow * ITEM_ATLAS_CELL_SIZE + ITEM_ATLAS_PADDING,
    sourceWidth: ITEM_SPRITE_SIZE,
    sourceHeight: ITEM_SPRITE_SIZE,
  };
};

const getItemRenderPartPosition = (item, part) => {
  return {
    left: item.x - camera.x + part.offsetX,
    top: item.y - camera.y + part.offsetY,
    zIndex: item.y + part.zOffset -1,
    width: ITEM_SPRITE_SIZE,
    height: ITEM_SPRITE_SIZE,
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

const getItemAtlasPath = (atlasName) => {
  if (atlasName === "items") {
    return "./images/items/items-sheet.png";
  }
  console.error(`atlasName: ${atlasName} n'existe pas`);
};
/* ---------- ITEMS - VALIDATION ATLAS FUTUR ---------- */

const isValidItemRenderPart = (part) => {
  if (
    !part ||
    !Number.isInteger(part.spriteCol) ||
    !Number.isInteger(part.spriteRow) ||
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

/* =====================================================
   ITEMS - MONDE ET RENDU DOM
===================================================== */

/* ---------- ITEMS - CREATION DONNEES ---------- */

const createGroundItem = (itemId, quantity, x, y) => {
  const itemData = getItemData(itemId);
  if (!itemData) {
    return null;
  }
  const worldItem = {
    itemId,
    quantity,
    x,
    y,
    uid: nextWorldItemId++,
  };
  return worldItem;
};

/* ---------- ITEMS - CREATION DOM ---------- */

const createItemPartElement = (item, part, partIndex) => {
  const itemData = getItemData(item.itemId);
  const atlasPath = getItemAtlasPath(itemData.render.atlas);
  const div = document.createElement("div");
  div.classList.add("world-item-part");
  div.style.backgroundImage = `url("${atlasPath}")`;
  div.setAttribute("data-item-uid", item.uid);
  div.setAttribute("data-part-index", partIndex);
  div.style.backgroundPosition = `-${part.sourceX}px -${part.sourceY}px`;
  div.style.backgroundRepeat = "no-repeat";
  return div;
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
  const itemElements = document.querySelectorAll(
    `.world-item-part[data-item-uid="${itemUid}"]`,
  );
  itemElements.forEach((itemElement) => {
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

/* =====================================================
   ITEMS - INVENTAIRE - DONNEES ET INTERACTIONS
===================================================== */

/* ---------- INVENTAIRE - AJOUT DONNEES ---------- */

const addItemToInventory = (itemToAdd) => {
  const itemData = getItemData(itemToAdd.itemId);
  if (itemData) {
    const inventoryItem = {
      itemId: itemToAdd.itemId,
      quantity: itemToAdd.quantity,
    };
    const existingItem = playerState.inventory.find((item) => {
      return item.itemId === inventoryItem.itemId;
    });

    if (existingItem && itemData.stackable) {
      existingItem.quantity += inventoryItem.quantity;
    } else {
      playerState.inventory.push(inventoryItem);
    }
    updatePlayerInventory();
  }
};

/* ---------- INVENTAIRE - INTERACTION JOUEUR ---------- */

const handleInteraction = () => {
  const nearItemIndex = worldItems.findIndex((item) => {
    return isNearPlayer(item);
  });

  if (nearItemIndex === -1) {
    console.log("Aucun item proche");
  } else {
    const nearItem = worldItems[nearItemIndex];
    worldItems.splice(nearItemIndex, 1);
    addItemToInventory(nearItem);
    removeGroundItemRender(nearItem.uid);
  }
};

/* ---------- INVENTAIRE - MISE A JOUR ITEMS ---------- */

const updateItemPosition = () => {
  worldItems.forEach((item) => {
    const positions = getItemRenderPartsPositions(item);
    if (!positions || positions.length <= 0) {
      return;
    }
    const itemElements = document.querySelectorAll(
      `.world-item-part[data-item-uid="${item.uid}"]`,
    );
    itemElements.forEach((element) => {
      const partIndex = Number(element.getAttribute("data-part-index"));
      const position = positions[partIndex];
      if (!position) {
        return;
      }
      applyItemRenderPartPosition(element, position);
    });
  });
};

/* =====================================================
   UI
===================================================== */

/* ---------- UI - INVENTAIRE ---------- */

const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
                <div class="boite-jeux-titre">Inventory</div>
                <div class="separateur-panneau"></div>`;
  playerState.inventory.forEach((item) => {
    const itemData = getItemData(item.itemId);
    if (itemData) {
      html += `<div class="boite-row"><span class="item-name">${itemData.name}</span><span class="item-quantity">x${item.quantity}</span></div>`;
    }
  });
  html += `</div>`;
  playerInventory.innerHTML = html;
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
  const freeWidthSpace =
    boiteJeux.clientWidth -
    panneauGauche.clientWidth -
    panneauDroite.clientWidth;
  const freeHeightSpace = boitePrincipale.clientHeight - minChatHeight;
  const logicWidthSpace = GAME_WIDTH;
  const logicHeightSpace = GAME_HEIGHT;
  const scaleWidth = freeWidthSpace / logicWidthSpace;
  const scaleHeight = freeHeightSpace / logicHeightSpace;
  const scale = Math.min(scaleWidth, scaleHeight);
  document.documentElement.style.setProperty("--game-scale", scale);
  const visualGameHeight = GAME_HEIGHT * scale;
  const gameTop = (boiteJeux.clientHeight - visualGameHeight) / 2;
  boiteJeuxInner.style.top = `${gameTop}px`;
};

/* =====================================================
   LIGHT - CANVAS
===================================================== */
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
      const gradient = ctx.createRadialGradient(
        screenX,
        screenY,
        20,
        screenX,
        screenY,
        lightRadius,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.08)");
      gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.04)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;

      ctx.fillRect(
        screenX - lightRadius,
        screenY - lightRadius,
        lightRadius * 2,
        lightRadius * 2,
      );
    } else {
      const gradient = ctx.createRadialGradient(
        screenX,
        screenY,
        20,
        screenX,
        screenY,
        source.light,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.69)");
      gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;

      ctx.fillRect(
        screenX - source.light,
        screenY - source.light,
        source.light * 2,
        source.light * 2,
      );
      const bright = ctx.createRadialGradient(
        screenX,
        screenY,
        20,
        screenX,
        screenY,
        source.light * 0.85,
      );
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

/* =====================================================
   JOUEUR - MOUVEMENT
===================================================== */

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
    return (
      PLAYER_MOVE_COOLDOWN_MS -
      100 -
      (playerState.level - 100) / 2 -
      playerState.speed
    );
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

  if (
    canMoveTo(nextX, nextY) &&
    !isMonsterAtPosition(nextX, nextY) &&
    !isBlockingItemAtPosition(nextX, nextY)
  ) {
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
};

/* =====================================================
   INPUTS - CLAVIER ET RESIZE
===================================================== */

/* ---------- INPUTS - TOUCHE APPUYEE ---------- */

document.addEventListener("keydown", (e) => {
  e.preventDefault();
  if (e.repeat) {
    return;
  }
  if (e.key === "e") {
    handleInteraction();
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

/* =====================================================
   MONSTRES
===================================================== */

/* ---------- MONSTRES - CREATION ET AFFICHAGE ---------- */

const MonsterHpRefresh = (monster) => {
  const monsterHp = document.querySelector(
    `.hp-red[data-monster-id="${monster.id}"]`,
  );
  if (monsterHp) {
    monsterHp.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
  }
};

const createMonster = (
  name,
  x,
  y,
  maxHp,
  damage,
  experience,
  moveCooldown = 250,
  pathRefreshCooldown = 800,
  MONSTER_FRAME_WIDTH = TILE_SIZE,
  MONSTER_FRAME_HEIGHT = TILE_SIZE,
  MONSTER_ANIMATION_FRAMES = 3,
) => {
  const monster = {
    name,
    x,
    y,
    hp: maxHp,
    maxHp,
    damage,
    experience,
    id: nextMonsterId++,
    moveCooldown,
    pathRefreshCooldown,
    MONSTER_FRAME_WIDTH,
    MONSTER_FRAME_HEIGHT,
    MONSTER_ANIMATION_FRAMES,
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
    div.classList.add("monster");
    div.style.width = `${TILE_SIZE}px`;
    div.style.height = `${TILE_SIZE}px`;
    if (monster.id === selectedMonsterId) {
      div.classList.add("monster-selected");
    }
    const monsterName = document.createElement("div");
    monsterName.classList.add("monster-name");
    monsterName.textContent = `${monster.name}`;
    const hpContainer = document.createElement("div");
    hpContainer.classList.add("hp-bar");
    const hpRed = document.createElement("div");
    hpRed.classList.add("hp-red");
    div.setAttribute("data-monster-id", monster.id);
    hpRed.setAttribute("data-monster-id", monster.id);
    const monsterSprite = document.createElement("div");
    monsterSprite.classList.add("monster-sprite");
    monsterSprite.style.backgroundImage = `url("../images/monstres/${monster.name.toLowerCase().replaceAll(" ", "-")}.png")`;
    monsterSprite.style.width = `${monster.MONSTER_FRAME_WIDTH}px`;
    monsterSprite.style.height = `${monster.MONSTER_FRAME_HEIGHT}px`;
    div.addEventListener("contextmenu", () => {
      clearMonsterSelection();
      if (monster.id === selectedMonsterId) {
        selectedMonsterId = null;
        return;
      }
      selectedMonsterId = monster.id;
      selectMonsterElement(selectedMonsterId);
    });
    div.style.left = `${monster.x - camera.x}px`;
    div.style.top = `${monster.y - camera.y}px`;
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
  const colonne = monster.walkFrame;
  const ligne = getDirectionRow(monster.direction);
  const x = -colonne * monster.MONSTER_FRAME_WIDTH;
  const y = -ligne * monster.MONSTER_FRAME_HEIGHT;
  const monsterElement = findMonsterElement(monster.id);
  const monsterSpriteElement = monsterElement.querySelector(".monster-sprite");
  monsterSpriteElement.style.backgroundSize = `${monster.MONSTER_FRAME_WIDTH * monster.MONSTER_ANIMATION_FRAMES}px ${monster.MONSTER_FRAME_HEIGHT * 4}px`;
  monsterSpriteElement.style.backgroundPosition = `${x}px ${y}px`;
};

/* ---------- MONSTRES - DETECTION ET DIRECTION ---------- */

const isMonsterAtPosition = (x, y) => {
  return monsters.some((monster) => {
    return monster.x === x && monster.y === y;
  });
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
  const monsterElement = document.querySelector(
    `.monster[data-monster-id="${monsterId}"]`,
  );
  if (monsterElement) {
    monsterElement.remove();
  }
  const monsterIndex = monsters.findIndex((monster) => {
    return monsterId === monster.id;
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
  addGroundItem(createGroundItem("ratCorpse", 1, monster.x, monster.y));
  removeMonster(monster.id);
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
    return monsterId === monster.id;
  });
  return monster;
};

const selectMonsterElement = (monsterId) => {
  const monsterElement = document.querySelector(
    `.monster[data-monster-id="${monsterId}"]`,
  );
  if (monsterElement) {
    monsterElement.classList.add("monster-selected");
  }
};
const findMonsterElement = (monsterId) => {
  const monsterElement = document.querySelector(
    `.monster[data-monster-id="${monsterId}"]`,
  );
  return monsterElement;
};

/* ---------- MONSTRES - COMBAT POSITION MOUVEMENT ---------- */

const updateMonsterCombat = () => {
  monsters.forEach((monster) => {
    if (isNearPlayer(monster)) {
      const now = Date.now();
      if (now < nextMonsterAttackTime) {
        return;
      }
      nextMonsterAttackTime = now + MONSTER_ATTACK_COOLDOWN_MS;
      playerState.hp -= getRandomInt(1, monster.damage);
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
    const monsterElement = document.querySelector(
      `.monster[data-monster-id="${monster.id}"]`,
    );
    if (monsterElement) {
      monsterElement.style.left = `${monster.x - camera.x}px`;
      monsterElement.style.top = `${monster.y - camera.y}px`;
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
    monster.nextMoveTime = date + monster.moveCooldown;
    const monsterPosition = getTilePosition(monster);
    const destination = pathDestination(
      monsterPosition,
      getTilePosition(playerState),
    );
    if (destination !== null) {
      if (monster.path.length <= 0) {
        monster.path = findPath(monsterPosition, destination);
        monster.nextPathRefreshTime = date + monster.pathRefreshCooldown;
      } else {
        const oldPathEnd = monster.path[monster.path.length - 1];

        if (getDistance(oldPathEnd, destination) > 2) {
          const newPath = findPath(monsterPosition, destination);
          if (newPath.length > 0) {
            monster.path = newPath;
            monster.nextPathRefreshTime = date + monster.pathRefreshCooldown;
          }
        } else if (date >= monster.nextPathRefreshTime) {
          const newPath = findPath(monsterPosition, destination);
          monster.nextPathRefreshTime = date + monster.pathRefreshCooldown;
          if (
            getDistance(oldPathEnd, destination) > 1 &&
            newPath &&
            newPath.length > 0
          ) {
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
      if (monster.walkFrame >= monster.MONSTER_ANIMATION_FRAMES) {
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

/* =====================================================
   PLAYER - COMBAT
===================================================== */

/* ---------- COMBAT JOUEUR - ATTAQUE ET MISE A JOUR ---------- */

const attackMonster = (monster) => {
  monster.hp -= getRandomInt(1, playerState.damage);
  if (monster.hp <= 0) {
    monster.hp = 0;
    MonsterHpRefresh(monster);
    deadMonster(monster);
    playerState.experience += monster.experience;
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

/* =====================================================
   PATHFINDING A*
===================================================== */

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
    if (
      currentNode.row === targetTile.row &&
      currentNode.col === targetTile.col
    ) {
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

/* =====================================================
   EVENEMENTS DU JEU
===================================================== */

/* ---------- EVENEMENTS - SOURIS ET MENU CONTEXTE ---------- */

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

/* =====================================================
   BOUCLE DE JEU
===================================================== */

/* ---------- BOUCLE DE JEU - UPDATE PRINCIPAL ---------- */

const gameLoop = () => {
  updateMovement();
  updateCombat();
  updateMonsterMovement();
  updateMonsterCombat();
};

setInterval(gameLoop, GAME_LOOP_MS);

/* =====================================================
   INITIALISATION DU JEU
===================================================== */

/* ---------- INITIALISATION - DEMARRAGE ---------- */

updateGameScale();
showPlayerName(playerState.name);
updatePlayerSprite();

renderMap(gameMap);

updatePlayerInventory();
updatePlayerStats();

addGroundItem(createGroundItem("box", 1, 20 * TILE_SIZE, 23 * TILE_SIZE));
addGroundItem(
  createGroundItem("healthPotion", 1, 30 * TILE_SIZE, 21 * TILE_SIZE),
);
addGroundItem(createGroundItem("apple", 2, 20 * TILE_SIZE, 24 * TILE_SIZE));
monsters.push(createMonster("Rat", 30 * TILE_SIZE, 20 * TILE_SIZE, 20, 4, 50));
monsters.push(createMonster("Rat", 33 * TILE_SIZE, 23 * TILE_SIZE, 20, 4, 50));
renderMonsters(monsters);
updateWorldPosition();
updateLight(playerState);

/* =====================================================
   DEBUG CONSOLE
===================================================== */

/* ---------- DEBUG - LOGS TEMPORAIRES ---------- */

console.log(gameMap);
console.log(player);
