import worldZMinus1Raw from "./assets/maps/tiled/world_z-1.tmj?raw";
import worldZ0Raw from "./assets/maps/tiled/world_z0.tmj?raw";
import { importTiledMapIntoWorldMaps } from "./tiledWorldImporter.js";

export const loadWorldMaps = () => {

  const worldMapsByZ = new Map();
  importTiledMapIntoWorldMaps(worldMapsByZ, JSON.parse(worldZ0Raw), "world_z0.tmj");
  importTiledMapIntoWorldMaps(worldMapsByZ, JSON.parse(worldZMinus1Raw), "world_z-1.tmj");
  return worldMapsByZ;
};
