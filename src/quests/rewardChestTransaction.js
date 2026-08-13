import { QUEST_STATUS } from "../data/questsDatabase.js";
import { getRewardTableData } from "../inventory/inventoryTransactions.js";
import {
  hasPlayerClaimedInteractableReward,
  recordPlayerInteractableRewardClaim,
  setPlayerQuestStatus,
} from "./questProgress.js";
import { getQuestData } from "./questProgress.js";

export const executeRewardChestTransaction = ({ player, interactable, requestedAt, insertRewardItems }) => {
  const { interactableId, questId, rewardTableId } = interactable?.properties ?? {};
  const questData = getQuestData(questId);
  const rewardTable = getRewardTableData(rewardTableId);
  if (
    typeof interactableId !== "string" ||
    interactableId === "" ||
    !questData ||
    !Array.isArray(rewardTable?.items) ||
    typeof insertRewardItems !== "function" ||
    !Number.isFinite(requestedAt)
  ) {
    return { success: false, reason: "configuration" };
  }
  if (hasPlayerClaimedInteractableReward(player, interactableId)) {
    return { success: false, reason: "already-claimed", changes: { questId } };
  }

  const grantResult = insertRewardItems(rewardTable.items);
  if (!grantResult?.success) {
    return { success: false, reason: grantResult?.reason ?? "reward-failed" };
  }
  if (
    !recordPlayerInteractableRewardClaim(player, interactableId, requestedAt) ||
    !setPlayerQuestStatus(player, questId, QUEST_STATUS.completed, requestedAt)
  ) {
    return { success: false, reason: "progress-commit-failed" };
  }
  return {
    success: true,
    changes: {
      interactableId,
      questId,
      claimedAt: requestedAt,
      progress: structuredClone(player.progress),
      equipment: structuredClone(player.equipment),
    },
    events: [{
      type: "reward-chest-completed",
      interactableId,
      questId,
      rewardItems: structuredClone(rewardTable.items),
      position: {
        x: interactable.x,
        y: interactable.y,
        width: interactable.width,
        height: interactable.height,
      },
    }],
  };
};
