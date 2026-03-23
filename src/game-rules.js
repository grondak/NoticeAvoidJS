export function shouldAllowActions(state) {
  return !state.gameOver && !state.delivered;
}

export function getDefaultStatusText(state) {
  if (state.gameOver) {
    return "Overwhelmed. Breathe and try again (refresh).";
  }
  if (state.delivered) {
    return "Delivered. Chad got the science homework.";
  }
  if (state.resting) {
    return "Wall-flower mode: taking a breather.";
  }
  return "Mission: deliver homework to Chad.";
}

export function getBurstMitigation(state) {
  let mitigation = 0;
  if (state.hoodieUp) mitigation += 0.18;
  if (state.phoneOut) mitigation += 0.15;
  if (state.resting) mitigation += 0.3;
  return Math.min(0.65, mitigation);
}

export function getHudToneState(state) {
  if (state.gameOver) return "loss";
  if (state.delivered) return "win";
  return "progress";
}

export function getSpeedScale(state) {
  const hoodieScale = state.hoodieUp ? 0.84 : 1;
  const phoneScale = state.phoneOut ? 0.72 : 1;
  return hoodieScale * phoneScale;
}

export function isMoving(keys) {
  return keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d");
}

export function getAnxietyDelta(seenCount, state) {
  let anxietyDelta = -0.01;

  if (seenCount > 0) {
    anxietyDelta += 0.26 * seenCount;
    if (state.hoodieUp) anxietyDelta -= 0.09;
    if (state.phoneOut) anxietyDelta -= 0.07;
    if (state.resting) anxietyDelta -= 0.18;
  } else {
    if (state.resting) anxietyDelta -= 0.22;
    if (state.phoneOut) anxietyDelta -= 0.02;
  }

  return anxietyDelta;
}

export function getGameOverMessage(reason) {
  if (reason === "burst") {
    return "You really can't make it to Chad's today.";
  }
  return "Overwhelmed. Breathe and try again (refresh).";
}
