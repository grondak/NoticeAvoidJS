import test from "node:test";
import assert from "node:assert/strict";

import {
  getAnxietyDelta,
  getBurstMitigation,
  getDefaultStatusText,
  getGameOverMessage,
  getHudToneState,
  getNpcNoticeState,
  getSpeedScale,
  getWallFlowerActivationDistance,
  isMoving,
  shouldAllowActions,
} from "../src/game-rules.js";

test("actions are disabled after win/loss", () => {
  assert.equal(shouldAllowActions({ gameOver: false, delivered: false }), true);
  assert.equal(shouldAllowActions({ gameOver: true, delivered: false }), false);
  assert.equal(shouldAllowActions({ gameOver: false, delivered: true }), false);
});

test("hud tone maps to progress/win/loss", () => {
  assert.equal(getHudToneState({ gameOver: false, delivered: false }), "progress");
  assert.equal(getHudToneState({ gameOver: false, delivered: true }), "win");
  assert.equal(getHudToneState({ gameOver: true, delivered: false }), "loss");
});

test("default status text follows state", () => {
  assert.equal(
    getDefaultStatusText({ gameOver: true, delivered: false, resting: false }),
    "Overwhelmed. Breathe and try again (refresh).",
  );
  assert.equal(
    getDefaultStatusText({ gameOver: false, delivered: true, resting: false }),
    "Delivered. Chad got the science homework.",
  );
  assert.equal(
    getDefaultStatusText({ gameOver: false, delivered: false, resting: true }),
    "Wall-flower mode: taking a breather.",
  );
});

test("burst mitigation stacks and caps", () => {
  assert.equal(getBurstMitigation({ hoodieUp: false, phoneOut: false, resting: false }), 0);
  assert.ok(Math.abs(getBurstMitigation({ hoodieUp: true, phoneOut: true, resting: false }) - 0.33) < 1e-9);
  assert.ok(Math.abs(getBurstMitigation({ hoodieUp: true, phoneOut: true, resting: true }) - 0.63) < 1e-9);
});

test("speed scale matches hoodie/phone penalties", () => {
  assert.equal(getSpeedScale({ hoodieUp: false, phoneOut: false }), 1);
  assert.equal(getSpeedScale({ hoodieUp: true, phoneOut: false }), 0.84);
  assert.equal(getSpeedScale({ hoodieUp: false, phoneOut: true }), 0.72);
  assert.equal(getSpeedScale({ hoodieUp: true, phoneOut: true }), 0.6048);
});

test("moving keys are WASD-only", () => {
  assert.equal(isMoving(new Set(["w"])), true);
  assert.equal(isMoving(new Set(["a", "o"])), true);
  assert.equal(isMoving(new Set(["i", "o", "p"])), false);
});

test("anxiety delta changes with visibility and remedies", () => {
  const baseSeen = getAnxietyDelta(1, { hoodieUp: false, phoneOut: false, resting: false });
  const withRemedies = getAnxietyDelta(1, { hoodieUp: true, phoneOut: true, resting: true });
  assert.equal(baseSeen, 0.25);
  assert.equal(withRemedies, -0.09);

  const unseenRest = getAnxietyDelta(0, { hoodieUp: false, phoneOut: false, resting: true });
  const unseenPhone = getAnxietyDelta(0, { hoodieUp: false, phoneOut: true, resting: false });
  assert.equal(unseenRest, -0.23);
  assert.equal(unseenPhone, -0.03);
});

test("burst game-over message is specific", () => {
  assert.equal(getGameOverMessage("burst"), "You really can't make it to Chad's today.");
  assert.equal(getGameOverMessage("other"), "Overwhelmed. Breathe and try again (refresh).");
});

test("wall-flower can be reached consistently while approaching a wall", () => {
  const playerRadius = 10;
  const wallX = 100;
  const speed = 2.3;
  const wallFlowerThreshold = getWallFlowerActivationDistance(playerRadius, speed);

  // Mirror collision logic in game.js: movement step is blocked once next x would overlap wall.
  const nearestReachableDistance = (phaseOffset) => {
    let x = 80 + phaseOffset;
    while (true) {
      const nextX = x + speed;
      const collides = nextX + playerRadius > wallX;
      if (collides) {
        break;
      }
      x = nextX;
    }
    return wallX - x;
  };

  // Expectation: no matter movement phase, player should be able to get close enough to trigger wall-flower.
  for (let phase = 0; phase < speed; phase += 0.05) {
    const distance = nearestReachableDistance(phase);
    assert.ok(
      distance <= wallFlowerThreshold,
      `phase=${phase.toFixed(2)} stops at distance=${distance.toFixed(3)}, threshold=${wallFlowerThreshold}`,
    );
  }
});

test("npc notice timer locks only after dwell time", () => {
  const lockMs = 900;

  const start = getNpcNoticeState({ isLocked: false, seenSince: null }, true, 1000, lockMs);
  assert.deepEqual(start, { isLocked: false, seenSince: 1000 });

  const almost = getNpcNoticeState(start, true, 1850, lockMs);
  assert.deepEqual(almost, { isLocked: false, seenSince: 1000 });

  const locked = getNpcNoticeState(almost, true, 1900, lockMs);
  assert.deepEqual(locked, { isLocked: true, seenSince: 1000 });
});

test("npc notice resets when player leaves cone", () => {
  const lockMs = 900;
  const prev = { isLocked: true, seenSince: 1000 };
  const reset = getNpcNoticeState(prev, false, 1400, lockMs);
  assert.deepEqual(reset, { isLocked: false, seenSince: null });
});
