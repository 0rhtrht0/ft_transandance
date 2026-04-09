# BLACKHOLE - Game Concept Document (Révision)

## 1) Vision du jeu

**Genre**  
Action / Survie / Labyrinthe dynamique / Multijoueur

**High concept**  
Un labyrinthe instable est dominé par un trou noir mobile.  
Le trou noir se déplace aléatoirement dans la map et représente une menace immédiate pour tous les joueurs.

**Promesse joueur**  
Chaque partie est différente: labyrinthe généré, déplacement imprévisible du trou noir, spawn aléatoire des joueurs, tension continue.

## 2) Boucle de jeu (core loop)

1. Génération d’un nouveau labyrinthe (procédurale).
2. Génération de la position initiale du trou noir (aléatoire).
3. Déplacement aléatoire continu du trou noir pendant la partie.
4. Spawn des joueurs à des positions aléatoires, sûres et uniques (aucun chevauchement).
5. Exploration et tentative d’atteindre la sortie.
6. Vérification de collision en continu entre joueurs et trou noir.
7. Résolution:
   - Si un joueur touche même partiellement le trou noir (même une extrémité): absorption globale et fin de jeu.
   - Si le temps limite est atteint avant que la porte soit trouvée: le trou noir grandit, absorbe tout le labyrinthe et la partie se termine.
   - Sinon, si la condition de sortie est remplie avant contact: victoire.

## 3) Systèmes de gameplay

### 3.1 Labyrinthe procédural

- Le labyrinthe est généré automatiquement à chaque partie.
- Taille en cellules impaires, passages serrés, rendu optimisé.

### 3.2 Trou noir mobile et aléatoire

- Le trou noir a un spawn initial aléatoire.
- Il se déplace aléatoirement pendant toute la partie.
- Son mouvement ne doit pas être scripté de manière fixe.
- Le rayon est dynamique et peut augmenter brutalement lors d’un contact.

### 3.3 Collision trou noir (règle critique)

- La collision est létale au moindre contact.
- Si un joueur touche même une petite partie du trou noir (bord/extrémité inclus):
  - le trou noir grandit,
  - il absorbe les joueurs,
  - il absorbe le labyrinthe,
  - la partie se termine immédiatement.

### 3.4 Séquence d’absorption globale

Au contact:
- agrandissement visuel du trou noir,
- effondrement/aspiration visuelle du labyrinthe,
- suppression des contrôles joueur,
- écran de fin:
  **"YOU HAVE BEEN ABSORBED BY BLACKHOLE"**.

### 3.5 Spawn joueurs (multijoueur)

- Spawn aléatoire pour chaque joueur.
- Les positions de spawn doivent être différentes.
- Deux joueurs ne peuvent jamais commencer sur la même case/position.
- Le serveur est source d’autorité pour garantir l’unicité.

### 3.6 Fog of war et pression visuelle

- Vision limitée autour du joueur.
- Ambiance de danger liée à la proximité du trou noir.

### 3.7 Porte de sortie

- Objectif principal tant qu’aucun contact avec le trou noir n’a eu lieu.
- Générée dans une zone atteignable.

### 3.8 Temps limite (échec)

- Une durée maximale est définie pour la manche.
- Si ce temps expire sans que la porte de sortie soit atteinte:
  - le trou noir grandit immédiatement,
  - il absorbe les joueurs,
  - il absorbe tout le labyrinthe,
  - la partie se termine.

## 4) Conditions de fin

### Défaite (globale)

- Si un joueur touche le trou noir, même partiellement:
  - fin immédiate de la partie pour tous,
  - absorption des joueurs et du labyrinthe,
  - message de défaite:
  **"YOU HAVE BEEN ABSORBED BY BLACKHOLE"**.
- Si le temps limite est atteint sans trouver la porte:
  - croissance immédiate du trou noir,
  - absorption des joueurs et du labyrinthe,
  - message de défaite:
  **"YOU HAVE BEEN ABSORBED BY BLACKHOLE"**.

### Victoire

- Si l’objectif de sortie est atteint avant toute collision avec le trou noir:
  **"YOU MANAGED TO ESCAPE THE BLACK HOLE"**.

## 5) Règles multijoueur

- Spawn initial aléatoire et unique pour chaque joueur.
- Aucun doublon de position de départ.
- Une collision d’un seul joueur avec le trou noir déclenche la fin globale de la partie.

Contrat d’événements (architecture):
- `join`
- `join_ack`
- `state_update`
- `disconnect`

## 6) Rendu et HUD

- Caméra centrée joueur, lissée, limitée au monde.
- Zoom souris + resize responsive.
- Indicateurs de danger liés au trou noir.
- Message de fin explicite en cas d’absorption globale.

## 7) État actuel des choix (cibles)

- Labyrinthe auto-généré: **oui**
- Trou noir aléatoire: **oui**
- Déplacement aléatoire du trou noir: **oui**
- Collision partielle avec le trou noir = mort immédiate: **oui**
- Agrandissement du trou noir au contact: **oui**
- Absorption de tout le labyrinthe au contact: **oui**
- Fin de jeu immédiate au contact: **oui**
- Spawn joueurs aléatoires: **oui**
- Spawn joueurs uniques (pas la même position): **oui**
- Temps limite sans sortie = absorption globale et fin: **oui**
