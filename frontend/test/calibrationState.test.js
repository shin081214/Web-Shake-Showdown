import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CALIBRATION_ALIGNING,
  CALIBRATION_READY,
  getCalibrationSummary,
  removePlayerCalibration,
  setPlayerCalibration,
} from '../src/calibrationState.js';

test('새 플레이어는 위치 맞추기가 끝날 때까지 게임을 시작할 수 없다', () => {
  const players = {
    phone1: { id: 'phone1' },
    phone2: { id: 'phone2' },
  };
  let calibration = {};

  calibration = setPlayerCalibration(calibration, 'phone1', CALIBRATION_ALIGNING);
  calibration = setPlayerCalibration(calibration, 'phone2', CALIBRATION_ALIGNING);

  assert.deepEqual(getCalibrationSummary(players, calibration), {
    total: 2,
    ready: 0,
    pending: 2,
    allReady: false,
    showGuide: true,
  });

  calibration = setPlayerCalibration(calibration, 'phone1', CALIBRATION_READY);
  assert.equal(getCalibrationSummary(players, calibration).allReady, false);

  calibration = setPlayerCalibration(calibration, 'phone2', CALIBRATION_READY);
  assert.deepEqual(getCalibrationSummary(players, calibration), {
    total: 2,
    ready: 2,
    pending: 0,
    allReady: true,
    showGuide: false,
  });
});

test('나간 플레이어의 위치 맞춤 상태를 제거한다', () => {
  const calibration = {
    phone1: CALIBRATION_READY,
    phone2: CALIBRATION_ALIGNING,
  };

  assert.deepEqual(removePlayerCalibration(calibration, 'phone2'), {
    phone1: CALIBRATION_READY,
  });
});
