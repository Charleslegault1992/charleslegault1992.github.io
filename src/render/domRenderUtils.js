export const getHpColor = (hp, maxHp) => {
  const percent = hp / maxHp;
  return `hsl(${percent * 120}, 100%, 45%)`;
};

export const getAtlasPath = (atlasName) => {
  if (atlasName === "items") {
    return new URL("../assets/images/items/items-sheet.png", import.meta.url).href;
  }
  if (atlasName === "monsters") {
    return new URL("../assets/images/monstres/monsters-sheet.png", import.meta.url).href;
  }
  console.error(`atlasName: ${atlasName} n'existe pas`);
  return undefined;
};

export const applyItemRenderPartPosition = (element, position) => {
  const leftStr = `${position.left}px`;
  const topStr = `${position.top}px`;
  const widthStr = `${position.width}px`;
  const heightStr = `${position.height}px`;
  if (element.style.left !== leftStr) element.style.left = leftStr;
  if (element.style.top !== topStr) element.style.top = topStr;
  if (element.style.width !== widthStr) element.style.width = widthStr;
  if (element.style.height !== heightStr) element.style.height = heightStr;
  if (element.style.zIndex != position.zIndex) element.style.zIndex = position.zIndex;
};
