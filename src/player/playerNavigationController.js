import {
  MINIMAP_AUTOWALK_MAX_DISTANCE_TILES,
  NPC_DIALOGUE_CONFIG,
} from "../core/gameConstants.js";
import { getGameUiText } from "../localization/gameLocalization.js";
import { combatTargetState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";
import { npcsByUid } from "../state/worldState.js";
import { getItemUseData } from "../items/itemModel.js";
import { isNearPlayer } from "./playerSpatial.js";
import { findWorldItemByUid } from "../world/worldItemStacks.js";
import { getCurrentWorldMap } from "../world/worldRuntime.js";
import { getTilePosition } from "../world/worldCoordinates.js";
import {
  getCardinalDirectionFromTileDelta,
  hasLineOfSightBetweenTiles,
} from "../world/pathfinding.js";

export const PLAYER_NAVIGATION_MODE = {
  click: "click",
  follow: "follow",
  action: "action",
};

export const PLAYER_ACTION_TYPE = {
  itemDrag: "itemDrag",
  useWorldItem: "useWorldItem",
  targetItemUse: "targetItemUse",
  npcGreeting: "npcGreeting",
};

export const PLAYER_ACTION_DISTANCE_TYPE = {
  square: "square",
  weighted: "weighted",
};

const PLAYER_AUTO_WALK_MAX_PATH_COST = MINIMAP_AUTOWALK_MAX_DISTANCE_TILES * 3;
const PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS = 300;
const PLAYER_ACTION_PATH_REFRESH_COOLDOWN_MS = 300;
const PLAYER_ACTION_EXECUTION_DELAY_MS = 100;

export const playerNavigationState = {
  mode: null,
  path: [],
  destinationTile: null,
  followEnabled: false,
  followTargetType: null,
  followTargetUid: null,
  pendingAction: null,
  actionExecuteAt: 0,
  nextPathRefreshAt: 0,
  lastFollowTargetTileKey: null,
  lastActionTargetTileKey: null,
  lastFailureKey: null,
};

export const keysPressed = {
  right: false,
  left: false,
  up: false,
  down: false,
};

export const resetMovementKeys = () => {
  keysPressed.right = false;
  keysPressed.left = false;
  keysPressed.up = false;
  keysPressed.down = false;
};

export const createPlayerNavigationController = ({
  areItemLocationsEqual,
  completeItemDrag,
  findItemLocationByUid,
  findMonsterByUid,
  findPlayerByUid,
  findPath,
  findPathToAnyTarget,
  getItemFromLocation,
  getPathTraversableAdjacentTiles,
  handleDrinkPotionUse,
  handleRuneUse,
  handleUseItemFromSource,
  isTileOccupiedByCreature,
  isTilePathTraversable,
  isWorldItemAvailableForInteraction,
  loseSelectedMonsterTarget,
  loseSelectedPlayerTarget,
  sayGreetingToNpc,
  showGameStatusMessage,
  startItemDrag,
  updatePlayerInventory,
  worldItemThrowRange,
}) => {
  const getFollowTarget = () => {
    if (playerNavigationState.followTargetType === "monster") {
      return findMonsterByUid(playerNavigationState.followTargetUid);
    }
    if (playerNavigationState.followTargetType === "player") {
      return findPlayerByUid(playerNavigationState.followTargetUid);
    }
    if (combatTargetState.monsterUid !== null) {
      return findMonsterByUid(combatTargetState.monsterUid);
    }
    if (combatTargetState.playerUid !== null) {
      return findPlayerByUid(combatTargetState.playerUid);
    }
    return null;
  };

  const loseFollowTarget = () => {
    const followTargetType = playerNavigationState.followTargetType;
    const followTargetUid = playerNavigationState.followTargetUid;
    if (followTargetType === "monster" && combatTargetState.monsterUid === followTargetUid) {
      loseSelectedMonsterTarget();
      return;
    }
    if (followTargetType === "player" && combatTargetState.playerUid === followTargetUid) {
      loseSelectedPlayerTarget();
      return;
    }
    playerNavigationState.followEnabled = false;
    stopPlayerNavigation();
    updatePlayerInventory();
    showGameStatusMessage(getGameUiText("targetLost"));
  };

  const stopPlayerNavigation = () => {
    playerNavigationState.mode = null;
    playerNavigationState.path = [];
    playerNavigationState.destinationTile = null;
    playerNavigationState.pendingAction = null;
    playerNavigationState.actionExecuteAt = 0;
    playerNavigationState.nextPathRefreshAt = 0;
    playerNavigationState.lastFollowTargetTileKey = null;
    playerNavigationState.lastActionTargetTileKey = null;
    playerNavigationState.lastFailureKey = null;
    playerNavigationState.followTargetType = null;
    playerNavigationState.followTargetUid = null;
  };

  const setPlayerNavigationPath = (path) => {
    if (!Array.isArray(path)) {
      playerNavigationState.path = [];
      return false;
    }

    playerNavigationState.path = path.map((tile) => {
      return { col: tile.col, row: tile.row };
    });
    return true;
  };

  const showPlayerNavigationFailure = (failureKey) => {
    if (playerNavigationState.lastFailureKey === failureKey) {
      return;
    }
    playerNavigationState.lastFailureKey = failureKey;
    showGameStatusMessage(getGameUiText("noPath"));
  };

  const refreshPlayerClickNavigationPath = () => {
    const destinationTile = playerNavigationState.destinationTile;
    const playerTile = getTilePosition(playerState);

    if (!destinationTile || !playerTile) {
      stopPlayerNavigation();
      return false;
    }

    if (playerTile.col === destinationTile.col && playerTile.row === destinationTile.row) {
      stopPlayerNavigation();
      return true;
    }

    const path = findPath(playerTile, destinationTile, true, PLAYER_AUTO_WALK_MAX_PATH_COST);
    if (path.length === 0) {
      const failureKey = `click:${playerState.z}:${destinationTile.col}:${destinationTile.row}`;
      stopPlayerNavigation();
      showPlayerNavigationFailure(failureKey);
      return false;
    }

    playerNavigationState.lastFailureKey = null;
    return setPlayerNavigationPath(path);
  };

  const startPlayerClickNavigation = (destinationTile) => {
    if (!Number.isInteger(destinationTile?.col) || !Number.isInteger(destinationTile?.row)) {
      return false;
    }

    playerNavigationState.mode = PLAYER_NAVIGATION_MODE.click;
    playerNavigationState.pendingAction = null;
    playerNavigationState.actionExecuteAt = 0;
    playerNavigationState.destinationTile = {
      col: destinationTile.col,
      row: destinationTile.row,
    };
    playerNavigationState.path = [];
    playerNavigationState.nextPathRefreshAt = 0;
    playerNavigationState.lastFollowTargetTileKey = null;
    playerNavigationState.lastActionTargetTileKey = null;
    return refreshPlayerClickNavigationPath();
  };

  const startPlayerFollowNavigation = (targetType = null, targetUid = null) => {
    if (["monster", "player"].includes(targetType) && targetUid !== null) {
      playerNavigationState.followTargetType = targetType;
      playerNavigationState.followTargetUid = targetUid;
    } else if (combatTargetState.monsterUid !== null) {
      playerNavigationState.followTargetType = "monster";
      playerNavigationState.followTargetUid = combatTargetState.monsterUid;
    } else if (combatTargetState.playerUid !== null) {
      playerNavigationState.followTargetType = "player";
      playerNavigationState.followTargetUid = combatTargetState.playerUid;
    }
    if (!playerNavigationState.followEnabled || !getFollowTarget()) {
      return false;
    }

    playerNavigationState.mode = PLAYER_NAVIGATION_MODE.follow;
    playerNavigationState.pendingAction = null;
    playerNavigationState.actionExecuteAt = 0;
    playerNavigationState.path = [];
    playerNavigationState.destinationTile = null;
    playerNavigationState.nextPathRefreshAt = 0;
    playerNavigationState.lastFollowTargetTileKey = null;
    playerNavigationState.lastActionTargetTileKey = null;
    playerNavigationState.lastFailureKey = null;
    return true;
  };

  const updatePlayerFollowNavigation = (now, forceRefresh = false) => {
    if (playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.follow) {
      return;
    }

    const target = getFollowTarget();
    if (!target || target.hp <= 0 || target.z !== playerState.z) {
      loseFollowTarget();
      return;
    }

    const targetTile = getTilePosition(target);
    const targetTileKey = `${target.z}:${targetTile.col}:${targetTile.row}`;

    if (isNearPlayer(target, 1)) {
      playerNavigationState.path = [];
      playerNavigationState.lastFollowTargetTileKey = targetTileKey;
      playerNavigationState.lastFailureKey = null;
      playerNavigationState.nextPathRefreshAt = now + PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS;
      return;
    }

    const targetMoved = targetTileKey !== playerNavigationState.lastFollowTargetTileKey;
    if (
      !forceRefresh &&
      !targetMoved &&
      now < playerNavigationState.nextPathRefreshAt
    ) {
      return;
    }

    const playerTile = getTilePosition(playerState);
    const targetTiles = getPathTraversableAdjacentTiles(targetTile).filter((tile) => {
      return !isTileOccupiedByCreature(tile.row, tile.col) || (tile.row === playerTile.row && tile.col === playerTile.col);
    });
    const path = findPathToAnyTarget(playerTile, targetTiles, true, PLAYER_AUTO_WALK_MAX_PATH_COST);

    playerNavigationState.path = [];
    playerNavigationState.lastFollowTargetTileKey = targetTileKey;
    playerNavigationState.nextPathRefreshAt = now + PLAYER_FOLLOW_PATH_REFRESH_COOLDOWN_MS;

    if (path.length === 0) {
      showPlayerNavigationFailure(`follow:${target.uid}:${targetTileKey}`);
      playerNavigationState.followEnabled = false;
      stopPlayerNavigation();
      updatePlayerInventory();
      return;
    }

    playerNavigationState.lastFailureKey = null;
    setPlayerNavigationPath(path);
  };

  const isTileWithinPlayerActionRange = (fromTile, targetTile, range, distanceType) => {
    if (
      !Number.isInteger(fromTile?.col) ||
      !Number.isInteger(fromTile?.row) ||
      !Number.isInteger(targetTile?.col) ||
      !Number.isInteger(targetTile?.row) ||
      !Number.isFinite(range)
    ) {
      return false;
    }
    const distanceCol = Math.abs(fromTile.col - targetTile.col);
    const distanceRow = Math.abs(fromTile.row - targetTile.row);
    if (distanceType === PLAYER_ACTION_DISTANCE_TYPE.weighted) {
      return distanceCol + distanceRow <= range;
    }
    return Math.max(distanceCol, distanceRow) <= range;
  };

  const isPlayerWithinActionRange = (target, range, distanceType = PLAYER_ACTION_DISTANCE_TYPE.square) => {
    if (!target || target.z !== playerState.z) {
      return false;
    }
    return isTileWithinPlayerActionRange(getTilePosition(playerState), getTilePosition(target), range, distanceType);
  };

  const resolvePlayerActionNavigationTarget = (action) => {
    if (!action) {
      return null;
    }

    if (action.type === PLAYER_ACTION_TYPE.itemDrag) {
      const currentSource = findItemLocationByUid(action.itemUid);
      const item = getItemFromLocation(currentSource);
      if (!item || !areItemLocationsEqual(action.source, currentSource)) {
        return null;
      }
      if (currentSource.locationType === "worldItem") {
        if (!isWorldItemAvailableForInteraction(item)) {
          return null;
        }
        if (!isNearPlayer(item, 1)) {
          return { target: item, range: 1, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
        }
      }
      if (action.destination?.locationType === "worldTile") {
        const destination = action.destination;
        if (destination.z !== playerState.z) {
          return null;
        }
        if (!isNearPlayer(destination, worldItemThrowRange)) {
          return {
            target: destination,
            range: worldItemThrowRange,
            distanceType: PLAYER_ACTION_DISTANCE_TYPE.square,
            requireLineOfSight: true,
          };
        }
      }
      return { isReady: true };
    }

    if (action.type === PLAYER_ACTION_TYPE.useWorldItem) {
      const item = findWorldItemByUid(action.itemUid);
      if (!isWorldItemAvailableForInteraction(item)) {
        return null;
      }
      return isNearPlayer(item, 1)
        ? { isReady: true }
        : { target: item, range: 1, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
    }

    if (action.type === PLAYER_ACTION_TYPE.targetItemUse) {
      const source = findItemLocationByUid(action.itemUid);
      const item = getItemFromLocation(source);
      const useData = getItemUseData(item);
      if (!source || !item || useData?.mode !== "target" || !Number.isFinite(useData.range)) {
        return null;
      }
      if (action.targetType === "monster") {
        const monster = findMonsterByUid(action.targetUid);
        if (useData.action !== "attackRune" || !monster || monster.hp <= 0 || monster.z !== playerState.z) {
          return null;
        }
        return isNearPlayer(monster, useData.range)
          ? { isReady: true }
          : {
              target: monster,
              range: useData.range,
              distanceType: PLAYER_ACTION_DISTANCE_TYPE.square,
              requireLineOfSight: true,
            };
      }
      if (action.targetType === "player") {
        const targetPlayer = findPlayerByUid(action.targetUid);
        if (
          useData.action !== "attackRune" ||
          !targetPlayer ||
          targetPlayer.uid === playerState.uid ||
          targetPlayer.hp <= 0 ||
          targetPlayer.z !== playerState.z
        ) {
          return null;
        }
        return isNearPlayer(targetPlayer, useData.range)
          ? { isReady: true }
          : {
              target: targetPlayer,
              range: useData.range,
              distanceType: PLAYER_ACTION_DISTANCE_TYPE.square,
              requireLineOfSight: true,
            };
      }
      if (action.targetType === "tile") {
        const targetTile = action.targetTile;
        if (useData.action !== "drinkPotion" || targetTile?.z !== playerState.z) {
          return null;
        }
        return isNearPlayer(targetTile, useData.range)
          ? { isReady: true }
          : { target: targetTile, range: useData.range, distanceType: PLAYER_ACTION_DISTANCE_TYPE.square };
      }
      return null;
    }

    if (action.type === PLAYER_ACTION_TYPE.npcGreeting) {
      const npc = npcsByUid.get(action.npcUid) ?? null;
      if (!npc || npc.z !== playerState.z) {
        return null;
      }
      return isPlayerWithinActionRange(npc, NPC_DIALOGUE_CONFIG.talkRange, PLAYER_ACTION_DISTANCE_TYPE.weighted)
        ? { isReady: true }
        : { target: npc, range: NPC_DIALOGUE_CONFIG.talkRange, distanceType: PLAYER_ACTION_DISTANCE_TYPE.weighted };
    }

    return null;
  };

  const executePlayerPendingAction = (action) => {
    if (action.type === PLAYER_ACTION_TYPE.itemDrag) {
      const source = findItemLocationByUid(action.itemUid);
      const item = getItemFromLocation(source);
      if (!item || !areItemLocationsEqual(action.source, source)) {
        return false;
      }
      startItemDrag(source);
      completeItemDrag(action.destination);
      return true;
    }

    if (action.type === PLAYER_ACTION_TYPE.useWorldItem) {
      const source = findItemLocationByUid(action.itemUid);
      if (source?.locationType !== "worldItem") {
        return false;
      }
      handleUseItemFromSource(source);
      return true;
    }

    if (action.type === PLAYER_ACTION_TYPE.targetItemUse) {
      const source = findItemLocationByUid(action.itemUid);
      const item = getItemFromLocation(source);
      const useData = getItemUseData(item);
      if (!source || !item || useData?.mode !== "target") {
        return false;
      }
      if (action.targetType === "monster") {
        const monster = findMonsterByUid(action.targetUid);
        if (!monster) {
          return false;
        }
        handleRuneUse(source, item, useData, { monster });
        return true;
      }
      if (action.targetType === "player") {
        const targetPlayer = findPlayerByUid(action.targetUid);
        if (!targetPlayer) {
          return false;
        }
        handleRuneUse(source, item, useData, { player: targetPlayer });
        return true;
      }
      if (action.targetType === "tile" && action.targetTile) {
        handleDrinkPotionUse(source, item, useData, { tile: action.targetTile });
        return true;
      }
      return false;
    }

    if (action.type === PLAYER_ACTION_TYPE.npcGreeting) {
      const npc = npcsByUid.get(action.npcUid) ?? null;
      return sayGreetingToNpc(npc, playerState);
    }

    return false;
  };

  const getPlayerActionApproachPath = (actionTarget) => {
    const playerTile = getTilePosition(playerState);
    const targetTile = getTilePosition(actionTarget.target);
    const pathTargetTiles = getPathTraversableAdjacentTiles(targetTile).filter((tile) => {
      return !isTileOccupiedByCreature(tile.row, tile.col) || (tile.col === playerTile.col && tile.row === playerTile.row);
    });
    if (isTilePathTraversable(targetTile.row, targetTile.col) && !isTileOccupiedByCreature(targetTile.row, targetTile.col)) {
      pathTargetTiles.push(targetTile);
    }

    const path = findPathToAnyTarget(playerTile, pathTargetTiles, true, PLAYER_AUTO_WALK_MAX_PATH_COST);
    const worldMap = getCurrentWorldMap();
    const actionTileIndex = path.findIndex((tile) => {
      if (!isTileWithinPlayerActionRange(tile, targetTile, actionTarget.range, actionTarget.distanceType)) {
        return false;
      }
      return !actionTarget.requireLineOfSight || hasLineOfSightBetweenTiles(worldMap, tile, targetTile);
    });
    return actionTileIndex === -1 ? [] : path.slice(0, actionTileIndex + 1);
  };

  const refreshPlayerActionNavigationPath = (now) => {
    const action = playerNavigationState.pendingAction;
    const actionTarget = resolvePlayerActionNavigationTarget(action);
    if (!actionTarget) {
      stopPlayerNavigation();
      return false;
    }
    if (actionTarget.isReady) {
      return schedulePlayerPendingActionExecution(now);
    }

    const targetTile = getTilePosition(actionTarget.target);
    const targetTileKey = `${actionTarget.target.z}:${targetTile.col}:${targetTile.row}`;
    const path = getPlayerActionApproachPath(actionTarget);
    if (path.length === 0) {
      const failureKey = `action:${action.type}:${targetTileKey}`;
      stopPlayerNavigation();
      showPlayerNavigationFailure(failureKey);
      return false;
    }

    playerNavigationState.lastActionTargetTileKey = targetTileKey;
    playerNavigationState.destinationTile = { ...path[path.length - 1] };
    playerNavigationState.nextPathRefreshAt = now + PLAYER_ACTION_PATH_REFRESH_COOLDOWN_MS;
    playerNavigationState.lastFailureKey = null;
    return setPlayerNavigationPath(path);
  };

  const schedulePlayerPendingActionExecution = (now) => {
    const movementEndTime = playerState.moveStartTime + playerState.moveDuration;
    playerNavigationState.path = [];
    playerNavigationState.destinationTile = null;
    playerNavigationState.actionExecuteAt = Math.max(now, movementEndTime) + PLAYER_ACTION_EXECUTION_DELAY_MS;
    return true;
  };

  const startPlayerActionNavigation = (action) => {
    if (!action || !Object.values(PLAYER_ACTION_TYPE).includes(action.type)) {
      return false;
    }
    playerNavigationState.mode = PLAYER_NAVIGATION_MODE.action;
    playerNavigationState.path = [];
    playerNavigationState.destinationTile = null;
    playerNavigationState.pendingAction = action;
    playerNavigationState.actionExecuteAt = 0;
    playerNavigationState.nextPathRefreshAt = 0;
    playerNavigationState.lastFollowTargetTileKey = null;
    playerNavigationState.lastActionTargetTileKey = null;
    playerNavigationState.lastFailureKey = null;
    return refreshPlayerActionNavigationPath(Date.now());
  };

  const updatePlayerActionNavigation = (now) => {
    if (playerNavigationState.mode !== PLAYER_NAVIGATION_MODE.action || !playerNavigationState.pendingAction) {
      return;
    }
    const actionTarget = resolvePlayerActionNavigationTarget(playerNavigationState.pendingAction);
    if (!actionTarget) {
      stopPlayerNavigation();
      return;
    }
    if (actionTarget.isReady) {
      if (playerNavigationState.actionExecuteAt === 0) {
        schedulePlayerPendingActionExecution(now);
        return;
      }
      if (now < playerNavigationState.actionExecuteAt) {
        return;
      }
      const action = playerNavigationState.pendingAction;
      stopPlayerNavigation();
      executePlayerPendingAction(action);
      return;
    }

    playerNavigationState.actionExecuteAt = 0;
    const targetTile = getTilePosition(actionTarget.target);
    const targetTileKey = `${actionTarget.target.z}:${targetTile.col}:${targetTile.row}`;
    const targetMoved = targetTileKey !== playerNavigationState.lastActionTargetTileKey;
    if (playerNavigationState.path.length === 0 || (targetMoved && now >= playerNavigationState.nextPathRefreshAt)) {
      refreshPlayerActionNavigationPath(now);
    }
  };

  const getPlayerNavigationMovement = (now) => {
    const nextTile = playerNavigationState.path[0];
    if (!nextTile) {
      return null;
    }

    const playerTile = getTilePosition(playerState);
    const deltaCol = nextTile.col - playerTile.col;
    const deltaRow = nextTile.row - playerTile.row;

    if (Math.abs(deltaCol) > 1 || Math.abs(deltaRow) > 1 || (deltaCol === 0 && deltaRow === 0)) {
      handleBlockedPlayerNavigationStep(now);
      return null;
    }

    return {
      deltaCol,
      deltaRow,
      direction: getCardinalDirectionFromTileDelta(deltaCol, deltaRow, playerState.direction),
    };
  };

  const completePlayerNavigationStep = () => {
    playerNavigationState.path.shift();

    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.click && playerNavigationState.path.length === 0) {
      stopPlayerNavigation();
    }
  };

  const handleBlockedPlayerNavigationStep = (now) => {
    playerNavigationState.path = [];

    if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.click) {
      refreshPlayerClickNavigationPath();
    } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.follow) {
      playerNavigationState.nextPathRefreshAt = 0;
      updatePlayerFollowNavigation(now, true);
    } else if (playerNavigationState.mode === PLAYER_NAVIGATION_MODE.action) {
      refreshPlayerActionNavigationPath(now);
    }
  };


  return {
    completeStep: completePlayerNavigationStep,
    getMovement: getPlayerNavigationMovement,
    handleBlockedStep: handleBlockedPlayerNavigationStep,
    isPlayerWithinActionRange,
    startAction: startPlayerActionNavigation,
    startClick: startPlayerClickNavigation,
    startFollow: startPlayerFollowNavigation,
    stop: stopPlayerNavigation,
    updateAction: updatePlayerActionNavigation,
    updateFollow: updatePlayerFollowNavigation,
  };
};
