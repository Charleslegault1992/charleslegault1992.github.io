import {
  MONSTER_AI_CONFIG,
  MONSTER_AI_STATE,
  TILE_SIZE,
} from "../core/gameConstants.js";
import { getManhattanDistance, getRandomInt } from "../core/mathUtils.js";
import { getMonsterData } from "./monsterModel.js";
import { pixiWorldRenderState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";

export const createMonsterAiSystem = ({
  findPathToAnyTarget,
  getDistanceToClosestTile,
  getNeighbors,
  getPathMovementCost,
  getPathTraversableAdjacentTiles,
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  getTilePosition,
  getWorldPosition,
  hasLineOfSightBetweenTiles,
  isTileOccupiedByCreature,
  isTilePathTraversable,
  isWalkableTile,
  moveMonsterInTileIndex,
  syncMonsterRenderVisibility,
  updateMonsterDirection,
  updateMonsterSprite,
  getPlayers = () => [playerState],
  getPlayerByUid = (playerUid) => (getPlayers() ?? []).find((player) => player?.uid === playerUid) ?? null,
  getWorldMap = (z) => pixiWorldRenderState.worldMapsByZ?.get(z) ?? null,
}) => {
  let eligiblePlayersByZ = null;

  const isEntityInsideMonsterRange = (monster, entity, rangeX, rangeY) => {
    if (
      !monster ||
      !entity ||
      monster.z !== entity.z ||
      !Number.isFinite(monster.x) ||
      !Number.isFinite(monster.y) ||
      !Number.isFinite(entity.x) ||
      !Number.isFinite(entity.y) ||
      !Number.isFinite(rangeX) ||
      !Number.isFinite(rangeY)
    ) {
      return false;
    }

    const distanceX = Math.abs(entity.x - monster.x) / TILE_SIZE;
    const distanceY = Math.abs(entity.y - monster.y) / TILE_SIZE;

    return distanceX <= rangeX && distanceY <= rangeY;
  };

  const getEligiblePlayers = (monster) => {
    const z = monster?.z;
    if (eligiblePlayersByZ?.has(z)) {
      return eligiblePlayersByZ.get(z);
    }
    const eligiblePlayers = (getPlayers() ?? []).filter((player) => player?.hp > 0 && player.z === z);
    eligiblePlayersByZ?.set(z, eligiblePlayers);
    return eligiblePlayers;
  };

  const isPlayerInsideMonsterRange = (monster, rangeX, rangeY) => {
    return getEligiblePlayers(monster).some((player) => isEntityInsideMonsterRange(monster, player, rangeX, rangeY));
  };

  const isPlayerInsideMonsterWakeRange = (monster) => {
    return isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.wakeRangeX, MONSTER_AI_CONFIG.wakeRangeY);
  };

  const isPlayerInsideMonsterSleepRange = (monster) => {
    return isPlayerInsideMonsterRange(monster, MONSTER_AI_CONFIG.sleepRangeX, MONSTER_AI_CONFIG.sleepRangeY);
  };

  const deactivateMonsterAi = (monster) => {
    if (!monster) {
      return;
    }

    monster.isAwake = false;
    monster.path = [];
    monster.badPathStartedAt = null;
    monster.state = MONSTER_AI_STATE.idle;
    monster.nextWanderAt = 0;
    monster.wanderStepsRemaining = 0;
    monster.nextBlockedChaseMoveAt = 0;
    monster.nextDynamicPathRefreshTime = 0;
  };

  const updateMonsterActivityState = (monster) => {
    if (!monster || getEligiblePlayers(monster).length === 0) {
      return false;
    }

    if (!monster.isAwake) {
      if (!isPlayerInsideMonsterWakeRange(monster)) {
        return false;
      }

      monster.isAwake = true;
      return true;
    }

    if (monster.targetUid === null && !isPlayerInsideMonsterSleepRange(monster)) {
      deactivateMonsterAi(monster);
      return false;
    }

    return true;
  };

  const canMonsterSeePlayer = (monster, player) => {
    if (!isEntityInsideMonsterRange(monster, player, MONSTER_AI_CONFIG.visionX, MONSTER_AI_CONFIG.visionY)) {
      return false;
    }

    const worldMap = getWorldMap(monster.z);
    if (!worldMap) {
      return false;
    }

    return hasLineOfSightBetweenTiles(worldMap, getTilePosition(monster), getTilePosition(player));
  };

  const getMonsterPathToPlayerAdjacentTile = (monster, player) => {
    if (!monster || !player || monster.z !== player.z) {
      return null;
    }

    if (isEntityInsideMonsterRange(monster, player, 1, 1)) {
      return [];
    }

    const monsterTile = getTilePosition(monster);
    const playerTile = getTilePosition(player);
    const targetTiles = getPathTraversableAdjacentTiles(playerTile);

    if (targetTiles.length === 0) {
      return null;
    }

    const path = findPathToAnyTarget(monsterTile, targetTiles);

    if (!Array.isArray(path) || path.length === 0) {
      return null;
    }

    return path;
  };

  const getMonsterHearingPathToPlayer = (monster, player) => {
    if (!isEntityInsideMonsterRange(monster, player, MONSTER_AI_CONFIG.hearingScanRange, MONSTER_AI_CONFIG.hearingScanRange)) {
      return null;
    }

    const path = getMonsterPathToPlayerAdjacentTile(monster, player);

    const pathCost = getPathMovementCost(getTilePosition(monster), path);

    if (path === null || pathCost > MONSTER_AI_CONFIG.maxHearingPathLength) {
      return null;
    }

    return path;
  };

  const getMonsterTarget = (monster) => {
    if (!monster || monster.targetUid === null) {
      return null;
    }

    const target = getPlayerByUid(monster.targetUid);
    return target?.hp > 0 && target.z === monster.z ? target : null;
  };

  const setMonsterTarget = (monster, target) => {
    if (!monster || target?.uid == null) {
      return false;
    }

    monster.targetUid = target.uid;
    monster.path = [];
    monster.badPathStartedAt = null;
    monster.state = MONSTER_AI_STATE.chase;
    monster.nextWanderAt = 0;
    monster.wanderStepsRemaining = 0;
    monster.nextBlockedChaseMoveAt = 0;
    monster.nextDynamicPathRefreshTime = 0;
    return true;
  };

  const clearMonsterTarget = (monster) => {
    if (!monster) {
      return;
    }

    monster.targetUid = null;
    monster.path = [];
    monster.badPathStartedAt = null;
    monster.roamCenterX = monster.x;
    monster.roamCenterY = monster.y;
    monster.state = MONSTER_AI_STATE.wander;
    monster.nextWanderAt = 0;
    monster.wanderStepsRemaining = 0;
    monster.nextBlockedChaseMoveAt = 0;
    monster.nextDynamicPathRefreshTime = 0;
  };

  const isMonsterTargetValid = (monster, target) => {
    if (!monster || !target || target.hp <= 0 || monster.z !== target.z) {
      return false;
    }

    return isEntityInsideMonsterRange(monster, target, MONSTER_AI_CONFIG.deaggroX, MONSTER_AI_CONFIG.deaggroY);
  };

  const updateMonsterTargetState = (monster, now) => {
    if (!monster || !Number.isFinite(now)) {
      return false;
    }

    if (monster.targetUid !== null) {
      const target = getMonsterTarget(monster);

      if (!isMonsterTargetValid(monster, target)) {
        clearMonsterTarget(monster);
        return false;
      }

      return true;
    }

    if (now < monster.nextAggroCheckAt) {
      return false;
    }

    monster.nextAggroCheckAt =
      now + getRandomInt(MONSTER_AI_CONFIG.aggroCheckCooldownMinMs, MONSTER_AI_CONFIG.aggroCheckCooldownMaxMs);

    const candidates = [...getEligiblePlayers(monster)].sort((first, second) => {
      const firstDistance = Math.abs(first.x - monster.x) + Math.abs(first.y - monster.y);
      const secondDistance = Math.abs(second.x - monster.x) + Math.abs(second.y - monster.y);
      return firstDistance - secondDistance;
    });
    for (const player of candidates) {
      if (canMonsterSeePlayer(monster, player)) {
        return setMonsterTarget(monster, player);
      }
      const hearingPath = getMonsterHearingPathToPlayer(monster, player);
      if (hearingPath !== null && setMonsterTarget(monster, player)) {
        monster.path = hearingPath;
        return true;
      }
    }
    return false;
  };

  const hasMonsterBadPathTimedOut = (monster, now) => {
    if (!monster || monster.badPathStartedAt === null) {
      return false;
    }

    return now - monster.badPathStartedAt >= MONSTER_AI_CONFIG.maxBadPathDurationMs;
  };

  const handleMonsterBadPath = (monster, now) => {
    if (!monster || !Number.isFinite(now)) {
      return false;
    }

    monster.path = [];

    if (monster.badPathStartedAt === null) {
      monster.badPathStartedAt = now;
    }

    if (hasMonsterBadPathTimedOut(monster, now)) {
      clearMonsterTarget(monster);
    }

    return false;
  };

  const shouldRefreshMonsterChasePath = (monster, targetTiles, now, forceRefresh = false) => {
    if (!monster || !Array.isArray(targetTiles) || targetTiles.length === 0 || !Number.isFinite(now)) {
      return false;
    }

    if (forceRefresh) {
      return true;
    }

    if (now >= monster.nextPathRefreshTime) {
      return true;
    }

    if (!Array.isArray(monster.path) || monster.path.length === 0) {
      return false;
    }

    const currentPathEnd = monster.path[monster.path.length - 1];
    return getDistanceToClosestTile(currentPathEnd, targetTiles) > 2;
  };

  const updateMonsterChasePath = (monster, now, forceRefresh = false, avoidCreatures = false) => {
    const target = getMonsterTarget(monster);
    const monsterData = getMonsterData(monster?.monsterId);

    if (!monster || !target || !monsterData || !Number.isFinite(now)) {
      return false;
    }

    if (isEntityInsideMonsterRange(monster, target, 1, 1)) {
      monster.path = [];
      monster.badPathStartedAt = null;
      return true;
    }

    if (hasMonsterBadPathTimedOut(monster, now)) {
      clearMonsterTarget(monster);
      return false;
    }

    if (monster.badPathStartedAt !== null && now < monster.nextPathRefreshTime && !forceRefresh) {
      return false;
    }

    const monsterTile = getTilePosition(monster);
    const targetTile = getTilePosition(target);
    const targetTiles = getPathTraversableAdjacentTiles(targetTile);

    if (targetTiles.length === 0) {
      monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;
      return handleMonsterBadPath(monster, now);
    }

    if (!shouldRefreshMonsterChasePath(monster, targetTiles, now, forceRefresh)) {
      return monster.path.length > 0;
    }

    monster.nextPathRefreshTime = now + monsterData.pathRefreshCooldown;

    const newPath = findPathToAnyTarget(monsterTile, targetTiles, avoidCreatures);
    const newPathCost = getPathMovementCost(monsterTile, newPath);

    const hasValidPath =
      Array.isArray(newPath) && newPath.length > 0 && newPathCost <= MONSTER_AI_CONFIG.maxChasePathLength;

    if (!hasValidPath) {
      if (avoidCreatures) {
        return false;
      }

      return handleMonsterBadPath(monster, now);
    }

    monster.path = newPath;
    monster.badPathStartedAt = null;
    return true;
  };

  const setMonsterIdleState = (monster, now) => {
    if (!monster || !Number.isFinite(now)) {
      return;
    }

    monster.state = MONSTER_AI_STATE.idle;
    monster.wanderStepsRemaining = 0;
    monster.nextWanderAt = now + getRandomInt(MONSTER_AI_CONFIG.idleDurationMinMs, MONSTER_AI_CONFIG.idleDurationMaxMs);
  };

  const startMonsterWanderState = (monster) => {
    if (!monster) {
      return;
    }

    monster.state = MONSTER_AI_STATE.wander;
    monster.wanderStepsRemaining = getRandomInt(MONSTER_AI_CONFIG.wanderStepsMin, MONSTER_AI_CONFIG.wanderStepsMax);
  };

  const isTileInsideMonsterRoamRange = (monster, tile) => {
    if (!monster || !Number.isInteger(tile?.col) || !Number.isInteger(tile?.row)) {
      return false;
    }

    const roamCenterCol = monster.roamCenterX / TILE_SIZE;
    const roamCenterRow = monster.roamCenterY / TILE_SIZE;

    return (
      Math.abs(tile.col - roamCenterCol) <= MONSTER_AI_CONFIG.wanderRadiusTiles &&
      Math.abs(tile.row - roamCenterRow) <= MONSTER_AI_CONFIG.wanderRadiusTiles
    );
  };

  const getRandomMonsterWanderTile = (monster) => {
    if (!monster) {
      return null;
    }

    const monsterTile = getTilePosition(monster);

    const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
      return isTileInsideMonsterRoamRange(monster, tile) && isWalkableTile(tile.row, tile.col, monsterTile);
    });

    if (possibleTiles.length === 0) {
      return null;
    }

    const cardinalTiles = possibleTiles.filter((tile) => {
      return getTileMovementCost(monsterTile, tile) === 1;
    });
    const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

    return preferredTiles[getRandomInt(0, preferredTiles.length - 1)];
  };

  const getRandomMonsterCombatDanceTile = (monster) => {
    const target = getMonsterTarget(monster);
    if (!monster || !target || monster.z !== target.z) {
      return null;
    }

    const monsterTile = getTilePosition(monster);
    const playerTile = getTilePosition(target);

    const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
      const distanceCol = Math.abs(tile.col - playerTile.col);
      const distanceRow = Math.abs(tile.row - playerTile.row);
      const isPlayerTile = distanceCol === 0 && distanceRow === 0;
      const remainsAdjacent = distanceCol <= 1 && distanceRow <= 1;

      return !isPlayerTile && remainsAdjacent && isWalkableTile(tile.row, tile.col, monsterTile);
    });

    if (possibleTiles.length === 0) {
      return null;
    }

    const cardinalTiles = possibleTiles.filter((tile) => {
      return getTileMovementCost(monsterTile, tile) === 1;
    });
    const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

    return preferredTiles[getRandomInt(0, preferredTiles.length - 1)];
  };

  const moveMonsterToTile = (monster, tile, now, moveDuration) => {
    if (!monster || !tile || !Number.isFinite(now) || !Number.isFinite(moveDuration)) {
      return false;
    }

    const monsterData = getMonsterData(monster.monsterId);
    if (!monsterData) {
      return false;
    }

    const monsterTile = getTilePosition(monster);

    if (!isWalkableTile(tile.row, tile.col, monsterTile)) {
      return false;
    }

    const movementCost = getTileMovementCost(monsterTile, tile);
    const animationMultiplier = getTileMovementAnimationMultiplier(monsterTile, tile);

    if (movementCost === null || animationMultiplier === null) {
      return false;
    }

    const finalMoveDuration = moveDuration * animationMultiplier;
    const finalMoveCooldown = moveDuration * movementCost;
    const { tileX, tileY } = getWorldPosition(tile);
    const previousX = monster.x;
    const previousY = monster.y;

    if (!moveMonsterInTileIndex(monster, tileX, tileY)) {
      return false;
    }

    updateMonsterDirection(monster, tile);

    monster.walkFrame++;

    if (monster.walkFrame >= monsterData.animationFrames) {
      monster.walkFrame = 0;
    }

    updateMonsterSprite(monster);

    monster.oldX = previousX;
    monster.oldY = previousY;
    monster.moveStartTime = now;
    monster.moveDuration = finalMoveDuration;
    monster.nextMoveTime = now + finalMoveCooldown;
    monster.x = tileX;
    monster.y = tileY;
    syncMonsterRenderVisibility(monster);

    return true;
  };

  const updateMonsterCombatDance = (monster, now) => {
    if (
      !monster ||
      !Number.isFinite(now) ||
      monster.state !== MONSTER_AI_STATE.combat ||
      !getMonsterTarget(monster)
    ) {
      return false;
    }

    if (monster.nextCombatDanceAt === 0) {
      monster.nextCombatDanceAt =
        now + getRandomInt(MONSTER_AI_CONFIG.combatDanceCooldownMinMs, MONSTER_AI_CONFIG.combatDanceCooldownMaxMs);
      return false;
    }

    if (now < monster.nextCombatDanceAt || now < monster.nextMoveTime) {
      return false;
    }

    monster.nextCombatDanceAt =
      now + getRandomInt(MONSTER_AI_CONFIG.combatDanceCooldownMinMs, MONSTER_AI_CONFIG.combatDanceCooldownMaxMs);

    const danceTile = getRandomMonsterCombatDanceTile(monster);
    const monsterData = getMonsterData(monster.monsterId);

    if (!danceTile || !monsterData) {
      return false;
    }

    return moveMonsterToTile(monster, danceTile, now, monsterData.moveCooldown);
  };

  const getMonsterChaseRepositionTile = (monster) => {
    const target = getMonsterTarget(monster);

    if (!monster || !target || monster.z !== target.z) {
      return null;
    }

    const monsterTile = getTilePosition(monster);
    const targetTile = getTilePosition(target);

    const possibleTiles = getNeighbors(monsterTile).filter((tile) => {
      return isWalkableTile(tile.row, tile.col, monsterTile);
    });

    if (possibleTiles.length === 0) {
      return null;
    }

    const cardinalTiles = possibleTiles.filter((tile) => {
      return getTileMovementCost(monsterTile, tile) === 1;
    });
    const preferredTiles = cardinalTiles.length > 0 ? cardinalTiles : possibleTiles;

    let bestDistance = Number.POSITIVE_INFINITY;
    const closestTiles = [];

    for (const tile of preferredTiles) {
      const distance = getManhattanDistance(tile, targetTile);

      if (distance < bestDistance) {
        bestDistance = distance;
        closestTiles.length = 0;
        closestTiles.push(tile);
      } else if (distance === bestDistance) {
        closestTiles.push(tile);
      }
    }

    return closestTiles[getRandomInt(0, closestTiles.length - 1)] ?? null;
  };

  const updateMonsterBlockedChaseMovement = (monster, now) => {
    if (!monster || !Number.isFinite(now) || monster.state !== MONSTER_AI_STATE.chase || monster.targetUid === null) {
      return false;
    }

    if (monster.nextBlockedChaseMoveAt === 0) {
      monster.nextBlockedChaseMoveAt =
        now +
        getRandomInt(MONSTER_AI_CONFIG.blockedChaseMoveCooldownMinMs, MONSTER_AI_CONFIG.blockedChaseMoveCooldownMaxMs);
      return false;
    }

    if (now < monster.nextBlockedChaseMoveAt || now < monster.nextMoveTime) {
      return false;
    }

    monster.nextBlockedChaseMoveAt =
      now +
      getRandomInt(MONSTER_AI_CONFIG.blockedChaseMoveCooldownMinMs, MONSTER_AI_CONFIG.blockedChaseMoveCooldownMaxMs);

    const repositionTile = getMonsterChaseRepositionTile(monster);
    const monsterData = getMonsterData(monster.monsterId);

    if (!repositionTile || !monsterData) {
      return false;
    }

    return moveMonsterToTile(monster, repositionTile, now, monsterData.moveCooldown);
  };

  const updateMonsterWanderMovement = (monster, now) => {
    if (!monster || !Number.isFinite(now)) {
      return;
    }

    if (monster.state === MONSTER_AI_STATE.idle) {
      if (monster.nextWanderAt === 0) {
        setMonsterIdleState(monster, now);
        return;
      }

      if (now < monster.nextWanderAt) {
        return;
      }

      startMonsterWanderState(monster);
    }

    if (monster.state !== MONSTER_AI_STATE.wander) {
      return;
    }

    if (monster.wanderStepsRemaining <= 0) {
      startMonsterWanderState(monster);
    }

    if (now < monster.nextMoveTime) {
      return;
    }

    const wanderTile = getRandomMonsterWanderTile(monster);

    if (!wanderTile) {
      setMonsterIdleState(monster, now);
      return;
    }

    const monsterData = getMonsterData(monster.monsterId);
    if (!monsterData) {
      return;
    }

    const monsterTile = getTilePosition(monster);
    const movementCost = getTileMovementCost(monsterTile, wanderTile);

    if (movementCost === null) {
      return;
    }

    const wanderCooldown =
      getRandomInt(MONSTER_AI_CONFIG.wanderStepCooldownMinMs, MONSTER_AI_CONFIG.wanderStepCooldownMaxMs) * movementCost;

    if (!moveMonsterToTile(monster, wanderTile, now, monsterData.moveCooldown)) {
      return;
    }

    monster.wanderStepsRemaining--;

    monster.nextMoveTime = Math.max(monster.nextMoveTime, now + wanderCooldown);

    if (monster.wanderStepsRemaining <= 0) {
      setMonsterIdleState(monster, now);
    }
  };

  const updateMonsterMovement = (now, activeMonsters) => {
    eligiblePlayersByZ = new Map();
    activeMonsters.forEach((monster) => {
      if (!updateMonsterActivityState(monster)) {
        return;
      }

      if (!updateMonsterTargetState(monster, now)) {
        updateMonsterWanderMovement(monster, now);
        return;
      }
      if (isEntityInsideMonsterRange(monster, getMonsterTarget(monster), 1, 1)) {
        monster.state = MONSTER_AI_STATE.combat;
        monster.path = [];
        monster.badPathStartedAt = null;
        updateMonsterCombatDance(monster, now);
        return;
      }

      monster.state = MONSTER_AI_STATE.chase;

      if (monster.nextMoveTime > now) {
        return;
      }

      const monsterData = getMonsterData(monster.monsterId);
      if (!monsterData) {
        return;
      }

      if (!updateMonsterChasePath(monster, now)) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }

      let nextStep = monster.path[0];

      if (!nextStep) {
        updateMonsterBlockedChaseMovement(monster, now);
        return;
      }

      const monsterTile = getTilePosition(monster);

      if (!isTilePathTraversable(nextStep.row, nextStep.col, monsterTile)) {
        if (!updateMonsterChasePath(monster, now, true)) {
          updateMonsterBlockedChaseMovement(monster, now);
          return;
        }

        nextStep = monster.path[0];

        if (!nextStep || !isTilePathTraversable(nextStep.row, nextStep.col, monsterTile)) {
          updateMonsterBlockedChaseMovement(monster, now);
          return;
        }
      }

      if (isTileOccupiedByCreature(nextStep.row, nextStep.col)) {
        let foundDynamicPath = false;

        if (now >= monster.nextDynamicPathRefreshTime) {
          monster.nextDynamicPathRefreshTime = now + MONSTER_AI_CONFIG.dynamicPathRefreshCooldownMs;
          foundDynamicPath = updateMonsterChasePath(monster, now, true, true);
        }

        if (!foundDynamicPath) {
          updateMonsterBlockedChaseMovement(monster, now);
          return;
        }

        nextStep = monster.path[0];

        if (!nextStep || !isWalkableTile(nextStep.row, nextStep.col, monsterTile)) {
          updateMonsterBlockedChaseMovement(monster, now);
          return;
        }
      }

      if (moveMonsterToTile(monster, nextStep, now, monsterData.moveCooldown)) {
        monster.nextBlockedChaseMoveAt = 0;
        monster.nextDynamicPathRefreshTime = 0;
        monster.path.shift();
      }
    });
    eligiblePlayersByZ = null;
  };

  return {
    clearTarget: clearMonsterTarget,
    getTarget: getMonsterTarget,
    setTarget: setMonsterTarget,
    updateActivityState: updateMonsterActivityState,
    updateMovement: updateMonsterMovement,
  };
};
