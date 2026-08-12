let nextItemInstanceId = 1;
let nextMonsterUid = 1;
let nextGroundEffectUid = 1;

export const allocateItemUid = () => {
  return nextItemInstanceId++;
};

export const allocateMonsterUid = () => {
  return nextMonsterUid++;
};

export const allocateGroundEffectUid = () => {
  return nextGroundEffectUid++;
};

export const observeExistingItemUid = (itemUid) => {
  if (Number.isInteger(itemUid) && itemUid >= nextItemInstanceId) {
    nextItemInstanceId = itemUid + 1;
  }
};
