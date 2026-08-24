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
import { renderGoogleIdentityButton } from "../network/googleIdentityClient.js";
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
export const OPEN_CHARACTER_SELECTOR_AFTER_RELOAD_SESSION_KEY = "no-name-yet:open-character-selector-after-reload";

export const createCharacterSelectorController = ({
  accountSession = null,
  googleClientId = "",
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
  const isOnlineAccountMode = accountSession !== null;
  let onlineCharacters = [];
  let onlineCharactersLoading = false;
  let onlineCharactersError = null;

  const getCharacterSelectorErrorMessage = (reason) => {
    const messagesByReason = {
      "invalid-name": getGameUiText("invalidCharacterName"),
      "invalid-appearance": getGameUiText("invalidAppearance"),
      "duplicate-name": getGameUiText("duplicateCharacterName"),
      "storage-error": getGameUiText("characterStorageError"),
      "corrupted-save": getGameUiText("corruptedSave"),
      "unsupported-save": getGameUiText("unsupportedSave"),
      "not-found": getGameUiText("characterNotFound"),
      "authentication-required": getGameUiText("authenticationRequired"),
      "invalid-credentials": getGameUiText("invalidCredentials"),
      "invalid-account": getGameUiText("invalidAccount"),
      "invalid-email": getGameUiText("invalidEmail"),
      "account-already-exists": getGameUiText("accountAlreadyExists"),
      "email-already-exists": getGameUiText("emailAlreadyExists"),
      "character-name-taken": getGameUiText("duplicateCharacterName"),
      "character-online": getGameUiText("characterOnline"),
      "too-many-attempts": getGameUiText("tooManyLoginAttempts"),
      "google-auth-failed": getGameUiText("googleAuthFailed"),
      "google-auth-unavailable": getGameUiText("googleAuthUnavailable"),
      "external-account-creation-failed": getGameUiText("googleAuthFailed"),
      "connection-error": getGameUiText("connectionError"),
    };
    return messagesByReason[reason] ?? getGameUiText("characterOperationFailed");
  };

  const closeCharacterSelector = () => {
    characterSelectorUiState.isOpen = false;
    characterSelectorUiState.view = "list";
    renderCharacterSelector();
  };

  const applyOnlineCharacterIdentity = (character) => {
    if (!character || typeof character.characterId !== "string") {
      return false;
    }
    playerState.uid = character.characterId;
    playerState.name = character.name;
    playerState.appearanceId = getPlayerAppearanceData(character.appearanceId).appearanceId;
    playerState.appearanceParts = normalizeCharacterAppearanceParts(
      character.appearanceParts,
      playerState.appearanceId,
    );
    playerState.appearanceColors = normalizeCharacterAppearanceColors(character.appearanceColors);
    return accountSession.selectCharacter(character);
  };

  const refreshOnlineCharacters = async () => {
    if (!isOnlineAccountMode || !accountSession.isAuthenticated() || onlineCharactersLoading) {
      return;
    }
    onlineCharactersLoading = true;
    onlineCharactersError = null;
    renderCharacterSelector();
    const result = await accountSession.listCharacters().catch(() => ({ success: false, reason: "connection-error" }));
    onlineCharactersLoading = false;
    if (!result.success) {
      onlineCharacters = [];
      onlineCharactersError = result.reason;
      if (!accountSession.isAuthenticated()) {
        characterSelectorUiState.view = "auth-choice";
      }
    } else {
      onlineCharacters = result.characters;
    }
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
    return startGame();
  };

  const openCharacterSelector = () => {
    if (characterSelectorUiState.isOpen) {
      return;
    }
    characterSelectorUiState.isOpen = true;
    characterSelectorUiState.view =
      isOnlineAccountMode && !accountSession.isAuthenticated() ? "auth-choice" : "list";
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
    if (isOnlineAccountMode && accountSession.isAuthenticated()) {
      void refreshOnlineCharacters();
    }
  };

  const saveCurrentCharacterBeforeSwitch = () => {
    return saveBeforeSwitch();
  };

  const selectCharacterProfile = (characterId) => {
    if (isOnlineAccountMode) {
      const character = onlineCharacters.find((entry) => entry.characterId === characterId);
      if (!applyOnlineCharacterIdentity(character)) {
        showGameStatusMessage(getGameUiText("characterNotFound"));
        return;
      }
      if (gameRuntimeState.isStarted) {
        reloadIntoSelectedCharacter();
      } else {
        startSelectedCharacterGame();
      }
      return;
    }
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

  const createNewCharacterProfile = async (name, appearanceId, appearanceColors, appearanceParts, errorElement) => {
    if (isOnlineAccountMode) {
      const creationResult = await accountSession.createCharacter({
        name,
        appearanceId,
        appearanceColors,
        appearanceParts,
      }).catch(() => ({ success: false, reason: "connection-error" }));
      if (!creationResult.success) {
        errorElement.textContent = getCharacterSelectorErrorMessage(creationResult.reason);
        return;
      }
      characterSelectorUiState.view = "list";
      await refreshOnlineCharacters();
      return;
    }
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

  const deleteExistingCharacterProfile = async (characterProfile) => {
    if (!characterProfile || !windowObject.confirm(getGameUiText("deleteCharacterConfirm")(characterProfile.name))) {
      return;
    }

    if (isOnlineAccountMode) {
      const deletionResult = await accountSession.deleteCharacter(characterProfile.characterId)
        .catch(() => ({ success: false, reason: "connection-error" }));
      if (!deletionResult.success) {
        showGameStatusMessage(getCharacterSelectorErrorMessage(deletionResult.reason));
        return;
      }
      onlineCharacters = onlineCharacters.filter((entry) => entry.characterId !== characterProfile.characterId);
      renderCharacterSelector();
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
    const isAuthChoice = characterSelectorUiState.view === "auth-choice";
    const isLogin = characterSelectorUiState.view === "login";
    const isRegistering = characterSelectorUiState.view === "register";
    const isAuthenticating = isAuthChoice || isLogin || isRegistering;

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
    const titleKey = isAuthChoice
      ? "accountAccess"
      : (isLogin ? "login" : (isRegistering ? "register" : (isCreatingCharacter ? "newCharacter" : "characters")));
    titleElement.textContent = getGameUiText(titleKey);
    const closeButtonElement = document.createElement("button");
    closeButtonElement.classList.add("character-selector-close-button");
    closeButtonElement.type = "button";
    closeButtonElement.textContent = "x";
    closeButtonElement.title = getGameUiText("closeCharacters");
    closeButtonElement.setAttribute("aria-label", getGameUiText("closeCharacters"));
    closeButtonElement.addEventListener("click", closeCharacterSelector);
    if (isCreatingCharacter || isLogin || isRegistering) {
      const backButtonElement = document.createElement("button");
      backButtonElement.classList.add("character-selector-back-button");
      backButtonElement.type = "button";
      backButtonElement.textContent = "<";
      const backButtonLabel = getGameUiText(isCreatingCharacter ? "backToCharacters" : "backToAccountAccess");
      backButtonElement.title = backButtonLabel;
      backButtonElement.setAttribute("aria-label", backButtonLabel);
      backButtonElement.addEventListener("click", () => {
        characterSelectorUiState.view = isCreatingCharacter ? "list" : "auth-choice";
        renderCharacterSelector();
      });
      headerElement.append(backButtonElement);
    }
    headerElement.append(titleElement, closeButtonElement);

    const separatorElement = document.createElement("div");
    separatorElement.classList.add("separateur-panneau");

    if (isAuthenticating) {
      const authFormElement = document.createElement("form");
      authFormElement.classList.add("character-account-form");
      const errorElement = document.createElement("div");
      errorElement.classList.add("character-selector-error");
      const interactiveElements = [];

      const setAuthenticationDisabled = (isDisabled) => {
        for (const element of interactiveElements) {
          element.disabled = isDisabled;
        }
        authFormElement.classList.toggle("character-account-form-busy", isDisabled);
      };

      const completeAuthentication = async (result) => {
        if (!result.success) {
          errorElement.textContent = getCharacterSelectorErrorMessage(result.reason);
          setAuthenticationDisabled(false);
          return;
        }
        characterSelectorUiState.view = "list";
        onlineCharacters = [];
        renderCharacterSelector();
        await refreshOnlineCharacters();
      };

      const appendGoogleAuthentication = () => {
        if (googleClientId === "") {
          return;
        }
        const authDividerElement = document.createElement("div");
        authDividerElement.classList.add("character-account-divider");
        authDividerElement.textContent = getGameUiText("or");
        const googleButtonElement = document.createElement("div");
        googleButtonElement.classList.add("character-google-button");
        authFormElement.append(authDividerElement, googleButtonElement);
        void renderGoogleIdentityButton({
          clientId: googleClientId,
          buttonElement: googleButtonElement,
          locale: gameOptionsUiState.values.language,
          onCredential: async (credential) => {
            setAuthenticationDisabled(true);
            errorElement.textContent = "";
            const result = await accountSession.loginWithGoogle(credential)
              .catch(() => ({ success: false, reason: "connection-error" }));
            await completeAuthentication(result);
          },
        }).catch(() => {
          errorElement.textContent = getGameUiText("googleAuthUnavailable");
        });
      };

      if (isAuthChoice) {
        const introElement = document.createElement("div");
        introElement.classList.add("character-account-intro");
        introElement.textContent = getGameUiText("accountAccessDescription");
        const existingAccountButton = document.createElement("button");
        existingAccountButton.classList.add("character-create-button", "character-account-choice-button");
        existingAccountButton.type = "button";
        existingAccountButton.textContent = getGameUiText("existingAccount");
        existingAccountButton.addEventListener("click", () => {
          characterSelectorUiState.view = "login";
          renderCharacterSelector();
        });
        const newAccountButton = document.createElement("button");
        newAccountButton.classList.add("character-open-create-button", "character-account-choice-button");
        newAccountButton.type = "button";
        newAccountButton.textContent = getGameUiText("newAccount");
        newAccountButton.addEventListener("click", () => {
          characterSelectorUiState.view = "register";
          renderCharacterSelector();
        });
        interactiveElements.push(existingAccountButton, newAccountButton);
        authFormElement.append(introElement, existingAccountButton, newAccountButton);
        appendGoogleAuthentication();
      } else {
        const accountInputElement = document.createElement("input");
        accountInputElement.classList.add("character-create-input");
        accountInputElement.type = "text";
        accountInputElement.autocomplete = "username";
        accountInputElement.minLength = 3;
        accountInputElement.maxLength = isLogin ? 320 : 40;
        accountInputElement.placeholder = getGameUiText(isLogin ? "accountOrEmail" : "accountName");
        const emailInputElement = document.createElement("input");
        emailInputElement.classList.add("character-create-input");
        emailInputElement.type = "email";
        emailInputElement.autocomplete = "email";
        emailInputElement.maxLength = 320;
        emailInputElement.placeholder = getGameUiText("email");
        const passwordInputElement = document.createElement("input");
        passwordInputElement.classList.add("character-create-input");
        passwordInputElement.type = "password";
        passwordInputElement.autocomplete = isLogin ? "current-password" : "new-password";
        passwordInputElement.minLength = 8;
        passwordInputElement.placeholder = getGameUiText("password");
        const submitButtonElement = document.createElement("button");
        submitButtonElement.classList.add("character-create-button");
        submitButtonElement.type = "submit";
        submitButtonElement.textContent = getGameUiText(isLogin ? "login" : "register");
        interactiveElements.push(accountInputElement, emailInputElement, passwordInputElement, submitButtonElement);
        authFormElement.append(accountInputElement);
        if (isRegistering) {
          authFormElement.append(emailInputElement);
        }
        authFormElement.append(passwordInputElement, submitButtonElement);
        authFormElement.addEventListener("submit", (event) => {
          event.preventDefault();
          setAuthenticationDisabled(true);
          errorElement.textContent = "";
          const request = isLogin
            ? accountSession.login(accountInputElement.value, passwordInputElement.value)
            : accountSession.register(accountInputElement.value, emailInputElement.value, passwordInputElement.value);
          void request
            .catch(() => ({ success: false, reason: "connection-error" }))
            .then(completeAuthentication);
        });
      }
      authFormElement.append(errorElement);
      wrapperElement.append(headerElement, separatorElement, authFormElement);
      windowElement.appendChild(wrapperElement);
      characterSelector.appendChild(windowElement);
      authFormElement.querySelector("input, button")?.focus();
      return;
    }

    const characterListElement = document.createElement("div");
    characterListElement.classList.add("character-selector-list");
    const activeOnlineCharacterId = accountSession?.getActiveCharacter()?.characterId ?? null;
    const profileResult = isOnlineAccountMode
      ? {
          success: onlineCharactersError === null,
          reason: onlineCharactersError,
          characters: onlineCharacters.map((character) => ({
            ...character,
            experience: 0,
            isActive: character.characterId === activeOnlineCharacterId,
          })),
        }
      : listCharacterProfiles();
    if (!profileResult.success) {
      const errorElement = document.createElement("div");
      errorElement.classList.add("character-selector-empty");
      errorElement.textContent = getCharacterSelectorErrorMessage(profileResult.reason);
      characterListElement.appendChild(errorElement);
    } else if (onlineCharactersLoading) {
      const loadingElement = document.createElement("div");
      loadingElement.classList.add("character-selector-empty");
      loadingElement.textContent = getGameUiText("loadingCharacters");
      characterListElement.appendChild(loadingElement);
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
        const characterLevel = Number.isFinite(characterProfile.level)
          ? characterProfile.level
          : getLevelFromExperience(characterProfile.experience);
        levelElement.textContent = `${getGameUiText("levelLabel")} ${characterLevel}`;
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
      if (isOnlineAccountMode) {
        const accountFooterElement = document.createElement("div");
        accountFooterElement.classList.add("character-account-footer");
        const accountNameElement = document.createElement("span");
        accountNameElement.textContent = accountSession.getAccountId();
        const logoutButtonElement = document.createElement("button");
        logoutButtonElement.classList.add("character-selector-delete-button");
        logoutButtonElement.type = "button";
        logoutButtonElement.textContent = getGameUiText("logoutAccount");
        logoutButtonElement.addEventListener("click", () => {
          accountSession.clear();
          onlineCharacters = [];
          characterSelectorUiState.view = "auth-choice";
          renderCharacterSelector();
        });
        accountFooterElement.append(accountNameElement, logoutButtonElement);
        wrapperElement.appendChild(accountFooterElement);
      }
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
    let shouldOpenCharacterSelector = false;
    try {
      shouldEnterGame = sessionStorage.getItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY) === "true";
      shouldOpenCharacterSelector = sessionStorage.getItem(OPEN_CHARACTER_SELECTOR_AFTER_RELOAD_SESSION_KEY) === "true";
      sessionStorage.removeItem(ENTER_GAME_AFTER_RELOAD_SESSION_KEY);
      sessionStorage.removeItem(OPEN_CHARACTER_SELECTOR_AFTER_RELOAD_SESSION_KEY);
    } catch {
      shouldEnterGame = false;
      shouldOpenCharacterSelector = false;
    }
    gameWelcome.hidden = false;
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
    if (shouldOpenCharacterSelector && !shouldEnterGame) {
      openCharacterSelector();
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
