const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const anxietyBar = document.getElementById("anxietyBar");
const anxietyValue = document.getElementById("anxietyValue");
const statusText = document.getElementById("statusText");
const hoodieState = document.getElementById("hoodieState");
const phoneState = document.getElementById("phoneState");
const restState = document.getElementById("restState");

const WORLD = {
  w: canvas.width,
  h: canvas.height,
};

const player = {
  x: 80,
  y: 470,
  r: 10,
  speed: 2.3,
  hoodieUp: false,
  phoneOut: false,
  resting: false,
};

const houseA = { x: 36, y: 430, w: 120, h: 95, label: "Your House" };
const houseB = { x: 780, y: 44, w: 150, h: 100, label: "Chad's House" };

const walls = [
  { x: 190, y: 350, w: 14, h: 175 },
  { x: 310, y: 190, w: 240, h: 14 },
  { x: 530, y: 265, w: 14, h: 205 },
  { x: 690, y: 90, w: 14, h: 175 },
  { x: 390, y: 370, w: 220, h: 14 },
];

const npcs = [
  { x: 295, y: 120, dir: 1.2, speed: 0.8, range: 120, fov: 1.2, patrol: "h" },
  { x: 655, y: 440, dir: -2.6, speed: 0.6, range: 130, fov: 1.3, patrol: "v" },
  { x: 460, y: 85, dir: 2.6, speed: 0.7, range: 100, fov: 1.0, patrol: "h" },
];

const keys = new Set();
let anxiety = 25;
let delivered = false;
let gameOver = false;

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys.add(key);

  if (!e.repeat) {
    if (key === "i") {
      toggleHoodie();
    } else if (key === "o") {
      togglePhone();
    } else if (key === "p") {
      toggleRest();
    }
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

function toggleHoodie() {
  player.hoodieUp = !player.hoodieUp;
  updateActionHud();
}

function togglePhone() {
  player.phoneOut = !player.phoneOut;
  updateActionHud();
}

function updateActionHud() {
  hoodieState.innerHTML = `<kbd>I</kbd> Hoodie: ${player.hoodieUp ? "Up" : "Down"}`;
  phoneState.innerHTML = `<kbd>O</kbd> Phone: ${player.phoneOut ? "Out" : "Away"}`;
  restState.innerHTML = `<kbd>P</kbd> Wall-Flower: ${player.resting ? "On" : "Off"}`;

  hoodieState.classList.toggle("active", player.hoodieUp);
  phoneState.classList.toggle("active", player.phoneOut);
  restState.classList.toggle("active", player.resting);
}

function toggleRest() {
  const nearWall = walls.some((w) => {
    const cx = Math.max(w.x, Math.min(player.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(player.y, w.y + w.h));
    return Math.hypot(player.x - cx, player.y - cy) < 12;
  });

  if (nearWall) {
    player.resting = !player.resting;
    statusText.textContent = player.resting
      ? "Wall-flower mode: taking a breather."
      : "Mission: deliver homework to Chad.";
    updateActionHud();
  } else {
    statusText.textContent = "Move next to a wall to use Wall-Flower mode.";
  }
}

function isMoving() {
  return keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d");
}

function insideRect(x, y, r) {
  return x > r && y > r && x < WORLD.w - r && y < WORLD.h - r;
}

function collidesWithWalls(x, y, r) {
  return walls.some(
    (w) => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h,
  );
}

function updatePlayer() {
  if (gameOver || delivered || player.resting) {
    return;
  }

  let dx = 0;
  let dy = 0;

  if (keys.has("w")) dy -= 1;
  if (keys.has("s")) dy += 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;

  if (dx || dy) {
    const mag = Math.hypot(dx, dy) || 1;
    const speedScale = player.phoneOut ? 0.72 : 1;
    const stepX = (dx / mag) * player.speed * speedScale;
    const stepY = (dy / mag) * player.speed * speedScale;

    const nx = player.x + stepX;
    const ny = player.y + stepY;

    if (insideRect(nx, player.y, player.r) && !collidesWithWalls(nx, player.y, player.r)) {
      player.x = nx;
    }
    if (insideRect(player.x, ny, player.r) && !collidesWithWalls(player.x, ny, player.r)) {
      player.y = ny;
    }
  }
}

function updateNpcs() {
  npcs.forEach((n) => {
    if (n.patrol === "h") {
      n.x += Math.cos(n.dir) * n.speed;
      if (n.x < 200 || n.x > 720) {
        n.dir = Math.PI - n.dir;
      }
    } else {
      n.y += Math.sin(n.dir) * n.speed;
      if (n.y < 110 || n.y > 460) {
        n.dir = -n.dir;
      }
    }
  });
}

function lineBlockedByWall(x1, y1, x2, y2) {
  for (const w of walls) {
    if (segmentIntersectsRect(x1, y1, x2, y2, w)) {
      return true;
    }
  }
  return false;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  const edges = [
    [rect.x, rect.y, rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
    [rect.x, rect.y + rect.h, rect.x, rect.y],
  ];
  return edges.some(([ax, ay, bx, by]) => segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by));
}

function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (d === 0) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function updateAnxiety() {
  if (gameOver || delivered) {
    return;
  }

  let anxietyDelta = -0.01;
  let seenCount = 0;

  npcs.forEach((n) => {
    const dx = player.x - n.x;
    const dy = player.y - n.y;
    const dist = Math.hypot(dx, dy);

    if (dist > n.range) {
      return;
    }

    const angleToPlayer = Math.atan2(dy, dx);
    const facing = n.dir;
    const delta = Math.atan2(Math.sin(angleToPlayer - facing), Math.cos(angleToPlayer - facing));

    if (Math.abs(delta) < n.fov * 0.5 && !lineBlockedByWall(n.x, n.y, player.x, player.y)) {
      seenCount += 1;
    }
  });

  if (seenCount > 0) {
    anxietyDelta += 0.26 * seenCount;
    if (player.hoodieUp) anxietyDelta -= 0.09;
    if (player.phoneOut) anxietyDelta -= 0.07;
    if (player.resting) anxietyDelta -= 0.18;
  } else {
    if (player.resting) anxietyDelta -= 0.22;
    if (player.phoneOut) anxietyDelta -= 0.02;
  }

  const movementStress = isMoving() && !player.phoneOut ? 0.02 : 0;
  anxiety = Math.max(0, Math.min(100, anxiety + anxietyDelta + movementStress));

  anxietyBar.value = anxiety;
  anxietyValue.textContent = String(Math.round(anxiety));

  if (anxiety >= 100) {
    gameOver = true;
    statusText.textContent = "Overwhelmed. Breathe and try again (refresh).";
  }
}

function checkMission() {
  if (
    !delivered &&
    player.x > houseB.x &&
    player.x < houseB.x + houseB.w &&
    player.y > houseB.y &&
    player.y < houseB.y + houseB.h
  ) {
    delivered = true;
    statusText.textContent = "Delivered. Chad got the science homework.";
  }
}

function drawCity() {
  ctx.fillStyle = "#ece8de";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.fillStyle = "#d6d1c2";
  ctx.fillRect(0, 250, WORLD.w, 54);
  ctx.fillRect(380, 0, 60, WORLD.h);

  ctx.fillStyle = "#a9b6b2";
  walls.forEach((w) => ctx.fillRect(w.x, w.y, w.w, w.h));

  drawHouse(houseA, "#af7248");
  drawHouse(houseB, "#7b9d63");
}

function drawHouse(h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(h.x, h.y, h.w, h.h);
  ctx.fillStyle = "#f3efe2";
  ctx.fillRect(h.x + h.w * 0.4, h.y + h.h * 0.55, h.w * 0.2, h.h * 0.45);
  ctx.fillStyle = "#1b1a18";
  ctx.font = "14px sans-serif";
  ctx.fillText(h.label, h.x + 8, h.y + 18);
}

function drawNpcs() {
  npcs.forEach((n) => {
    ctx.fillStyle = "#2d4f5c";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(191, 61, 45, 0.15)";
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.arc(n.x, n.y, n.range, n.dir - n.fov / 2, n.dir + n.fov / 2);
    ctx.closePath();
    ctx.fill();
  });
}

function drawPlayer() {
  ctx.fillStyle = player.hoodieUp ? "#3d3d47" : "#5f6f89";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  if (player.phoneOut) {
    ctx.fillStyle = "#f0f5ff";
    ctx.fillRect(player.x + 6, player.y - 4, 4, 8);
  }

  if (player.resting) {
    ctx.fillStyle = "#2f7d6b";
    ctx.fillText("rest", player.x - 12, player.y - 14);
  }
}

function drawMissionLine() {
  ctx.strokeStyle = "rgba(47, 125, 107, 0.28)";
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(houseA.x + houseA.w, houseA.y + houseA.h / 2);
  ctx.lineTo(houseB.x, houseB.y + houseB.h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function tick() {
  updatePlayer();
  updateNpcs();
  updateAnxiety();
  checkMission();

  drawCity();
  drawMissionLine();
  drawNpcs();
  drawPlayer();

  requestAnimationFrame(tick);
}

updateActionHud();
tick();
