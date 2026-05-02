/* =====================================================
   ELEMENTS HTML
===================================================== */

const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const player = document.querySelector("#player");
const game = document.querySelector("#game");
const boiteJeux = document.querySelector("#boite-jeux");
const nav = document.querySelector(".navbar");
const entete = document.querySelector(".entete-jeux");

/* =====================================================
    VARIABLES GLOBALES
===================================================== */

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const PLAYER_SIZE = 32;
const TILE_SIZE = 32;
const MOVE_SPEED = TILE_SIZE;
const MAP_COLS = GAME_WIDTH / TILE_SIZE;
const MAP_ROWS = GAME_HEIGHT / TILE_SIZE;

const FLOOR = 0;
const WALL = 1;

let nextWorldItemId = 1;
let nextMonsterId = 1;
let selectedMonsterId = null;

const worldItems = [];
const monsters = [];

const playerSpawnX = 13 * 32;
const playerSpawnY = 8 * 32;

const camera = {
  x: 0,
  y: 0,
};

/* =====================================================
   TIMING
===================================================== */

const GAME_LOOP_MS = 10;

let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;

let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;
let nextMonsterAttackTime = 0;

const MONSTER_ATTACK_COOLDOWN_MS = 1500;

/* =====================================================
   SPRITE JOUEUR
===================================================== */

const PLAYER_FRAME_WIDTH = 32;
const PLAYER_FRAME_HEIGHT = 64;
const PLAYER_ANIMATION_FRAMES = 3;

/* =====================================================
   JOUEUR
===================================================== */

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
  inventory: [
    {
      name: "Sword",
      type: "weapon",
      quantity: 1,
    },
    {
      name: "Health Potion",
      type: "consumable",
      quantity: 1,
    },
    {
      name: "Apple",
      type: "food",
      quantity: 1,
    },
  ],
};

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
  player.style.top = `${playerState.y - camera.y - 32}px`;
  player.style.zIndex = playerState.y;
};

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

const updateCamera = () => {
  camera.x = playerState.x + 16 - GAME_WIDTH / 2;
  camera.y = playerState.y + 16 - GAME_HEIGHT / 2;
  if (camera.x < 0) {
    camera.x = 0;
  }
  if (camera.x > mapWidth - GAME_WIDTH) {
    camera.x = mapWidth - GAME_WIDTH;
  }
  if (camera.y < 0) {
    camera.y = 0;
  }
  if (camera.y > mapHeight - GAME_HEIGHT) {
    camera.y = mapHeight - GAME_HEIGHT;
  }
};

/* =====================================================
   MAP
===================================================== */

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
   OUTILS / HELPERS
===================================================== */

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const isNearPlayer = (target) => {
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const targetCol = target.x / TILE_SIZE;
  const targetRow = target.y / TILE_SIZE;

  return (
    Math.abs(playerCol - targetCol) <= 1 && Math.abs(playerRow - targetRow) <= 1
  );
};

const updateWorldPosition = () => {
  updateCamera();
  updateMapPosition();
  updateItemPosition();
  updateMonsterPosition();
  updatePlayerPosition();
};

/* =====================================================
   WORLD ITEMS
===================================================== */

const createWorldItem = (name, type, quantity, x, y, blockMovement, isTall) => {
  const worldItem = {
    name,
    type,
    quantity,
    x,
    y,
    id: nextWorldItemId++,
    blockMovement,
    isTall,
  };
  return worldItem;
};

const createCorpse = (name, x, y) => {
  const corpse = {
    name,
    type: "corpse",
    quantity: 1,
    x,
    y,
    id: nextWorldItemId++,
  };
  return corpse;
};

const renderWorldItems = (items) => {
  for (let i = 0; i < items.length; i++) {
    const div = document.createElement("div");
    const item = items[i];
    div.classList.add("world-item");
    div.style.backgroundImage = `url("../images/items/${item.name.toLowerCase().replaceAll(" ", "-")}.png")`;
    div.setAttribute("data-item-id", item.id);

    div.style.zIndex = item.y - 1;
    if (item.isTall) {
      div.style.left = `${item.x - camera.x}px`;
      div.style.top = `${item.y - camera.y - 32}px`;
      div.style.zIndex = item.y;
      div.style.height = "64px";
    } else {
      div.style.left = `${item.x - camera.x}px`;
      div.style.top = `${item.y - camera.y}px`;
      div.style.zIndex = item.y - 1;
      div.style.height = "32px";
    }
    game.appendChild(div);
  }
};

const addWorldItem = (worldItem) => {
  worldItems.push(worldItem);
  renderWorldItems([worldItem]);
};

const isBlockingItemAtPosition = (x, y) => {
  return worldItems.some((item) => {
    return item.blockMovement && item.x === x && item.y === y;
  });
};

/* =====================================================
   INVENTAIRE ET INTERACTIONS
===================================================== */

const addItemToInventory = (itemToAdd) => {
  const inventoryItem = {
    name: itemToAdd.name,
    type: itemToAdd.type,
    quantity: itemToAdd.quantity,
  };
  const existingItem = playerState.inventory.find((item) => {
    return item.name === inventoryItem.name && item.type === inventoryItem.type;
  });
  if (existingItem) {
    existingItem.quantity += inventoryItem.quantity;
  } else {
    playerState.inventory.push(inventoryItem);
  }
  updatePlayerInventory();
};

const handleInteraction = () => {
  const nearItemIndex = worldItems.findIndex((item) => {
    return isNearPlayer(item);
  });

  if (nearItemIndex === -1) {
    console.log("Aucun item proche");
  } else {
    const nearItem = worldItems[nearItemIndex];
    const itemElement = document.querySelector(
      `.world-item[data-item-id="${nearItem.id}"]`,
    );
    if (itemElement) {
      itemElement.remove();
    }
    const removedItem = worldItems.splice(nearItemIndex, 1);
    const pickedItem = removedItem[0];
    addItemToInventory(pickedItem);
  }
};

const updateItemPosition = () => {
  worldItems.forEach((item) => {
    const itemElement = document.querySelector(
      `.world-item[data-item-id="${item.id}"]`,
    );

    if (itemElement) {
      if (item.isTall) {
        itemElement.style.left = `${item.x - camera.x}px`;
        itemElement.style.top = `${item.y - camera.y - 32}px`;
      } else {
        itemElement.style.left = `${item.x - camera.x}px`;
        itemElement.style.top = `${item.y - camera.y}px`;
      }
    }
  });
};

/* =====================================================
   UI
===================================================== */

const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
                <div class="boite-jeux-titre">Inventory</div>`;
  playerState.inventory.forEach((item) => {
    html += `<div class="boite-row"><span class="item-name">${item.name}</span><span class="item-quantity">x${item.quantity}</span></div>`;
  });
  html += `</div>`;
  playerInventory.innerHTML = html;
};

const updatePlayerStats = () => {
  playerStats.innerHTML = `<div class="boite-boite">
                              <div class="boite-jeux-titre">Stats</div>
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

const updateGameScale = () => {
  const freeWidthSpace = boiteJeux.clientWidth;
  const freeHeightSpace = window.innerHeight - nav.clientHeight;
  const logicWidthSpace = 920;
  const logicHeightSpace = 480;
  const scaleWidth = freeWidthSpace / logicWidthSpace;
  const scaleHeight = freeHeightSpace / logicHeightSpace;
  const scale = Math.min(scaleWidth, scaleHeight)
  document.documentElement.style.setProperty("--game-scale", scale);
};

/* =====================================================
   MOUVEMENT
===================================================== */

const keysPressed = {
  right: false,
  left: false,
  up: false,
  down: false,
};

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
   INPUTS
===================================================== */

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

window.addEventListener("resize", () => {
  updateGameScale();
});

/* =====================================================
   MONSTRES
===================================================== */
const MonsterHpRefresh = (monster) => {
  const monsterHp = document.querySelector(
    `.hp-red[data-monster-id="${monster.id}"]`,
  );
  if (monsterHp) {
    monsterHp.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
  }
};
const createMonster = (name, x, y, maxHp, damage, experience) => {
  const monster = {
    name,
    x,
    y,
    hp: maxHp,
    maxHp,
    damage,
    experience,
    id: nextMonsterId++,
  };
  return monster;
};

const renderMonsters = (monstersList) => {
  for (let i = 0; i < monstersList.length; i++) {
    const div = document.createElement("div");
    const monster = monstersList[i];
    div.classList.add("monster");
    div.style.backgroundImage = `url("../images/monstres/${monster.name.toLowerCase().replaceAll(" ", "-")}.png")`;
    if (monster.id === selectedMonsterId) {
      div.classList.add("monster-selected");
    }
    const monsterName = document.createElement("div");
    monsterName.classList.add("name");
    monsterName.textContent = `${monster.name}`;
    const hpContainer = document.createElement("div");
    hpContainer.classList.add("hp-bar");
    const hpRed = document.createElement("div");
    hpRed.classList.add("hp-red");
    div.setAttribute("data-monster-id", monster.id);
    hpRed.setAttribute("data-monster-id", monster.id);
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
    game.appendChild(div);
  }
};

const isMonsterAtPosition = (x, y) => {
  return monsters.some((monster) => {
    return monster.x === x && monster.y === y;
  });
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

const clearMonsterSelection = () => {
  const monsterSelection = document.querySelectorAll(".monster-selected");
  monsterSelection.forEach((monster) => {
    monster.classList.remove("monster-selected");
  });
};

const deadMonster = (monster) => {
  addWorldItem(createCorpse(`${monster.name} Corpse`, monster.x, monster.y));
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
    }
  });
};

/* =====================================================
   COMBAT
===================================================== */

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
   EVENTS DU JEU
===================================================== */

boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

/* =====================================================
   GAME LOOP
===================================================== */

const gameLoop = () => {
  updateMovement();
  updateCombat();
  updateMonsterCombat();
};

setInterval(gameLoop, GAME_LOOP_MS);

/* =====================================================
   INITIALISATION DU JEU
===================================================== */
updateGameScale();
showPlayerName(playerState.name);
updatePlayerSprite();

renderMap(gameMap);

updatePlayerInventory();
updatePlayerStats();

addWorldItem(
  createWorldItem("Apple", "food", 2, 20 * 32, 24 * 32, false, false),
);
addWorldItem(
  createWorldItem(
    "Health Potion",
    "consumable",
    1,
    32 * 30,
    21 * 32,
    false,
    false,
  ),
);
addWorldItem(
  createWorldItem("Box", "container", 1, 20 * 32, 23 * 32, true, true),
);
monsters.push(createMonster("Rat", 30 * 32, 20 * 32, 20, 4, 50));
monsters.push(createMonster("Rat", 33 * 32, 23 * 32, 20, 4, 50));
renderMonsters(monsters);
updateWorldPosition();

/* =====================================================
   CONSOLE LOG
===================================================== */

console.log(gameMap);
console.log(player);
console.log(`Map = ${MAP_COLS} colonnes X ${MAP_ROWS} lignes`);
