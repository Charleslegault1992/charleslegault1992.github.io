export const createInventoryDragController = ({
  dragState,
  inputState,
  resolveItem,
  clearWorldSelection,
  resetInputComboState,
}) => {
  const reset = () => {
    dragState.isDragging = false;
    document.body.classList.remove("item-drag-active");
    dragState.item = null;
    dragState.sourceLocationType = null;
    dragState.sourceSlotIndex = null;
    dragState.sourceEquipmentSlotName = null;
    dragState.sourceParentContainerUid = null;
    dragState.sourceItemUid = null;
  };

  const resetPending = () => {
    dragState.pendingSourceLocation = null;
    dragState.pendingSlotElement = null;
    dragState.startScreenX = null;
    dragState.startScreenY = null;
  };

  const cancel = () => {
    for (const slot of document.querySelectorAll(".container-slot-dragging")) {
      slot.classList.remove("container-slot-dragging");
    }
    clearWorldSelection();
    reset();
    resetPending();
    resetInputComboState();
  };

  const start = (source) => {
    const item = resolveItem(source);
    if (!item) {
      return false;
    }
    reset();
    inputState.shouldBlockNextWorldClick = true;
    dragState.isDragging = true;
    document.body.classList.add("item-drag-active");
    dragState.item = item;

    if (source.locationType === "containerSlot") {
      dragState.sourceLocationType = source.locationType;
      dragState.sourceParentContainerUid = source.parentContainerUid;
      dragState.sourceSlotIndex = source.slotIndex;
    } else if (source.locationType === "equipmentSlot") {
      dragState.sourceLocationType = source.locationType;
      dragState.sourceEquipmentSlotName = source.equipmentSlotName;
    } else if (source.locationType === "worldItem") {
      dragState.sourceLocationType = source.locationType;
      dragState.sourceItemUid = source.itemUid;
    } else {
      reset();
      return false;
    }
    return true;
  };

  const getSource = () => {
    if (!dragState.isDragging) {
      return null;
    }
    if (dragState.sourceLocationType === "containerSlot") {
      return {
        locationType: dragState.sourceLocationType,
        parentContainerUid: dragState.sourceParentContainerUid,
        slotIndex: dragState.sourceSlotIndex,
      };
    }
    if (dragState.sourceLocationType === "equipmentSlot") {
      return {
        locationType: dragState.sourceLocationType,
        equipmentSlotName: dragState.sourceEquipmentSlotName,
      };
    }
    if (dragState.sourceLocationType === "worldItem") {
      return {
        locationType: dragState.sourceLocationType,
        itemUid: dragState.sourceItemUid,
      };
    }
    return null;
  };

  return {
    cancel,
    getSource,
    reset,
    resetPending,
    start,
  };
};
