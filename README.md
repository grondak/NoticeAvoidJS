# NoticeAvoidJS

Notice:Avoid is a lightweight browser game prototype. You move through a city to deliver Chad's science homework while trying to avoid being noticed and keeping anxiety under control.

## Current Prototype

- Top-down movement using WASD or arrow keys
- NPC line-of-sight awareness
- Anxiety system that rises when you are seen
- Player social tools:
  - Hoodie up/down
  - Phone out/away
  - Wall-resting (press Space while next to a wall)
- Win condition: reach Chad's house before anxiety maxes out

## Local Run

Because this is plain HTML/CSS/JS, you can run it with any static file server.

### Option 1: Python

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

### Option 2: VS Code Live Server

Open `index.html` and launch with Live Server.

## Project Structure

```
NoticeAvoidJS/
├── index.html
├── src/
│   ├── game.js
│   └── styles.css
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
