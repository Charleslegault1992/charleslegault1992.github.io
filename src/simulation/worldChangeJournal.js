import { createWorldDelta } from "./worldSnapshot.js";

export const createWorldChangeJournal = ({ initialRevision = 0, maxEntries = 256 } = {}) => {
  if (!Number.isSafeInteger(initialRevision) || initialRevision < 0 || !Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw new TypeError("World change journal configuration is invalid.");
  }

  let revision = initialRevision;
  const entries = [];

  const record = ({ serverTime, upserts = {}, removals = {}, events = [] }) => {
    const delta = createWorldDelta({
      baseRevision: revision,
      revision: revision + 1,
      serverTime,
      upserts,
      removals,
      events,
    });
    if (!delta) {
      return null;
    }
    revision = delta.revision;
    entries.push(delta);
    while (entries.length > maxEntries) {
      entries.shift();
    }
    return Object.freeze({ baseRevision: delta.baseRevision, revision: delta.revision });
  };

  const readDeltasAfter = (knownRevision) => {
    if (!Number.isSafeInteger(knownRevision) || knownRevision < 0 || knownRevision > revision) {
      return null;
    }
    if (knownRevision === revision) {
      return [];
    }
    const firstAvailableBaseRevision = entries[0]?.baseRevision ?? revision;
    if (knownRevision < firstAvailableBaseRevision) {
      return null;
    }
    const startIndex = knownRevision - firstAvailableBaseRevision;
    return entries.slice(startIndex);
  };

  const getDeltasAfter = (knownRevision) => {
    const deltas = readDeltasAfter(knownRevision);
    return deltas === null ? null : structuredClone(deltas);
  };

  return Object.freeze({
    getRevision: () => revision,
    getDeltasAfter,
    readDeltasAfter,
    record,
  });
};
