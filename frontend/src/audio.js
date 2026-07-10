// Procedural synthwave audio engine built with Web Audio API.
// No external assets: bass drone, pads, arpeggios, drums, and hit SFX are all
// generated from oscillators + noise buffers at runtime.
// Auto-starts on first user gesture (browser autoplay policy).

let audioCtx = null;
let masterGain = null;
let started = false;

// --- helpers ---

function ctx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function noiseBuffer(ctx, duration) {
  const samples = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// --- background layers ---

function startDrone(ctx) {
  // Low sine drone
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55; // A1
  const g = ctx.createGain();
  g.gain.value = 0.18;
  osc.connect(g).connect(masterGain);
  osc.start();

  // Octave
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 110;
  const g2 = ctx.createGain();
  g2.gain.value = 0.08;
  osc2.connect(g2).connect(masterGain);
  osc2.start();
}

function startPad(ctx) {
  const chords = [
    [130.81, 164.81, 196.00], // C3 E3 G3
    [138.59, 174.61, 207.65], // C#3 Eb3 G#3
    [110.00, 130.81, 164.81], // A2 C3 E3
    [116.54, 146.83, 174.61], // B2 D3 F#3
  ];
  let idx = 0;

  function playChord() {
    const chord = chords[idx % chords.length];
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.5);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
      osc.connect(g).connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 4.1);
    });
    idx++;
  }

  playChord();
  const padInterval = setInterval(playChord, 4000);

  return () => clearInterval(padInterval);
}

function startArp(ctx) {
  const notes = [
    261.63, 329.63, 392.00, 523.25, // C4 E4 G4 C5
    277.18, 349.23, 415.30, 554.37, // C#4 Eb4 G#4 Cs5
    220.00, 277.18, 329.63, 440.00, // A2 Cs3 E3 A3
    233.08, 293.66, 349.23, 466.16, // B2 D3 F#3 Bs3
  ];
  let idx = 0;

  function tick() {
    const freq = notes[idx % notes.length];
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 5;

    osc.connect(filter).connect(g).connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);

    idx++;
  }

  const arpInterval = setInterval(tick, 150);
  return () => clearInterval(arpInterval);
}

function startDrums(ctx) {
  const kickBuf = noiseBuffer(ctx, 0.3);
  const snareBuf = noiseBuffer(ctx, 0.2);

  function kick(time) {
    const src = ctx.createBufferSource();
    src.buffer = kickBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    osc.connect(g).connect(masterGain);
    src.connect(g).connect(masterGain);
    src.start(time);
    src.stop(time + 0.3);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  function snare(time) {
    const src = ctx.createBufferSource();
    src.buffer = snareBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    src.connect(filter).connect(g).connect(masterGain);
    src.start(time);
    src.stop(time + 0.2);
  }

  function hihat(time) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    src.connect(filter).connect(g).connect(masterGain);
    src.start(time);
    src.stop(time + 0.06);
  }

  function pattern(time, bar) {
    const bpm = 110;
    const beatDur = 60 / bpm;
    // Kick on 1, 2, 3, 4 + extra swing
    kick(time);
    kick(time + beatDur * 2);
    if (bar % 2 === 0) kick(time + beatDur * 3.5);
    // Snare on 2 and 4
    snare(time + beatDur);
    snare(time + beatDur * 3);
    // Hi-hat on 8ths
    for (let i = 0; i < 8; i++) hihat(time + beatDur * i * 0.5);
  }

  let bar = 0;
  const bpm = 110;
  const barDur = (60 / bpm) * 4;

  function scheduleBars() {
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      pattern(now + i * barDur, bar + i);
    }
    bar += 4;
  }

  scheduleBars();
  const timer = setInterval(scheduleBars, barDur * 1000);
  return () => clearInterval(timer);
}

// --- hit sound effect ---

function playHitSound(ctx) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 3;

  osc.connect(filter).connect(g).connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// --- public API ---

/** Call this on first user gesture (click / tap) to unlock autoplay. */
export function initAudio() {
  if (started) return;
  started = true;
  const c = ctx();
  startDrone(c);
  startPad(c);
  startArp(c);
  startDrums(c);
}

/** Play the hit SFX. Safe to call even before init (will auto-init). */
export function playHit() {
  if (!started) initAudio();
  playHitSound(ctx());
}
