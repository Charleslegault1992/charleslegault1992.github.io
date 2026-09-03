const musicUrlModulesByPath = import.meta.glob("./assets/audio/music/*.{mp3,ogg,wav}", {
  eager: true,
  query: "?url",
  import: "default",
});

const sfxUrlModulesByPath = import.meta.glob("./assets/audio/sfx/**/*.{mp3,ogg,wav}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const GAME_SFX = Object.freeze({
  arrowAttack: "ArrowAttack",
  axeSlice: "AxeSlice",
  block: "Block",
  maceSlice: "MaceSlice",
  runeUse: "RuneUse",
  swordSlice: "SwordSlice",
  armorBlock: "WeaponArmorBlock",
  ratDeath: "DeadRats",
  spiderDeath: "DeadSpider",
  openChest: "OpenChest",
  drinkPotion: "DrinkPotion",
  eat: "Eat",
  itemEquip: "ItemEquip",
  itemMove: "ItemMoveInventory",
  moneyMove: "MoneyMoveInventory",
  ropeUse: "RopeClimbOrUse",
  torchOn: "TorchOn",
  levelUp: "LevelUp",
  questDone: "QuestDone",
});

const musicEntries = Object.entries(musicUrlModulesByPath);

const raidMusicUrl = musicEntries.find(([path]) => path.endsWith("/raid.mp3"))?.[1] ?? null;

const musicUrls = musicEntries.filter(([path]) => !path.endsWith("/raid.mp3")).map(([, url]) => url);
const sfxUrlsById = new Map();

for (const [path, url] of Object.entries(sfxUrlModulesByPath)) {
  const fileName = path.split("/").at(-1) ?? "";
  const effectId = fileName.replace(/\.[^.]+$/, "");
  if (effectId) {
    sfxUrlsById.set(effectId, url);
  }
}

const audioState = {
  context: null,
  sfxGain: null,
  sfxBuffersById: new Map(),
  sfxLoadPromisesById: new Map(),
  musicMode: "normal",
  musicElement: null,
  currentMusicUrl: null,
  musicRequested: false,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.35,
  sfxVolume: 0.65,
};

const getAudioContext = () => {
  if (audioState.context) {
    return audioState.context;
  }
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  audioState.context = new AudioContextClass();
  audioState.sfxGain = audioState.context.createGain();
  audioState.sfxGain.gain.value = audioState.sfxVolume;
  audioState.sfxGain.connect(audioState.context.destination);
  return audioState.context;
};

const getMusicElement = () => {
  if (audioState.musicElement) {
    return audioState.musicElement;
  }
  const musicElement = new Audio();
  musicElement.preload = "metadata";
  musicElement.volume = audioState.musicVolume;
  musicElement.addEventListener("ended", () => {
    if (audioState.musicMode === "normal") {
      playNextMusicTrack();
    }
  });
  audioState.musicElement = musicElement;
  return musicElement;
};

const chooseNextMusicUrl = () => {
  if (musicUrls.length === 0) {
    return null;
  }
  if (musicUrls.length === 1) {
    return musicUrls[0];
  }
  const availableUrls = musicUrls.filter((url) => url !== audioState.currentMusicUrl);
  return availableUrls[Math.floor(Math.random() * availableUrls.length)] ?? musicUrls[0];
};

const playNextMusicTrack = async () => {
  if (!audioState.musicRequested || !audioState.musicEnabled) {
    return false;
  }
  const nextMusicUrl = chooseNextMusicUrl();
  if (!nextMusicUrl) {
    return false;
  }
  const musicElement = getMusicElement();
  audioState.currentMusicUrl = nextMusicUrl;
  audioState.musicMode = "normal";
  musicElement.loop = false;
  musicElement.src = nextMusicUrl;
  musicElement.volume = audioState.musicVolume;
  try {
    await musicElement.play();
    return true;
  } catch {
    return false;
  }
};

const loadSfxBuffer = async (effectId) => {
  if (audioState.sfxBuffersById.has(effectId)) {
    return audioState.sfxBuffersById.get(effectId);
  }
  if (audioState.sfxLoadPromisesById.has(effectId)) {
    return audioState.sfxLoadPromisesById.get(effectId);
  }
  const context = getAudioContext();
  const effectUrl = sfxUrlsById.get(effectId);
  if (!context || !effectUrl) {
    return null;
  }

  const loadPromise = fetch(effectUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load audio effect: ${effectId}`);
      }
      return response.arrayBuffer();
    })
    .then((audioData) => context.decodeAudioData(audioData))
    .then((audioBuffer) => {
      audioState.sfxBuffersById.set(effectId, audioBuffer);
      audioState.sfxLoadPromisesById.delete(effectId);
      return audioBuffer;
    })
    .catch(() => {
      audioState.sfxLoadPromisesById.delete(effectId);
      return null;
    });

  audioState.sfxLoadPromisesById.set(effectId, loadPromise);
  return loadPromise;
};

export const unlockGameAudio = async () => {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  if (audioState.musicRequested && audioState.musicEnabled && audioState.musicElement?.paused) {
    if (audioState.currentMusicUrl) {
      try {
        await audioState.musicElement.play();
      } catch {
        return false;
      }
    } else {
      await playNextMusicTrack();
    }
  }
  return true;
};

export const preloadGameSfx = () => {
  for (const effectId of sfxUrlsById.keys()) {
    loadSfxBuffer(effectId);
  }
};

export const playGameSfx = async (effectId) => {
  if (!audioState.sfxEnabled || audioState.sfxVolume <= 0 || !sfxUrlsById.has(effectId)) {
    return false;
  }
  const context = getAudioContext();
  if (!context) {
    return false;
  }
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  const audioBuffer = await loadSfxBuffer(effectId);
  if (!audioBuffer || !audioState.sfxGain) {
    return false;
  }
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioState.sfxGain);
  source.start();
  return true;
};

export const startGameMusic = () => {
  audioState.musicRequested = true;
  const musicElement = getMusicElement();
  if (!audioState.musicEnabled || audioState.musicVolume <= 0) {
    return false;
  }
  if (audioState.currentMusicUrl && musicElement.paused) {
    musicElement.play().catch(() => {});
    return true;
  }
  playNextMusicTrack();
  return true;
};

export const stopGameMusic = () => {
  audioState.musicRequested = false;
  if (audioState.musicElement) {
    audioState.musicElement.pause();
    audioState.musicElement.currentTime = 0;
  }
};

export const setGameAudioSettings = ({ musicEnabled, sfxEnabled, musicVolume, sfxVolume }) => {
  audioState.musicEnabled = musicEnabled === true;
  audioState.sfxEnabled = sfxEnabled === true;
  audioState.musicVolume = Math.min(Math.max(Number(musicVolume) || 0, 0), 1);
  audioState.sfxVolume = Math.min(Math.max(Number(sfxVolume) || 0, 0), 1);

  if (audioState.musicElement) {
    audioState.musicElement.volume = audioState.musicVolume;
    if (!audioState.musicEnabled || audioState.musicVolume <= 0) {
      audioState.musicElement.pause();
    } else if (audioState.musicRequested && audioState.musicElement.paused) {
      if (audioState.currentMusicUrl) {
        audioState.musicElement.play().catch(() => {});
      } else {
        playNextMusicTrack();
      }
    }
  }
  if (audioState.sfxGain) {
    audioState.sfxGain.gain.value = audioState.sfxVolume;
  }
};

export const startRaidMusic = () => {
  audioState.musicRequested = true;

  if (!raidMusicUrl) {
    return false;
  }

  const musicElement = getMusicElement();

  if (audioState.musicMode === "raid" && audioState.currentMusicUrl === raidMusicUrl) {
    return true;
  }

  audioState.musicMode = "raid";
  audioState.currentMusicUrl = raidMusicUrl;

  musicElement.pause();
  musicElement.src = raidMusicUrl;
  musicElement.currentTime = 0;
  musicElement.loop = true;
  musicElement.volume = audioState.musicVolume;

  if (!audioState.musicEnabled || audioState.musicVolume <= 0) {
    return true;
  }

  musicElement.play().catch(() => {});

  return true;
};

export const resumeGameMusicAfterRaid = () => {
  if (audioState.musicMode !== "raid") {
    return true;
  }

  const musicElement = getMusicElement();

  musicElement.pause();
  musicElement.currentTime = 0;
  musicElement.loop = false;

  audioState.musicMode = "normal";
  audioState.currentMusicUrl = null;

  if (!audioState.musicRequested || !audioState.musicEnabled || audioState.musicVolume <= 0) {
    return true;
  }

  playNextMusicTrack();

  return true;
};

document.addEventListener("pointerdown", unlockGameAudio, { passive: true });
document.addEventListener("keydown", unlockGameAudio);
