/* ---------- DATABASE - EFFETS DE SOL ---------- */

export const GROUND_EFFECT_DECAY_STAGE_MS = 60000;
export const FIELD_EFFECT_DECAY_STAGE_MS = 30000;

const createFluidEffect = (atlasCol) => ({
  kind: "fluid",
  atlas: "items",
  atlasCol,
  atlasRow: 0,
  framesPerStage: 1,
  animationFrameMs: 0,
  decayStageMs: GROUND_EFFECT_DECAY_STAGE_MS,
});

const createFieldEffect = ({ atlasRow, statusEffectId, damageType, damageTicks }) => ({
  kind: "field",
  atlas: "effects",
  atlasCol: 0,
  atlasRow,
  framesPerStage: 3,
  animationFrameMs: 180,
  decayStageMs: FIELD_EFFECT_DECAY_STAGE_MS,
  statusEffectId,
  damageType,
  damageTicks: Object.freeze([...damageTicks]),
});

export const groundEffectsDatabase = {
  healthPotionFluid: createFluidEffect(0),
  blood: createFluidEffect(3),
  manaPotionFluid: createFluidEffect(6),
  whiteFluid: createFluidEffect(9),
  lava: createFluidEffect(12),
  poison: createFluidEffect(15),
  greenBlood: createFluidEffect(18),
  purpleFluid: createFluidEffect(21),
  antidoteFluid: createFluidEffect(24),
  fireField: createFieldEffect({
    atlasRow: 0,
    statusEffectId: "burning",
    damageType: "fire",
    damageTicks: [12, 10, 8, 6, 4, 2],
  }),
  energyField: createFieldEffect({
    atlasRow: 2,
    statusEffectId: "electrified",
    damageType: "energy",
    damageTicks: [11, 9, 7, 5, 3, 1],
  }),
  poisonField: createFieldEffect({
    atlasRow: 1,
    statusEffectId: "poison",
    damageType: "poison",
    damageTicks: [8, 7, 6, 5, 4, 3, 2, 1],
  }),
  iceField: createFieldEffect({
    atlasRow: 3,
    statusEffectId: "frozen",
    damageType: "ice",
    damageTicks: [10, 8, 6, 4, 2],
  }),
};
