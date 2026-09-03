import { TILE_SIZE } from "../src/core/gameConstants.js";
import { createGroundItem } from "../src/items/itemFactory.js";
import { createMonster, getMonsterData } from "../src/monsters/monsterModel.js";

import {
  RAID_PHASE,
  createRaidPortalTransition,
  getRaidBossSpawnMarker,
  getRaidMarkerByName,
  getRaidMonsterSpawnMarkers,
  getRaidPortalCollisionTiles,
} from "../src/raids/raidModel.js";

import { clearDynamicCollisionOwner, setDynamicCollisionOwnerTiles } from "../src/world/dynamicWorldCollision.js";

import { createRaidChestContent } from "./serverRaidLoot.js";
/* ==================================================== */
/* RAID - CONFIG                                        */
/* ==================================================== */

const COUNTDOWN_SECONDS = 3;
const COUNTDOWN_STEP_MS = 1000;
const DEFAULT_MAX_PLAYERS = 4;

const getPortalCollisionOwnerId = (raidId) => {
  return `raid:${raidId}:portal`;
};

/* ==================================================== */
/* RAID - SYSTEM                                        */
/* ==================================================== */

export const createServerRaidSystem = ({
  worldMapsByZ,
  playersByUid,
  monsters,
  worldItems,
  findAvailablePlayerSpawn,
  recordPlayerTileEntry,
}) => {
  if (
    !(worldMapsByZ instanceof Map) ||
    !(playersByUid instanceof Map) ||
    typeof monsters?.add !== "function" ||
    typeof monsters?.remove !== "function" ||
    typeof worldItems?.add !== "function" ||
    typeof worldItems?.remove !== "function" ||
    typeof worldItems?.get !== "function" ||
    typeof findAvailablePlayerSpawn !== "function" ||
    typeof recordPlayerTileEntry !== "function"
  ) {
    throw new TypeError("Invalid server raid dependencies.");
  }

  /*
   * Definitions Tiled mises en cache.
   *
   * raidId -> {
   *   playerSpawn,
   *   monsterSpawns,
   *   bossSpawn,
   *   chestSpawn,
   *   portalSpawn,
   *   ...
   * }
   */
  const definitionsByRaidId = new Map();

  /*
   * État des raids actifs.
   *
   * raidId -> état runtime
   */
  const raidStatesById = new Map();

  /*
   * Permet de savoir instantanément
   * si un monstre appartient à un raid.
   *
   * monsterUid -> {
   *   raidId,
   *   role
   * }
   */
  const raidMonsterByUid = new Map();

  /* ==================================================== */
  /* RESULTAT UPDATE                                      */
  /* ==================================================== */

  const createUpdateResult = () => {
    return {
      changedPlayers: [],

      spawnedMonsters: [],
      removedMonsterUids: [],

      spawnedWorldItems: [],
      removedWorldItemUids: [],

      events: [],
    };
  };

  /* ==================================================== */
  /* RAID - DEFINITION TILED                              */
  /* ==================================================== */

  const getRaidDefinition = (raidId) => {
    if (definitionsByRaidId.has(raidId)) {
      return definitionsByRaidId.get(raidId);
    }

    const playerSpawn = getRaidMarkerByName(worldMapsByZ, raidId, "raid_player_spawn");

    const monsterSpawns = getRaidMonsterSpawnMarkers(worldMapsByZ, raidId);

    const bossSpawn = getRaidBossSpawnMarker(worldMapsByZ, raidId);

    const chestSpawn = getRaidMarkerByName(worldMapsByZ, raidId, "raid_chest_spawn");

    const portalSpawn = getRaidMarkerByName(worldMapsByZ, raidId, "raid_exit_portal");

    const portalTransition = createRaidPortalTransition(portalSpawn);

    /*
     * Vérifie que tous les monsterId des spawns
     * normaux existent réellement.
     */
    const regularMonstersValid =
      monsterSpawns.length > 0 &&
      monsterSpawns.every((marker) => {
        return Boolean(getMonsterData(marker.properties?.monsterId));
      });

    /*
     * Vérifie le boss.
     */
    const bossValid = Boolean(getMonsterData(bossSpawn?.properties?.monsterId));

    if (
      !playerSpawn ||
      !regularMonstersValid ||
      !bossSpawn ||
      !bossValid ||
      !chestSpawn ||
      !portalSpawn ||
      !portalTransition
    ) {
      console.error(`[Raid] Definition invalide pour ${raidId}`, {
        playerSpawn: Boolean(playerSpawn),
        monsterSpawnCount: monsterSpawns.length,
        regularMonstersValid,
        bossSpawn: Boolean(bossSpawn),
        bossValid,
        chestSpawn: Boolean(chestSpawn),
        portalSpawn: Boolean(portalSpawn),
        portalTransition: Boolean(portalTransition),
      });

      return null;
    }

    /*
     * Pour l'instant un raid doit être entièrement
     * sur le même Z.
     */
    const allMarkers = [playerSpawn, bossSpawn, chestSpawn, portalSpawn, ...monsterSpawns];

    const raidZValues = new Set(allMarkers.map((marker) => marker.z));

    if (raidZValues.size !== 1) {
      console.error(`[Raid] Tous les markers de ${raidId} doivent être sur le même Z.`);

      return null;
    }

    const definition = {
      raidId,

      z: playerSpawn.z,

      maxPlayers:
        Number.isInteger(playerSpawn.properties?.maxPlayers) && playerSpawn.properties.maxPlayers > 0
          ? playerSpawn.properties.maxPlayers
          : DEFAULT_MAX_PLAYERS,

      playerSpawn,
      monsterSpawns,
      bossSpawn,
      chestSpawn,
      portalSpawn,
      portalTransition,
    };

    definitionsByRaidId.set(raidId, definition);

    return definition;
  };

  /* ==================================================== */
  /* RAID - ETAT                                         */
  /* ==================================================== */

  const createRaidState = (raidId, now) => {
    return {
      raidId,

      phase: RAID_PHASE.countdown,

      countdown: COUNTDOWN_SECONDS,

      nextCountdownAt: now + COUNTDOWN_STEP_MS,

      participants: new Set(),

      regularMonsterUids: new Set(),

      bossUid: null,

      chestUid: null,

      abortRequested: false,
    };
  };
  /* ==================================================== */
  /* RAID - ETAT PRIVE JOUEUR                            */
  /* ==================================================== */

  const createPlayerRaidState = (state, definition) => {
    return {
      raidId: state.raidId,

      phase: state.phase,

      countdown: state.phase === RAID_PHASE.countdown ? state.countdown : 0,

      chest:
        state.phase === RAID_PHASE.completed && Number.isInteger(state.chestUid)
          ? {
              active: true,

              uid: state.chestUid,

              col: definition.chestSpawn.col,
              row: definition.chestSpawn.row,
              z: definition.chestSpawn.z,

              chestId: definition.chestSpawn.properties?.chestId ?? null,
            }
          : null,

      portal:
        state.phase === RAID_PHASE.completed
          ? {
              active: true,

              col: definition.portalSpawn.col,
              row: definition.portalSpawn.row,
              z: definition.portalSpawn.z,
            }
          : null,
    };
  };

  /* ==================================================== */
  /* RAID - SYNC JOUEURS                                 */
  /* ==================================================== */

  const synchronizeRaidPlayers = (state, definition) => {
    const changedPlayers = [];

    for (const playerUid of [...state.participants]) {
      const player = playersByUid.get(playerUid);

      /*
       * Joueur disparu du serveur.
       */
      if (!player) {
        state.participants.delete(playerUid);

        continue;
      }

      player.raid = createPlayerRaidState(state, definition);

      changedPlayers.push(player);
    }

    return changedPlayers;
  };

  /* ==================================================== */
  /* RAID - EVENTS PRIVES                                */
  /* ==================================================== */

  const createParticipantEvents = (state, type, extra = {}) => {
    const events = [];

    for (const playerUid of state.participants) {
      if (!playersByUid.has(playerUid)) {
        continue;
      }

      events.push({
        type,

        raidId: state.raidId,

        playerUid,

        recipientPlayerUid: playerUid,

        visibility: "private",

        ...extra,
      });
    }

    return events;
  };

  /* ==================================================== */
  /* RAID - SPAWN MONSTRE                                */
  /* ==================================================== */

  const spawnRaidMonster = (state, marker, role) => {
    const monsterId = marker.properties?.monsterId;

    const monster = createMonster(monsterId, marker.col * TILE_SIZE, marker.row * TILE_SIZE, marker.z);

    if (!monster) {
      console.error(`[Raid] Impossible de créer ${monsterId}.`);

      return null;
    }

    /*
     * TRÈS IMPORTANT :
     *
     * Un monstre de raid n'appartient pas
     * au système normal de respawn.
     */
    monster.spawnId = null;

    monster.raidId = state.raidId;

    monster.raidRole = role;

    monster.raidSpawnObjectId = marker.tiledObjectId ?? null;

    if (!monsters.add(monster)) {
      console.error(`[Raid] Impossible d'ajouter ${monsterId} au monde.`);

      return null;
    }

    raidMonsterByUid.set(monster.uid, {
      raidId: state.raidId,
      role,
    });

    if (role === "boss") {
      state.bossUid = monster.uid;
    } else {
      state.regularMonsterUids.add(monster.uid);
    }

    return monster;
  };

  /* ==================================================== */
  /* RAID - SPAWN COFFRE                                  */
  /* ==================================================== */

  const spawnRaidChest = (state, definition) => {
    /*
     * Protection anti-double-spawn.
     */
    if (Number.isInteger(state.chestUid)) {
      return worldItems.get(state.chestUid) ?? null;
    }

    const chestId = definition.chestSpawn.properties?.chestId;

    if (typeof chestId !== "string" || chestId === "") {
      console.error(`[Raid] ${state.raidId}: raid_chest_spawn n'a pas de chestId.`);

      return null;
    }

    /*
     * Le loot est roulé UNE SEULE FOIS
     * côté serveur.
     */
    const lootResult = createRaidChestContent(chestId);

    if (!lootResult?.success) {
      console.error(
        `[Raid] ${state.raidId}: génération du coffre impossible: ${lootResult?.reason ?? "unknown-error"}`,
      );

      return null;
    }

    const chest = createGroundItem(
      lootResult.chestItemId,
      1,
      definition.chestSpawn.col * TILE_SIZE,
      definition.chestSpawn.row * TILE_SIZE,
      definition.chestSpawn.z,
      lootResult.content,
    );

    if (!chest) {
      console.error(`[Raid] ${state.raidId}: createGroundItem du coffre a échoué.`);

      return null;
    }

    /*
     * Métadonnées runtime.
     */
    chest.raidId = state.raidId;
    chest.raidChestId = chestId;

    if (!worldItems.add(chest)) {
      console.error(`[Raid] ${state.raidId}: impossible d'ajouter le coffre aux worldItems.`);

      return null;
    }

    state.chestUid = chest.uid;

    return chest;
  };

  /* ==================================================== */
  /* RAID - REMOVE MONSTRES                              */
  /* ==================================================== */

  const removeAllRaidMonsters = (state) => {
    const monsterUids = [...state.regularMonsterUids];

    if (Number.isInteger(state.bossUid)) {
      monsterUids.push(state.bossUid);
    }

    const removedMonsterUids = [];

    for (const monsterUid of monsterUids) {
      raidMonsterByUid.delete(monsterUid);

      if (monsters.remove(monsterUid)) {
        removedMonsterUids.push(monsterUid);
      }
    }

    state.regularMonsterUids.clear();

    state.bossUid = null;

    return removedMonsterUids;
  };
  /* ==================================================== */
  /* RAID - REMOVE COFFRE                                 */
  /* ==================================================== */

  const removeRaidChest = (state) => {
    if (!Number.isInteger(state.chestUid)) {
      return null;
    }

    const chestUid = state.chestUid;

    /*
     * On vide l'UID immédiatement pour éviter
     * toute tentative de double suppression.
     */
    state.chestUid = null;

    if (!worldItems.remove(chestUid)) {
      return null;
    }

    return chestUid;
  };
  /* ==================================================== */
  /* RAID - COLLISION PORTAIL                            */
  /* ==================================================== */

  const setRaidPortalCollision = (definition, active) => {
    const worldMap = worldMapsByZ.get(definition.portalSpawn.z);

    if (!worldMap) {
      return false;
    }

    const ownerId = getPortalCollisionOwnerId(definition.raidId);

    if (!active) {
      return clearDynamicCollisionOwner(worldMap, ownerId);
    }

    return setDynamicCollisionOwnerTiles(worldMap, ownerId, getRaidPortalCollisionTiles(definition.portalSpawn));
  };

  /* ==================================================== */
  /* RAID - RESET                                        */
  /* ==================================================== */

  const resetRaid = (state, definition, updateResult) => {
    /*
     * Nettoyage monstres.
     */
    const removedMonsterUids = removeAllRaidMonsters(state);

    updateResult.removedMonsterUids.push(...removedMonsterUids);

    /*
     * Nettoyage coffre.
     */
    const removedChestUid = removeRaidChest(state);

    if (Number.isInteger(removedChestUid)) {
      updateResult.removedWorldItemUids.push(removedChestUid);
    }

    /*
     * Enlève les collisions dynamiques
     * du portail.
     */
    setRaidPortalCollision(definition, false);

    /*
     * Nettoie l'état raid des joueurs
     * encore présents.
     */
    for (const playerUid of state.participants) {
      const player = playersByUid.get(playerUid);

      if (player?.raid?.raidId === state.raidId) {
        player.raid = null;

        updateResult.changedPlayers.push(player);
      }
    }

    state.participants.clear();

    raidStatesById.delete(state.raidId);
  };

  /* ==================================================== */
  /* RAID - START                                        */
  /* ==================================================== */

  const startRaid = (player, raidId, now) => {
    if (!player || player.hp <= 0 || player.raid || !Number.isFinite(now)) {
      return {
        success: false,
        reason: "invalid-raid-request",
      };
    }

    const definition = getRaidDefinition(raidId);

    if (!definition) {
      return {
        success: false,
        reason: "raid-definition-invalid",
      };
    }

    let state = raidStatesById.get(raidId);

    /*
     * Premier joueur.
     */
    if (!state) {
      state = createRaidState(raidId, now);

      raidStatesById.set(raidId, state);
    } else if (state.phase !== RAID_PHASE.countdown || state.abortRequested) {
      /*
       * Une fois le 3-2-1 terminé,
       * personne ne peut rejoindre.
       */
      return {
        success: false,
        reason: "raid-in-progress",
      };
    }

    if (state.participants.size >= definition.maxPlayers) {
      return {
        success: false,
        reason: "raid-full",
      };
    }

    const spawnPosition = findAvailablePlayerSpawn(definition.playerSpawn);

    if (!spawnPosition) {
      /*
       * Si personne n'avait encore rejoint,
       * on détruit l'état vide.
       */
      if (state.participants.size === 0) {
        raidStatesById.delete(raidId);
      }

      return {
        success: false,
        reason: "raid-spawn-blocked",
      };
    }

    const previousZ = player.z;

    /*
     * Téléportation sur l'île.
     */
    Object.assign(player, {
      z: definition.z,

      x: spawnPosition.x,
      y: spawnPosition.y,

      oldX: spawnPosition.x,
      oldY: spawnPosition.y,

      renderX: spawnPosition.x,
      renderY: spawnPosition.y,

      moveStartTime: 0,
      moveDuration: 0,
    });

    state.participants.add(player.uid);

    player.raid = createPlayerRaidState(state, definition);

    recordPlayerTileEntry(player);

    return {
      success: true,

      changes: {
        raidId,

        x: player.x,
        y: player.y,
        z: player.z,

        previousZ,
      },

      events: [
        {
          type: "player-world-transitioned",

          playerUid: player.uid,

          x: player.x,
          y: player.y,
          z: player.z,

          previousZ,
        },

        {
          type: "raid-entered",

          raidId,

          playerUid: player.uid,

          recipientPlayerUid: player.uid,

          visibility: "private",

          countdown: state.countdown,
        },
      ],
    };
  };

  /* ==================================================== */
  /* RAID - MONSTRE MORT                                 */
  /* ==================================================== */

  const notifyMonsterDeath = (monster) => {
    const raidMonsterReference = raidMonsterByUid.get(monster?.uid);

    /*
     * Monstre normal :
     * le raid system ignore.
     */
    if (!raidMonsterReference) {
      return false;
    }

    raidMonsterByUid.delete(monster.uid);

    const state = raidStatesById.get(raidMonsterReference.raidId);

    if (!state) {
      return false;
    }

    if (raidMonsterReference.role === "boss") {
      state.bossUid = null;
    } else {
      state.regularMonsterUids.delete(monster.uid);
    }

    return true;
  };

  /* ==================================================== */
  /* RAID - QUITTER                                      */
  /* ==================================================== */

  const leaveRaid = (player, reason = "left") => {
    const raidId = player?.raid?.raidId;

    const state = raidStatesById.get(raidId);

    if (!player || !state || !state.participants.has(player.uid)) {
      if (player) {
        player.raid = null;
      }

      return {
        success: false,
        reason: "player-not-in-raid",
        events: [],
      };
    }

    state.participants.delete(player.uid);

    player.raid = null;

    /*
     * Quand le dernier joueur part,
     * le raid sera nettoyé au prochain tick.
     */
    if (state.participants.size === 0) {
      state.abortRequested = true;
    }

    return {
      success: true,

      changes: {
        raidId,
        reason,
      },

      events: [
        {
          type: "raid-left",

          raidId,

          playerUid: player.uid,

          recipientPlayerUid: player.uid,

          visibility: "private",

          reason,
        },
      ],
    };
  };

  /* ==================================================== */
  /* RAID - DESTINATION DE SORTIE                        */
  /* ==================================================== */

  const getPlayerExitTransition = (player) => {
    const raidId = player?.raid?.raidId;

    if (!raidId) {
      return null;
    }

    const state = raidStatesById.get(raidId);

    if (!state || !state.participants.has(player.uid)) {
      return null;
    }

    const definition = getRaidDefinition(raidId);

    return definition?.portalTransition ?? null;
  };

  /* ==================================================== */
  /* RAID - PORTAIL AUTOMATIQUE                          */
  /* ==================================================== */

  const findAutomaticExitTransition = (player) => {
    const raidId = player?.raid?.raidId;

    const state = raidStatesById.get(raidId);

    if (!state || state.phase !== RAID_PHASE.completed || !state.participants.has(player.uid)) {
      return null;
    }

    const definition = getRaidDefinition(raidId);

    if (!definition) {
      return null;
    }

    /*
     * Le joueur doit marcher exactement
     * sur la case CENTRALE du portail.
     */
    const playerCol = player.x / TILE_SIZE;

    const playerRow = player.y / TILE_SIZE;

    if (
      player.z !== definition.portalSpawn.z ||
      playerCol !== definition.portalSpawn.col ||
      playerRow !== definition.portalSpawn.row
    ) {
      return null;
    }

    return definition.portalTransition;
  };

  /* ==================================================== */
  /* RAID - UPDATE                                       */
  /* ==================================================== */

  const update = (now) => {
    const updateResult = createUpdateResult();

    if (!Number.isFinite(now)) {
      return updateResult;
    }

    raidLoop: for (const [raidId, state] of [...raidStatesById]) {
      const definition = getRaidDefinition(raidId);

      /*
       * Nettoie les participants qui
       * n'existent plus.
       */
      for (const playerUid of [...state.participants]) {
        if (!playersByUid.has(playerUid)) {
          state.participants.delete(playerUid);
        }
      }

      if (!definition || state.participants.size === 0) {
        state.abortRequested = true;
      }

      /*
       * RAID ABANDONNÉ.
       */
      if (state.abortRequested) {
        if (definition) {
          resetRaid(state, definition, updateResult);
        }

        continue;
      }

      /* ================================================ */
      /* COUNTDOWN                                        */
      /* ================================================ */

      if (state.phase === RAID_PHASE.countdown) {
        /*
         * while au lieu d'un simple if :
         *
         * si le serveur a un tick lent,
         * le countdown ne se désynchronise pas.
         */
        while (now >= state.nextCountdownAt && state.phase === RAID_PHASE.countdown) {
          state.nextCountdownAt += COUNTDOWN_STEP_MS;

          state.countdown--;

          /*
           * 3 -> 2
           * 2 -> 1
           */
          if (state.countdown > 0) {
            updateResult.changedPlayers.push(...synchronizeRaidPlayers(state, definition));

            continue;
          }

          /*
           * 1 terminé :
           * spawn de TOUS les monstres.
           */
          const spawnedMonsters = definition.monsterSpawns
            .map((marker) => {
              return spawnRaidMonster(state, marker, "monster");
            })
            .filter(Boolean);

          /*
           * On ne lance jamais un raid
           * partiellement spawné.
           */
          if (spawnedMonsters.length !== definition.monsterSpawns.length) {
            console.error(`[Raid] Spawn incomplet pour ${raidId}. Raid annulé.`);

            state.abortRequested = true;

            resetRaid(state, definition, updateResult);

            continue raidLoop;
          }

          state.phase = RAID_PHASE.monsters;

          updateResult.spawnedMonsters.push(...spawnedMonsters);

          updateResult.changedPlayers.push(...synchronizeRaidPlayers(state, definition));

          updateResult.events.push(
            ...createParticipantEvents(state, "raid-wave-started", {
              monsterCount: spawnedMonsters.length,
            }),
          );
        }
      }

      /* ================================================ */
      /* TOUS LES MONSTRES MORTS                         */
      /* ================================================ */

      if (state.phase === RAID_PHASE.monsters && state.regularMonsterUids.size === 0) {
        const boss = spawnRaidMonster(state, definition.bossSpawn, "boss");

        if (!boss) {
          console.error(`[Raid] Impossible de spawn le boss de ${raidId}.`);

          state.abortRequested = true;

          resetRaid(state, definition, updateResult);

          continue;
        }

        state.phase = RAID_PHASE.boss;

        updateResult.spawnedMonsters.push(boss);

        updateResult.changedPlayers.push(...synchronizeRaidPlayers(state, definition));

        updateResult.events.push(
          ...createParticipantEvents(state, "raid-boss-spawned", {
            bossUid: boss.uid,
            monsterId: boss.monsterId,
          }),
        );
      }

      /* ================================================ */
      /* BOSS MORT                                       */
      /* ================================================ */

      if (state.phase === RAID_PHASE.boss && state.bossUid === null) {
        /*
         * 1. Crée le coffre avant de passer
         * le raid en completed.
         */
        const chest = spawnRaidChest(state, definition);

        if (chest) {
          updateResult.spawnedWorldItems.push(chest);

          updateResult.events.push(
            ...createParticipantEvents(state, "raid-chest-spawned", {
              chestUid: chest.uid,
              chestId: chest.raidChestId,
              col: definition.chestSpawn.col,
              row: definition.chestSpawn.row,
              z: definition.chestSpawn.z,
            }),
          );
        } else {
          /*
           * Même si le coffre plante,
           * on ne garde JAMAIS les joueurs
           * prisonniers du raid.
           */
          console.error(`[Raid] ${raidId}: le coffre n'a pas pu apparaître.`);
        }

        /*
         * 2. Raid terminé.
         */
        state.phase = RAID_PHASE.completed;

        /*
         * 3. Active les 7 collisions
         * autour du portail.
         */
        setRaidPortalCollision(definition, true);

        /*
         * 4. Les joueurs reçoivent :
         *
         * phase = completed
         * chest.active
         * portal.active
         */
        updateResult.changedPlayers.push(...synchronizeRaidPlayers(state, definition));

        updateResult.events.push(...createParticipantEvents(state, "raid-completed"));
      }
    }

    /*
     * Évite plusieurs upserts du même joueur
     * ou du même monstre dans le même tick.
     */
    updateResult.changedPlayers = [
      ...new Map(updateResult.changedPlayers.map((player) => [player.uid, player])).values(),
    ];

    updateResult.spawnedMonsters = [
      ...new Map(updateResult.spawnedMonsters.map((monster) => [monster.uid, monster])).values(),
    ];

    updateResult.removedMonsterUids = [...new Set(updateResult.removedMonsterUids)];

    updateResult.spawnedWorldItems = [
      ...new Map(updateResult.spawnedWorldItems.map((item) => [item.uid, item])).values(),
    ];

    updateResult.removedWorldItemUids = [...new Set(updateResult.removedWorldItemUids)];

    return updateResult;
  };

  /* ==================================================== */
  /* PUBLIC API                                          */
  /* ==================================================== */

  return Object.freeze({
    startRaid,

    notifyMonsterDeath,

    leaveRaid,

    getPlayerExitTransition,

    findAutomaticExitTransition,

    update,

    getRaidState: (raidId) => {
      return raidStatesById.get(raidId) ?? null;
    },
  });
};
