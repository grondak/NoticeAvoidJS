const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const anxietyBar = document.getElementById("anxietyBar");
const anxietyValue = document.getElementById("anxietyValue");
const statusText = document.getElementById("statusText");
const burstText = document.getElementById("burstText");
const hoodieState = document.getElementById("hoodieState");
const phoneState = document.getElementById("phoneState");
const restState = document.getElementById("restState");

const VIEWPORT = { w: canvas.width, h: canvas.height };
const WORLD = { w: 1920, h: 1080 };
const camera = { x: 0, y: 0 };

const player = {
  x: 90,
  y: 930,
  r: 10,
  speed: 2.3,
  hoodieUp: false,
  phoneOut: false,
  resting: false,
};

const houseA = { x: 36, y: 880, w: 120, h: 95, label: "Your House" };
const houseB = { x: 1740, y: 44, w: 150, h: 100, label: "Chad's House" };

let walls = [];
let npcs = [];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function generateWalls() {
  const blocked = [
    { x: houseA.x - 20, y: houseA.y - 20, w: houseA.w + 40, h: houseA.h + 40 },
    { x: houseB.x - 20, y: houseB.y - 20, w: houseB.w + 40, h: houseB.h + 40 },
    { x: player.x - 30, y: player.y - 30, w: 60, h: 60 },
  ];

  const generated = [];
  const wallTarget = randInt(8, 16);
  let tries = 0;

  while (generated.length < wallTarget && tries < 500) {
    tries += 1;
    const vertical = Math.random() < 0.5;
    const wall = vertical
      ? { x: randInt(200, 1680), y: randInt(100, 880), w: 14, h: randInt(90, 220) }
      : { x: randInt(200, 1600), y: randInt(100, 960), w: randInt(90, 250), h: 14 };

    if (blocked.some((zone) => rectsOverlap(wall, zone))) {
      continue;
    }
    if (generated.some((existing) => rectsOverlap(wall, existing))) {
      continue;
    }
    generated.push(wall);
  }

  return generated;
}

function isPointInsideWall(x, y) {
  return walls.some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
}

function generateNpcs() {
  const generated = [];
  const npcTarget = randInt(5, 12);
  let tries = 0;

  while (generated.length < npcTarget && tries < 500) {
    tries += 1;
    const x = randInt(220, 1680);
    const y = randInt(120, 940);
    const farFromPlayer = Math.hypot(x - player.x, y - player.y) > 120;
    const farFromHouses =
      Math.hypot(x - (houseA.x + houseA.w / 2), y - (houseA.y + houseA.h / 2)) > 100 &&
      Math.hypot(x - (houseB.x + houseB.w / 2), y - (houseB.y + houseB.h / 2)) > 100;

    if (!farFromPlayer || !farFromHouses || isPointInsideWall(x, y)) {
      continue;
    }

    generated.push({
      x,
      y,
      dir: Math.random() * Math.PI * 2,
      speed: 0.55 + Math.random() * 0.4,
      range: randInt(95, 140),
      fov: 1 + Math.random() * 0.35,
      patrol: Math.random() < 0.5 ? "h" : "v",
    });
  }

  return generated;
}

walls = generateWalls();
npcs = generateNpcs();

const keys = new Set();
let anxiety = 25;
let delivered = false;
let gameOver = false;
let burstMessageUntil = 0;
let nextInternalBurstAt = performance.now() + randInt(7000, 14000);

function getDefaultStatusText() {
  if (gameOver) {
    return "Overwhelmed. Breathe and try again (refresh).";
  }
  if (delivered) {
    return "Delivered. Chad got the science homework.";
  }
  if (player.resting) {
    return "Wall-flower mode: taking a breather.";
  }
  return "Mission: deliver homework to Chad.";
}

function getBurstMitigation() {
  let mitigation = 0;
  if (player.hoodieUp) mitigation += 0.18;
  if (player.phoneOut) mitigation += 0.15;
  if (player.resting) mitigation += 0.3;
  return Math.min(0.65, mitigation);
}

function setBurstMessage(text) {
  if (!burstText) {
    return;
  }

  if (text) {
    burstText.textContent = text;
    burstText.classList.add("active");
  } else {
    burstText.textContent = "";
    burstText.classList.remove("active");
  }
}

function maybeTriggerInternalBurst(now) {
  if (now < nextInternalBurstAt || gameOver || delivered) {
    return;
  }

  const rawBurst = randInt(15, 35);
  const reducedBurst = Math.max(1, Math.round(rawBurst * (1 - getBurstMitigation())));
  anxiety = Math.min(100, anxiety + reducedBurst);

  statusText.textContent = `Suddenly, you aren't feeling it. +${reducedBurst} anxiety`;
  setBurstMessage(`Suddenly, you aren't feeling it. +${reducedBurst} anxiety`);
  burstMessageUntil = now + 2800;
  nextInternalBurstAt = now + randInt(9000, 18000);
}

function clearBurstMessageIfDone(now) {
  if (burstMessageUntil === 0 || now < burstMessageUntil) {
    return;
  }

  burstMessageUntil = 0;
  setBurstMessage("");
  statusText.textContent = getDefaultStatusText();
}

globalThis.addEventListener("keydown", (e) => {
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

globalThis.addEventListener("keyup", (e) => {
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

function getSpeedScale() {
  const hoodieScale = player.hoodieUp ? 0.84 : 1;
  const phoneScale = player.phoneOut ? 0.72 : 1;
  return hoodieScale * phoneScale;
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
    const speedScale = getSpeedScale();
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
      if (n.x < 200 || n.x > 1700) {
        n.dir = Math.PI - n.dir;
      }
    } else {
      n.y += Math.sin(n.dir) * n.speed;
      if (n.y < 110 || n.y > 960) {
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
  const lineStart = { x: x1, y: y1 };
  const lineEnd = { x: x2, y: y2 };
  return edges.some(([ax, ay, bx, by]) => {
    const edgeStart = { x: ax, y: ay };
    const edgeEnd = { x: bx, y: by };
    return segmentsIntersect(lineStart, lineEnd, edgeStart, edgeEnd);
  });
}

function segmentsIntersect(a, b, c, d) {
  const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (denom === 0) return false;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
  const u = ((a.x - c.x) * (a.y - b.y) - (a.y - c.y) * (a.x - b.x)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function countNpcsSeeingPlayer() {
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

  return seenCount;
}

function getAnxietyDelta(seenCount) {
  let anxietyDelta = -0.01;

  if (seenCount > 0) {
    anxietyDelta += 0.26 * seenCount;
    if (player.hoodieUp) anxietyDelta -= 0.09;
    if (player.phoneOut) anxietyDelta -= 0.07;
    if (player.resting) anxietyDelta -= 0.18;
  } else {
    if (player.resting) anxietyDelta -= 0.22;
    if (player.phoneOut) anxietyDelta -= 0.02;
  }

  return anxietyDelta;
}

function updateAnxiety() {
  if (gameOver || delivered) {
    return;
  }

  const seenCount = countNpcsSeeingPlayer();
  const anxietyDelta = getAnxietyDelta(seenCount);

  const movementStress = isMoving() && !player.phoneOut ? 0.02 : 0;
  anxiety = Math.max(0, Math.min(100, anxiety + anxietyDelta + movementStress));
  maybeTriggerInternalBurst(performance.now());

  anxietyBar.value = anxiety;
  anxietyValue.textContent = String(Math.round(anxiety));

  if (anxiety >= 100) {
    gameOver = true;
    statusText.textContent = getDefaultStatusText();
  }

  clearBurstMessageIfDone(performance.now());
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
    statusText.textContent = getDefaultStatusText();
    setBurstMessage("");
  }
}

function updateCamera() {
  camera.x = Math.max(0, Math.min(player.x - VIEWPORT.w / 2, WORLD.w - VIEWPORT.w));
  camera.y = Math.max(0, Math.min(player.y - VIEWPORT.h / 2, WORLD.h - VIEWPORT.h));
}

function drawCity() {
  ctx.fillStyle = "#ece8de";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.fillStyle = "#d6d1c2";
  ctx.fillRect(0, 500, WORLD.w, 54);
  ctx.fillRect(940, 0, 60, WORLD.h);

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
  updateCamera();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawCity();
  drawMissionLine();
  drawNpcs();
  drawPlayer();
  ctx.restore();

  requestAnimationFrame(tick);
}

updateActionHud();
tick();
