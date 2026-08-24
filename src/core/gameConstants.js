export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE_SIZE = 64;
export const MAX_ITEM_STACK_SIZE = 100;
export const MAX_SURFACE_HEIGHT = 160;
export const MAX_STEP_HEIGHT = 40;

export const WORLD_RENDER_LAYER_SIZE = 100;
export const WORLD_RENDER_LAYER_ITEM = 10;
export const WORLD_RENDER_LAYER_CREATURE = 50;
export const WORLD_RENDER_LAYER_EFFECT = 90;

export const PLAYER_SIZE = TILE_SIZE;
export const PLAYER_APPEARANCE_LAYER_ORDER = ["legs", "boots", "body", "head"];
export const CHUNK_SIZE_TILES = 16;
export const MOVE_SPEED = TILE_SIZE;
export const MAP_COLS = GAME_WIDTH / TILE_SIZE;
export const MAP_ROWS = GAME_HEIGHT / TILE_SIZE;
export const SPRITE_SIZE = 64;
export const ATLAS_CELL_SIZE = 66;
export const ATLAS_PADDING = 1;

export const TORCH_FUEL_REFRESH_INTERVAL_MS = 1000;
export const TORCH_PLAYER_REVEAL_RADIUS = 64;

export const MINIMAP_ZOOM_LEVELS = [3, 4, 6, 8, 12];
export const MINIMAP_DEFAULT_CELL_SIZE = 6;
export const MINIMAP_DYNAMIC_REFRESH_MS = 150;
export const MINIMAP_AUTOWALK_MAX_DISTANCE_TILES = 30;
export const MINIMAP_MONSTER_REVEAL_RANGE_TILES = 5;
export const MINIMAP_DISCOVERY_RADIUS_X = Math.ceil(MAP_COLS / 2) + 1;
export const MINIMAP_DISCOVERY_RADIUS_Y = Math.ceil(MAP_ROWS / 2) + 1;

export const SPELL_HOTKEY_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
export const MOBILE_SPELL_LONG_PRESS_MS = 500;
export const MOBILE_SPELL_PRESS_MOVE_TOLERANCE_PX = 12;

export const FLOOR = 0;
export const WALL = 1;

export const GAME_LOGIC_STEP_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 250;
export const MAX_LOGIC_STEPS_PER_FRAME = 5;
export const DECAY_REFRESH_COOLDOWN_MS = 1000;
export const CORPSE_DECAY_COOLDOWN_MS = {
  player: {
    stage0: 600000,
    stage1: 900000,
    stage2: 1800000,
  },
  monster: {
    stage0: 120000,
    stage1: 180000,
    stage2: 300000,
  },
};

export const PLAYER_ATTACK_COOLDOWN_MS = 1000;
export const PLAYER_COMBAT_MODES = Object.freeze(["fullAttack", "balanced", "fullDefense"]);
export const PLAYER_MOVE_COOLDOWN_MS = 200;
export const SKILL_TRAINING_COOLDOWN_MS = 45000;
export const SHIELDING_BLOCK_COOLDOWN_MS = 2000;
export const SHIELDING_MAX_BLOCKS_PER_COOLDOWN = 2;
export const SKILL_EXPERIENCE_GAIN_PER_TRY = 25;
export const SANITY_DECAY_INTERVAL_MS = 6000;

export const MONSTER_ATTACK_COOLDOWN_MS = 1500;
export const MONSTER_RESPAWN_CONFIG = {
  blockedRetryMs: 30000,
  playerBlockRangeX: Math.ceil(MAP_COLS / 2) + 2,
  playerBlockRangeY: Math.ceil(MAP_ROWS / 2) + 2,
  maxEventsPerLogicStep: 20,
};
export const MONSTER_AI_STATE = {
  idle: "idle",
  wander: "wander",
  chase: "chase",
  combat: "combat",
  flee: "flee",
};
export const MONSTER_AI_CONFIG = {
  wakeRangeX: Math.ceil(MAP_COLS / 2) + 4,
  wakeRangeY: Math.ceil(MAP_ROWS / 2) + 4,
  sleepRangeX: Math.ceil(MAP_COLS / 2) + 8,
  sleepRangeY: Math.ceil(MAP_ROWS / 2) + 8,
  visionX: Math.ceil(MAP_COLS / 2) + 1,
  visionY: Math.ceil(MAP_ROWS / 2) + 1,
  deaggroX: Math.ceil(MAP_COLS / 2) + 5,
  deaggroY: Math.ceil(MAP_ROWS / 2) + 5,
  hearingScanRange: 8,
  maxHearingPathLength: 8,
  maxChasePathLength: 18,
  maxBadPathDurationMs: 2000,
  combatDanceCooldownMinMs: 2000,
  combatDanceCooldownMaxMs: 5300,
  blockedChaseMoveCooldownMinMs: 1000,
  blockedChaseMoveCooldownMaxMs: 1800,
  dynamicPathRefreshCooldownMs: 300,
  aggroCheckCooldownMinMs: 200,
  aggroCheckCooldownMaxMs: 350,
  wanderRadiusTiles: 4,
  idleDurationMinMs: 1200,
  idleDurationMaxMs: 3000,
  wanderStepCooldownMinMs: 450,
  wanderStepCooldownMaxMs: 900,
  wanderStepsMin: 1,
  wanderStepsMax: 3,
};
export const MONSTER_AI_CHUNK_RADIUS = Math.ceil(
  Math.max(
    MONSTER_AI_CONFIG.wakeRangeX,
    MONSTER_AI_CONFIG.wakeRangeY,
    MONSTER_AI_CONFIG.sleepRangeX,
    MONSTER_AI_CONFIG.sleepRangeY,
    MONSTER_AI_CONFIG.deaggroX,
    MONSTER_AI_CONFIG.deaggroY,
  ) / CHUNK_SIZE_TILES,
);

export const NPC_DIALOGUE_CONFIG = {
  talkRange: 3,
  responseDelayMs: 500,
  lineIntervalMs: 900,
  conversationTimeoutMs: 60000,
  maxQueuedReplies: 8,
};

export const USE_COOLDOWN_MS = {
  rune: 2000,
  spell: 2000,
  item: 1000,
};
