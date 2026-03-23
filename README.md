# NoticeAvoidJS

Notice:Avoid is a browser social-stealth game. You walk from your house to Chad's across a generated neighborhood while trying to avoid being noticed and keeping anxiety under control.

## Current Prototype

- Top-down movement using WASD
- Procedurally generated neighborhood blocks, roads, parks, and lakes
- NPC line-of-sight awareness and road-based patrol behavior
- Anxiety system that rises when you are seen or when internal bursts hit
- Player social tools:
  - Hoodie up/down
  - Phone out/away
  - Wall-flower mode (press P near building walls)
- Movement penalties while hoodie/phone are active
- HUD state colors for in-progress, win, and loss
- Win condition: reach Chad's house before anxiety maxes out

## Local Run

Because this is plain HTML/CSS/JS, you can run it with any static file server.

### Option 1: Python

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173> and click through to `play.html`.

### Option 2: VS Code Live Server

Open `index.html` and launch with Live Server.

## Controls

- Move: W A S D
- Hoodie toggle: I
- Phone toggle: O
- Wall-flower toggle: P (near building walls)

## Automated Tests

Run regression tests with Node's built-in test runner:

```bash
npm test
```

Current coverage targets gameplay rules that are easy to regress:

- End-state action lockout (no remedy toggles after win/loss)
- HUD tone state mapping (progress/win/loss)
- Anxiety delta behavior across seen/unseen and remedy states
- Burst mitigation stacking and cap behavior
- Movement key filtering and speed scaling
- Road generation invariants and minimum coverage
- NPC road selection, patrol direction, and spawn lane bounds

## Project Structure

```
NoticeAvoidJS/
├── index.html
├── play.html
├── package.json
├── src/
│   ├── game.js
│   ├── game-rules.js
│   ├── styles.css
│   ├── version.js
│   └── world-rules.js
├── tests/
│   ├── game-rules.test.js
│   └── world-rules.test.js
└── README.md
```

## Git + GitHub Setup

Run these commands from the project folder:

```bash
git init
git add .
git commit -m "Initial NoticeAvoidJS prototype"
git branch -M main
```

If you have GitHub CLI (`gh`) authenticated:

```bash
gh repo create NoticeAvoidJS --public --source=. --remote=origin --push
```

If you prefer creating the repo manually on GitHub:

1. Create an empty repo named `NoticeAvoidJS`.
2. Then run:

```bash
git remote add origin https://github.com/<your-username>/NoticeAvoidJS.git
git push -u origin main
```

## GitHub Pages

For quick hosting, in repo settings:

1. Go to **Settings -> Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`.
4. Save.

Your game will be published at:

`https://<your-username>.github.io/NoticeAvoidJS/`
