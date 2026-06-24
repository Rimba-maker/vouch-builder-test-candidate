const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ingestNightlog } = require('../src/ingest/nightlog')

const DATE = '2026-05-28'

// ── room extraction ───────────────────────────────────────────

test('extracts room from "Room 205" pattern', () => {
  const { events } = ingestNightlog('- Room 205 aircon not working', DATE)
  assert.equal(events[0].room, '205')
})

test('extracts room from leading 3-digit pattern', () => {
  const { events } = ingestNightlog('- 309 guest complained about noise', DATE)
  assert.equal(events[0].room, '309')
})

test('extracts room from Chinese 房 pattern', () => {
  const { events } = ingestNightlog('- 205房 保险箱故障', DATE)
  assert.equal(events[0].room, '205')
})

test('extracts room from "noticed 205" pattern', () => {
  const { events } = ingestNightlog('- noticed 205 had a leak', DATE)
  assert.equal(events[0].room, '205')
})

test('returns null room for hotel-wide note', () => {
  const { events } = ingestNightlog('- WiFi dropping in lobby', DATE)
  assert.equal(events[0].room, null)
})

// ── status detection ──────────────────────────────────────────

test('resolved keywords → resolved status', () => {
  const { events } = ingestNightlog('- Room 101 issue is resolved', DATE)
  assert.equal(events[0].status, 'resolved')
})

test('follow-up keywords → unresolved status', () => {
  const { events } = ingestNightlog('- Room 202 please follow-up on deposit', DATE)
  assert.equal(events[0].status, 'unresolved')
})

test('flagging keywords → pending status', () => {
  const { events } = ingestNightlog('- flagging for the morning team to decide', DATE)
  assert.equal(events[0].status, 'pending')
})

// ── non-English / Chinese entries ────────────────────────────

test('Chinese text → flagged for manual review', () => {
  const { flags } = ingestNightlog('- 205房 保险箱故障，需要维修', DATE)
  assert.equal(flags.length, 1)
  assert.match(flags[0].flag, /Non-English/)
})

test('Chinese text → status defaults to pending (not assumed resolved)', () => {
  const { events } = ingestNightlog('- 205房 保险箱故障，需要维修', DATE)
  assert.equal(events[0].status, 'pending')
})

test('Chinese text → original preserved in flag', () => {
  const bullet = '205房 保险箱故障，需要维修'
  const { flags } = ingestNightlog(`- ${bullet}`, DATE)
  assert.equal(flags[0].original, bullet)
})

test('Chinese text with 了 resolved marker → resolved', () => {
  // settle了 should be detected as resolved
  const { events } = ingestNightlog('- 312 deposit settle了', DATE)
  assert.equal(events[0].status, 'resolved')
})

// ── source references ────────────────────────────────────────

test('each bullet gets a unique nightlog ref', () => {
  const { events } = ingestNightlog('- first bullet\n- second bullet', DATE)
  assert.equal(events[0].id, `nightlog-${DATE}:bullet-1`)
  assert.equal(events[1].id, `nightlog-${DATE}:bullet-2`)
})

test('non-bullet lines are ignored', () => {
  const text = `# Night log\n\nSome prose.\n\n- Only this bullet\n`
  const { events } = ingestNightlog(text, DATE)
  assert.equal(events.length, 1)
})

// ── type detection ───────────────────────────────────────────

test('aircon mention → maintenance type', () => {
  const { events } = ingestNightlog('- Room 301 aircon out of order', DATE)
  assert.equal(events[0].type, 'maintenance')
})

test('passport mention → compliance type', () => {
  const { events } = ingestNightlog('- Room 204 passport not scanned', DATE)
  assert.equal(events[0].type, 'compliance')
})

test('deposit mention → finance type', () => {
  const { events } = ingestNightlog('- Room 309 no deposit collected', DATE)
  assert.equal(events[0].type, 'finance')
})
