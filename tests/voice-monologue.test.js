import test from "node:test";
import assert from "node:assert/strict";

import { createVoiceMonologue } from "../src/voice-monologue.js";

function installAudioStubs() {
  const originalFetch = globalThis.fetch;
  const originalAudioContext = globalThis.AudioContext;
  const originalWebkitAudioContext = globalThis.webkitAudioContext;

  const state = {
    fetchCalls: 0,
  };

  class FakeSource {
    constructor(ctx) {
      this.ctx = ctx;
      this.onended = null;
    }

    connect() {}

    start(_when, offset, duration) {
      this.ctx.starts.push({ offset, duration });
      if (this.onended) {
        this.onended();
      }
    }

    stop() {
      this.ctx.stops += 1;
    }
  }

  class FakeAudioContext {
    constructor() {
      this.state = "suspended";
      this.starts = [];
      this.stops = 0;
      this.decodeCalls = 0;
      this.resumeCalls = 0;
      this.destination = {};
    }

    async resume() {
      this.state = "running";
      this.resumeCalls += 1;
    }

    async decodeAudioData(_arrayBuffer) {
      this.decodeCalls += 1;
      return { tag: "decoded-buffer" };
    }

    createBufferSource() {
      return new FakeSource(this);
    }
  }

  const contexts = [];

  globalThis.fetch = async () => {
    state.fetchCalls += 1;
    return {
      ok: true,
      async arrayBuffer() {
        return new ArrayBuffer(8);
      },
    };
  };

  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  };
  globalThis.webkitAudioContext = undefined;

  return {
    state,
    contexts,
    restore() {
      globalThis.fetch = originalFetch;
      globalThis.AudioContext = originalAudioContext;
      globalThis.webkitAudioContext = originalWebkitAudioContext;
    },
  };
}

test("voice monologue no-ops when disabled", async () => {
  const voice = createVoiceMonologue({ enabled: false, voiceUrl: "https://example.com/voice.wav" });
  assert.equal(voice.enabled, false);
  await voice.trigger("burst_hit");
  await voice.prepareAfterUserGesture();
});

test("invalid cue entries are ignored and do not fetch audio", async () => {
  const stubs = installAudioStubs();
  try {
    const voice = createVoiceMonologue({
      enabled: true,
      voiceUrl: "https://example.com/voice.wav",
      cueTable: {
        test_event: [{ start: null, end: null, script: "placeholder" }],
      },
    });

    await voice.trigger("test_event");
    assert.equal(stubs.state.fetchCalls, 0);
    assert.equal(stubs.contexts.length, 1);
    assert.equal(stubs.contexts[0].starts.length, 0);
  } finally {
    stubs.restore();
  }
});

test("audio file is fetched once and reused for repeated triggers", async () => {
  const stubs = installAudioStubs();
  try {
    const voice = createVoiceMonologue({
      enabled: true,
      voiceUrl: "https://example.com/voice.wav",
      cueTable: {
        test_event: [{ start: 2.25, end: 2.8, script: "line" }],
      },
      cooldownsMs: {
        test_event: 0,
      },
    });

    await voice.trigger("test_event");
    await voice.trigger("test_event");

    assert.equal(stubs.state.fetchCalls, 1);
    assert.equal(stubs.contexts.length, 1);
    assert.equal(stubs.contexts[0].decodeCalls, 1);
    assert.equal(stubs.contexts[0].starts.length, 2);
    assert.equal(stubs.contexts[0].starts[0].offset, 2.25);
    assert.ok(Math.abs(stubs.contexts[0].starts[0].duration - 0.55) < 1e-9);
  } finally {
    stubs.restore();
  }
});

test("event cooldown suppresses rapid retrigger", async () => {
  const stubs = installAudioStubs();
  try {
    const voice = createVoiceMonologue({
      enabled: true,
      voiceUrl: "https://example.com/voice.wav",
      cueTable: {
        test_event: [{ start: 1, end: 1.4, script: "line" }],
      },
      cooldownsMs: {
        test_event: 60_000,
      },
    });

    await voice.trigger("test_event");
    await voice.trigger("test_event");

    assert.equal(stubs.contexts[0].starts.length, 1);
  } finally {
    stubs.restore();
  }
});
