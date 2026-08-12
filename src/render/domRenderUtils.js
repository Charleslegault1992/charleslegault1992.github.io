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
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
  element.style.width = `${position.width}px`;
  element.style.height = `${position.height}px`;
  element.style.zIndex = position.zIndex;
};
