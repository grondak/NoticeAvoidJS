function randInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function generateRoadStarts(count, axisMax, roadWidth, avoidSpans = [], rng = Math.random) {
  const starts = [];
  const section = axisMax / (count + 1);

  for (let i = 0; i < count; i += 1) {
    let placed = false;
    let tries = 0;

    while (!placed && tries < 80) {
      tries += 1;
      const jitter = randInt(-54, 54, rng);
      const raw = Math.round(section * (i + 1) - roadWidth * 0.5 + jitter);
      const minEdge = 20;
      const maxEdge = axisMax - roadWidth - 20;
      const start = Math.max(minEdge, Math.min(maxEdge, raw));

      const tooCloseToRoad = starts.some((existing) => Math.abs(existing - start) < 190);
      const insideAvoid = avoidSpans.some((span) => start < span.max && start + roadWidth > span.min);

      if (!tooCloseToRoad && !insideAvoid) {
        starts.push(start);
        placed = true;
      }
    }
  }

  return starts.sort((a, b) => a - b);
}

export function ensureRoadCoverage(starts, axisMax, minimumCount, roadWidth, avoidSpans = []) {
  const ensured = [...starts].sort((a, b) => a - b);
  const section = axisMax / (minimumCount + 1);

  for (let i = 0; ensured.length < minimumCount && i < minimumCount * 3; i += 1) {
    const raw = Math.round(section * ((i % minimumCount) + 1) - roadWidth * 0.5);
    const start = Math.max(20, Math.min(axisMax - roadWidth - 20, raw));
    const tooClose = ensured.some((existing) => Math.abs(existing - start) < 170);
    const insideAvoid = avoidSpans.some((span) => start < span.max && start + roadWidth > span.min);

    if (!tooClose && !insideAvoid) {
      ensured.push(start);
    }
  }

  return ensured.sort((a, b) => a - b);
}

export function spansBetweenRoads(starts, max, roadWidth) {
  const cuts = [0, ...starts.flatMap((start) => [start, start + roadWidth]), max].sort((a, b) => a - b);
  const spans = [];

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const min = cuts[i];
    const maxEdge = cuts[i + 1];
    const mid = (min + maxEdge) * 0.5;
    const onRoad = starts.some((start) => mid >= start && mid <= start + roadWidth);

    if (!onRoad && maxEdge - min > 80) {
      spans.push({ min, max: maxEdge });
    }
  }

  return spans;
}

export function chooseNpcRoad(horizontalRoads, verticalRoads, rng = Math.random) {
  const hasHorizontal = horizontalRoads.length > 0;
  const hasVertical = verticalRoads.length > 0;

  if (!hasHorizontal && !hasVertical) {
    return null;
  }

  const horizontal = hasHorizontal && (!hasVertical || rng() < 0.5);
  const pool = horizontal ? horizontalRoads : verticalRoads;
  const road = pool[randInt(0, pool.length - 1, rng)];
  return { horizontal, road };
}

export function getDirectionForPatrol(horizontal, rng = Math.random) {
  if (horizontal) {
    return rng() < 0.5 ? 0 : Math.PI;
  }
  return rng() < 0.5 ? Math.PI * 0.5 : Math.PI * 1.5;
}

export function getNpcSpawnPoint(horizontal, road, world, rng = Math.random) {
  const laneOffset = randInt(-18, 18, rng);
  const x = horizontal ? randInt(30, world.w - 30, rng) : road.x + road.w * 0.5 + laneOffset;
  const y = horizontal ? road.y + road.h * 0.5 + laneOffset : randInt(30, world.h - 30, rng);
  return { x, y };
}
