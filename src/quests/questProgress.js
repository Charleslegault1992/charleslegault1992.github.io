import { QUEST_STATUS, questsDatabase } from "../data/questsDatabase.js";
import { playerState } from "../state/playerState.js";

export const getQuestData = (questId) => {
  if (typeof questId !== "string" || !(questId in questsDatabase)) {
    return null;
  }
  return questsDatabase[questId];
};

export const getPlayerQuestState = (questId) => {
  if (typeof questId !== "string" || !playerState.progress?.questsById) {
    return null;
  }
  return playerState.progress.questsById[questId] ?? null;
};

export const setPlayerQuestStatus = (questId, status, now = Date.now()) => {
  if (!getQuestData(questId) || !Object.values(QUEST_STATUS).includes(status) || !Number.isFinite(now)) {
    return false;
  }
  const currentQuestState = getPlayerQuestState(questId);
  playerState.progress.questsById[questId] = {
    questId,
    status,
    startedAt: currentQuestState?.startedAt ?? now,
    completedAt: status === QUEST_STATUS.completed ? (currentQuestState?.completedAt ?? now) : null,
  };
  return true;
};

export const hasPlayerClaimedInteractableReward = (interactableId) => {
  if (typeof interactableId !== "string" || !playerState.progress?.rewardClaimsByInteractableId) {
    return false;
  }
  return interactableId in playerState.progress.rewardClaimsByInteractableId;
};

export const recordPlayerInteractableRewardClaim = (interactableId, now = Date.now()) => {
  if (
    typeof interactableId !== "string" ||
    interactableId === "" ||
    !Number.isFinite(now) ||
    !playerState.progress?.rewardClaimsByInteractableId
  ) {
    return false;
  }
  playerState.progress.rewardClaimsByInteractableId[interactableId] = {
    interactableId,
    claimedAt: now,
  };
  return true;
};
