export const getDirectionRow = (direction) => {
  if (direction === "down") {
    return 0;
  }
  if (direction === "left") {
    return 1;
  }
  if (direction === "right") {
    return 2;
  }
  if (direction === "up") {
    return 3;
  }
  return 0;
};
