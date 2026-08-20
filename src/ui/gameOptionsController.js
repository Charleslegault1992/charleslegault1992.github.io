import { MINIMAP_ZOOM_LEVELS } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { getCurrentGameLanguage, getGameUiText } from "../localization/gameLocalization.js";
import { characterSelectorUiState, gameRuntimeState, questUiState, spellUiState } from "../state/clientRuntimeState.js";
import {
  DEFAULT_GAME_OPTIONS,
  GAME_OPTIONS_STORAGE_KEY,
  gameOptionsUiState,
  SUPPORTED_GAME_LANGUAGES,
} from "../state/gameOptionsState.js";
import {
  fpsCounter,
  game,
  gameOptionsWindow,
  gameWelcomeLanguageButtons,
  gameWelcomePlayButton,
} from "./domRefs.js";

const BOOLEAN_OPTIONS = [
  { key: "showFps", labelKey: "showFps" },
  { key: "showCreatureNames", labelKey: "showCreatureNames" },
  { key: "showHealthBars", labelKey: "showHealthBars" },
  { key: "musicEnabled", labelKey: "musicEnabled" },
  { key: "sfxEnabled", labelKey: "sfxEnabled" },
];

const VOLUME_OPTIONS = [
  { key: "musicVolume", labelKey: "musicVolume" },
  { key: "sfxVolume", labelKey: "sfxVolume" },
];

export const createGameOptionsController = ({
  renderCharacterSelector,
  renderPlayerMinimap,
  renderWorldLabels,
  resetPlayerStatsUi,
  setAudioSettings,
  setMinimapZoom,
  refreshChatUi,
  updatePlayerInventory,
  updatePlayerStats,
}) => {
  const save = () => {
    try {
      localStorage.setItem(GAME_OPTIONS_STORAGE_KEY, JSON.stringify(gameOptionsUiState.values));
      return true;
    } catch {
      return false;
    }
  };

  const applyLanguageUi = () => {
    const language = getCurrentGameLanguage();
    document.documentElement.lang = language;
    if (gameWelcomePlayButton) {
      gameWelcomePlayButton.textContent = getGameUiText("play");
    }
    for (const button of gameWelcomeLanguageButtons) {
      const isActive = button.dataset.gameLanguage === language;
      button.classList.toggle("game-welcome-language-button-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    for (const element of document.querySelectorAll("[data-game-text]")) {
      element.textContent = getGameUiText(element.dataset.gameText);
    }
    for (const element of document.querySelectorAll("[data-game-title]")) {
      const title = getGameUiText(element.dataset.gameTitle);
      element.title = title;
      element.setAttribute("aria-label", title);
    }
  };

  const apply = () => {
    if (fpsCounter) {
      fpsCounter.style.display = gameOptionsUiState.values.showFps ? "" : "none";
    }
    game?.classList.toggle("game-hide-creature-names", !gameOptionsUiState.values.showCreatureNames);
    game?.classList.toggle("game-hide-health-bars", !gameOptionsUiState.values.showHealthBars);
    setAudioSettings(gameOptionsUiState.values);
    if (MINIMAP_ZOOM_LEVELS.includes(gameOptionsUiState.values.minimapCellSize)) {
      setMinimapZoom(gameOptionsUiState.values.minimapCellSize, false);
    }
    applyLanguageUi();
    if (gameRuntimeState.isStarted) {
      renderPlayerMinimap(true);
    }
  };

  const refreshLanguageDependentUi = () => {
    applyLanguageUi();
    if (characterSelectorUiState.isOpen) {
      renderCharacterSelector();
    }
    if (gameRuntimeState.isStarted) {
      resetPlayerStatsUi();
      updatePlayerStats();
      refreshChatUi();
      updatePlayerInventory();
      renderWorldLabels();
    } else if (gameOptionsUiState.isOpen) {
      render();
    }
  };

  const setLanguage = (language) => {
    if (!SUPPORTED_GAME_LANGUAGES.has(language)) {
      return false;
    }
    gameOptionsUiState.values.language = language;
    save();
    refreshLanguageDependentUi();
    return true;
  };

  const setBoolean = (optionKey, enabled) => {
    if (!(optionKey in DEFAULT_GAME_OPTIONS) || typeof enabled !== "boolean") {
      return false;
    }
    gameOptionsUiState.values[optionKey] = enabled;
    save();
    apply();
    return true;
  };

  const setVolume = (optionKey, volume) => {
    if (!(optionKey in DEFAULT_GAME_OPTIONS) || !Number.isFinite(volume)) {
      return false;
    }
    gameOptionsUiState.values[optionKey] = clamp(volume, 0, 1);
    save();
    apply();
    return true;
  };

  const close = () => {
    gameOptionsUiState.isOpen = false;
    updatePlayerInventory();
  };

  const render = () => {
    if (!gameOptionsWindow) {
      return;
    }
    gameOptionsWindow.hidden = !gameOptionsUiState.isOpen;
    gameOptionsWindow.textContent = "";
    if (!gameOptionsUiState.isOpen) {
      return;
    }

    const wrapperElement = document.createElement("div");
    wrapperElement.classList.add("boite-boite");
    const headerElement = document.createElement("div");
    headerElement.classList.add("options-window-header");
    const titleElement = document.createElement("div");
    titleElement.classList.add("boite-jeux-titre");
    titleElement.textContent = getGameUiText("options");
    const closeButtonElement = document.createElement("button");
    closeButtonElement.classList.add("options-window-close-button");
    closeButtonElement.type = "button";
    closeButtonElement.textContent = "x";
    closeButtonElement.title = getGameUiText("closeOptions");
    closeButtonElement.setAttribute("aria-label", getGameUiText("closeOptions"));
    closeButtonElement.addEventListener("click", close);
    headerElement.append(titleElement, closeButtonElement);

    const separatorElement = document.createElement("div");
    separatorElement.classList.add("separateur-panneau");
    const listElement = document.createElement("div");
    listElement.classList.add("options-list");
    for (const definition of BOOLEAN_OPTIONS) {
      const row = document.createElement("label");
      row.classList.add("options-row");
      const label = document.createElement("span");
      label.textContent = getGameUiText(definition.labelKey);
      const input = document.createElement("input");
      input.classList.add("options-toggle");
      input.type = "checkbox";
      input.checked = gameOptionsUiState.values[definition.key];
      input.addEventListener("change", () => setBoolean(definition.key, input.checked));
      row.append(label, input);
      listElement.appendChild(row);
    }
    for (const definition of VOLUME_OPTIONS) {
      const row = document.createElement("label");
      row.classList.add("options-row");
      const label = document.createElement("span");
      label.textContent = getGameUiText(definition.labelKey);
      const input = document.createElement("input");
      input.classList.add("options-volume-slider");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = "0.05";
      input.value = String(gameOptionsUiState.values[definition.key]);
      input.addEventListener("input", () => setVolume(definition.key, Number(input.value)));
      row.append(label, input);
      listElement.appendChild(row);
    }

    const languageRow = document.createElement("label");
    languageRow.classList.add("options-row");
    const languageLabel = document.createElement("span");
    languageLabel.textContent = getGameUiText("language");
    const languageSelect = document.createElement("select");
    languageSelect.classList.add("options-language-select");
    for (const language of [{ id: "en", labelKey: "english" }, { id: "fr", labelKey: "french" }]) {
      const option = document.createElement("option");
      option.value = language.id;
      option.textContent = getGameUiText(language.labelKey);
      languageSelect.appendChild(option);
    }
    languageSelect.value = getCurrentGameLanguage();
    languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));
    languageRow.append(languageLabel, languageSelect);
    listElement.appendChild(languageRow);

    const resetButton = document.createElement("button");
    resetButton.classList.add("options-reset-button");
    resetButton.type = "button";
    resetButton.textContent = getGameUiText("restoreDefaults");
    resetButton.addEventListener("click", () => {
      gameOptionsUiState.values = { ...DEFAULT_GAME_OPTIONS };
      save();
      apply();
      refreshLanguageDependentUi();
    });
    wrapperElement.append(headerElement, separatorElement, listElement, resetButton);
    gameOptionsWindow.appendChild(wrapperElement);
  };

  const toggle = () => {
    gameOptionsUiState.isOpen = !gameOptionsUiState.isOpen;
    if (gameOptionsUiState.isOpen) {
      questUiState.isOpen = false;
      spellUiState.isOpen = false;
    }
    updatePlayerInventory();
  };

  return { apply, applyLanguageUi, close, refreshLanguageDependentUi, render, save, setLanguage, toggle };
};
