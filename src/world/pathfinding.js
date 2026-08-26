import { MinHeap } from "../core/MinHeap.js";
import { getManhattanDistance } from "../core/mathUtils.js";
import { isWorldCollisionAtTile } from "./worldCoordinates.js";

export const getTileMovementCost = (fromTile, toTile) => {
  if (
    !Number.isInteger(fromTile?.col) ||
    !Number.isInteger(fromTile?.row) ||
    !Number.isInteger(toTile?.col) ||
    !Number.isInteger(toTile?.row)
  ) {
    return null;
  }

  const distanceCol = Math.abs(toTile.col - fromTile.col);
  const distanceRow = Math.abs(toTile.row - fromTile.row);
  if (distanceCol > 1 || distanceRow > 1 || (distanceCol === 0 && distanceRow === 0)) {
    return null;
  }
  return distanceCol === 1 && distanceRow === 1 ? 3 : 1;
};

export const getTileMovementAnimationMultiplier = (fromTile, toTile) => {
  const movementCost = getTileMovementCost(fromTile, toTile);
  if (movementCost === null) {
    return null;
  }
  return movementCost === 3 ? 2 : 1;
};

export const getCardinalDirectionFromTileDelta = (deltaCol, deltaRow, fallbackDirection = "down") => {
  if (deltaCol > 0) {
    return "right";
  }
  if (deltaCol < 0) {
    return "left";
  }
  if (deltaRow < 0) {
    return "up";
  }
  if (deltaRow > 0) {
    return "down";
  }
  return fallbackDirection;
};

export const getPathMovementCost = (startTile, path) => {
  if (!startTile || !Array.isArray(path)) {
    return Number.POSITIVE_INFINITY;
  }

  let totalCost = 0;
  let previousTile = startTile;
  for (const tile of path) {
    const movementCost = getTileMovementCost(previousTile, tile);
    if (movementCost === null) {
      return Number.POSITIVE_INFINITY;
    }
    totalCost += movementCost;
    previousTile = tile;
  }
  return totalCost;
};

export const hasLineOfSightBetweenTiles = (worldMap, fromTile, toTile) => {
  if (
    !(worldMap?.chunksByKey instanceof Map) ||
    !Number.isInteger(fromTile?.col) ||
    !Number.isInteger(fromTile?.row) ||
    !Number.isInteger(toTile?.col) ||
    !Number.isInteger(toTile?.row)
  ) {
    return false;
  }

  let currentCol = fromTile.col;
  let currentRow = fromTile.row;
  const distanceCol = Math.abs(toTile.col - currentCol);
  const distanceRow = -Math.abs(toTile.row - currentRow);
  const stepCol = currentCol < toTile.col ? 1 : -1;
  const stepRow = currentRow < toTile.row ? 1 : -1;
  let error = distanceCol + distanceRow;

  while (currentCol !== toTile.col || currentRow !== toTile.row) {
    const doubledError = error * 2;
    if (doubledError >= distanceRow) {
      error += distanceRow;
      currentCol += stepCol;
    }
    if (doubledError <= distanceCol) {
      error += distanceCol;
      currentRow += stepRow;
    }
    if (isWorldCollisionAtTile(worldMap, currentCol, currentRow)) {
      return false;
    }
  }
  return true;
};

export const getNeighbors = (tile) => {
  return [
    { row: tile.row - 1, col: tile.col - 1 },
    { row: tile.row - 1, col: tile.col },
    { row: tile.row - 1, col: tile.col + 1 },
    { row: tile.row, col: tile.col - 1 },
    { row: tile.row, col: tile.col + 1 },
    { row: tile.row + 1, col: tile.col - 1 },
    { row: tile.row + 1, col: tile.col },
    { row: tile.row + 1, col: tile.col + 1 },
  ];
};

export const getDistanceToClosestTile = (tile, targetTiles) => {
  if (
    !Number.isInteger(tile?.col) ||
    !Number.isInteger(tile?.row) ||
    !Array.isArray(targetTiles) ||
    targetTiles.length === 0
  ) {
    return Number.POSITIVE_INFINITY;
  }

  let closestDistance = Number.POSITIVE_INFINITY;
  for (const targetTile of targetTiles) {
    if (Number.isInteger(targetTile?.col) && Number.isInteger(targetTile?.row)) {
      closestDistance = Math.min(closestDistance, getManhattanDistance(tile, targetTile));
    }
  }
  return closestDistance;
};

const comparePathNodes = (nodeA, nodeB) => {
  if (nodeA.f !== nodeB.f) {
    return nodeA.f - nodeB.f;
  }
  if (nodeA.h !== nodeB.h) {
    return nodeA.h - nodeB.h;
  }
  return nodeA.openOrder - nodeB.openOrder;
};

const buildPath = (currentNode) => {
  const path = [];
  while (currentNode.parent) {
    path.push(currentNode);
    currentNode = currentNode.parent;
  }
  return path.reverse();
};

export const createPathfinder = ({ isTilePathTraversable, isTileOccupiedByCreature }) => {
  if (typeof isTilePathTraversable !== "function" || typeof isTileOccupiedByCreature !== "function") {
    throw new TypeError("Pathfinder tile rules must be functions.");
  }

  const isWalkableTile = (row, col, fromTile = null) => {
    return isTilePathTraversable(row, col, fromTile) && !isTileOccupiedByCreature(row, col);
  };

  const getNeighborNodes = (tile, targetTiles, avoidCreatures = false) => {
    const neighborNodes = [];
    for (const neighbor of getNeighbors(tile)) {
      const canTraverse = avoidCreatures
        ? isWalkableTile(neighbor.row, neighbor.col, tile)
        : isTilePathTraversable(neighbor.row, neighbor.col, tile);
      if (!canTraverse) {
        continue;
      }
      const movementCost = getTileMovementCost(tile, neighbor);
      if (movementCost === null) {
        continue;
      }
      const g = tile.g + movementCost;
      const h = getDistanceToClosestTile(neighbor, targetTiles);
      neighborNodes.push({
        row: neighbor.row,
        col: neighbor.col,
        g,
        h,
        f: g + h,
        parent: tile,
      });
    }
    return neighborNodes;
  };

  const getPathTraversableAdjacentTiles = (tile) => {
    if (!Number.isInteger(tile?.col) || !Number.isInteger(tile?.row)) {
      return [];
    }
    return getNeighbors(tile).filter((neighbor) => isTilePathTraversable(neighbor.row, neighbor.col));
  };

  const findPathToAnyTarget = (
    startTile,
    targetTiles,
    avoidCreatures = false,
    maxPathCost = Number.POSITIVE_INFINITY,
  ) => {
    if (
      !Number.isInteger(startTile?.col) ||
      !Number.isInteger(startTile?.row) ||
      !Array.isArray(targetTiles) ||
      targetTiles.length === 0 ||
      (maxPathCost !== Number.POSITIVE_INFINITY && (!Number.isFinite(maxPathCost) || maxPathCost < 0))
    ) {
      return [];
    }

    const validTargetTiles = targetTiles.filter(
      (targetTile) => Number.isInteger(targetTile?.col) && Number.isInteger(targetTile?.row),
    );
    if (validTargetTiles.length === 0) {
      return [];
    }

    const targetKeys = new Set(validTargetTiles.map((targetTile) => `${targetTile.col}:${targetTile.row}`));
    const openHeap = new MinHeap(comparePathNodes);
    const closedTileKeys = new Set();
    const bestGByTileKey = new Map();
    let nextOpenOrder = 0;
    const h = getDistanceToClosestTile(startTile, validTargetTiles);
    const startNode = {
      row: startTile.row,
      col: startTile.col,
      g: 0,
      h,
      f: h,
      parent: null,
      openOrder: nextOpenOrder++,
    };
    bestGByTileKey.set(`${startNode.col}:${startNode.row}`, startNode.g);
    openHeap.push(startNode);

    while (openHeap.size > 0) {
      const currentNode = openHeap.pop();
      if (!currentNode) {
        break;
      }
      const currentNodeKey = `${currentNode.col}:${currentNode.row}`;
      if (closedTileKeys.has(currentNodeKey) || currentNode.g !== bestGByTileKey.get(currentNodeKey)) {
        continue;
      }
      closedTileKeys.add(currentNodeKey);
      if (targetKeys.has(currentNodeKey)) {
        return buildPath(currentNode);
      }

      for (const node of getNeighborNodes(currentNode, validTargetTiles, avoidCreatures)) {
        if (node.g > maxPathCost) {
          continue;
        }
        const nodeKey = `${node.col}:${node.row}`;
        if (closedTileKeys.has(nodeKey)) {
          continue;
        }
        const bestKnownG = bestGByTileKey.get(nodeKey);
        if (bestKnownG !== undefined && node.g >= bestKnownG) {
          continue;
        }
        bestGByTileKey.set(nodeKey, node.g);
        node.openOrder = nextOpenOrder++;
        openHeap.push(node);
      }
    }
    return [];
  };

  const findPath = (startTile, targetTile, avoidCreatures = false, maxPathCost = Number.POSITIVE_INFINITY) => {
    return findPathToAnyTarget(startTile, [targetTile], avoidCreatures, maxPathCost);
  };

  return {
    findPath,
    findPathToAnyTarget,
    getPathTraversableAdjacentTiles,
    isWalkableTile,
  };
};
