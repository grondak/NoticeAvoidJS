import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseNpcRoad,
  ensureRoadCoverage,
  generateRoadStarts,
  getDirectionForPatrol,
  getNpcSpawnPoint,
  spansBetweenRoads,
} from "../src/world-rules.js";

function sequenceRng(values) {
  let i = 0;
  return () => {
    const value = values[i] ?? values[values.length - 1] ?? 0.5;
    i += 1;
    return value;
  };
}

test("generateRoadStarts returns sorted and bounded starts", () => {
  const starts = generateRoadStarts(3, 1000, 72, [], sequenceRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));

  assert.equal(starts.length, 3);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  starts.forEach((start) => {
    assert.ok(start >= 20);
    assert.ok(start <= 908);
  });
});

test("generateRoadStarts avoids blocked spans", () => {
  const starts = generateRoadStarts(
    2,
    800,
    72,
    [
      { min: 200, max: 330 },
      { min: 470, max: 590 },
    ],
    sequenceRng([0.5, 0.5, 0.5, 0.5]),
  );

  starts.forEach((start) => {
    assert.equal(start < 330 && start + 72 > 200, false);
    assert.equal(start < 590 && start + 72 > 470, false);
  });
});

test("ensureRoadCoverage pads roads to minimum count", () => {
  const ensured = ensureRoadCoverage([120], 1000, 3, 72, []);
  assert.ok(ensured.length >= 3);
  assert.deepEqual(ensured, [...ensured].sort((a, b) => a - b));
});

test("spansBetweenRoads returns buildable non-road spans", () => {
  const spans = spansBetweenRoads([200, 520], 1000, 72);
  assert.ok(spans.length > 0);
  spans.forEach((span) => {
    assert.ok(span.max - span.min > 80);
    assert.equal(span.min < 272 && span.max > 200, false);
    assert.equal(span.min < 592 && span.max > 520, false);
  });
});

test("chooseNpcRoad handles empty and one-sided pools", () => {
  assert.equal(chooseNpcRoad([], []), null);

  const onlyHorizontal = chooseNpcRoad([{ id: "h1" }], [], sequenceRng([0.9]));
  assert.equal(onlyHorizontal.horizontal, true);
  assert.equal(onlyHorizontal.road.id, "h1");

  const onlyVertical = chooseNpcRoad([], [{ id: "v1" }], sequenceRng([0.1]));
  assert.equal(onlyVertical.horizontal, false);
  assert.equal(onlyVertical.road.id, "v1");
});

test("getDirectionForPatrol yields lane-aligned directions", () => {
  const hDirA = getDirectionForPatrol(true, sequenceRng([0.1]));
  const hDirB = getDirectionForPatrol(true, sequenceRng([0.9]));
  const vDirA = getDirectionForPatrol(false, sequenceRng([0.1]));
  const vDirB = getDirectionForPatrol(false, sequenceRng([0.9]));

  assert.equal(hDirA, 0);
  assert.equal(hDirB, Math.PI);
  assert.equal(vDirA, Math.PI * 0.5);
  assert.equal(vDirB, Math.PI * 1.5);
});

test("getNpcSpawnPoint keeps NPCs in-lane and in-bounds", () => {
  const world = { w: 1920, h: 1080 };
  const hRoad = { x: 0, y: 400, w: 1920, h: 72 };
  const vRoad = { x: 600, y: 0, w: 72, h: 1080 };

  const horizontalPoint = getNpcSpawnPoint(true, hRoad, world, sequenceRng([0.8, 0.25]));
  assert.ok(horizontalPoint.x >= 30 && horizontalPoint.x <= world.w - 30);
  assert.ok(horizontalPoint.y >= hRoad.y + hRoad.h * 0.5 - 18);
  assert.ok(horizontalPoint.y <= hRoad.y + hRoad.h * 0.5 + 18);

  const verticalPoint = getNpcSpawnPoint(false, vRoad, world, sequenceRng([0.3, 0.7]));
  assert.ok(verticalPoint.y >= 30 && verticalPoint.y <= world.h - 30);
  assert.ok(verticalPoint.x >= vRoad.x + vRoad.w * 0.5 - 18);
  assert.ok(verticalPoint.x <= vRoad.x + vRoad.w * 0.5 + 18);
});
