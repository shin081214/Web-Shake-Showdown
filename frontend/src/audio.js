// Lightweight hit-only audio engine. Background music is intentionally disabled.
// The glass shatter is synthesized once from reusable noise plus short resonant tones.

let audioCtx = null;
let masterGain = null;
let glassNoiseBuffer = null;
let started = false;

function ctx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.62;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function createGlassNoiseBuffer(context) {
  const duration = 0.32;
  const samples = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, samples, context.sampleRate);
  const data = buffer.getChannelData(0);

  // Irregular, rapidly decaying noise gives the initial brittle glass crack.
  for (let index = 0; index < samples; index += 1) {
    const progress = index / samples;
    const envelope = Math.pow(1 - progress, 2.4);
    const impulse = Math.random() > 0.82 ? 1.8 : 0.55;
    data[index] = (Math.random() * 2 - 1) * envelope * impulse;
  }
  return buffer;
}

function getGlassNoiseBuffer(context) {
  if (!glassNoiseBuffer) glassNoiseBuffer = createGlassNoiseBuffer(context);
  return glassNoiseBuffer;
}

export function playHitSound(context, output = masterGain) {
  const now = context.currentTime;

  // High-passed noise: the instantaneous brittle crack.
  const noise = context.createBufferSource();
  noise.buffer = getGlassNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2100;
  noiseFilter.Q.value = 0.8;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  noise.connect(noiseFilter).connect(noiseGain).connect(output);
  noise.start(now);
  noise.stop(now + 0.3);

  // Inharmonic high partials ring at different lengths like scattered glass pieces.
  const fragmentFrequencies = [1650, 2280, 3070, 3980, 5150, 6730];
  fragmentFrequencies.forEach((baseFrequency, index) => {
    const fragment = context.createOscillator();
    fragment.type = index % 2 === 0 ? 'sine' : 'triangle';
    const frequency = baseFrequency * (0.97 + Math.random() * 0.06);
    const duration = 0.12 + index * 0.035;
    fragment.frequency.setValueAtTime(frequency, now);
    fragment.frequency.exponentialRampToValueAtTime(frequency * 0.82, now + duration);

    const fragmentGain = context.createGain();
    fragmentGain.gain.setValueAtTime(0.2 / (1 + index * 0.14), now);
    fragmentGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    fragment.connect(fragmentGain).connect(output);
    fragment.start(now + index * 0.004);
    fragment.stop(now + duration + 0.02);
  });
}

/** Unlock audio on the host's Start Game click. No background audio is started. */
export function initAudio() {
  if (started) return;
  started = true;
  const context = ctx();
  getGlassNoiseBuffer(context);
}

/** Play the glass-shatter hit effect. Safe to call before explicit initialization. */
export function playHit() {
  if (!started) initAudio();
  playHitSound(ctx());
}
