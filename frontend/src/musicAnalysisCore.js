import { NOTE_LEAD_SECONDS } from './toxicBeatmap.js';

const LANES = [-1, 0, 1, 0, -1, 1];

function buildSections(beats, energy, duration, bpm) {
  if (duration <= 0) return [];

  const secondsPerBeat = 60 / (Number.isFinite(bpm) && bpm > 0 ? bpm : 120);
  const sectionDuration = Math.min(16, Math.max(8, secondsPerBeat * 16));
  const sectionCount = Math.max(1, Math.ceil(duration / sectionDuration));
  const averages = Array.from({ length: sectionCount }, (_, sectionIndex) => {
    const start = sectionIndex * sectionDuration;
    const end = Math.min(duration, start + sectionDuration);
    const values = beats.flatMap((time, beatIndex) => (
      time >= start && time < end && Number.isFinite(energy[beatIndex])
        ? [energy[beatIndex]]
        : []
    ));
    return values.length > 0
      ? values.reduce((total, value) => total + value, 0) / values.length
      : 0;
  });
  const minimum = Math.min(...averages);
  const maximum = Math.max(...averages);
  const range = maximum - minimum;

  return averages.map((average, index) => {
    const normalized = range > 0 ? (average - minimum) / range : 0.5;
    const level = 1 + Math.round(normalized * 5);
    const isRush = level >= 5;
    const previous = index > 0 && range > 0 ? (averages[index - 1] - minimum) / range : normalized;
    let name = 'VERSE';
    if (index === 0) name = 'OPENING';
    else if (index === averages.length - 1) name = isRush ? 'FINAL RUSH' : 'FINALE';
    else if (normalized >= 0.7) name = 'CHORUS';
    else if (normalized - previous >= 0.18) name = 'BUILD';
    else if (normalized <= 0.3) name = 'BREAKDOWN';

    return {
      start: index * sectionDuration,
      end: Math.min(duration, (index + 1) * sectionDuration),
      name,
      level,
      isRush,
    };
  });
}

function vectorToNumbers(essentia, vector) {
  if (!vector || (typeof vector.size === 'function' && vector.size() === 0)) return [];
  return Array.from(essentia.vectorToArray(vector));
}

export function resamplePcmLinear(samples, inputSampleRate, outputSampleRate = 44100) {
  if (inputSampleRate === outputSampleRate) return samples;
  if (inputSampleRate <= 0 || outputSampleRate <= 0) {
    throw new Error('Sample rates must be positive.');
  }

  const outputLength = Math.max(1, Math.round(samples.length * outputSampleRate / inputSampleRate));
  const resampled = new Float32Array(outputLength);
  const sourceStep = inputSampleRate / outputSampleRate;

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * sourceStep;
    const leftIndex = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    resampled[index] = samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction;
  }

  return resampled;
}

export function calculateBeatEnergies(samples, sampleRate, beats, windowSeconds = 0.2) {
  const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100;
  const halfWindow = Math.max(1, Math.floor(safeSampleRate * windowSeconds / 2));

  return beats.map(time => {
    const center = Math.round(time * safeSampleRate);
    const start = Math.max(0, center - halfWindow);
    const end = Math.min(samples.length, center + halfWindow);
    if (end <= start) return 0;

    let sumOfSquares = 0;
    for (let index = start; index < end; index += 1) {
      sumOfSquares += samples[index] * samples[index];
    }
    return Math.sqrt(sumOfSquares / (end - start));
  });
}

export function extractRhythmWithEssentia(essentia, samples, sampleRate) {
  const ownedVectors = new Set();

  try {
    const analysisSamples = resamplePcmLinear(samples, sampleRate);
    const input = essentia.arrayToVector(analysisSamples);
    ownedVectors.add(input);
    const rhythm = essentia.RhythmExtractor2013(input, 208, 'multifeature', 40);
    ownedVectors.add(rhythm.ticks);
    ownedVectors.add(rhythm.estimates);
    ownedVectors.add(rhythm.bpmIntervals);

    return {
      bpm: Number.isFinite(rhythm.bpm) ? rhythm.bpm : 0,
      confidence: Number.isFinite(rhythm.confidence) ? rhythm.confidence : 0,
      beats: vectorToNumbers(essentia, rhythm.ticks),
    };
  } finally {
    for (const vector of ownedVectors) {
      vector?.delete?.();
    }
  }
}

export function buildBeatmapFromAnalysis({
  bpm,
  confidence = 0,
  duration,
  beats = [],
  energy = [],
}) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const finiteEnergy = energy.filter(Number.isFinite);
  const minimumEnergy = finiteEnergy.length > 0 ? Math.min(...finiteEnergy) : 0;
  const maximumEnergy = finiteEnergy.length > 0 ? Math.max(...finiteEnergy) : 0;
  const energyRange = maximumEnergy - minimumEnergy;
  const playableBeats = beats
    .map((time, index) => ({
      time,
      sourceIndex: index,
      normalizedEnergy: energyRange > 0 && Number.isFinite(energy[index])
        ? (energy[index] - minimumEnergy) / energyRange
        : 0.5,
    }))
    .filter(beat => (
      Number.isFinite(beat.time)
      && beat.time >= NOTE_LEAD_SECONDS
      && beat.time < safeDuration
    ))
    .sort((left, right) => left.time - right.time)
    .filter((beat, index, sorted) => index === 0 || beat.time > sorted[index - 1].time)
    .filter(beat => beat.normalizedEnergy >= 0.5 || beat.sourceIndex % 2 === 0);

  return {
    bpm: Number.isFinite(bpm) ? bpm : 0,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    duration: safeDuration,
    sections: buildSections(beats, energy, safeDuration, bpm),
    notes: playableBeats.map((beat, index) => ({
      id: `essentia-${index}`,
      time: beat.time,
      lane: LANES[index % LANES.length],
      accent: beat.normalizedEnergy >= 0.75,
    })),
  };
}

export function isPlayableBeatmap(beatmap) {
  return Boolean(
    beatmap
    && Number.isFinite(beatmap.bpm)
    && beatmap.bpm > 0
    && Number.isFinite(beatmap.duration)
    && beatmap.duration > 0
    && Array.isArray(beatmap.notes)
    && beatmap.notes.length > 0
    && beatmap.notes.every(note => (
      Number.isFinite(note.time)
      && [-1, 0, 1].includes(note.lane)
    ))
    && Array.isArray(beatmap.sections)
    && beatmap.sections.length > 0
  );
}
