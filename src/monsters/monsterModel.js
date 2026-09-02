import { MONSTER_AI_STATE } from "../core/gameConstants.js";
import { monstersDatabase } from "../data/monstersDatabase.js";
import { allocateMonsterUid } from "../state/uidAllocator.js";

export const getMonsterData = (monsterId) => {
  if (monstersDatabase[monsterId]) {
    return monstersDatabase[monsterId];
  }
  console.error(`monsterId: ${monsterId} n'existe pas dans monstersDatabase`);
  return null;
};

export const createMonster = (monsterId, x, y, z) => {
  const monsterData = getMonsterData(monsterId);
  if (!monsterData) {
    return null;
  }
  return {
    monsterId,
    x,
    y,
    z,
    oldX: x,
    oldY: y,
    renderX: x,
    renderY: y,
    moveStartTime: 0,
    moveDuration: 0,
    hp: monsterData.maxHp,
    uid: allocateMonsterUid(),
    nextMoveTime: 0,
    nextAttackTime: 0,
    path: [],
    nextPathRefreshTime: 0,
    direction: "down",
    walkFrame: 1,
    state: MONSTER_AI_STATE.idle,
    isAwake: false,
    targetUid: null,
    roamCenterX: x,
    roamCenterY: y,
    badPathStartedAt: null,
    nextCombatDanceAt: 0,
    nextBlockedChaseMoveAt: 0,
    nextDynamicPathRefreshTime: 0,
    nextAggroCheckAt: 0,
    nextWanderAt: 0,
    wanderStepsRemaining: 0,
    statusEffects: {},
    damageByPlayerUid: new Map(),
  };
};
