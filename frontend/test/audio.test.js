import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, playHitSound } from '../src/audio.js';

class AudioNode {
  connect(target) {
    return target;
  }
}

function createAudioHarness() {
  const oscillators = [];
  const bufferSources = [];

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.sampleRate = 48000;
      this.destination = new AudioNode();
    }

    createGain() {
      const gain = new AudioNode();
      gain.gain = {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      };
      return gain;
    }

    createOscillator() {
      const oscillator = new AudioNode();
      oscillator.frequency = {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      };
      oscillator.start = () => { oscillator.started = true; };
      oscillator.stop = () => { oscillator.stopped = true; };
      oscillators.push(oscillator);
      return oscillator;
    }

    createBiquadFilter() {
      const filter = new AudioNode();
      filter.frequency = { value: 0 };
      filter.Q = { value: 0 };
      return filter;
    }

    createBuffer(_channels, sampleCount) {
      return { getChannelData: () => new Float32Array(sampleCount) };
    }

    createBufferSource() {
      const source = new AudioNode();
      source.start = () => { source.started = true; };
      source.stop = () => { source.stopped = true; };
      bufferSources.push(source);
      return source;
    }
  }

  return { FakeAudioContext, oscillators, bufferSources };
}

test('a hit starts a noise crack and multiple ringing glass fragments', () => {
  const { FakeAudioContext, oscillators, bufferSources } = createAudioHarness();
  const context = new FakeAudioContext();

  playHitSound(context, context.destination);

  assert.equal(bufferSources.length, 1);
  assert.equal(bufferSources[0].started, true);
  assert.equal(bufferSources[0].stopped, true);
  assert.equal(oscillators.length >= 6, true);
  assert.equal(oscillators.every(oscillator => oscillator.started), true);
  assert.equal(oscillators.every(oscillator => oscillator.stopped), true);
});

test('initializing audio does not start any background music', () => {
  const { FakeAudioContext, oscillators } = createAudioHarness();
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.setInterval = () => 1;

  try {
    initAudio();
    assert.equal(oscillators.length, 0);
  } finally {
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
  }
});
