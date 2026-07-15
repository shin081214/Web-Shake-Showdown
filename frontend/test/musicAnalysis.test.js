import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_LEAD_SECONDS } from '../src/toxicBeatmap.js';
import {
  buildBeatmapFromAnalysis,
  calculateBeatEnergies,
  extractRhythmWithEssentia,
  isPlayableBeatmap,
  resamplePcmLinear,
} from '../src/musicAnalysisCore.js';
import {
  downmixAudioBuffer,
  loadAudioBytes,
  readCachedBeatmap,
} from '../src/musicAnalysis.js';

test('detected beats become ordered notes inside the playable song window', () => {
  const beatmap = buildBeatmapFromAnalysis({
    bpm: 120,
    confidence: 4.2,
    duration: 12,
    beats: [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 11.9, 12.1],
    energy: [0.2, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.3, 0.1],
  });

  assert.equal(beatmap.bpm, 120);
  assert.equal(beatmap.confidence, 4.2);
  assert.ok(beatmap.notes.length > 0);
  assert.ok(beatmap.notes.every(note => (
    note.time >= NOTE_LEAD_SECONDS
    && note.time < beatmap.duration
    && [-1, 0, 1].includes(note.lane)
  )));
  assert.ok(beatmap.notes.every((note, index) => (
    index === 0 || note.time > beatmap.notes[index - 1].time
  )));
});

test('louder passages produce denser notes and accented hits', () => {
  const beats = Array.from({ length: 24 }, (_, index) => 3 + index * 0.5);
  const beatmap = buildBeatmapFromAnalysis({
    bpm: 120,
    duration: 15,
    beats,
    energy: beats.map((_, index) => (index < 12 ? 0.1 : 1)),
  });

  const quietNotes = beatmap.notes.filter(note => note.time < 9);
  const loudNotes = beatmap.notes.filter(note => note.time >= 9);

  assert.ok(loudNotes.length > quietNotes.length);
  assert.ok(loudNotes.some(note => note.accent));
  assert.equal(quietNotes.some(note => note.accent), false);
});

test('energy-derived sections cover the song and mark the loudest passage as a rush', () => {
  const beats = Array.from({ length: 24 }, (_, index) => 3 + index * 0.5);
  const beatmap = buildBeatmapFromAnalysis({
    bpm: 120,
    duration: 15,
    beats,
    energy: beats.map((_, index) => (index < 12 ? 0.1 : 1)),
  });
  const quietSection = beatmap.sections.find(section => section.start <= 4 && section.end > 4);
  const loudSection = beatmap.sections.find(section => section.start <= 12 && section.end > 12);

  assert.equal(beatmap.sections[0].start, 0);
  assert.equal(beatmap.sections.at(-1).end, 15);
  assert.ok(loudSection.level > quietSection.level);
  assert.equal(loudSection.isRush, true);
});

test('non-44.1 kHz PCM is resampled before Essentia rhythm extraction and native vectors are released', () => {
  const vectors = [];
  const vector = values => {
    const instance = {
      values,
      deleted: 0,
      size: () => values.length,
      delete() { this.deleted += 1; },
    };
    vectors.push(instance);
    return instance;
  };
  const inputVector = vector([0, 2]);
  const ticksVector = vector([3, 3.5, 4]);
  const estimatesVector = vector([120]);
  const intervalsVector = vector([0.5, 0.5]);
  const calls = [];
  const essentia = {
    arrayToVector(samples) {
      calls.push(['vector', Array.from(samples)]);
      return inputVector;
    },
    RhythmExtractor2013(signal, maxTempo, method, minTempo) {
      calls.push(['rhythm', signal, maxTempo, method, minTempo]);
      return {
        bpm: 120,
        confidence: 4.5,
        ticks: ticksVector,
        estimates: estimatesVector,
        bpmIntervals: intervalsVector,
      };
    },
    vectorToArray(source) { return Float32Array.from(source.values); },
  };

  const analysis = extractRhythmWithEssentia(
    essentia,
    new Float32Array([0, 1, 2, 3]),
    88200
  );

  assert.deepEqual(analysis.beats, [3, 3.5, 4]);
  assert.equal(analysis.bpm, 120);
  assert.deepEqual(calls[0], ['vector', [0, 2]]);
  assert.deepEqual(calls[1], ['rhythm', inputVector, 208, 'multifeature', 40]);
  assert.ok(vectors.every(item => item.deleted === 1));
});

test('linear PCM resampling preserves duration and interpolates sample positions', () => {
  const resampled = resamplePcmLinear(new Float32Array([0, 10, 20, 30]), 4, 2);

  assert.deepEqual(Array.from(resampled), [0, 20]);
});

test('beat energy follows the RMS around each detected beat', () => {
  const samples = new Float32Array(40);
  samples.fill(0.1, 0, 20);
  samples.fill(1, 20);

  const energy = calculateBeatEnergies(samples, 10, [1, 3], 1);

  assert.ok(Math.abs(energy[0] - 0.1) < 1e-6);
  assert.equal(energy[1], 1);
});

test('decoded stereo audio is copied and downmixed to mono for the analysis worker', () => {
  const channels = [
    Float32Array.from([1, -1, 0.5]),
    Float32Array.from([-1, 1, 0.5]),
  ];
  const audioBuffer = {
    length: 3,
    numberOfChannels: 2,
    getChannelData: channel => channels[channel],
  };

  const mono = downmixAudioBuffer(audioBuffer);

  assert.deepEqual(Array.from(mono), [0, 0, 0.5]);
  assert.notEqual(mono.buffer, channels[0].buffer);
});

test('only complete finite analysis results are accepted as playable beatmaps', () => {
  const valid = buildBeatmapFromAnalysis({
    bpm: 100,
    duration: 20,
    beats: [3, 4, 5, 6, 7, 8, 9],
    energy: [1, 1, 1, 1, 1, 1, 1],
  });

  assert.equal(isPlayableBeatmap(valid), true);
  assert.equal(isPlayableBeatmap({ ...valid, bpm: 0 }), false);
  assert.equal(isPlayableBeatmap({ ...valid, notes: [] }), false);
  assert.equal(isPlayableBeatmap({ ...valid, sections: [] }), false);
});

test('the analysis cache returns only a playable result for the requested track', () => {
  const valid = {
    ...buildBeatmapFromAnalysis({
      bpm: 100,
      duration: 20,
      beats: [3, 4, 5, 6, 7, 8, 9],
      energy: [1, 1, 1, 1, 1, 1, 1],
    }),
    songUrl: '/audio/song.mp3',
  };
  const storage = {
    value: JSON.stringify(valid),
    getItem() { return this.value; },
  };

  assert.deepEqual(readCachedBeatmap(storage, 'key', '/audio/song.mp3'), valid);
  assert.equal(readCachedBeatmap(storage, 'key', '/audio/other.mp3'), null);
  storage.value = JSON.stringify({ ...valid, notes: [] });
  assert.equal(readCachedBeatmap(storage, 'key', '/audio/song.mp3'), null);
});

test('a user-selected audio file is decoded directly without fetching a URL', async () => {
  const expected = new ArrayBuffer(8);
  let fetched = false;
  const audioFile = {
    async arrayBuffer() { return expected; },
  };

  const actual = await loadAudioBytes({
    audioFile,
    songUrl: 'blob:local-song',
    fetchImpl: async () => {
      fetched = true;
      throw new Error('network fetch should not run');
    },
  });

  assert.equal(actual, expected);
  assert.equal(fetched, false);
});
