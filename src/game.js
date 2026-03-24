import {
  getAnxietyDelta as getAnxietyDeltaForState,
  getBurstMitigation as getBurstMitigationForState,
  getDefaultStatusText as getDefaultStatusTextForState,
  getGameOverMessage,
  getHudToneState,
  getNpcNoticeState,
  getSpeedScale as getSpeedScaleForState,
  getWallFlowerActivationDistance,
  isMoving as isMovingKeys,
  shouldAllowActions,
} from "./game-rules.js";
import {
  ensureRoadCoverage,
  generateRoadStarts,
  getDirectionForPatrol,
  getNpcSidewalkSpawn,
  getSidewalkLanes,
  spansBetweenRoads,
} from "./world-rules.js";
import { createVoiceMonologue, VOICE_CUE_TABLE } from "./voice-monologue.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const anxietyBar = document.getElementById("anxietyBar");
const anxietyValue = document.getElementById("anxietyValue");
const statusText = document.getElementById("statusText");
const burstText = document.getElementById("burstText");
const hoodieState = document.getElementById("hoodieState");
const phoneState = document.getElementById("phoneState");
const restState = document.getElementById("restState");
const hud = document.querySelector(".hud");

const VIEWPORT = { w: canvas.width, h: canvas.height };
const WORLD = { w: 1920, h: 1080 };
const camera = { x: 0, y: 0 };
const GAME_PACE = 0.5;

function paceMs(ms) {
  return Math.round(ms / GAME_PACE);
}

const player = {
  x: 90,
  y: 930,
  r: 10,
  speed: 1.8,
  hoodieUp: false,
  phoneOut: false,
  resting: false,
};

const houseA = { x: 36, y: 880, w: 120, h: 95, label: "Your House" };
const houseB = { x: 1740, y: 44, w: 150, h: 100, label: "Chad's House" };

const ROAD_WIDTH = 72;
const SIDEWALK_INSET = 9;
const NOTICE_LOCK_MS = paceMs(250);
const HIGH_ANXIETY_THRESHOLD = 75;
const NEAR_GOAL_DISTANCE = 220;

// Provide a hosted WAV URL through this global before loading game.js.
const VOICE_MONOLOGUE_URL = globalThis.NOTICE_AVOID_VOICE_URL || "";

const voiceMonologue = createVoiceMonologue({
  enabled: true,
  voiceUrl: VOICE_MONOLOGUE_URL,
  cueTable: VOICE_CUE_TABLE,
});

let hRoadY = [];
let vRoadX = [];
let roads = [];
let areas = [];
let parks = [];
let lakes = [];

let walls = [];
let npcs = [];
let sidewalkLanes = [];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function roadIntersectsRect(road, rect) {
  return rectsOverlap(road, rect);
}

function chooseAreaType() {
  const roll = Math.random();
  if (roll < 0.58) return "residential";
  if (roll < 0.76) return "commercial";
  if (roll < 0.89) return "park";
  if (roll < 0.97) return "civic";
  return "lake";
}

function generateNeighborhood() {
  const avoidHorizontal = [
    { min: houseA.y - 16, max: houseA.y + houseA.h + 16 },
    { min: houseB.y - 16, max: houseB.y + houseB.h + 16 },
  ];
  const avoidVertical = [
    { min: houseA.x - 16, max: houseA.x + houseA.w + 16 },
    { min: houseB.x - 16, max: houseB.x + houseB.w + 16 },
  ];

  hRoadY = generateRoadStarts(randInt(3, 4), WORLD.h, ROAD_WIDTH, avoidHorizontal);
  vRoadX = generateRoadStarts(randInt(3, 5), WORLD.w, ROAD_WIDTH, avoidVertical);
  hRoadY = ensureRoadCoverage(hRoadY, WORLD.h, 2, ROAD_WIDTH, avoidHorizontal);
  vRoadX = ensureRoadCoverage(vRoadX, WORLD.w, 2, ROAD_WIDTH, avoidVertical);

  roads = [
    ...hRoadY.map((y) => ({ x: 0, y, w: WORLD.w, h: ROAD_WIDTH })),
    ...vRoadX.map((x) => ({ x, y: 0, w: ROAD_WIDTH, h: WORLD.h })),
  ];

  parks = [];
  lakes = [];
  areas = [];

  const xSpans = spansBetweenRoads(vRoadX, WORLD.w, ROAD_WIDTH);
  const ySpans = spansBetweenRoads(hRoadY, WORLD.h, ROAD_WIDTH);

  xSpans.forEach((xSpan) => {
    ySpans.forEach((ySpan) => {
      const areaType = chooseAreaType();
      const area = {
        x: xSpan.min,
        y: ySpan.min,
        w: xSpan.max - xSpan.min,
        h: ySpan.max - ySpan.min,
        type: areaType,
      };

      areas.push(area);

      if (areaType === "park") {
        parks.push({
          x: area.x + 14,
          y: area.y + 14,
          w: Math.max(20, area.w - 28),
          h: Math.max(20, area.h - 28),
        });
      }

      if (areaType === "lake" && lakes.length < 2) {
        lakes.push({
          x: area.x + 18,
          y: area.y + 18,
          w: Math.max(30, area.w - 36),
          h: Math.max(30, area.h - 36),
        });
      }
    });
  });

  if (lakes.length === 0 && areas.length > 0) {
    const fallback = areas[randInt(0, areas.length - 1)];
    lakes.push({
      x: fallback.x + 24,
      y: fallback.y + 24,
      w: Math.max(40, fallback.w - 48),
      h: Math.max(40, fallback.h - 48),
    });
  }
}

function generateWalls() {
  const blocked = [
    { x: houseA.x - 26, y: houseA.y - 26, w: houseA.w + 52, h: houseA.h + 52 },
    { x: houseB.x - 26, y: houseB.y - 26, w: houseB.w + 52, h: houseB.h + 52 },
    { x: player.x - 40, y: player.y - 40, w: 80, h: 80 },
    ...parks,
    ...lakes,
  ];

  const generated = [];
  areas.forEach((area) => populateAreaBuildings(area, blocked, generated));

  return generated;
}

function getBuildingTarget(areaType) {
  if (areaType === "residential") return randInt(3, 6);
  if (areaType === "commercial") return randInt(2, 4);
  return randInt(1, 3);
}

function getBuildingSize(areaType, maxWidth, maxHeight) {
  const widthCap = areaType === "commercial" ? 146 : 112;
  const heightCap = areaType === "commercial" ? 112 : 92;
  return {
    bw: randInt(48, Math.min(widthCap, maxWidth)),
    bh: randInt(44, Math.min(heightCap, maxHeight)),
  };
}

function getBuildingCandidate(area, bw, bh) {
  const edge = randInt(0, 3);
  let x = area.x + randInt(10, Math.max(10, area.w - bw - 10));
  let y = area.y + randInt(10, Math.max(10, area.h - bh - 10));

  if (edge === 0) y = area.y + 8;
  if (edge === 1) x = area.x + area.w - bw - 8;
  if (edge === 2) y = area.y + area.h - bh - 8;
  if (edge === 3) x = area.x + 8;

  return { x, y, w: bw, h: bh };
}

function isBuildingValid(building, blocked, generated) {
  if (blocked.some((zone) => rectsOverlap(building, zone))) return false;
  if (roads.some((road) => roadIntersectsRect(road, building))) return false;
  return !generated.some((existing) => rectsOverlap(building, existing));
}

function populateAreaBuildings(area, blocked, generated) {
  if (area.type === "park" || area.type === "lake") {
    return;
  }

  const maxWidth = Math.max(48, area.w - 24);
  const maxHeight = Math.max(44, area.h - 24);
  if (maxWidth < 48 || maxHeight < 44) {
    return;
  }

  const target = getBuildingTarget(area.type);
  let tries = 0;

  while (tries < 50) {
    tries += 1;
    const existingCount = generated.filter(
      (b) => b.x >= area.x && b.x + b.w <= area.x + area.w && b.y >= area.y && b.y + b.h <= area.y + area.h,
    ).length;
    if (existingCount >= target) {
      break;
    }

    const { bw, bh } = getBuildingSize(area.type, maxWidth, maxHeight);
    const building = getBuildingCandidate(area, bw, bh);
    if (isBuildingValid(building, blocked, generated)) {
      generated.push(building);
    }
  }
}

function isPointInsideWall(x, y) {
  return walls.some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
}

function findAreaForPoint(x, y) {
  return areas.find((area) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h);
}

function getAreaBehavior(x, y) {
  const type = findAreaForPoint(x, y)?.type || "residential";
  if (type === "commercial") {
    return { speedMin: 0.66, speedMax: 1.02, rangeMin: 108, rangeMax: 148, fovMin: 1.08, fovMax: 1.4, turnBias: 0.22 };
  }
  if (type === "park") {
    return { speedMin: 0.45, speedMax: 0.76, rangeMin: 92, rangeMax: 128, fovMin: 0.95, fovMax: 1.2, turnBias: 0.16 };
  }
  if (type === "civic") {
    return { speedMin: 0.58, speedMax: 0.86, rangeMin: 104, rangeMax: 138, fovMin: 1.05, fovMax: 1.32, turnBias: 0.2 };
  }
  if (type === "lake") {
    return { speedMin: 0.5, speedMax: 0.8, rangeMin: 96, rangeMax: 132, fovMin: 0.98, fovMax: 1.25, turnBias: 0.28 };
  }
  return { speedMin: 0.5, speedMax: 0.8, rangeMin: 90, rangeMax: 125, fovMin: 0.92, fovMax: 1.16, turnBias: 0.12 };
}

function setNpcPatrolBounds(npc) {
  if (npc.patrol === "h") {
    npc.min = 20;
    npc.max = WORLD.w - 20;
  } else {
    npc.min = 20;
    npc.max = WORLD.h - 20;
  }
}

function maybeTurnAtIntersection(npc) {
  // Fire when NPC is inside both a horizontal and vertical road band — i.e. at an intersection.
  const onHorizontal = hRoadY.some((ry) => npc.y >= ry - 2 && npc.y <= ry + ROAD_WIDTH + 2);
  const onVertical = vRoadX.some((rx) => npc.x >= rx - 2 && npc.x <= rx + ROAD_WIDTH + 2);

  if (!onHorizontal || !onVertical) {
    return;
  }

  // Cooldown prevents re-firing every tick while inside the intersection band.
  const now = performance.now();
  if (now - npc.lastTurnedAt < 1200) {
    return;
  }

  const nearby = npcs.filter((other) => other !== npc && Math.hypot(other.x - npc.x, other.y - npc.y) < 92).length;
  const turnChance = Math.min(0.62, npc.turnBias + nearby * 0.06);

  if (Math.random() >= turnChance) {
    npc.lastTurnedAt = now; // consumed the decision window even if no turn taken
    return;
  }

  // Sidewalk lane coords for each direction.
  const vSidewalkCoords = vRoadX.flatMap((rx) => [rx + SIDEWALK_INSET, rx + ROAD_WIDTH - SIDEWALK_INSET]);
  const hSidewalkCoords = hRoadY.flatMap((ry) => [ry + SIDEWALK_INSET, ry + ROAD_WIDTH - SIDEWALK_INSET]);

  if (npc.patrol === "h") {
    if (vSidewalkCoords.length === 0) return;
    npc.patrol = "v";
    npc.dir = Math.random() < 0.5 ? Math.PI * 0.5 : Math.PI * 1.5;
    const snappedX = vSidewalkCoords.reduce(
      (best, coord) => (Math.abs(coord - npc.x) < Math.abs(best - npc.x) ? coord : best),
    );
    npc.x = snappedX;
    npc.laneCoord = snappedX;
  } else {
    if (hSidewalkCoords.length === 0) return;
    npc.patrol = "h";
    npc.dir = Math.random() < 0.5 ? 0 : Math.PI;
    const snappedY = hSidewalkCoords.reduce(
      (best, coord) => (Math.abs(coord - npc.y) < Math.abs(best - npc.y) ? coord : best),
    );
    npc.y = snappedY;
    npc.laneCoord = snappedY;
  }

  npc.lastTurnedAt = now;
  setNpcPatrolBounds(npc);
}

function canSpawnNpcAt(x, y) {
  const farFromPlayer = Math.hypot(x - player.x, y - player.y) > 120;
  const farFromHouseA = Math.hypot(x - (houseA.x + houseA.w * 0.5), y - (houseA.y + houseA.h * 0.5)) > 100;
  const farFromHouseB = Math.hypot(x - (houseB.x + houseB.w * 0.5), y - (houseB.y + houseB.h * 0.5)) > 100;
  return farFromPlayer && farFromHouseA && farFromHouseB && !isPointInsideWall(x, y);
}

function buildNpc(x, y, lane) {
  const horizontal = lane.horizontal;
  const behavior = getAreaBehavior(x, y);
  return {
    x,
    y,
    dir: getDirectionForPatrol(horizontal),
    speed: behavior.speedMin + Math.random() * (behavior.speedMax - behavior.speedMin),
    range: randInt(behavior.rangeMin, behavior.rangeMax),
    fov: behavior.fovMin + Math.random() * (behavior.fovMax - behavior.fovMin),
    patrol: horizontal ? "h" : "v",
    turnBias: behavior.turnBias,
    noticeLocked: false,
    noticeSeenSince: null,
    laneCoord: lane.coord,
    lastTurnedAt: 0,
    min: 20,
    max: horizontal ? WORLD.w - 20 : WORLD.h - 20,
  };
}

function generateNpcs() {
  const generated = [];
  const npcTarget = randInt(20, 36);

  if (sidewalkLanes.length === 0) {
    return generated;
  }

  let tries = 0;

  while (generated.length < npcTarget && tries < 1400) {
    tries += 1;
    const lane = sidewalkLanes[randInt(0, sidewalkLanes.length - 1)];
    const { x, y } = getNpcSidewalkSpawn(lane, WORLD);

    if (!canSpawnNpcAt(x, y)) {
      continue;
    }

    generated.push(buildNpc(x, y, lane));
  }

  return generated;
}

generateNeighborhood();
sidewalkLanes = getSidewalkLanes(hRoadY, vRoadX, ROAD_WIDTH, SIDEWALK_INSET);
walls = generateWalls();
npcs = generateNpcs();

const keys = new Set();
let anxiety = 25;
let delivered = false;
let gameOver = false;
let gameOverReason = "";
let burstMessageUntil = 0;
let nextInternalBurstAt = performance.now() + randInt(paceMs(7000), paceMs(14000));
let previousSeenCount = 0;
let wasNearGoal = false;
let wasHighAnxiety = false;

function getDefaultStatusText() {
  return getDefaultStatusTextForState({
    gameOver,
    delivered,
    resting: player.resting,
  });
}

function getBurstMitigation() {
  return getBurstMitigationForState({
    hoodieUp: player.hoodieUp,
    phoneOut: player.phoneOut,
    resting: player.resting,
  });
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
  voiceMonologue.trigger("burst_hit");
  if (rawBurst >= 28) {
    voiceMonologue.trigger("burst_heavy");
  }
  if (anxiety >= 100) {
    gameOverReason = "burst";
  }

  statusText.textContent = `Suddenly, you aren't feeling it. +${reducedBurst} anxiety`;
  setBurstMessage(`Suddenly, you aren't feeling it. +${reducedBurst} anxiety`);
  burstMessageUntil = now + paceMs(2800);
  nextInternalBurstAt = now + randInt(paceMs(9000), paceMs(18000));
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

  if (!shouldAllowActions({ gameOver, delivered })) {
    return;
  }

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

function warmVoiceMonologue() {
  voiceMonologue.prepareAfterUserGesture();
}

globalThis.addEventListener("pointerdown", warmVoiceMonologue, { once: true });
globalThis.addEventListener("keydown", warmVoiceMonologue, { once: true });

function toggleHoodie() {
  if (!shouldAllowActions({ gameOver, delivered })) {
    return;
  }

  player.hoodieUp = !player.hoodieUp;
  if (player.hoodieUp) {
    voiceMonologue.trigger("hoodie_on");
  }
  updateActionHud();
}

function togglePhone() {
  if (!shouldAllowActions({ gameOver, delivered })) {
    return;
  }

  player.phoneOut = !player.phoneOut;
  if (player.phoneOut) {
    voiceMonologue.trigger("phone_on");
  }
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
  if (!shouldAllowActions({ gameOver, delivered })) {
    return;
  }

  const activationDistance = getWallFlowerActivationDistance(player.r, player.speed);

  const nearWall = walls.some((w) => {
    const cx = Math.max(w.x, Math.min(player.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(player.y, w.y + w.h));
    return Math.hypot(player.x - cx, player.y - cy) <= activationDistance;
  });

  if (nearWall) {
    player.resting = !player.resting;
    voiceMonologue.trigger(player.resting ? "rest_on" : "rest_off");
    statusText.textContent = player.resting
      ? "Wall-flower mode: taking a breather."
      : "Mission: deliver homework to Chad.";
    updateActionHud();
  } else {
    voiceMonologue.trigger("rest_miss");
    statusText.textContent = "Move next to a wall to use Wall-Flower mode.";
  }
}

function clearRemedies() {
  player.hoodieUp = false;
  player.phoneOut = false;
  player.resting = false;
  updateActionHud();
}

function lockEndStateControls() {
  keys.clear();
  clearRemedies();
  updateHudTone();
}

function updateHudTone() {
  if (!hud) {
    return;
  }

  const tone = getHudToneState({ gameOver, delivered });
  hud.classList.remove("state-progress", "state-win", "state-loss");
  if (tone === "loss") {
    hud.dataset.state = "loss";
    hud.classList.add("state-loss");
    return;
  }
  if (tone === "win") {
    hud.dataset.state = "win";
    hud.classList.add("state-win");
    return;
  }
  hud.dataset.state = "progress";
  hud.classList.add("state-progress");
}

function isMoving() {
  return isMovingKeys(keys);
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
  return getSpeedScaleForState({
    hoodieUp: player.hoodieUp,
    phoneOut: player.phoneOut,
  });
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
    const stepX = (dx / mag) * player.speed * speedScale * GAME_PACE;
    const stepY = (dy / mag) * player.speed * speedScale * GAME_PACE;

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
      n.x += Math.cos(n.dir) * n.speed * GAME_PACE;
      if (n.x < n.min || n.x > n.max) {
        n.dir = Math.PI - n.dir;
      }
    } else {
      n.y += Math.sin(n.dir) * n.speed * GAME_PACE;
      if (n.y < n.min || n.y > n.max) {
        n.dir = -n.dir;
      }
    }

    // Soft pull back toward sidewalk lane — keeps NPCs on the pavement, allows slight drift.
    if (n.laneCoord != null) {
      if (n.patrol === "h") {
        n.y += (n.laneCoord - n.y) * 0.08 * GAME_PACE;
      } else {
        n.x += (n.laneCoord - n.x) * 0.08 * GAME_PACE;
      }
    }

    maybeTurnAtIntersection(n);
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
  const now = performance.now();
  let seenCount = 0;

  npcs.forEach((n) => {
    const dx = player.x - n.x;
    const dy = player.y - n.y;
    const dist = Math.hypot(dx, dy);
    const angleToPlayer = Math.atan2(dy, dx);
    const facing = n.dir;
    const delta = Math.atan2(Math.sin(angleToPlayer - facing), Math.cos(angleToPlayer - facing));
    const canSeeNow =
      dist <= n.range && Math.abs(delta) < n.fov * 0.5 && !lineBlockedByWall(n.x, n.y, player.x, player.y);

    const nextNoticeState = getNpcNoticeState(
      { isLocked: n.noticeLocked, seenSince: n.noticeSeenSince },
      canSeeNow,
      now,
      NOTICE_LOCK_MS,
    );
    const wasSeenSince = n.noticeSeenSince;
    const wasLocked = n.noticeLocked;
    n.noticeLocked = nextNoticeState.isLocked;
    n.noticeSeenSince = nextNoticeState.seenSince;

    if (!wasLocked && n.noticeLocked) {
      voiceMonologue.trigger("notice_locked");
    }

    if (wasSeenSince !== null && !canSeeNow && !wasLocked) {
      voiceMonologue.trigger("near_miss_cone_exit");
    }

    if (n.noticeLocked) {
      seenCount += 1;
    }
  });

  return seenCount;
}

function getAnxietyDelta(seenCount) {
  return getAnxietyDeltaForState(seenCount, {
    hoodieUp: player.hoodieUp,
    phoneOut: player.phoneOut,
    resting: player.resting,
  });
}

function updateAnxiety() {
  if (gameOver || delivered) {
    return;
  }

  const seenCount = countNpcsSeeingPlayer();
  if (seenCount >= 2 && previousSeenCount < 2) {
    voiceMonologue.trigger("crowd_locked");
  }
  previousSeenCount = seenCount;
  const anxietyDelta = getAnxietyDelta(seenCount) * GAME_PACE;

  const movementStress = isMoving() && !player.phoneOut ? 0.02 * GAME_PACE : 0;
  anxiety = Math.max(0, Math.min(100, anxiety + anxietyDelta + movementStress));
  maybeTriggerInternalBurst(performance.now());

  anxietyBar.value = anxiety;
  anxietyValue.textContent = String(Math.round(anxiety));

  if (!wasHighAnxiety && anxiety >= HIGH_ANXIETY_THRESHOLD) {
    voiceMonologue.trigger("anxiety_high");
  }
  if (wasHighAnxiety && anxiety < 40) {
    voiceMonologue.trigger("anxiety_recovered");
  }
  wasHighAnxiety = anxiety >= HIGH_ANXIETY_THRESHOLD;

  if (anxiety >= 100) {
    gameOver = true;
    lockEndStateControls();
    voiceMonologue.trigger(gameOverReason === "burst" ? "game_over_burst" : "game_over_seen");
    statusText.textContent =
      gameOverReason === "burst" ? getGameOverMessage("burst") : getGameOverMessage("other");
  }

  clearBurstMessageIfDone(performance.now());
}

function checkMission() {
  if (!delivered) {
    const houseCenterX = houseB.x + houseB.w * 0.5;
    const houseCenterY = houseB.y + houseB.h * 0.5;
    const nearGoal = Math.hypot(player.x - houseCenterX, player.y - houseCenterY) <= NEAR_GOAL_DISTANCE;
    if (!wasNearGoal && nearGoal) {
      voiceMonologue.trigger("near_goal");
    }
    wasNearGoal = nearGoal;
  }

  if (
    !delivered &&
    player.x > houseB.x &&
    player.x < houseB.x + houseB.w &&
    player.y > houseB.y &&
    player.y < houseB.y + houseB.h
  ) {
    delivered = true;
    lockEndStateControls();
    voiceMonologue.trigger("delivered");
    statusText.textContent = getDefaultStatusText();
    setBurstMessage("");
  }
}

function updateCamera() {
  camera.x = Math.max(0, Math.min(player.x - VIEWPORT.w / 2, WORLD.w - VIEWPORT.w));
  camera.y = Math.max(0, Math.min(player.y - VIEWPORT.h / 2, WORLD.h - VIEWPORT.h));
}

function drawCity() {
  ctx.fillStyle = "#dfe7d4";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  parks.forEach((p) => {
    ctx.fillStyle = "#b7d2a6";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  lakes.forEach((lake) => {
    ctx.fillStyle = "#90bed0";
    ctx.beginPath();
    ctx.ellipse(
      lake.x + lake.w * 0.5,
      lake.y + lake.h * 0.5,
      lake.w * 0.5,
      lake.h * 0.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });

  // Pass 1: sidewalk band (light concrete) — full road rect for each road.
  ctx.fillStyle = "#c0bcb0";
  roads.forEach((road) => ctx.fillRect(road.x, road.y, road.w, road.h));

  // Pass 2: carriageway (asphalt) — inset from each road edge, leaving sidewalk strips.
  ctx.fillStyle = "#9a9c98";
  roads.forEach((road) => {
    if (road.w > road.h) {
      ctx.fillRect(road.x, road.y + SIDEWALK_INSET, road.w, road.h - SIDEWALK_INSET * 2);
    } else {
      ctx.fillRect(road.x + SIDEWALK_INSET, road.y, road.w - SIDEWALK_INSET * 2, road.h);
    }
  });

  // Pass 3: centre-line dashes.
  roads.forEach((road) => {
    ctx.strokeStyle = "rgba(243, 239, 226, 0.65)";
    ctx.setLineDash([12, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (road.w > road.h) {
      const cy = road.y + road.h * 0.5;
      ctx.moveTo(road.x + 16, cy);
      ctx.lineTo(road.x + road.w - 16, cy);
    } else {
      const cx = road.x + road.w * 0.5;
      ctx.moveTo(cx, road.y + 16);
      ctx.lineTo(cx, road.y + road.h - 16);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  ctx.lineWidth = 1;

  ctx.fillStyle = "#c7b59f";
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

    ctx.fillStyle = n.noticeLocked ? "rgba(191, 61, 45, 0.24)" : "rgba(61, 112, 147, 0.14)";
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
  updateHudTone();
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
updateHudTone();
tick();
