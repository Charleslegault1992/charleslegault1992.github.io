/* ==================================================== */
//#region     -----  IMPORTS  -----
/* ==================================================== */
import { Application, Container, Graphics } from "pixi.js";
//#endregion  -----  IMPORTS  -----

/* ==================================================== */
//#region     -----  PIXI - ETAT  -----
/* ==================================================== */
let pixiApp = null;
let worldContainer = null;
let mapContainer = null;
let mapGraphics = null;
//#endregion  -----  PIXI - ETAT  -----

/* ==================================================== */
//#region     -----  PIXI - INITIALISATION  -----
/* ==================================================== */
/* ---------- APPLICATION ET CONTAINERS ---------- */
export const initializePixiRenderer = async ({ htmlParentElement, gameWidth, gameHeight }) => {
  pixiApp = new Application();

  await pixiApp.init({
    width: gameWidth,
    height: gameHeight,
  });

  pixiApp.canvas.classList.add("pixi-canvas");
  htmlParentElement.appendChild(pixiApp.canvas);

  worldContainer = new Container();
  mapContainer = new Container();
  mapGraphics = new Graphics();
  pixiApp.stage.addChild(worldContainer);
  worldContainer.addChild(mapContainer);
  mapContainer.addChild(mapGraphics);
};
//#endregion  -----  PIXI - INITIALISATION  -----

/* ==================================================== */
//#region     -----  PIXI - RENDU MAP TEMPORAIRE  -----
/* ==================================================== */
/* ---------- MAP DEBUG PAR RECTANGLES ---------- */
export const renderPixiMap = (map, tileSize, floorValue, wallValue) => {
  if (!mapGraphics) {
    return;
  }

  mapGraphics.clear();

  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const tile = map[row][col];
      const x = col * tileSize;
      const y = row * tileSize;

      if (tile === floorValue) {
        mapGraphics.rect(x, y, tileSize, tileSize).fill(0x3a7d44);
      }
      if (tile === wallValue) {
        mapGraphics.rect(x, y, tileSize, tileSize).fill(0x555555);
      }
    }
  }
};
//#endregion  -----  PIXI - RENDU MAP TEMPORAIRE  -----
