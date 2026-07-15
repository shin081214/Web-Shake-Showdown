import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMusicTime,
  initAudio,
  pauseMusic,
  playHitSound,
  resumeMusic,
  startMusic,
  stopMusic,
} from '../src/audio.js';

class AudioNode {
  connect(target) {
    return target;
  }
}

function createAudioHarness() {
  const oscillators = [];
  const bufferSources = [];
  const audioElements = [];

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

  class FakeAudio {
    constructor(source) {
      this.source = source;
      this.currentTime = 0;
      this.listeners = new Map();
      audioElements.push(this);
    }

    addEventListener(event, listener) {
      this.listeners.set(event, listener);
    }

    removeEventListener(event, listener) {
      if (this.listeners.get(event) === listener) this.listeners.delete(event);
    }

    pause() {
      this.paused = true;
    }

    play() {
      this.played = true;
      this.paused = false;
      return Promise.resolve();
    }
  }

  return { FakeAudioContext, FakeAudio, audioElements, oscillators, bufferSources };
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

test('the analyzed track starts at zero and exposes its playback position as the map clock', async () => {
  const { FakeAudioContext, FakeAudio, audioElements } = createAudioHarness();
  const originalWindow = globalThis.window;
  globalThis.window = { AudioContext: FakeAudioContext, Audio: FakeAudio };

  try {
    await startMusic('/audio/analyzed.mp3');

    assert.equal(audioElements.length, 1);
    assert.equal(audioElements[0].source, '/audio/analyzed.mp3');
    assert.equal(audioElements[0].played, true);
    assert.equal(audioElements[0].currentTime, 0);

    audioElements[0].currentTime = 12.5;
    assert.equal(getMusicTime(), 12.5);

    stopMusic();
    assert.equal(audioElements[0].paused, true);
    assert.equal(audioElements[0].currentTime, 0);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('pausing for calibration preserves the music clock until playback resumes', async () => {
  const { FakeAudioContext, FakeAudio, audioElements } = createAudioHarness();
  const originalWindow = globalThis.window;
  globalThis.window = { AudioContext: FakeAudioContext, Audio: FakeAudio };

  try {
    await startMusic('/audio/calibration-pause.mp3');
    audioElements[0].currentTime = 7.25;

    pauseMusic();
    assert.equal(audioElements[0].paused, true);
    assert.equal(getMusicTime(), 7.25);

    await resumeMusic();
    assert.equal(audioElements[0].paused, false);
    assert.equal(getMusicTime(), 7.25);
    stopMusic();
  } finally {
    globalThis.window = originalWindow;
  }
});
