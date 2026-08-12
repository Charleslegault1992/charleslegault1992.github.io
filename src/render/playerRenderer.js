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
};

export const initializePlayerRenderRefs = () => {
  playerRenderRefs.hp = playerRenderRefs.root?.querySelector(".php-red") ?? null;
  playerRenderRefs.floatingText = playerRenderRefs.root?.querySelector(".player-floating-text-layer") ?? null;
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

export const updatePlayerPosition = (camera) => {
  const surfaceOffsetY = getEntitySurfaceOffsetY(playerState);
  const renderX = playerState.renderX;
  const renderY = playerState.renderY - TILE_SIZE - surfaceOffsetY;
  const zIndex = getWorldRenderZIndex(getEntityRenderSortY(playerState), WORLD_RENDER_LAYER_CREATURE);

  updatePixiPlayerTransform({ x: renderX, y: renderY, zIndex });

  playerRenderRefs.root.style.left = `${renderX - camera.x}px`;
  playerRenderRefs.root.style.top = `${renderY - camera.y}px`;
  playerRenderRefs.root.style.zIndex = zIndex;
};

export const refreshPlayerHpBar = () => {
  const playerHp = playerRenderRefs.hp;
  if (!playerHp) {
    return;
  }
  playerHp.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
  playerHp.style.setProperty("--hp-color", getHpColor(playerState.hp, playerState.maxHp));
};
