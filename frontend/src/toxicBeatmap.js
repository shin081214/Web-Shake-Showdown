// Hand-tuned from librosa onset/beat analysis of the supplied 48 kHz Toxic FLAC.
// Times are seconds in the decoded track; lanes are left (-1), center (0), right (1).

export const TOXIC_SONG_URL = '/audio/boywithuke-toxic.mp3';
export const TOXIC_SONG_DURATION = 168.02;
export const TOXIC_BPM = 89.103;

export const NOTE_SPEED = 20;
export const NOTE_HIT_Z = -5.45;
export const NOTE_SPAWN_Z = -60;
export const NOTE_MISS_Z = 10;
export const NOTE_LEAD_SECONDS = (NOTE_HIT_Z - NOTE_SPAWN_Z) / NOTE_SPEED;

export const TOXIC_SECTIONS = [
  { start: 0.0, end: 31.7, name: 'OPENING', level: 1, isRush: false },
  { start: 31.7, end: 47.0, name: 'VERSE', level: 2, isRush: false },
  { start: 47.0, end: 75.3, name: 'BUILD', level: 3, isRush: false },
  { start: 75.3, end: 96.0, name: 'CHORUS', level: 4, isRush: true },
  { start: 96.0, end: 123.3, name: 'BREAKDOWN', level: 3, isRush: false },
  { start: 123.3, end: 165.0, name: 'FINAL RUSH', level: 6, isRush: true },
];

// [beat time, lane, accent]. Quiet sections use alternating beats plus strong
// transients; both chorus sections use every detected beat.
const TOXIC_NOTE_DATA = [
  [4.063, -1, 0], [5.410, 0, 0], [6.711, 1, 0], [8.057, 0, 1], [9.381, -1, 0], [10.728, 0, 1],
  [12.074, 1, 0], [12.725, 0, 1], [13.398, -1, 0], [14.048, 0, 1], [14.721, 1, 0], [16.045, 0, 0],
  [17.392, -1, 0], [18.739, 0, 0], [20.062, 1, 0], [21.386, 0, 0], [22.732, -1, 0], [24.056, 0, 0],
  [25.403, 1, 0], [26.726, 0, 0], [28.073, -1, 0], [29.373, 0, 0], [30.720, 1, 0], [31.393, 0, 1],
  [32.044, -1, 0], [33.390, 1, 1], [34.040, 0, 1], [34.714, 1, 1], [36.037, -1, 0], [36.711, 0, 1],
  [37.384, -1, 1], [38.708, 1, 1], [40.054, 0, 1], [41.378, 1, 0], [42.701, -1, 0], [44.048, 0, 1],
  [44.698, -1, 1], [45.395, 1, 1], [46.719, 0, 0], [47.369, -1, 1], [48.065, 0, 1], [49.389, 1, 1],
  [50.062, 1, 1], [50.736, 0, 0], [52.059, -1, 0], [52.709, -1, 1], [53.383, 0, 0], [54.729, 1, 1],
  [56.030, 1, 0], [57.330, 0, 0], [58.677, -1, 0], [60.047, -1, 0], [60.720, 0, 1], [61.394, 1, 0],
  [62.694, 1, 0], [64.041, 0, 0], [65.387, -1, 0], [66.711, -1, 0], [68.034, 0, 0], [69.381, 1, 0],
  [70.728, 1, 0], [72.052, 0, 0], [73.375, -1, 0], [74.699, -1, 0], [75.372, -1, 0], [75.952, 1, 0],
  [76.719, -1, 1], [77.392, 1, 0], [78.065, 0, 1], [78.739, 1, 0], [79.389, 0, 1], [80.039, -1, 0],
  [80.736, -1, 0], [81.386, 1, 0], [82.059, -1, 0], [82.733, 1, 0], [83.406, 0, 0], [84.056, 1, 0],
  [84.706, 0, 0], [85.380, -1, 0], [86.053, -1, 0], [86.727, 1, 0], [87.400, -1, 0], [88.073, 1, 0],
  [88.700, 0, 0], [89.397, 1, 0], [90.070, 0, 0], [90.744, -1, 0], [91.394, -1, 1], [92.067, 1, 0],
  [92.717, -1, 0], [93.367, 1, 0], [94.064, 0, 0], [94.737, 1, 0], [95.388, 0, 0], [96.061, 0, 0],
  [97.384, -1, 0], [98.731, 0, 0], [100.055, 1, 0], [101.378, 0, 0], [102.725, -1, 0], [104.072, 0, 0],
  [105.372, 1, 1], [106.719, 0, 0], [108.066, -1, 0], [109.389, 0, 0], [110.713, 1, 0], [112.060, 0, 0],
  [113.383, -1, 0], [114.730, 0, 1], [116.053, 1, 0], [117.377, 0, 0], [118.608, -1, 0], [119.861, 0, 0],
  [121.255, 1, 0], [122.717, 0, 0], [123.368, -1, 1], [124.041, 1, 0], [124.691, 0, 0], [125.365, -1, 0],
  [126.038, 1, 0], [126.711, 0, 0], [127.385, 1, 0], [128.035, -1, 0], [128.708, -1, 0], [129.382, 1, 0],
  [130.032, 0, 0], [130.705, -1, 0], [131.379, 1, 0], [132.052, 0, 0], [132.702, 1, 1], [133.375, -1, 0],
  [134.026, -1, 0], [134.699, 1, 0], [135.372, 0, 0], [136.046, -1, 0], [136.696, 1, 0], [137.369, 0, 0],
  [138.043, 1, 0], [138.693, -1, 0], [139.366, -1, 0], [140.040, 1, 0], [140.713, 0, 0], [141.363, -1, 0],
  [142.036, 1, 0], [142.710, 0, 0], [143.360, 1, 1], [144.033, -1, 0], [144.707, -1, 1], [145.380, 1, 0],
  [146.030, 0, 1], [146.704, -1, 0], [147.377, 1, 0], [148.050, 0, 0], [148.701, 1, 0], [149.374, -1, 0],
  [150.047, -1, 0], [150.698, 1, 0], [151.348, 0, 0], [152.021, -1, 0], [152.718, 1, 0], [153.368, 0, 0],
  [154.041, 1, 1], [154.715, -1, 0], [155.341, -1, 0], [156.038, 1, 0], [156.711, 0, 0], [157.385, -1, 0],
  [158.035, 1, 1], [158.708, 0, 0], [159.382, 1, 0], [160.032, -1, 0], [160.705, -1, 0], [161.379, 1, 0],
  [162.029, 0, 0], [162.702, -1, 0], [163.376, 1, 0], [164.049, 0, 0],
];

export const TOXIC_NOTES = TOXIC_NOTE_DATA.map(([time, lane, accent], index) => ({
  id: `toxic-${index}`,
  time,
  lane,
  accent: Boolean(accent),
}));

export const TOXIC_FALLBACK_BEATMAP = {
  songUrl: TOXIC_SONG_URL,
  title: 'TOXIC',
  artist: 'BoyWithUke',
  duration: TOXIC_SONG_DURATION,
  bpm: TOXIC_BPM,
  confidence: 0,
  notes: TOXIC_NOTES,
  sections: TOXIC_SECTIONS,
  analysisSource: '정적 폴백',
};

export function getBeatmapSection(songTime, sections = TOXIC_SECTIONS) {
  const time = Math.max(0, Number.isFinite(songTime) ? songTime : 0);
  const safeSections = Array.isArray(sections) && sections.length > 0 ? sections : TOXIC_SECTIONS;
  return safeSections.find(section => time < section.end) ?? safeSections.at(-1);
}

export function getNoteZ(noteTime, songTime) {
  return NOTE_HIT_Z + (songTime - noteTime) * NOTE_SPEED;
}

export function formatSongTime(seconds, duration = TOXIC_SONG_DURATION) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : TOXIC_SONG_DURATION;
  const safeSeconds = Math.max(0, Math.min(safeDuration, Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
