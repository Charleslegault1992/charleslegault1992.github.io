import { QUEST_STATUS } from "../data/questsDatabase.js";
import { getGameUiText, getLocalizedQuestData } from "../localization/gameLocalization.js";
import { getQuestData } from "../quests/questProgress.js";
import { questUiState, spellUiState } from "../state/clientRuntimeState.js";
import { gameOptionsUiState } from "../state/gameOptionsState.js";
import { playerState } from "../state/playerState.js";
import { playerInventory, playerQuests } from "./domRefs.js";

export const createQuestWindowController = ({ updatePlayerInventory }) => {
  const getEntries = () => {
    if (!playerState.progress?.questsById) {
      return [];
    }
    return Object.values(playerState.progress.questsById)
      .filter((questState) => getQuestData(questState.questId))
      .sort((firstQuest, secondQuest) => {
        if (firstQuest.status !== secondQuest.status) {
          return firstQuest.status === QUEST_STATUS.started ? -1 : 1;
        }
        return firstQuest.startedAt - secondQuest.startedAt;
      });
  };

  const close = () => {
    questUiState.isOpen = false;
    updatePlayerInventory();
  };

  const render = () => {
    if (!playerQuests) {
      return;
    }
    playerQuests.hidden = !questUiState.isOpen;
    playerQuests.innerHTML = "";
    if (!questUiState.isOpen) {
      return;
    }

    const wrapperElement = document.createElement("div");
    wrapperElement.classList.add("boite-boite");
    const headerElement = document.createElement("div");
    headerElement.classList.add("quest-window-header");
    const titleElement = document.createElement("div");
    titleElement.classList.add("boite-jeux-titre");
    titleElement.textContent = getGameUiText("quests");
    const closeButtonElement = document.createElement("button");
    closeButtonElement.classList.add("quest-window-close-button");
    closeButtonElement.type = "button";
    closeButtonElement.textContent = "x";
    closeButtonElement.title = getGameUiText("closeQuests");
    closeButtonElement.setAttribute("aria-label", getGameUiText("closeQuests"));
    closeButtonElement.addEventListener("click", close);
    headerElement.append(titleElement, closeButtonElement);

    const separatorElement = document.createElement("div");
    separatorElement.classList.add("separateur-panneau");
    const questListElement = document.createElement("div");
    questListElement.classList.add("quest-list");
    const entries = getEntries();
    if (entries.length === 0) {
      const emptyElement = document.createElement("div");
      emptyElement.classList.add("quest-list-empty");
      emptyElement.textContent = getGameUiText("noQuests");
      questListElement.appendChild(emptyElement);
    } else {
      for (const questState of entries) {
        const questData = getLocalizedQuestData(questState.questId);
        const rowElement = document.createElement("div");
        rowElement.classList.add("quest-list-row", `quest-list-row-${questState.status}`);
        const nameElement = document.createElement("span");
        nameElement.classList.add("quest-list-name");
        nameElement.textContent = questData.name;
        const statusElement = document.createElement("span");
        statusElement.classList.add("quest-list-status");
        statusElement.textContent =
          questState.status === QUEST_STATUS.completed
            ? getGameUiText("questCompleted")
            : getGameUiText("questStarted");
        rowElement.append(nameElement, statusElement);
        questListElement.appendChild(rowElement);
      }
    }
    wrapperElement.append(headerElement, separatorElement, questListElement);
    playerQuests.appendChild(wrapperElement);
  };

  const toggle = () => {
    questUiState.isOpen = !questUiState.isOpen;
    if (questUiState.isOpen) {
      gameOptionsUiState.isOpen = false;
      spellUiState.isOpen = false;
    }
    updatePlayerInventory();
  };

  const bindButton = () => {
    playerInventory?.querySelector('[data-ui-action="toggle-quests"]')?.addEventListener("click", toggle);
  };

  return { bindButton, close, getEntries, render, toggle };
};
