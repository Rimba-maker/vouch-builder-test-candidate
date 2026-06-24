const { test } = require('node:test')
const assert = require('node:assert/strict')
const { shiftDate } = require('../src/ingest/events')

// SGT = UTC+8. Shift runs 23:00–07:00 SGT.
// Events at/after 23:00 SGT → belong to NEXT morning.

test('before 23:00 SGT stays on same date', () => {
  // 2026-05-27 22:59 SGT = 2026-05-27T14:59:00Z
  assert.equal(shiftDate('2026-05-27T14:59:00.000Z'), '2026-05-27')
})

test('exactly 23:00 SGT rolls to next morning', () => {
  // 2026-05-27 23:00 SGT = 2026-05-27T15:00:00Z
  assert.equal(shiftDate('2026-05-27T15:00:00.000Z'), '2026-05-28')
})

test('23:30 SGT rolls to next morning', () => {
  // 2026-05-27 23:30 SGT = 2026-05-27T15:30:00Z
  assert.equal(shiftDate('2026-05-27T15:30:00.000Z'), '2026-05-28')
})

test('00:30 SGT (early morning) stays on same morning', () => {
  // 2026-05-28 00:30 SGT = 2026-05-27T16:30:00Z → morning of 2026-05-28
  assert.equal(shiftDate('2026-05-27T16:30:00.000Z'), '2026-05-28')
})

test('06:59 SGT (end of shift) stays on same morning', () => {
  // 2026-05-28 06:59 SGT = 2026-05-27T22:59:00Z → morning of 2026-05-28
  assert.equal(shiftDate('2026-05-27T22:59:00.000Z'), '2026-05-28')
})

test('07:00 SGT (new day, not night shift) stays on that date', () => {
  // 2026-05-28 07:00 SGT = 2026-05-27T23:00:00Z
  assert.equal(shiftDate('2026-05-27T23:00:00.000Z'), '2026-05-28')
})
