import { pixiWorldRenderState } from "../state/clientRuntimeState.js";

export const getCurrentWorldMap = () => {
  if (!(pixiWorldRenderState.worldMapsByZ instanceof Map)) {
    return null;
  }
  return pixiWorldRenderState.worldMapsByZ.get(pixiWorldRenderState.currentZ) ?? null;
};
