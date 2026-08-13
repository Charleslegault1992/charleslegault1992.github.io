import { QUEST_STATUS, questsDatabase } from "../data/questsDatabase.js";

export const getQuestData = (questId) => {
  if (typeof questId !== "string" || !(questId in questsDatabase)) {
    return null;
  }
  return questsDatabase[questId];
};

export const getPlayerQuestState = (player, questId) => {
  if (typeof questId !== "string" || !player?.progress?.questsById) {
    return null;
  }
  return player.progress.questsById[questId] ?? null;
};

export const setPlayerQuestStatus = (player, questId, status, now) => {
  if (!getQuestData(questId) || !Object.values(QUEST_STATUS).includes(status) || !Number.isFinite(now)) {
    return false;
  }
  const currentQuestState = getPlayerQuestState(player, questId);
  player.progress.questsById[questId] = {
    questId,
    status,
    startedAt: currentQuestState?.startedAt ?? now,
    completedAt: status === QUEST_STATUS.completed ? (currentQuestState?.completedAt ?? now) : null,
  };
  return true;
};

export const hasPlayerClaimedInteractableReward = (player, interactableId) => {
  if (typeof interactableId !== "string" || !player?.progress?.rewardClaimsByInteractableId) {
    return false;
  }
  return interactableId in player.progress.rewardClaimsByInteractableId;
};

export const recordPlayerInteractableRewardClaim = (player, interactableId, now) => {
  if (
    typeof interactableId !== "string" ||
    interactableId === "" ||
    !Number.isFinite(now) ||
    !player?.progress?.rewardClaimsByInteractableId
  ) {
    return false;
  }
  player.progress.rewardClaimsByInteractableId[interactableId] = {
    interactableId,
    claimedAt: now,
  };
  return true;
};
