# DevMaster PWA

Application d'apprentissage interactive pour maîtriser **React.js** et **Flutter** en jouant — plus une section arcade « Pause Dev ». Interface en français, sans compte, sans backend, sans aucune dépendance distante.

Technologies : **HTML5 + CSS3 + JavaScript natif uniquement** (React et Flutter sont enseignés, pas utilisés pour construire l'app).

## Fichiers livrés

| Fichier | Rôle |
|---|---|
| `index.html` | Application complète : interface, styles CSS et JavaScript principal (fichier unique autonome) |
| `manifest.webmanifest` | Manifeste PWA (standalone, portrait, raccourcis) |
| `sw.js` | Service Worker : précache + nettoyage des anciens caches |
| `icons/` | Icônes PNG 180/192/512 + icône maskable (générées par `tests/make_icons.py`) |
| `tests/smoke.mjs` | Tests du noyau (progression, sauvegarde, import, catalogue) — Node, sans navigateur |
| `tests/e2e/` | Tests navigateur réels (Chrome headless) : navigation, parties, hors ligne |
| `tests/make_icons.py` | Génération des icônes (Pillow) |

## Lancement

Le Service Worker et l'installation **exigent HTTPS ou localhost**. Un simple `file://` n'active ni le cache hors ligne ni l'installation (l'app reste utilisable, mais sans PWA).

```bash
cd jeux_v2
python3 -m http.server 8765        # ou : npx serve .
# puis ouvrir http://localhost:8765/
```

## Installation sur Android (Chrome)

1. Ouvrir `https://<ton-domaine>/` (ou `http://localhost:8765/` en test).
2. Menu Chrome (⋮) → **Installer l'application** / **Ajouter à l'écran d'accueil**.
3. Confirmer : DevMaster s'ouvre en plein écran, sans barre de navigateur.

Depuis l'app : **Profil → Application → Installer l'application** (le bouton utilise l'invite native si le navigateur la propose, sinon il affiche les instructions exactes).

## Déploiement HTTPS

- **GitHub Pages / Netlify / Vercel** : déposer le dossier tel quel ; HTTPS est fourni automatiquement.
- Serveur maison : certificat Let's Encrypt (ex. Caddy : `reverse_proxy` automatique HTTPS).
- Vérifier que `sw.js` est servi en `Content-Type: text/javascript` et que le scope `/` (ou sous-dossier) correspond au `scope` du manifeste.

## Test hors ligne

1. Charger l'app une fois en ligne (le Service Worker met en cache la coquille).
2. Couper le réseau (mode avion).
3. Recharger : l'app démarre, les 18 jeux sont jouables, la progression continue de s'enregistrer.
   Vérifié automatiquement par `tests/e2e/offline.mjs`.

## Tests

```bash
node tests/smoke.mjs        # noyau : niveaux, XP, records, défis, import/export (21 tests)

# tests navigateur (nécessite Chrome + npm i puppeteer-core dans un dossier adjacent)
python3 -m http.server 8765 &
cd tests/e2e && node test.mjs && node offline.mjs && node order-games.mjs
```

Dernier passage : **21/21** noyau, **53/53** E2E, **20/20** hors ligne + interactions, **0 erreur JS** en navigateur.

## Fonctionnalités réellement terminées

**Structure**
- Navigation inférieure fixe (Accueil, Explorer, Progression, Profil) + en-tête adaptatif + écran de jeu prioritaire (Retour, score, chronomètre, Pause).
- 3 univers : React.js (3 domaines), Flutter (3 domaines), Pause Dev (arcade).

**18 jeux jouables**
- React : Puzzle JSX (6 exercices), Cartes mémoire Hooks (5 paires, retournement 3D, meilleurs temps/essais), Vrai/Faux éclair (15 affirmations, 2 modes), Circuit/Pipe Flow (6 scénarios animés), Swipe Decision (10 scénarios, balayage facultatif), Tri & rangement (3 séries × 6 briques), Circuit API (3 ordres + 5 scénarios GET/POST/PATCH/erreurs).
- Flutter : Puzzle arbre de Widgets (5 arbres), Balance Stateful/Stateless (8 scénarios), Tir sur cible UI (14 consignes, difficulté progressive), Circuit de données (6 flux : Bloc, Riverpod, Repository, cache, injection), Swipe Decision mobile (10 scénarios), Puzzle JSON parsing (3 ordres + 6 mappings de clés/types Dart), Tri & rangement architecture Flutter (3 séries × 6 briques).
- Arcade : Serpent de code (Canvas, D-pad + balayage, anti-demi-tour, accélération), Casse-briques (3 niveaux, 3 vies, collisions à sous-pas), Labyrinthe du code (génération récursive garantie résoluble, 3 difficultés), Course Tap-Tap (4 coureurs, taps alternés, équilibrée).

**Progression**
- 8 niveaux (Code Rookie → Architecture Master), barème configurable (+10/+20/+25/+15/+30 XP), pas de double récompense, aucun XP en cas d'abandon.
- Précision calculée (« — » si aucune réponse), statistiques séparées par univers et arcade, records, historique des parties, série de jours, 5 défis quotidiens, 8 succès.
- Sauvegarde localStorage centralisée et validée (version, sanitisation, migration), export JSON téléchargeable, import avec vérification + confirmation, réinitialisation avec confirmation explicite.

**PWA**
- Manifeste valide (standalone, portrait, raccourcis), icônes 180/192/512/maskable, Service Worker avec version de cache et nettoyage, indicateur en ligne/hors ligne, vibration facultative, `prefers-reduced-motion` respecté.

## Limites connues (honnêteté)

- Service Worker et installation ne fonctionnent pas en `file://` (contrainte des navigateurs) : servir en localhost/HTTPS.
- La date de journée active vient de l'horloge locale : elle n'est pas vérifiée côté serveur (l'app est 100 % locale, par conception).
- Les exercices sont évalués par solutions attendues comparées (jamais d'`eval`) : les variantes acceptées sont explicites, mais un reformulé inhabituel sera refusé.
- La vibration dépend du support navigateur (fonctionne sur Chrome Android).
