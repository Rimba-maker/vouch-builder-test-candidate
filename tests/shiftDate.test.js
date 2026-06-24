const { test } = require('node:test')
const assert = require('node:assert/strict')
const { shiftDate, parseOffsetHours } = require('../src/ingest/shiftDate')

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

// ── multi-timezone support ────────────────────────────────────

test('parseOffsetHours: +08:00 → 8', () => {
  assert.equal(parseOffsetHours('+08:00'), 8)
})

test('parseOffsetHours: +07:00 (Bangkok) → 7', () => {
  assert.equal(parseOffsetHours('+07:00'), 7)
})

test('parseOffsetHours: +09:00 (Tokyo) → 9', () => {
  assert.equal(parseOffsetHours('+09:00'), 9)
})

test('parseOffsetHours: +04:00 (Dubai) → 4', () => {
  assert.equal(parseOffsetHours('+04:00'), 4)
})

test('parseOffsetHours: -05:00 → -5', () => {
  assert.equal(parseOffsetHours('-05:00'), -5)
})

test('Bangkok hotel (UTC+7): 23:00 local rolls to next morning', () => {
  // 2026-05-27 23:00 Bangkok = 2026-05-27T16:00:00Z
  assert.equal(shiftDate('2026-05-27T16:00:00.000Z', 7), '2026-05-28')
})

test('Bangkok hotel (UTC+7): 22:59 local stays same date', () => {
  // 2026-05-27 22:59 Bangkok = 2026-05-27T15:59:00Z
  assert.equal(shiftDate('2026-05-27T15:59:00.000Z', 7), '2026-05-27')
})

test('Tokyo hotel (UTC+9): 23:00 local rolls to next morning', () => {
  // 2026-05-27 23:00 Tokyo = 2026-05-27T14:00:00Z
  assert.equal(shiftDate('2026-05-27T14:00:00.000Z', 9), '2026-05-28')
})

test('same UTC timestamp → different shift dates in Bangkok vs Tokyo', () => {
  // 2026-05-27T15:30:00Z = 22:30 Bangkok (same day) vs 00:30 Tokyo (next day)
  const utc = '2026-05-27T15:30:00.000Z'
  assert.equal(shiftDate(utc, 7), '2026-05-27') // Bangkok: 22:30, stays
  assert.equal(shiftDate(utc, 9), '2026-05-28') // Tokyo: 00:30, next morning
})
