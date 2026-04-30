/* Éléments HTML */
const playerStats = document.querySelector("#player-stats");
const playerInventory = document.querySelector("#player-inventory");
const player = document.querySelector("#player");
const game = document.querySelector("#game");
const boiteJeux = document.querySelector("#boite-jeux");
const monsterHp = 10;

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
let nextMonsterId = 1;
let selectedMonsterId = null;
const worldItems = [];
/* TIMING */
const GAME_LOOP_MS = 10;
let PLAYER_ATTACK_COOLDOWN_MS = 1000;
let PLAYER_MOVE_COOLDOWN_MS = 200;
let nextPlayerMoveTime = 0;
let nextPlayerAttackTime = 0;
let nextMonsterAttackTime = 0;

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
  damage: 9,
  magicSkill: 0,
  swordSkill: 1,
  maceSkill: 1,
  axeSkill: 1,
  distanceSkill: 1,
  shieldSkill: 1,
  weight: 400,
  speed: 1,
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
const createPlayerName = (name) => {
  const playerName = document.createElement("div");
  playerName.classList.add("name");
  playerName.textContent = `${name}`;
  player.appendChild(playerName);
};

createPlayerName(playerState.name);

/* BLOQUER CLIC DROIT DANS LE JEUX */
boiteJeux.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});
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
/* RANDOM NUMBER */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
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
    div.style.backgroundImage = `url("../images/items/${item.name.toLowerCase().replaceAll(" ", "-")}.png")`;
    div.setAttribute("data-item-id", item.id);
    div.style.left = `${item.x}px`;
    div.style.top = `${item.y}px`;
    game.appendChild(div);
  }
};

const addWorldItem = (worldItem) => {
  worldItems.push(worldItem);
  renderWorldItems([worldItem]);
};

addWorldItem(createWorldItem("Apple", "food", 3, 128, 64));
addWorldItem(createWorldItem("Health Potion", "consumable", 1, 128, 256));

/* Mouvement */
const updatePlayerPosition = () => {
  player.style.left = `${playerState.x}px`;
  player.style.top = `${playerState.y - 32}px`;
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

/* RENDER MAP*/
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
                              <div class="boite-row"><span>Magic Level:</span><span>${playerState.magicSkill}</span></div>
                              <div class="boite-row"><span>Sword Fighting:</span><span>${playerState.swordSkill}</span></div>
                              <div class="boite-row"><span>Mace Fighting:</span><span>${playerState.maceSkill}</span></div>
                              <div class="boite-row"><span>Axe Fighting:</span><span>${playerState.axeSkill}</span></div>
                              <div class="boite-row"><span>Distance:</span><span>${playerState.distanceSkill}</span></div>
                              <div class="boite-row"><span>Shielding:</span><span>${playerState.shieldSkill}</span></div>
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

  if (canMoveTo(nextX, nextY)) {
    playerState.x = nextX;
    playerState.y = nextY;
  }
  updatePlayerPosition();
  nextPlayerMoveTime = now + PLAYER_MOVE_COOLDOWN_MS;
};

/* Monstre */
const monsters = [];
const createMonster = (name, x, y, hp) => {
  const monster = {
    name,
    x,
    y,
    hp,
    maxHp: hp,
    id: nextMonsterId++,
  };
  return monster;
};

monsters.push(createMonster("Rat", 320, 192, 20));
monsters.push(createMonster("Rat", 64, 192, 20));

/* RENDER MONSTER */
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
    div.style.left = `${monster.x}px`;
    div.style.top = `${monster.y}px`;
    hpContainer.appendChild(hpRed);
    div.appendChild(monsterName);
    div.appendChild(hpContainer);
    game.appendChild(div);
  }
};
renderMonsters(monsters);

/* CLEAR MONSTER */
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

/* mort du monstre */
const deadMonster = (monster) => {
  addWorldItem(createCorpse(`${monster.name} Corpse`, monster.x, monster.y));
  removeMonster(monster.id);
  selectedMonsterId = null;
};

/* TROUVER Monstre */
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

/* ATTAQUER */
const attackMonster = (monster) => {
  monster.hp -= getRandomInt(1, playerState.damage);
  if (monster.hp <= 0) {
    monster.hp = 0;
    hpRefresh(monster);
    deadMonster(monster);
    return;
  }
  hpRefresh(monster);
  console.log(monster.hp);
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

/* REFRESH HP */
const hpRefresh = (monster) => {
  const monsterHp = document.querySelector(
    `.hp-red[data-monster-id="${monster.id}"]`,
  );
  if (monsterHp) {
    monsterHp.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
  }
};

/* Keypressed */
const keysPressed = {
  right: false,
  left: false,
  up: false,
  down: false,
};

/* GAME LOOP */
const gameLoop = () => {
  updateMovement();
  updateCombat();
};

setInterval(gameLoop, GAME_LOOP_MS);

/* console log */
console.log(gameMap);
console.log(player);
console.log(`Map = ${MAP_COLS} colonnes X ${MAP_ROWS} lignes`);

/* TEST */
