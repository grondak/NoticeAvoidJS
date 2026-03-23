const DEFAULT_EVENT_COOLDOWNS_MS = {
  near_miss_cone_exit: 6000,
  notice_locked: 3200,
  crowd_locked: 5000,
  burst_hit: 4500,
  burst_heavy: 7000,
  rest_on: 3500,
  rest_off: 2500,
  rest_miss: 3000,
  hoodie_on: 2500,
  phone_on: 2500,
  anxiety_high: 7000,
  anxiety_recovered: 7000,
  near_goal: 12000,
  delivered: 999999,
  game_over_burst: 999999,
  game_over_seen: 999999,
};

// Fill these with your single WAV cue slices. Any entry with null timings is ignored.
export const VOICE_CUE_TABLE = {
  near_miss_cone_exit: [
    { start: null, end: null, script: "That was close." },
    { start: null, end: null, script: "Keep moving." },
  ],
  notice_locked: [
    { start: null, end: null, script: "They see me." },
    { start: null, end: null, script: "Act normal." },
  ],
  crowd_locked: [{ start: null, end: null, script: "Too many eyes." }],
  burst_hit: [
    { start: null, end: null, script: "Not now." },
    { start: null, end: null, script: "Here we go." },
  ],
  burst_heavy: [{ start: null, end: null, script: "I cannot do this today." }],
  rest_on: [{ start: null, end: null, script: "Breathe." }],
  rest_off: [{ start: null, end: null, script: "One step." }],
  rest_miss: [{ start: null, end: null, script: "Need a wall." }],
  hoodie_on: [{ start: null, end: null, script: "Hood up." }],
  phone_on: [{ start: null, end: null, script: "Phone out." }],
  anxiety_high: [{ start: null, end: null, script: "I am close to spiraling." }],
  anxiety_recovered: [{ start: null, end: null, script: "Okay, settle down." }],
  near_goal: [{ start: null, end: null, script: "Almost there." }],
  delivered: [{ start: null, end: null, script: "I made it." }],
  game_over_burst: [{ start: null, end: null, script: "I cannot today." }],
  game_over_seen: [{ start: null, end: null, script: "Too many people." }],
};

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function isValidCue(cue) {
  return Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start;
}

export function createVoiceMonologue(config = {}) {
  const voiceUrl = config.voiceUrl || "";
  const enabled = Boolean(config.enabled && voiceUrl);
  const cueTable = config.cueTable || VOICE_CUE_TABLE;
  const cooldownsMs = { ...DEFAULT_EVENT_COOLDOWNS_MS, ...(config.cooldownsMs || {}) };

  if (!enabled) {
    return {
      enabled: false,
      trigger() {},
      prepareAfterUserGesture() {},
    };
  }

  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtx) {
    return {
      enabled: false,
      trigger() {},
      prepareAfterUserGesture() {},
    };
  }

  const ctx = new AudioCtx();
  let buffer = null;
  let loading = null;
  let currentSource = null;
  const lastEventAt = new Map();

  async function ensureLoaded() {
    if (buffer) {
      return;
    }
    if (!loading) {
      loading = fetch(voiceUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Voice fetch failed: ${res.status}`);
          }
          return res.arrayBuffer();
        })
        .then((arr) => ctx.decodeAudioData(arr))
        .then((decoded) => {
          buffer = decoded;
        })
        .catch((err) => {
          console.warn("Voice monologue disabled for this session:", err);
        });
    }
    await loading;
  }

  async function prepareAfterUserGesture() {
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      await ensureLoaded();
    } catch (err) {
      console.warn("Voice monologue could not initialize:", err);
    }
  }

  async function trigger(eventName) {
    const cues = cueTable[eventName] || [];
    const validCues = cues.filter(isValidCue);
    if (validCues.length === 0) {
      return;
    }

    const nowMs = performance.now();
    const cooldownMs = cooldownsMs[eventName] || 0;
    const lastAt = lastEventAt.get(eventName) || -Infinity;
    if (nowMs - lastAt < cooldownMs) {
      return;
    }

    lastEventAt.set(eventName, nowMs);

    await prepareAfterUserGesture();
    if (!buffer) {
      return;
    }

    const cue = randomChoice(validCues);
    const duration = cue.end - cue.start;

    if (currentSource) {
      try {
        currentSource.stop();
      } catch {
        // Ignore if source already ended.
      }
      currentSource = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, cue.start, duration);
    currentSource = source;
    source.onended = () => {
      if (currentSource === source) {
        currentSource = null;
      }
    };
  }

  return {
    enabled: true,
    trigger,
    prepareAfterUserGesture,
  };
}
