import { MINIMAP_DEFAULT_CELL_SIZE, MINIMAP_ZOOM_LEVELS } from "../core/gameConstants.js";

export const GAME_OPTIONS_STORAGE_KEY = "no-name-yet:game-options";
export const SUPPORTED_GAME_LANGUAGES = new Set(["en", "fr"]);
export const DEFAULT_GAME_OPTIONS = {
  showFps: true,
  showCreatureNames: true,
  showHealthBars: true,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.35,
  sfxVolume: 0.65,
  minimapCellSize: MINIMAP_DEFAULT_CELL_SIZE,
  language: "en",
};

const loadGameOptions = () => {
  try {
    const savedOptions = JSON.parse(localStorage.getItem(GAME_OPTIONS_STORAGE_KEY));
    const options = { ...DEFAULT_GAME_OPTIONS };
    for (const optionKey of ["showFps", "showCreatureNames", "showHealthBars", "musicEnabled", "sfxEnabled"]) {
      if (typeof savedOptions?.[optionKey] === "boolean") {
        options[optionKey] = savedOptions[optionKey];
      }
    }
    for (const volumeKey of ["musicVolume", "sfxVolume"]) {
      if (Number.isFinite(savedOptions?.[volumeKey])) {
        options[volumeKey] = Math.min(Math.max(savedOptions[volumeKey], 0), 1);
      }
    }
    if (SUPPORTED_GAME_LANGUAGES.has(savedOptions?.language)) {
      options.language = savedOptions.language;
    }
    if (MINIMAP_ZOOM_LEVELS.includes(savedOptions?.minimapCellSize)) {
      options.minimapCellSize = savedOptions.minimapCellSize;
    }
    return options;
  } catch {
    return { ...DEFAULT_GAME_OPTIONS };
  }
};

export const gameOptionsUiState = {
  isOpen: false,
  values: loadGameOptions(),
};
