import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_HIT_Z,
  NOTE_LEAD_SECONDS,
  NOTE_MISS_Z,
  NOTE_SPAWN_Z,
  NOTE_SPEED,
  TOXIC_NOTES,
  TOXIC_SONG_DURATION,
  formatSongTime,
  getBeatmapSection,
  getNoteZ,
} from '../src/toxicBeatmap.js';

test('Toxic map is ordered, playable, and stays inside the audible song', () => {
  assert.equal(TOXIC_NOTES.length, 178);
  assert.ok(TOXIC_NOTES[0].time >= NOTE_LEAD_SECONDS);
  assert.ok(TOXIC_NOTES.at(-1).time < TOXIC_SONG_DURATION);
  assert.ok(TOXIC_NOTES.every((note, index) => (
    [-1, 0, 1].includes(note.lane)
    && (index === 0 || note.time > TOXIC_NOTES[index - 1].time)
  )));
});

test('chorus sections have a denser note pattern than the breakdown', () => {
  const chorusCount = TOXIC_NOTES.filter(note => note.time >= 75.3 && note.time < 96).length;
  const breakdownCount = TOXIC_NOTES.filter(note => note.time >= 96 && note.time < 123.3).length;
  const chorusNotesPerSecond = chorusCount / (96 - 75.3);
  const breakdownNotesPerSecond = breakdownCount / (123.3 - 96);

  assert.ok(chorusNotesPerSecond > breakdownNotesPerSecond);
  assert.equal(getBeatmapSection(80).name, 'CHORUS');
  assert.equal(getBeatmapSection(130).name, 'FINAL RUSH');
});

test('absolute song time puts notes at spawn, hit, and miss positions', () => {
  const noteTime = 10;
  const missDelay = (NOTE_MISS_Z - NOTE_HIT_Z) / NOTE_SPEED;

  assert.ok(Math.abs(getNoteZ(noteTime, noteTime - NOTE_LEAD_SECONDS) - NOTE_SPAWN_Z) < 1e-9);
  assert.equal(getNoteZ(noteTime, noteTime), NOTE_HIT_Z);
  assert.ok(Math.abs(getNoteZ(noteTime, noteTime + missDelay) - NOTE_MISS_Z) < 1e-9);
});

test('song time labels clamp to the track duration', () => {
  assert.equal(formatSongTime(0), '0:00');
  assert.equal(formatSongTime(75.8), '1:15');
  assert.equal(formatSongTime(Number.POSITIVE_INFINITY), '0:00');
  assert.equal(formatSongTime(999), '2:48');
});
