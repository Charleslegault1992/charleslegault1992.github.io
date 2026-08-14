# Architecture du client

## Objectif

Le client est organise pour que la logique de jeu puisse migrer vers un serveur autoritaire sans etre reecrite. Le DOM et Pixi affichent l'etat; ils ne doivent pas devenir la source de verite du jeu.

## Direction des dependances

Les dependances vont dans ce sens:

```text
core + data
    -> state + models
    -> regles de domaine
    -> systemes de jeu
    -> render + UI + inputs
    -> main.js
```

Un module de domaine ne doit pas importer le DOM, un element HTML ou un renderer Pixi. Un renderer peut lire un modele, mais il ne decide pas si une action est valide.

## Responsabilites

### `src/core`

Constantes, mathematiques, atlas, heap et boucle fixe. Ces modules ne connaissent aucun ecran et aucune regle propre a une interface.

### `src/data`

Definitions statiques des items, monstres, NPC, classes, quetes et effets au sol. Les instances vivantes ne sont jamais stockees ici.

### `src/state`

Sources de verite en memoire:

- `playerState.js`: personnage actif;
- `worldState.js`: entites vivantes et index du monde;
- `clientRuntimeState.js`: camera, drag, ciblage et etats temporaires du client;
- `gameOptionsState.js`: options persistantes;
- `uidAllocator.js`: identites uniques locales.

### `src/items` et `src/inventory`

Modeles, creation, poids, cooldowns et transactions atomiques. Une transaction est validee au complet avant sa premiere mutation.

### `src/actions`

Frontiere entre une intention du joueur et une mutation du jeu. Une action contient un type, un `requestId` et un payload serialisable. Le dispatcher trouve le handler autoritaire et retourne toujours un resultat structure avec `success`, `status`, `reason`, `changes` et `events`.

Les actions d'inventaire et les intentions principales de gameplay utilisent cette frontiere: mouvement, attaque, parole NPC, interaction avec le monde, transitions et sorts. Les payloads et resultats sont clones afin qu'une reference partagee ne puisse pas traverser cette frontiere.

### `src/simulation`

Simulation autoritaire locale et adaptateur de transport:

- `gameSimulation.js` valide l'etat courant, les distances et les cooldowns avant d'appeler une mutation;
- `localGameTransport.js` simule le passage futur par le reseau avec des donnees clonees;
- `gameActionEffectRouter.js` distribue les evenements confirmes vers le DOM, Pixi et l'audio.

Le trajet d'une intention est maintenant:

```text
input -> action serialisable -> transport -> simulation -> resultat
                                                       -> events -> effets clients
```

Un effet client qui echoue ne peut pas annuler une mutation autoritaire deja acceptee. Chaque abonne recoit sa propre copie du resultat.

### `src/world`

Coordonnees, chunks, piles d'items, surfaces, mouvement, pathfinding et effets au sol. Le pathfinder recoit ses regles d'occupation par callbacks afin de rester reutilisable cote serveur.

### `src/player`, `src/monsters`, `src/npcs`, `src/combat`, `src/quests`

Regles propres aux entites et a leur progression. Les index spatiaux evitent de parcourir toutes les entites pour chaque requete locale.

### `src/render`, `src/pixiRenderer.js` et `src/ui`

Affichage seulement. Le DOM garde les panneaux et controles; Pixi garde le monde, les entites et les effets. Le fog-of-war de la minimap est separe dans `src/minimap` parce qu'il fait partie de la progression sauvegardee.

### `src/main.js`

Point de composition actuel. Il branche les systemes, les evenements et les workflows qui traversent plusieurs domaines. Aucune nouvelle base de donnees, structure globale ou formule de gameplay ne doit y etre ajoutee.

## Identites et index

- `itemId`, `monsterId` et `npcId` identifient un type dans une base de donnees.
- `uid` identifie une instance vivante unique.
- Les tableaux gardent un ordre quand cet ordre a un sens.
- Les `Map` par UID servent aux recherches directes.
- Les index par tile/chunk servent aux recherches spatiales locales.

Ces structures peuvent coexister quand elles repondent a des besoins differents, mais toute mutation doit passer par la fonction proprietaire qui maintient les index synchronises.

## Rendu et performance

- La logique tourne avec un fixed timestep borne.
- Le monde Tiled est importe en chunks.
- Pixi ne garde que les chunks visibles dans la scene.
- Les textures de tiles sont mises en cache.
- Les entites utilisent des index spatiaux et un ordre de rendu stable.
- Les effets au sol sont separes des items interactifs.

Pixi est charge avec un `import()` dynamique par la facade seulement quand le jeu demarre. L'accueil et la selection de personnage ne creent donc pas le renderer avant que le joueur entre dans le monde.

## Extractions completees

- orchestration de sauvegarde et session du personnage;
- controleur complet de minimap;
- etat du drag/drop, emplacements d'items et transactions d'equipement;
- fenetres de conteneurs.
- navigation du joueur, follow, actions differees et joystick mobile;
- IA, aggro, pathfinding local et respawn des monstres;
- conversations, commerce, apprentissage de sorts et banque des NPC;
- stockage/rendu du chat, lancement des sorts et assignation des hotkeys.
- options, quetes, accueil, selection et creation de personnage;
- bootstrap du client en phases explicites et orchestration ordonnee des systemes de logique/rendu;
- actions serialisables pour le mouvement, le combat, les NPC, les interactables et les sorts.
- transport local unique et simulation autoritaire pour les actions de gameplay et d'inventaire;
- evenements de resultat separes pour les effets Pixi, DOM et audio.

## Frontiere online

Le transport WebSocket, la simulation serveur, les snapshots, les deltas, la prediction du mouvement, le chat et le rendu des joueurs distants utilisent maintenant les memes contrats d'actions que le transport local. L'API HTTP possede les comptes et les personnages, tandis que SQLite applique son schema par migrations versionnees.

L'accueil utilise maintenant l'API de comptes, le chat possede une premiere moderation persistante et le PVP consensuel passe par la simulation autoritaire. Les prochaines frontieres sont les echanges entre joueurs, les groupes et le remplacement eventuel de SQLite lorsque le serveur devra utiliser plusieurs processus.

Chaque extraction doit passer les tests de domaine, le build de production et une verification des references JavaScript avant de commencer la suivante.
