# Architecture online

## Principe

Le client envoie seulement des intentions serialisables. Le serveur retrouve les entites par UID, valide l'etat courant, applique la mutation et retourne un resultat. Pixi, le DOM, les sons et les textes restent des effets clients.

Le mode serveur est active quand `VITE_GAME_SERVER_URL` existe. Sans cette variable, le navigateur utilise le meme contrat d'actions avec `localGameTransport`, ce qui garde un mode de developpement local sans lancer deux simulations en parallele.

## Flux reseau

1. Le client ouvre `/game` et envoie `client.hello` avec un jeton et un personnage.
2. Le serveur authentifie le compte, reserve le personnage et retourne `server.welcome`.
3. Un `server.snapshot` initialise l'etat prive, les entites et les chunks visibles.
4. Chaque intention utilise `client.action` avec un `requestId` unique et idempotent.
5. Le serveur retourne `server.action-result` au demandeur.
6. Le tick a 30 Hz diffuse des `server.delta` filtres par interet spatial.
7. Un trou de revision ou une reconnexion force un nouveau snapshot.

Le transport WebSocket fait une reconnexion exponentielle de 250 ms a 5 secondes. Les actions encore en attente sont rejetees lors d'une coupure: elles ne sont jamais rejouees aveuglement. Seul le mouvement est predit, puis reconcilie avec l'etat autoritaire.

## Etat autoritaire actuel

- Joueurs separes par session et personnage.
- Mouvement, collisions Tiled, occupation des tiles et transitions de floor.
- Inventaire, equipement, containers, stacks, capacite et items au sol.
- Potions, nourriture, torches, runes et cooldowns d'items.
- Sorts, mana, apprentissage et cooldown commun des sorts.
- Coffres de recompense, progression de quete et reclamation unique.
- Conversations NPC, file d'attente, achats de base, apprentissage de sorts et consultation bancaire.
- Monstres, aggro, pathfinding, mouvement, combat, mort, loot et respawn.
- Regeneration, sanity, mort du joueur, corpse et retour au spawn.
- PVP consensuel avec skull blanc, retaliation legale, skull rouge et verrouillage en combat.
- Decay des corpses et effets au sol.
- Sauvegarde SQLite a la creation, toutes les 30 secondes et a la deconnexion.

Les snapshots separent l'etat public de l'etat prive. L'equipement, l'inventaire, la banque, les skills, les sorts et la progression ne sont envoyes qu'au proprietaire. Les evenements de combat sont filtres par joueur et zone visible.

## Client distant

`remoteGameStateBridge` applique les snapshots et deltas aux objets deja utilises par le rendu. Les references existantes sont conservees pour eviter de recreer inutilement Pixi, le DOM et les controleurs. Les entites sorties de la zone d'interet sont retirees des maps clientes.

Configuration locale:

```powershell
$env:GAME_AUTH_SECRET="development-only-secret-change-me"
npm run auth:token
```

Placer ensuite le jeton retourne dans `.env.local` avec les deux variables de `.env.example`, puis lancer le serveur et Vite dans deux terminaux:

```powershell
npm run server
npm run dev
```

En production, le jeton doit etre court, emis apres une vraie connexion HTTPS et transmis avec `wss://`. Le secret HMAC reste exclusivement sur le serveur. Une variable `VITE_` est publique dans le bundle navigateur et ne doit jamais contenir ce secret.

## Protections verifiees

- Limite de 64 KiB par message et 60 messages par seconde par socket.
- Rejet des messages binaires, versions invalides, sequences dupliquees et actions mal formees.
- Jetons HMAC expires avec comparaison de signature en temps constant.
- Reservation d'un personnage deja connecte.
- `requestId` idempotent; un meme ID avec un autre contenu est rejete.
- Une session ne peut pas agir sous l'UID d'un autre joueur.
- Une course sur le meme item ne peut avoir qu'un gagnant.
- Les mutations d'inventaire critiques sont atomiques avec rollback.
- L'origine HTTP et WebSocket est limitee au client configure en production.
- Le rate limit d'authentification reconnait l'adresse transmise par le reverse proxy local.

## Limites connues avant production

- La moderation cible actuellement les personnages connectes; il manque encore les signalements et un historique consultable.
- Les zones PVP protegees, les drops speciaux du skull rouge et les runes contre les joueurs ne sont pas encore implementes.
- Les echanges, groupes, guildes et listes d'amis entre joueurs ne sont pas encore implementes.
- Les fichiers Tiled et les assets restent telecharges par le client; ils ne doivent pas contenir de secrets.
- SQLite convient au developpement et a un seul processus. PostgreSQL et une strategie de migration seront necessaires avant plusieurs instances serveur.
- Le test de charge actuel valide la connexion et le snapshot de 20 clients, pas encore un soak test de plusieurs heures.

## Verification

```powershell
npm test
npm run build
npm run test:load
npm audit --omit=dev --audit-level=high
```

Le serveur expose `GET /health` et le WebSocket `/game`.

Un lancement avec `NODE_ENV=production` exige `GAME_AUTH_SECRET` et `GAME_CLIENT_ORIGIN`. Le workflow GitHub Pages exige aussi les variables de depot `VITE_GAME_SERVER_URL` et `VITE_GAME_API_URL`; il refuse de publier un client qui retomberait accidentellement en mode local.

## Comptes et personnages

L'API HTTP expose maintenant `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` et les operations `GET`, `POST` et `DELETE` sur `/characters`. Les mots de passe sont derives avec `scrypt` et un sel aleatoire. Le navigateur recoit seulement un jeton HMAC court, le renouvelle pendant la session, puis presente ce jeton au WebSocket.

La creation automatique depuis le message `client.hello` est bloquee par defaut. `GAME_ALLOW_CHARACTER_AUTOCREATE=true` existe uniquement pour un environnement local controle. En production, un personnage doit deja appartenir au compte avant sa connexion.

## Schema SQLite

Le schema est versionne dans `server/persistence/sqliteMigrations.js`. Chaque migration est appliquee dans une transaction et inscrite dans `schema_migrations`. Une migration deja inscrite n'est jamais rejouee. Les repositories de comptes et de personnages utilisent la meme base avec WAL, foreign keys et un busy timeout.
