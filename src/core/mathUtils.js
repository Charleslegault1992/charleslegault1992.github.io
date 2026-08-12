export const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getRandomFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

export const clamp = (value, min, max) => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const isEmpty = (value) => {
  if (value == null) {
    return true;
  }
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
};

export const getManhattanDistance = (a, b) => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};
