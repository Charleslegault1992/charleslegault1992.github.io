# 🎮 nonameyet — MMORPG 2D Web

Un MMORPG 2D multijoueur développé comme projet personnel afin d'apprendre et d'expérimenter avec le développement web, les serveurs temps réel, les bases de données et l'architecture de jeux en ligne.

Je suis un étudiant québécois en développement logiciel et ce projet me permet de mettre en pratique plusieurs concepts vus en programmation, mais aussi d'aller beaucoup plus loin avec un projet concret que je développe progressivement.

> Le projet est toujours en développement.

---

## 🌐 Jouer / voir le projet

Le client web est hébergé avec **GitHub Pages**.

👉 [Ouvrir le jeu](https://charleslegault1992.github.io/)

---

# 🧰 Technologies utilisées

### Frontend

* **JavaScript ES Modules**
* **Vite**
* **PixiJS 8**
* HTML / CSS
* WebGL
* Responsive UI
* WebSocket client
* Tiled Map Editor

### Backend

* **Node.js**
* **WebSocket**
* Serveur de jeu authoritative
* API HTTP
* Authentification
* Gestion des sessions
* Boucle serveur temps réel
* Systèmes de combat, monstres, NPC et inventaire

### Base de données

* **PostgreSQL 18**
* `node-postgres (pg)`
* Transactions SQL
* Prepared queries
* Optimistic locking
* Migrations
* Pool de connexions
* Sauvegardes asynchrones
* Monitoring avec `pg_stat_statements`

Le projet utilisait initialement **SQLite + WAL** avant d'être migré vers PostgreSQL.

### Infrastructure

* **Linux / Ubuntu Server**
* VPS **OVH**
* **systemd**
* Git / GitHub
* GitHub Pages
* Variables d'environnement
* Services et timers Linux
* Backup de base de données

### Tests

* **Node Test Runner**
* Tests unitaires
* Tests d'intégration
* Tests WebSocket
* Tests serveur authoritative
* Tests de persistence
* Tests PostgreSQL
* Tests gameplay

Le projet contient actuellement **plus de 280 tests automatisés**.

---

# 🧠 Quelques concepts mis en pratique

Ce projet m'a permis de travailler sur plusieurs problèmes réels qu'on retrouve dans une application multijoueur.

### Serveur authoritative

Le client ne décide pas directement du résultat des actions importantes.

Le serveur valide notamment :

* les déplacements;
* le combat;
* l'utilisation des items;
* les sorts;
* les NPC;
* les inventaires;
* les interactions avec le monde;
* les sauvegardes des personnages.

Cela réduit les possibilités de triche et garde l'état du monde cohérent entre les joueurs.

---

### 🌐 Communication temps réel

Le client et le serveur communiquent avec **WebSocket**.

Le système comprend notamment :

* snapshots du monde;
* deltas;
* réplication des joueurs;
* mouvements;
* combat;
* chat;
* événements;
* reconnexion;
* synchronisation de l'état.

---

### 🏃 Prédiction et interpolation

Pour rendre le mouvement plus fluide malgré la latence réseau :

* le joueur local utilise de la **client-side prediction**;
* le serveur reste authoritative;
* le client effectue une **reconciliation** avec l'état serveur;
* les joueurs et monstres distants utilisent de l'**interpolation**.

---

### 💾 Persistence PostgreSQL

Les comptes et personnages sont sauvegardés dans PostgreSQL.

La persistence utilise notamment :

* un Pool de connexions partagé;
* des transactions;
* des requêtes paramétrées;
* des migrations versionnées;
* de l'optimistic locking;
* des sauvegardes asynchrones;
* une queue avec coalescing;
* une concurrence limitée pour éviter de surcharger la base de données.

La boucle principale du jeu n'attend pas les sauvegardes SQL.

---

### 🎒 Inventaire et objets

Le jeu possède un système d'objets permettant entre autres :

* inventaires;
* équipements;
* sacs;
* sacs dans des sacs;
* objets au sol;
* stacks;
* déplacement d'items;
* poids et capacité;
* runes;
* nourriture;
* coffres;
* loot de monstres.

Les opérations importantes sont validées par le serveur.

---

### 🗺️ Monde avec Tiled

Les maps sont créées avec **Tiled Map Editor**.

Le moteur charge notamment :

* plusieurs étages;
* collisions;
* objets;
* murs;
* portes;
* transitions entre étages;
* zones;
* NPC;
* tilesets externes et intégrés.

---

### ⚔️ Gameplay

Quelques systèmes déjà présents :

* combat PvE;
* PvP;
* monstres avec IA;
* aggro;
* chase;
* combat;
* respawn;
* spells;
* runes;
* dégâts élémentaires;
* fields;
* regeneration;
* expérience;
* niveaux;
* skills;
* NPC avec conversations;
* commerces;
* banque;
* quêtes;
* reward chests;
* système de mort;
* corps et loot.

---

# 🏗️ Architecture simplifiée

```text
┌─────────────────────────────┐
│         Navigateur          │
│                             │
│ Vite + PixiJS + WebGL       │
│ Prediction / Interpolation  │
└──────────────┬──────────────┘
               │
             WebSocket
               │
┌──────────────▼──────────────┐
│      Node.js Game Server    │
│                             │
│ Authoritative Simulation    │
│ Combat / Items / NPC / AI   │
│ Sessions / Networking       │
└──────────────┬──────────────┘
               │
               │ async
               ▼
┌─────────────────────────────┐
│         PostgreSQL          │
│                             │
│ Accounts                    │
│ Characters                  │
│ External identities         │
│ Moderation                  │
└─────────────────────────────┘
```

---

# 🚀 Pourquoi j'ai créé ce projet

Au départ, mon objectif était simplement de créer un petit jeu 2D dans le navigateur.

Le projet a progressivement évolué vers un véritable environnement client/serveur avec :

* plusieurs joueurs;
* persistence;
* networking;
* sécurité;
* architecture serveur;
* base de données;
* tests;
* déploiement Linux.

C'est devenu mon principal projet pour apprendre comment différentes parties d'une application complète communiquent ensemble.

---

# 📚 Ce que ce projet démontre

Ce projet est principalement un projet d'apprentissage, mais il me permet de démontrer ma capacité à :

* comprendre une base de code qui devient progressivement plus grande;
* séparer frontend, backend et persistence;
* concevoir des systèmes temps réel;
* travailler avec une base de données relationnelle;
* utiliser Git dans un projet de longue durée;
* écrire et maintenir des tests;
* diagnostiquer des problèmes de performance;
* déployer une application sur Linux;
* refactoriser des systèmes existants;
* apprendre de nouvelles technologies lorsque le projet en a besoin.

---

# 🔧 Développement local

Installation :

```bash
npm install
```

Client :

```bash
npm run dev
```

Tests :

```bash
npm test
```

Build production :

```bash
npm run build
```

Le serveur de production nécessite également une configuration PostgreSQL et plusieurs variables d'environnement qui ne sont évidemment pas incluses dans le dépôt.

---

# 📈 Projet en évolution

Le projet continue d'évoluer avec entre autres :

* amélioration du networking;
* optimisation serveur;
* nouvelles zones;
* nouveaux NPC;
* raids;
* nouvelles mécaniques de gameplay;
* amélioration de la persistence;
* outils administratifs;
* tests de charge;
* amélioration continue de l'architecture.

---

## 👨‍💻 À propos

Projet personnel développé par **Charles Legault**, étudiant québécois en développement logiciel.

Je développe ce projet principalement pour apprendre, expérimenter et construire un portfolio démontrant mes compétences en développement logiciel, web et backend.

Je suis également intéressé par les opportunités de **stage en développement logiciel / web** au Québec.

---

⭐ Si vous êtes recruteur, développeur ou simplement curieux, n'hésitez pas à parcourir le code et l'historique du projet.
