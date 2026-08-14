import { TILE_SIZE, WORLD_RENDER_LAYER_CREATURE } from "../core/gameConstants.js";
import { setPixiPlayerFrame, updatePixiPlayerTransform } from "../pixiRendererFacade.js";
import {
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
} from "../player/playerAppearance.js";
import { playerState } from "../state/playerState.js";
import { player } from "../ui/domRefs.js";
import { getEntitySurfaceOffsetY } from "../world/worldItemStacks.js";
import { getHpColor } from "./domRenderUtils.js";
import { getEntityRenderSortY, getWorldRenderZIndex } from "./renderOrder.js";
import { getDirectionRow } from "./spriteDirection.js";

const playerRenderRefs = {
  root: player,
  hp: null,
  floatingText: null,
  skull: null,
};

export const initializePlayerRenderRefs = () => {
  playerRenderRefs.hp = playerRenderRefs.root?.querySelector(".php-red") ?? null;
  playerRenderRefs.floatingText = playerRenderRefs.root?.querySelector(".player-floating-text-layer") ?? null;
  playerRenderRefs.skull = playerRenderRefs.root?.querySelector(".player-skull") ?? null;
};

export const getPlayerFloatingTextElement = () => {
  return playerRenderRefs.floatingText;
};

export const showPlayerName = (name) => {
  if (!playerRenderRefs.root) {
    return;
  }
  let playerName = playerRenderRefs.root.querySelector(".name");
  if (!playerName) {
    playerName = document.createElement("div");
    playerName.classList.add("name");
    playerRenderRefs.root.appendChild(playerName);
  }
  playerName.textContent = `${name}`;
};

export const refreshPlayerSkull = (skullType) => {
  if (!playerRenderRefs.root) {
    return;
  }
  let skull = playerRenderRefs.skull;
  if (!skull) {
    skull = document.createElement("div");
    skull.classList.add("player-skull");
    playerRenderRefs.root.appendChild(skull);
    playerRenderRefs.skull = skull;
  }
  const hasSkull = skullType === "white" || skullType === "red";
  skull.hidden = !hasSkull;
  skull.classList.toggle("player-skull-red", skullType === "red");
};

export const updatePlayerSprite = () => {
  const sourceX = playerState.walkFrame * PLAYER_FRAME_WIDTH;
  const sourceY = getDirectionRow(playerState.direction) * PLAYER_FRAME_HEIGHT;
  setPixiPlayerFrame({
    sourceX,
    sourceY,
    sourceWidth: PLAYER_FRAME_WIDTH,
    sourceHeight: PLAYER_FRAME_HEIGHT,
  });
};

let lastPlayerDomLeft = null;
let lastPlayerDomTop = null;
let lastPlayerDomZIndex = null;

export const updatePlayerPosition = (camera, tileStackRenderOffset = 0) => {
  const surfaceOffsetY = getEntitySurfaceOffsetY(playerState);
  const renderX = playerState.renderX;
  const renderY = playerState.renderY - TILE_SIZE - surfaceOffsetY;
  const zIndex =
    getWorldRenderZIndex(getEntityRenderSortY(playerState), WORLD_RENDER_LAYER_CREATURE) + tileStackRenderOffset;

  updatePixiPlayerTransform({ x: renderX, y: renderY, zIndex });

  if (playerRenderRefs.root) {
    const nextLeft = `${renderX - camera.x}px`;
    const nextTop = `${renderY - camera.y}px`;
    const nextZIndex = Math.floor(zIndex);

    if (lastPlayerDomLeft !== nextLeft) {
      playerRenderRefs.root.style.left = nextLeft;
      lastPlayerDomLeft = nextLeft;
    }
    if (lastPlayerDomTop !== nextTop) {
      playerRenderRefs.root.style.top = nextTop;
      lastPlayerDomTop = nextTop;
    }
    if (lastPlayerDomZIndex !== nextZIndex) {
      playerRenderRefs.root.style.zIndex = nextZIndex;
      lastPlayerDomZIndex = nextZIndex;
    }
  }
};

export const refreshPlayerHpBar = () => {
  const playerHp = playerRenderRefs.hp;
  if (!playerHp) {
    return;
  }
  playerHp.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
  playerHp.style.setProperty("--hp-color", getHpColor(playerState.hp, playerState.maxHp));
};
