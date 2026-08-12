import {
  createCharacterProfile,
  DEFAULT_CHARACTER_APPEARANCE_COLORS,
  DEFAULT_CHARACTER_APPEARANCE_PARTS,
  deleteCharacterProfile,
  listCharacterProfiles,
  normalizeCharacterAppearanceColors,
  normalizeCharacterAppearanceParts,
  setActiveCharacterId,
} from "../characterSaveStore.js";
import { getGameUiText, getLocalizedContentData } from "../localization/gameLocalization.js";
import {
  applyPlayerAppearanceBackground,
  clearPlayerAppearanceColorTextureCache,
  DEFAULT_PLAYER_APPEARANCE_ID,
  getPlayerAppearanceData,
  playerAppearancePartsDatabase,
  playerAppearancesDatabase,
} from "../player/playerAppearance.js";
import { getLevelFromExperience } from "../player/playerProgression.js";
import {
  characterSelectorUiState,
  gameRuntimeState,
  questUiState,
} from "../state/clientRuntimeState.js";
import { gameOptionsUiState } from "../state/gameOptionsState.js";
import { playerState } from "../state/playerState.js";
import {
  characterSelector,
  gameWelcome,
  gameWelcomeLanguageButtons,
  gameWelcomePlayButton,
} from "./domRefs.js";

export const ENTER_GAME_AFTER_RELOAD_SESSION_KEY = "no-name-yet:enter-game-after-reload";

export const createCharacterSelectorController = ({
  applyGameLanguageUi,
  cancelItemDrag,
  cancelItemUse,
  renderOptionsWindow,
  renderQuestWindow,
  resetMobileJoystick,
  saveBeforeSwitch,
  setGameLanguage,
  setOpenMobilePanel,
  showGameStatusMessage,
  startGame,
  stopPlayerNavigation,
  unlockGameAudio,
  windowObject = window,
}) => {
  const getCharacterSelectorErrorMessage = (reason) => {
    const messagesByReason = {
      "invalid-name": getGameUiText("invalidCharacterName"),
      "invalid-appearance": getGameUiText("invalidAppearance"),
      "duplicate-name": getGameUiText("duplicateCharacterName"),
      "storage-error": getGameUiText("characterStorageError"),
      "corrupted-save": getGameUiText("corruptedSave"),
      "unsupported-save": getGameUiText("unsupportedSave"),
      "not-found": getGameUiText("characterNotFound"),
    };
    return messagesByReason[reason] ?? getGameUiText("characterOperationFailed");
  };

  const closeCharacterSelector = () => {
    characterSelectorUiState.isOpen = false;
    characterSelectorUiState.view = "list";
    renderCharacterSelector();
  };

  const reloadIntoSelectedCharacter = () => {
    gameRuntimeState.isSwitchingCharacter = true;
    try {
      sessionStorage.setItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY, "true");
    } catch {
      // The reload still uses the active character saved in local storage.
    }
    windowObject.location.reload();
  };

  const startSelectedCharacterGame = async () => {
    if (gameRuntimeState.isStarting || gameRuntimeState.isStarted) {
      return false;
    }
    closeCharacterSelector();
    if (gameWelcome) {
      gameWelcome.hidden = true;
    }
    return startGame();
  };

  const openCharacterSelector = () => {
    if (characterSelectorUiState.isOpen) {
      return;
    }
    characterSelectorUiState.isOpen = true;
    characterSelectorUiState.view = "list";
    if (gameRuntimeState.isStarted) {
      questUiState.isOpen = false;
      gameOptionsUiState.isOpen = false;
      renderQuestWindow();
      renderOptionsWindow();
      resetMobileJoystick();
      setOpenMobilePanel(null);
      stopPlayerNavigation();
      cancelItemDrag();
      cancelItemUse();
    }
    renderCharacterSelector();
  };

  const saveCurrentCharacterBeforeSwitch = () => {
    return saveBeforeSwitch();
  };

  const selectCharacterProfile = (characterId) => {
    if (!gameRuntimeState.isStarted) {
      const selectionResult = setActiveCharacterId(characterId);
      if (!selectionResult.success) {
        showGameStatusMessage(getCharacterSelectorErrorMessage(selectionResult.reason));
        return;
      }
      startSelectedCharacterGame();
      return;
    }

    if (characterId === playerState.uid) {
      closeCharacterSelector();
      return;
    }
    if (!saveCurrentCharacterBeforeSwitch()) {
      return;
    }

    const selectionResult = setActiveCharacterId(characterId);
    if (!selectionResult.success) {
      showGameStatusMessage(getCharacterSelectorErrorMessage(selectionResult.reason));
      return;
    }
    reloadIntoSelectedCharacter();
  };

  const createNewCharacterProfile = (name, appearanceId, appearanceColors, appearanceParts, errorElement) => {
    if (gameRuntimeState.isStarted && !saveCurrentCharacterBeforeSwitch()) {
      errorElement.textContent = getGameUiText("currentCharacterSaveFailed");
      return;
    }

    const creationResult = createCharacterProfile(name, appearanceId, appearanceColors, appearanceParts);
    if (!creationResult.success) {
      errorElement.textContent = getCharacterSelectorErrorMessage(creationResult.reason);
      return;
    }
    if (gameRuntimeState.isStarted) {
      reloadIntoSelectedCharacter();
    } else {
      startSelectedCharacterGame();
    }
  };

  const deleteExistingCharacterProfile = (characterProfile) => {
    if (!characterProfile || !windowObject.confirm(getGameUiText("deleteCharacterConfirm")(characterProfile.name))) {
      return;
    }

    const deletionResult = deleteCharacterProfile(characterProfile.characterId);
    if (!deletionResult.success) {
      showGameStatusMessage(getCharacterSelectorErrorMessage(deletionResult.reason));
      return;
    }

    if (deletionResult.wasActive && gameRuntimeState.isStarted) {
      if (deletionResult.activeCharacterId === null) {
        gameRuntimeState.isSwitchingCharacter = true;
        try {
          sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
        } catch {
          // The welcome screen is still the default after a normal reload.
        }
        windowObject.location.reload();
        return;
      }
      reloadIntoSelectedCharacter();
      return;
    }
    renderCharacterSelector();
  };

  const renderCharacterSelector = () => {
    if (!characterSelector) {
      return;
    }

    characterSelector.hidden = !characterSelectorUiState.isOpen;
    characterSelector.textContent = "";
    if (!characterSelectorUiState.isOpen) {
      return;
    }
    const isCreatingCharacter = characterSelectorUiState.view === "create";

    const windowElement = document.createElement("section");
    windowElement.classList.add("boite-panneau", "character-selector-window");
    if (isCreatingCharacter) {
      windowElement.classList.add("character-selector-window-creation");
    }

    const wrapperElement = document.createElement("div");
    wrapperElement.classList.add("boite-boite");

    const headerElement = document.createElement("div");
    headerElement.classList.add("character-selector-header");
    const titleElement = document.createElement("div");
    titleElement.classList.add("boite-jeux-titre");
    titleElement.textContent = getGameUiText(isCreatingCharacter ? "newCharacter" : "characters");
    const closeButtonElement = document.createElement("button");
    closeButtonElement.classList.add("character-selector-close-button");
    closeButtonElement.type = "button";
    closeButtonElement.textContent = "x";
    closeButtonElement.title = getGameUiText("closeCharacters");
    closeButtonElement.setAttribute("aria-label", getGameUiText("closeCharacters"));
    closeButtonElement.addEventListener("click", closeCharacterSelector);
    if (isCreatingCharacter) {
      const backButtonElement = document.createElement("button");
      backButtonElement.classList.add("character-selector-back-button");
      backButtonElement.type = "button";
      backButtonElement.textContent = "<";
      backButtonElement.title = getGameUiText("backToCharacters");
      backButtonElement.setAttribute("aria-label", getGameUiText("backToCharacters"));
      backButtonElement.addEventListener("click", () => {
        characterSelectorUiState.view = "list";
        renderCharacterSelector();
      });
      headerElement.append(backButtonElement);
    }
    headerElement.append(titleElement, closeButtonElement);

    const separatorElement = document.createElement("div");
    separatorElement.classList.add("separateur-panneau");

    const characterListElement = document.createElement("div");
    characterListElement.classList.add("character-selector-list");
    const profileResult = listCharacterProfiles();
    if (!profileResult.success) {
      const errorElement = document.createElement("div");
      errorElement.classList.add("character-selector-empty");
      errorElement.textContent = getCharacterSelectorErrorMessage(profileResult.reason);
      characterListElement.appendChild(errorElement);
    } else if (profileResult.characters.length === 0) {
      const emptyElement = document.createElement("div");
      emptyElement.classList.add("character-selector-empty");
      emptyElement.textContent = getGameUiText("noCharacters");
      characterListElement.appendChild(emptyElement);
    } else {
      for (const characterProfile of profileResult.characters) {
        const rowElement = document.createElement("div");
        rowElement.classList.add("character-selector-row");
        if (characterProfile.isActive) {
          rowElement.classList.add("character-selector-row-active");
        }

        const selectButtonElement = document.createElement("button");
        selectButtonElement.classList.add("character-selector-select-button");
        selectButtonElement.type = "button";

        const portraitElement = document.createElement("span");
        portraitElement.classList.add("character-selector-portrait");
        void applyPlayerAppearanceBackground(
          portraitElement,
          characterProfile.appearanceParts,
          characterProfile.appearanceColors,
        );

        const identityElement = document.createElement("span");
        identityElement.classList.add("character-selector-identity");
        const nameElement = document.createElement("span");
        nameElement.classList.add("character-selector-name");
        nameElement.textContent = characterProfile.name;
        const levelElement = document.createElement("span");
        levelElement.classList.add("character-selector-level");
        levelElement.textContent = `${getGameUiText("levelLabel")} ${getLevelFromExperience(characterProfile.experience)}`;
        identityElement.append(nameElement, levelElement);

        const statusElement = document.createElement("span");
        statusElement.classList.add("character-selector-current-label");
        statusElement.textContent = characterProfile.isActive ? getGameUiText("current") : getGameUiText("select");
        selectButtonElement.append(portraitElement, identityElement, statusElement);
        selectButtonElement.addEventListener("click", () => {
          selectCharacterProfile(characterProfile.characterId);
        });

        const deleteButtonElement = document.createElement("button");
        deleteButtonElement.classList.add("character-selector-delete-button");
        deleteButtonElement.type = "button";
        deleteButtonElement.textContent = getGameUiText("delete");
        deleteButtonElement.title = getGameUiText("deleteCharacter")(characterProfile.name);
        deleteButtonElement.addEventListener("click", () => {
          deleteExistingCharacterProfile(characterProfile);
        });

        rowElement.append(selectButtonElement, deleteButtonElement);
        characterListElement.appendChild(rowElement);
      }
    }

    const openCreationButtonElement = document.createElement("button");
    openCreationButtonElement.classList.add("character-open-create-button");
    openCreationButtonElement.type = "button";
    openCreationButtonElement.textContent = getGameUiText("newCharacter");
    openCreationButtonElement.addEventListener("click", () => {
      characterSelectorUiState.view = "create";
      renderCharacterSelector();
    });

    const secondSeparatorElement = document.createElement("div");
    secondSeparatorElement.classList.add("separateur-panneau");

    if (!isCreatingCharacter) {
      wrapperElement.append(
        headerElement,
        separatorElement,
        characterListElement,
        secondSeparatorElement,
        openCreationButtonElement,
      );
      windowElement.appendChild(wrapperElement);
      characterSelector.appendChild(windowElement);
      return;
    }

    const formElement = document.createElement("form");
    formElement.classList.add("character-create-form");
    const formTitleElement = document.createElement("div");
    formTitleElement.classList.add("character-create-title");
    formTitleElement.textContent = getGameUiText("newCharacter");
    const nameInputElement = document.createElement("input");
    nameInputElement.classList.add("character-create-input");
    nameInputElement.type = "text";
    nameInputElement.name = "characterName";
    nameInputElement.placeholder = getGameUiText("characterName");
    nameInputElement.minLength = 2;
    nameInputElement.maxLength = 20;
    nameInputElement.autocomplete = "off";
    let selectedAppearanceId = DEFAULT_PLAYER_APPEARANCE_ID;
    let selectedAppearanceColors = normalizeCharacterAppearanceColors(DEFAULT_CHARACTER_APPEARANCE_COLORS);
    let selectedAppearanceParts = normalizeCharacterAppearanceParts(DEFAULT_CHARACTER_APPEARANCE_PARTS);
    const appearanceOptionsElement = document.createElement("div");
    appearanceOptionsElement.classList.add("character-creator-layout");
    const mainPreviewElement = document.createElement("div");
    mainPreviewElement.classList.add("character-creator-preview");
    const controlsElement = document.createElement("div");
    controlsElement.classList.add("character-creator-controls");
    const refreshAppearanceControls = [];

    const refreshAppearancePreviews = () => {
      void applyPlayerAppearanceBackground(mainPreviewElement, selectedAppearanceParts, selectedAppearanceColors);
      for (const refreshAppearanceControl of refreshAppearanceControls) {
        refreshAppearanceControl();
      }
    };

    const createAppearanceChoiceGroup = ({ title, options, getSelectedId, onSelect }) => {
      const groupElement = document.createElement("div");
      groupElement.classList.add("character-creator-choice-group");
      const titleElement = document.createElement("div");
      titleElement.classList.add("character-creator-choice-title");
      titleElement.textContent = title;
      const buttonsElement = document.createElement("div");
      buttonsElement.classList.add("character-creator-choice-buttons");
      const buttonsById = new Map();

      for (const option of options) {
        const buttonElement = document.createElement("button");
        buttonElement.classList.add("character-appearance-option");
        buttonElement.type = "button";
        buttonElement.setAttribute("aria-pressed", "false");
        const labelElement = document.createElement("span");
        labelElement.classList.add("character-appearance-label");
        labelElement.textContent = option.label;
        buttonElement.appendChild(labelElement);
        buttonElement.addEventListener("click", () => {
          onSelect(option.id);
          refreshAppearancePreviews();
        });
        buttonsById.set(option.id, buttonElement);
        buttonsElement.appendChild(buttonElement);
      }

      refreshAppearanceControls.push(() => {
        const selectedId = getSelectedId();
        for (const [optionId, buttonElement] of buttonsById.entries()) {
          const isSelected = optionId === selectedId;
          buttonElement.classList.toggle("character-appearance-option-active", isSelected);
          buttonElement.setAttribute("aria-pressed", String(isSelected));
        }
      });
      groupElement.append(titleElement, buttonsElement);
      return groupElement;
    };

    const createAppearanceCycleControl = ({ title, options, getSelectedId, onSelect }) => {
      const controlElement = document.createElement("div");
      controlElement.classList.add("character-creator-cycle-control");
      const previousButtonElement = document.createElement("button");
      previousButtonElement.classList.add("character-creator-arrow-button");
      previousButtonElement.type = "button";
      previousButtonElement.textContent = "<";
      previousButtonElement.setAttribute("aria-label", `${title} -`);
      const valueElement = document.createElement("div");
      valueElement.classList.add("character-creator-cycle-value");
      const nextButtonElement = document.createElement("button");
      nextButtonElement.classList.add("character-creator-arrow-button");
      nextButtonElement.type = "button";
      nextButtonElement.textContent = ">";
      nextButtonElement.setAttribute("aria-label", `${title} +`);

      const selectOffset = (offset) => {
        const selectedIndex = options.findIndex((option) => option.id === getSelectedId());
        const nextIndex = (selectedIndex + offset + options.length) % options.length;
        onSelect(options[nextIndex].id);
        refreshAppearancePreviews();
      };
      previousButtonElement.addEventListener("click", () => selectOffset(-1));
      nextButtonElement.addEventListener("click", () => selectOffset(1));
      refreshAppearanceControls.push(() => {
        const selectedOption = options.find((option) => option.id === getSelectedId()) ?? options[0];
        valueElement.textContent = `${title} ${selectedOption.label}`;
      });
      controlElement.append(previousButtonElement, valueElement, nextButtonElement);
      return controlElement;
    };

    const sexChoiceElement = createAppearanceChoiceGroup({
      title: getGameUiText("sex"),
      options: Object.values(playerAppearancesDatabase).map((appearanceData) => ({
        id: appearanceData.appearanceId,
        label: getLocalizedContentData("appearances", appearanceData.appearanceId, appearanceData).label,
      })),
      getSelectedId: () => selectedAppearanceId,
      onSelect: (appearanceId) => {
        selectedAppearanceId = getPlayerAppearanceData(appearanceId).appearanceId;
      },
    });
    controlsElement.append(
      createAppearanceCycleControl({
        title: getGameUiText("head"),
        options: [playerAppearancePartsDatabase.head, playerAppearancePartsDatabase.head1].map((partData) => ({
          id: partData.partId,
          label: partData.label,
        })),
        getSelectedId: () => selectedAppearanceParts.headId,
        onSelect: (headId) => {
          selectedAppearanceParts = normalizeCharacterAppearanceParts({ ...selectedAppearanceParts, headId });
        },
      }),
      createAppearanceCycleControl({
        title: getGameUiText("body"),
        options: [playerAppearancePartsDatabase.body, playerAppearancePartsDatabase.body2].map((partData) => ({
          id: partData.partId,
          label: partData.label,
        })),
        getSelectedId: () => selectedAppearanceParts.bodyId,
        onSelect: (bodyId) => {
          selectedAppearanceParts = normalizeCharacterAppearanceParts({ ...selectedAppearanceParts, bodyId });
        },
      }),
    );
    appearanceOptionsElement.append(sexChoiceElement, mainPreviewElement, controlsElement);
    refreshAppearancePreviews();

    const colorOptionsElement = document.createElement("div");
    colorOptionsElement.classList.add("character-color-options");
    const createColorControl = (colorKey, labelText) => {
      const labelElement = document.createElement("label");
      labelElement.classList.add("character-color-control");
      const labelTextElement = document.createElement("span");
      labelTextElement.textContent = labelText;
      const inputElement = document.createElement("input");
      inputElement.classList.add("character-color-input");
      inputElement.type = "color";
      inputElement.value = selectedAppearanceColors[colorKey];
      inputElement.addEventListener("input", () => {
        clearPlayerAppearanceColorTextureCache(colorKey, selectedAppearanceColors[colorKey]);
        selectedAppearanceColors = normalizeCharacterAppearanceColors({
          ...selectedAppearanceColors,
          [colorKey]: inputElement.value,
        });
        refreshAppearancePreviews();
      });
      labelElement.append(labelTextElement, inputElement);
      return labelElement;
    };
    colorOptionsElement.append(
      createColorControl("hair", getGameUiText("hairColor")),
      createColorControl("clothes", getGameUiText("clothesColor")),
      createColorControl("pants", getGameUiText("pantsColor")),
      createColorControl("shoes", getGameUiText("shoesColor")),
    );

    const createButtonElement = document.createElement("button");
    createButtonElement.classList.add("character-create-button");
    createButtonElement.type = "submit";
    createButtonElement.textContent = getGameUiText("create");
    const formErrorElement = document.createElement("div");
    formErrorElement.classList.add("character-selector-error");

    formElement.append(
      formTitleElement,
      appearanceOptionsElement,
      colorOptionsElement,
      nameInputElement,
      createButtonElement,
      formErrorElement,
    );
    formElement.addEventListener("submit", (event) => {
      event.preventDefault();
      createNewCharacterProfile(
        nameInputElement.value,
        selectedAppearanceId,
        selectedAppearanceColors,
        selectedAppearanceParts,
        formErrorElement,
      );
    });

    wrapperElement.append(headerElement, separatorElement, formElement);
    windowElement.appendChild(wrapperElement);
    characterSelector.appendChild(windowElement);
    nameInputElement.focus();
  };

  const toggleCharacterSelector = () => {
    if (characterSelectorUiState.isOpen) {
      closeCharacterSelector();
    } else {
      openCharacterSelector();
    }
  };

  const initializeGameWelcome = () => {
    if (!gameWelcome || !gameWelcomePlayButton) {
      return true;
    }

    let shouldEnterGame = false;
    try {
      shouldEnterGame = sessionStorage.getItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY) === "true";
      sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
    } catch {
      shouldEnterGame = false;
    }
    gameWelcome.hidden = shouldEnterGame;
    applyGameLanguageUi();

    gameWelcome.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    gameWelcome.addEventListener("mouseup", (event) => {
      event.stopPropagation();
    });
    gameWelcome.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    gameWelcome.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    gameWelcomePlayButton.addEventListener("click", () => {
      unlockGameAudio();
      openCharacterSelector();
    });
    for (const languageButton of gameWelcomeLanguageButtons) {
      languageButton.addEventListener("click", () => {
        setGameLanguage(languageButton.dataset.gameLanguage);
      });
    }
    return shouldEnterGame;
  };


  return {
    close: closeCharacterSelector,
    initializeWelcome: initializeGameWelcome,
    open: openCharacterSelector,
    render: renderCharacterSelector,
    saveBeforeSwitch: saveCurrentCharacterBeforeSwitch,
    toggle: toggleCharacterSelector,
  };
};
