# DUNGEON RUNNER

A turn-based puzzle game with a built-in level editor. Design 8×8 dungeons, then play them: roll dice for action points, move, attack, defend, and face an AI opponent that moves enemies toward you.

---

## Running the app

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (e.g. `http://localhost:5173`). Use **Play** or **Open puzzle editor** from the home screen.

To build for production:

```bash
npm run build
npm run preview
```

### Deploying to GitHub Pages

The repo is set up to deploy to GitHub Pages via GitHub Actions.

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to the `main` branch (or run the workflow manually from the **Actions** tab). The workflow builds the app and deploys it to Pages.

The app will be available at `https://<username>.github.io/<repo-name>/`. Routes (`/editor`, `/play`) work correctly with the base path.

---

## Routes

| Route     | Purpose                          |
| --------- | -------------------------------- |
| `/`       | Home; links to Play and Editor   |
| `/editor` | Level editor (design puzzles)    |
| `/play`   | Play mode (load and play levels) |

---

## Level editor (`/editor`)

Use the editor to build levels on an **8×8 grid**.

### Tools

Select a tool, then click a cell on the board to apply it.

| Tool           | Effect                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| **Movement**   | Traversable tile (default). Click to clear an entity or reset a tile. |
| **Obstacle**   | Blocking tile. Stops movement and pathfinding.                         |
| **Player start** | Where the player begins. Only one per level.                        |
| **Enemy start**  | Where an enemy begins. You can place multiple.                        |
| **Exit**       | Goal tile. Only one per level.                                        |
| **Collectible** | Optional pick-up. Multiple allowed.                                   |
| **Eraser**     | Clears the entity on the cell (sets tile to movement, no entity).     |

### Export and import

- **Export level** — Downloads a `.json` file with the current board and metadata (name, dimensions, timestamp). Use this to save a level or share it.
- **Import level** — Opens a file picker. Choose a level JSON (from a previous export or that matches the format below) to load it into the editor and keep editing.

### Level layout tips

- Place exactly one **Player start** and one **Exit** so the level is valid for play.
- Use **Obstacle** to create walls and force paths.
- **Enemy start** positions are where enemies spawn; the AI will move them toward the player during its turn.

---

## Play mode (`/play`)

Load a level and play through the turn-based game.

### Loading a level

1. Click **Load level**.
2. Choose a `.json` level file (one you exported from the editor or that matches the level format).
3. The board appears and your turn starts automatically with a dice roll.

### Your turn

- **Dice (🎲)** — At the start of your turn you roll once. The result (1–6) is your **action points** for that turn.
- **Action points (⚡)** — Each **Move**, **Attack**, or **Defend** costs 1 point. Spend them in any order.
- **Health (❤)** — Shows your current HP (e.g. 5/5). You and all enemies start at 5/5.

**Actions:**

- **Move** — Click **Move**, then click an **adjacent** empty movement tile. Costs 1 AP. You can only move one tile per use.
- **Attack** — Click **Attack**, then click an **adjacent** enemy. Deals 1 damage and costs 1 AP. A short health indicator (e.g. 4/5) appears above the enemy. Enemies are removed at 0 HP.
- **Defend** — Click **Defend** to spend 1 AP and heal yourself 1 HP (up to your max).
- **End turn** — Enabled only when you have **0 action points** left. Click to end your turn and start the opponent’s turn.

### Opponent turn

- The bar above the board shows **Opponent turn** with a spinner while the AI runs.
- The opponent rolls dice to get its own action points.
- It picks one random enemy and uses its points to:
  - **Move** that enemy one tile at a time toward you (1 AP per step), until the enemy is adjacent to you or it runs out of AP.
  - If that enemy is already adjacent and has less HP than you, it **heals** that enemy (1 AP per 1 HP) instead.
- When the opponent is done, your next turn starts and you roll the dice again.

### Rules summary (for design)

- **Grid:** 8×8; only 4-direction (up/down/left/right) for move and attack.
- **Action points:** 1d6 per turn for both player and opponent.
- **Costs:** Move = 1, Attack = 1, Defend (heal self) = 1.
- **Enemy attack range:** 1 tile (adjacent). The AI does not attack you in the current build; it only moves enemies and heals them.
- **Starting health:** Player and every enemy start at 5 HP (max 5).

---

## Level file format

Levels are JSON files. Exported files look like this (you can edit the `name` or other fields if you want):

```json
{
  "version": 1,
  "name": "Untitled level",
  "dimensions": { "rows": 8, "cols": 8 },
  "createdAt": "2025-03-11T...",
  "grid": [
    [
      { "base": "movement", "entity": null },
      { "base": "obstacle", "entity": null },
      ...
    ],
    ...
  ]
}
```

- **grid** — 8 rows × 8 columns. Each cell has:
  - **base:** `"movement"` or `"obstacle"`
  - **entity:** `null`, `"player"`, `"enemy"`, `"exit"`, or `"collectible"`
- **dimensions** — Must be 8×8 for the app to accept the level.

Use **Export level** in the editor to generate a valid file, then **Import level** in the editor to edit it again, or **Load level** in play to test it.
