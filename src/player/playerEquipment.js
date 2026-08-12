import { playerState } from "../state/playerState.js";

export const getEquipmentSlotItem = (slotName) => {
  return playerState.equipment[slotName] ?? null;
};
