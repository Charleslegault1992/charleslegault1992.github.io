import { clamp } from "../core/mathUtils.js";
import { getItemData, isContainerItem, isOpenableContainerItem } from "../items/itemModel.js";
import { getLocalizedItemName } from "../localization/gameLocalization.js";
import { isNearPlayer } from "../player/playerSpatial.js";
import { dragState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";
import { openedContainers } from "../state/worldState.js";
import { mobileGameControls, playerContainers } from "./domRefs.js";

export const createContainerWindowController = ({
  inputState,
  renderItemIcon,
  shouldBlockContextMenuAction,
  cancelItemDrag,
  handleUseItemFromSource,
  isMobileGameLayout,
  syncMobileBackpackButton,
  syncItemUseSourceFeedback,
  refreshInventoryUi,
  resolveContainerItem,
}) => {
  const getWrapperUid = (containerWrapper) => {
    return containerWrapper?.itemUid ?? containerWrapper?.item?.uid ?? null;
  };

  const getCurrentContainerItem = (containerWrapper) => {
    const containerUid = getWrapperUid(containerWrapper);
    if (!Number.isInteger(containerUid)) {
      return null;
    }

    const currentItem = resolveContainerItem(containerUid);
    if (!currentItem || !isOpenableContainerItem(currentItem)) {
      return null;
    }

    containerWrapper.item = currentItem;
    return currentItem;
  };

  const findWrapperByUid = (containerUid) => {
    return openedContainers.find((container) => getWrapperUid(container) === containerUid) ?? null;
  };

  const findIndexByUid = (containerUid) => {
    return openedContainers.findIndex((container) => getWrapperUid(container) === containerUid);
  };

  const getRootWrapper = (containerWrapper) => {
    if (!containerWrapper) {
      return null;
    }
    let rootWrapper = containerWrapper;
    while (rootWrapper.parent) {
      rootWrapper = rootWrapper.parent;
    }
    return rootWrapper;
  };

  const isChildOf = (openedWindow, containerToClose) => {
    let parent = openedWindow?.parent ?? null;
    while (parent) {
      if (parent.item.uid === containerToClose?.uid) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  };

  const renderSlots = (containerBody, containerItem) => {
    if (!containerItem || !containerBody) {
      return;
    }
    containerBody.innerHTML = "";
    const capacity = getItemData(containerItem.itemId)?.capacity;
    if (!Number.isInteger(capacity)) {
      return;
    }
    const slotGrid = document.createElement("div");
    slotGrid.classList.add("container-slot-grid");
    for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
      const slotItem = containerItem.content[slotIndex];
      const slot = document.createElement("div");
      slot.classList.add("container-slot");
      slot.dataset.containerSlotIndex = slotIndex;
      slot.dataset.containerUid = containerItem.uid;
      if (slotItem) {
        renderItemIcon(slot, slotItem, 40);
        slot.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (dragState.isDragging) {
            inputState.shouldBlockNextContextMenu = true;
            cancelItemDrag();
            return;
          }
          if (shouldBlockContextMenuAction()) {
            return;
          }
          handleUseItemFromSource({
            locationType: "containerSlot",
            parentContainerUid: containerItem.uid,
            slotIndex,
          });
        });
      }
      slotGrid.appendChild(slot);
    }
    containerBody.appendChild(slotGrid);
  };

  const syncOrderFromDock = () => {
    if (!playerContainers) {
      return;
    }
    const wrappersByUid = new Map(openedContainers.map((container) => [container.item.uid, container]));
    const orderedContainers = [];
    for (const element of playerContainers.querySelectorAll(".container-window")) {
      const wrapper = wrappersByUid.get(Number(element.dataset.containerUid));
      if (wrapper) {
        orderedContainers.push(wrapper);
      }
    }
    if (orderedContainers.length === openedContainers.length) {
      openedContainers.splice(0, openedContainers.length, ...orderedContainers);
    }
  };

  const startDockDrag = (event, windowElement) => {
    if (
      dragState.isDragging ||
      event.button !== 0 ||
      event.target.closest("button") ||
      !playerContainers.contains(windowElement)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    windowElement.classList.add("container-window-dragging");
    const pointerId = event.pointerId;
    let lastPointerY = event.clientY;

    const moveWindow = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      moveEvent.preventDefault();
      if (moveEvent.clientY > lastPointerY) {
        let nextWindow = windowElement.nextElementSibling;
        while (nextWindow?.classList.contains("container-window")) {
          if (moveEvent.clientY < nextWindow.getBoundingClientRect().top) {
            break;
          }
          playerContainers.insertBefore(windowElement, nextWindow.nextElementSibling);
          nextWindow = windowElement.nextElementSibling;
        }
      } else if (moveEvent.clientY < lastPointerY) {
        let previousWindow = windowElement.previousElementSibling;
        while (previousWindow?.classList.contains("container-window")) {
          if (moveEvent.clientY > previousWindow.getBoundingClientRect().bottom) {
            break;
          }
          playerContainers.insertBefore(windowElement, previousWindow);
          previousWindow = windowElement.previousElementSibling;
        }
      }
      lastPointerY = moveEvent.clientY;
    };

    const finishWindowMove = (finishEvent) => {
      if (finishEvent.type !== "blur" && finishEvent.pointerId !== pointerId) {
        return;
      }
      windowElement.classList.remove("container-window-dragging");
      document.removeEventListener("pointermove", moveWindow, true);
      document.removeEventListener("pointerup", finishWindowMove, true);
      document.removeEventListener("pointercancel", finishWindowMove, true);
      window.removeEventListener("blur", finishWindowMove);
      syncOrderFromDock();
    };

    document.addEventListener("pointermove", moveWindow, true);
    document.addEventListener("pointerup", finishWindowMove, true);
    document.addEventListener("pointercancel", finishWindowMove, true);
    window.addEventListener("blur", finishWindowMove, { once: true });
  };

  const getContainerDockHeightLimit = () => {
    if (!isMobileGameLayout()) {
      return playerContainers.clientHeight;
    }

    const dockStyle = window.getComputedStyle(playerContainers);
    const containingHeight = playerContainers.offsetParent?.clientHeight ?? window.visualViewport?.height ?? window.innerHeight;
    const topInset = Number.parseFloat(dockStyle.top);
    const bottomInset = Number.parseFloat(dockStyle.bottom);
    const configuredMaxHeight = Number.parseFloat(dockStyle.maxHeight);
    const availableHeight =
      Number.isFinite(containingHeight) && Number.isFinite(topInset) && Number.isFinite(bottomInset)
        ? containingHeight - topInset - bottomInset
        : playerContainers.clientHeight;

    return Number.isFinite(configuredMaxHeight)
      ? Math.min(availableHeight, configuredMaxHeight)
      : availableHeight;
  };

  const startResize = (event, windowElement, container, resizeHandle) => {
    if (dragState.isDragging || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startPointerY = event.clientY;
    const startHeight = windowElement.getBoundingClientRect().height;
    const dockHeightLimit = getContainerDockHeightLimit();
    const contentMaxHeight = Number.isFinite(container.maxWindowHeight) ? container.maxWindowHeight : dockHeightLimit;
    const maxHeight = Math.max(70, Math.min(contentMaxHeight, dockHeightLimit));
    resizeHandle.setPointerCapture(event.pointerId);

    const resizeWindow = (moveEvent) => {
      const nextHeight = clamp(startHeight + moveEvent.clientY - startPointerY, 70, maxHeight);
      windowElement.style.height = `${nextHeight}px`;
      container.windowHeight = nextHeight;
    };

    const finishResize = (finishEvent) => {
      resizeHandle.removeEventListener("pointermove", resizeWindow);
      resizeHandle.removeEventListener("pointerup", finishResize);
      resizeHandle.removeEventListener("pointercancel", finishResize);
      if (resizeHandle.hasPointerCapture(finishEvent.pointerId)) {
        resizeHandle.releasePointerCapture(finishEvent.pointerId);
      }
    };

    resizeHandle.addEventListener("pointermove", resizeWindow);
    resizeHandle.addEventListener("pointerup", finishResize, { once: true });
    resizeHandle.addEventListener("pointercancel", finishResize, { once: true });
  };

  const applyHeightBounds = (windowElement, bodyElement, container) => {
    const currentWindowHeight = windowElement.getBoundingClientRect().height;
    const windowChromeHeight = currentWindowHeight - bodyElement.clientHeight;
    const slotGridHeight = bodyElement.querySelector(".container-slot-grid")?.getBoundingClientRect().height ?? 0;
    const bodyStyle = window.getComputedStyle(bodyElement);
    const bodyVerticalPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    const contentHeight = Math.ceil(windowChromeHeight + bodyVerticalPadding + slotGridHeight);
    const maxWindowHeight = Math.max(70, Math.min(contentHeight, getContainerDockHeightLimit()));
    const requestedHeight = Number.isFinite(container.windowHeight) ? container.windowHeight : maxWindowHeight;
    const resolvedHeight = clamp(requestedHeight, 70, maxWindowHeight);
    Object.assign(container, { maxWindowHeight, windowHeight: resolvedHeight });
    windowElement.style.maxHeight = `${maxWindowHeight}px`;
    windowElement.style.height = `${resolvedHeight}px`;
  };

  const close = (containerItem) => {
    const index = findIndexByUid(containerItem?.uid);
    if (index === -1) {
      return false;
    }
    openedContainers.splice(index, 1);
    render();
    return true;
  };

  const open = (containerItem, title, sourceType, parent) => {
    if (!isContainerItem(containerItem) || !isOpenableContainerItem(containerItem)) {
      return false;
    }
    if (sourceType === "world") {
      const rootItem = parent ? getRootWrapper(parent)?.item : containerItem;
      if (!rootItem || rootItem.z !== playerState.z || !isNearPlayer(rootItem, 1)) {
        return false;
      }
    }
    if (findWrapperByUid(containerItem.uid)) {
      close(containerItem);
      return true;
    }
    openedContainers.push({
      itemUid: containerItem.uid,
      item: containerItem,
      title,
      isMinimized: false,
      sourceType,
      parent,
      parentUid: parent ? getWrapperUid(parent) : null,
      windowHeight: null,
      maxWindowHeight: null,
    });
    render();
    return true;
  };

  const render = () => {
    if (!playerContainers) {
      return;
    }
    playerContainers.innerHTML = "";
    for (let index = openedContainers.length - 1; index >= 0; index--) {
      if (!getCurrentContainerItem(openedContainers[index])) {
        openedContainers.splice(index, 1);
      }
    }

    for (const container of openedContainers) {
      const containerItem = getCurrentContainerItem(container);
      if (!containerItem) {
        continue;
      }

      let body = null;
      const windowElement = document.createElement("div");
      windowElement.classList.add("container-window", `container-window-${container.sourceType}`);
      windowElement.dataset.containerUid = containerItem.uid;

      const header = document.createElement("div");
      header.classList.add("container-window-header");
      header.addEventListener("pointerdown", (event) => startDockDrag(event, windowElement));

      const title = document.createElement("div");
      title.classList.add("boite-jeux-titre");
      title.textContent = getLocalizedItemName(containerItem.itemId);
      header.appendChild(title);

      if (container.parent) {
        const backButton = document.createElement("button");
        backButton.classList.add("container-back-button");
        backButton.textContent = "\u2039";
        backButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const parentWrapper = container.parent;
          const parentUid = getWrapperUid(parentWrapper);

          close(containerItem);

          const parentAlreadyOpen = findWrapperByUid(parentUid);
          if (parentAlreadyOpen) {
            parentAlreadyOpen.isMinimized = false;
            render();
            return;
          }

          const parentItem = getCurrentContainerItem(parentWrapper);
          if (parentItem) {
            open(parentItem, parentWrapper.title, parentWrapper.sourceType, parentWrapper.parent);
          }
        });
        header.appendChild(backButton);
      }

      const minimizeButton = document.createElement("button");
      minimizeButton.classList.add("container-minimize-button");
      minimizeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        container.isMinimized = !container.isMinimized;
        render();
      });

      const closeButton = document.createElement("button");
      closeButton.classList.add("container-minimize-button");
      closeButton.textContent = "X";
      closeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        close(containerItem);
      });

      header.append(minimizeButton, closeButton);

      if (container.isMinimized) {
        windowElement.classList.add("container-window-minimized");
        minimizeButton.textContent = "+";
        windowElement.appendChild(header);
      } else {
        if (Number.isFinite(container.windowHeight)) {
          windowElement.style.height = `${container.windowHeight}px`;
        }
        minimizeButton.textContent = "-";
        const separator = document.createElement("div");
        separator.classList.add("separateur-panneau");
        body = document.createElement("div");
        body.classList.add("container-window-body");
        renderSlots(body, containerItem);
        const resizeHandle = document.createElement("div");
        resizeHandle.classList.add("container-window-resize-handle");
        resizeHandle.addEventListener("pointerdown", (event) =>
          startResize(event, windowElement, container, resizeHandle),
        );
        windowElement.append(header, separator, body, resizeHandle);
      }

      playerContainers.appendChild(windowElement);
      if (body) {
        applyHeightBounds(windowElement, body, container);
      }
    }
    mobileGameControls?.classList.toggle("mobile-game-controls-container-open", openedContainers.length > 0);
    syncMobileBackpackButton();
    syncItemUseSourceFeedback();
  };

  const closeAll = () => {
    openedContainers.length = 0;
    refreshInventoryUi();
  };

  const closeWithChildren = (containerToClose) => {
    if (!containerToClose) {
      return;
    }
    let wasClosed = false;
    for (let index = openedContainers.length - 1; index >= 0; index--) {
      const wrapper = openedContainers[index];
      if (wrapper.item.uid === containerToClose.uid || isChildOf(wrapper, containerToClose)) {
        openedContainers.splice(index, 1);
        wasClosed = true;
      }
    }
    if (wasClosed) {
      render();
    }
  };

  const toggleMinimized = (containerItem) => {
    const wrapper = findWrapperByUid(containerItem?.uid);
    if (!wrapper) {
      return false;
    }
    wrapper.isMinimized = !wrapper.isMinimized;
    render();
    return true;
  };

  return {
    close,
    closeAll,
    closeWithChildren,
    findIndexByUid,
    findItemByUid: (containerUid) => findWrapperByUid(containerUid)?.item ?? null,
    findWrapperByUid,
    getRootWrapper,
    open,
    render,
    renderSlots,
    toggleMinimized,
  };
};
