/* Éléments HTML */
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const player = document.querySelector("#player");
const game = document.querySelector("#game");

/* CONSTANTE DE JEUX */
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

/* Creation du joueur */
const playerState = {
  x: 64,
  y: 64,
  name: "Charles",
  hp: 100,
  maxHp: 100,
  level: 1,
  experience: 0,
  gold: 0,
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

/* MAP */
const gameMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

/* --------- Fonction -------- */
/* WORLD ITEMS */
const createWorldItem = (name, type, quantity, x, y) => {
  const worldItem = {
    name,
    type,
    quantity,
    x,
    y,
    id: nextWorldItemId++,
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
    div.setAttribute("data-item-id", item.id);
    div.style.left = `${item.x}px`;
    div.style.top = `${item.y}px`;
    game.appendChild(div);
  }
};
const worldItems = [];

const addWorldItem = (worldItem) => {
  worldItems.push(worldItem);
  renderWorldItems([worldItem]);
};

addWorldItem(createWorldItem("Apple", "food", 3, 128, 64));
addWorldItem(createWorldItem("Health Potion", "consumable", 1, 128, 256));
addWorldItem(createCorpse("Rat Corpse", 224, 128));

/* Mouvement */
const updatePlayerPosition = () => {
  player.style.left = `${playerState.x}px`;
  player.style.top = `${playerState.y}px`;
};
updatePlayerPosition();

const isInsideMap = (testX, testY) => {
  return (
    testX >= 0 &&
    testX <= GAME_WIDTH - PLAYER_SIZE &&
    testY >= 0 &&
    testY <= GAME_HEIGHT - PLAYER_SIZE
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

/* RENDER */
const renderMap = (map) => {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const tileValue = map[row][col];
      const div = document.createElement("div");
      div.classList.add("tile");
      if (tileValue === FLOOR) {
        div.classList.add("floor");
      } else if (tileValue === WALL) {
        div.classList.add("wall");
      }
      div.style.left = `${col * TILE_SIZE}px`;
      div.style.top = `${row * TILE_SIZE}px`;
      game.appendChild(div);
    }
  }
};
renderMap(gameMap);

/* UI */
const updatePlayerInventory = () => {
  let html = `<div class="boite-boite">
                <div class="boite-jeux-titre">Inventory</div>`;
  playerState.inventory.forEach((item) => {
    html += `<div class="boite-row"><span class="item-name">${item.name}</span><span class="item-quantity">x${item.quantity}</span></div>`;
  });
  html += `</div>`;
  playerInventory.innerHTML = html;
};
updatePlayerInventory();

const updatePlayerStats = () => {
  playerStats.innerHTML = `<div class="boite-boite">
                              <div class="boite-jeux-titre">Stats</div>
                              <div class="boite-row"><span>Name:</span><span>${playerState.name}</span></div>
                              <div class="boite-row"><span>Level:</span><span>${playerState.level}</span></div>
                              <div class="boite-row"><span>HP:</span><span>${playerState.hp}/${playerState.maxHp}</span></div>
                              <div class="boite-row"><span>EXP:</span><span>${playerState.experience}</span></div>
                              <div class="boite-row"><span>Gold:</span><span>${playerState.gold}</span></div>
                            </div>`;
};
updatePlayerStats();

/* NEAR PLAYER */
const isNearPlayer = (target) => {
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const targetCol = target.x / TILE_SIZE;
  const targetRow = target.y / TILE_SIZE;

  return (
    Math.abs(playerCol - targetCol) <= 1 && Math.abs(playerRow - targetRow) <= 1
  );
};

/* INTERACTION RAMASSER */
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

/* Attribution des touches */
document.addEventListener("keydown", (e) => {
  e.preventDefault();
  if (e.key === "e") {
    handleInteraction();
    return;
  }

  let nextX = playerState.x;
  let nextY = playerState.y;
  if (e.key === "ArrowRight" || e.key === "d") {
    nextX += MOVE_SPEED;
  } else if (e.key === "ArrowLeft" || e.key === "a") {
    nextX -= MOVE_SPEED;
  } else if (e.key === "ArrowUp" || e.key === "w") {
    nextY -= MOVE_SPEED;
  } else if (e.key === "ArrowDown" || e.key === "s") {
    nextY += MOVE_SPEED;
  } else {
    return;
  }
  if (canMoveTo(nextX, nextY)) {
    playerState.x = nextX;
    playerState.y = nextY;
  }
  updatePlayerPosition();
});

/* console log */
console.log(gameMap);
console.log(player);
console.log(`Map = ${MAP_COLS} colonnes X ${MAP_ROWS} lignes`);

/* TEST */
