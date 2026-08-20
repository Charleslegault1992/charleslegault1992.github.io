const PIXI_RENDERER_WEBGL = "webgl";
const PIXI_RENDERER_WEBGPU = "webgpu";

export const getRequestedPixiRenderer = (search = "") => {
  if (typeof search !== "string" || search === "") {
    return null;
  }
  const requestedRenderer = new URLSearchParams(search).get("pixiRenderer");
  return requestedRenderer === PIXI_RENDERER_WEBGPU || requestedRenderer === PIXI_RENDERER_WEBGL
    ? requestedRenderer
    : null;
};

export const getPixiRendererPreference = (requestedRenderer) => {
  return requestedRenderer === PIXI_RENDERER_WEBGPU
    ? [PIXI_RENDERER_WEBGPU, PIXI_RENDERER_WEBGL]
    : [PIXI_RENDERER_WEBGL, PIXI_RENDERER_WEBGPU];
};
