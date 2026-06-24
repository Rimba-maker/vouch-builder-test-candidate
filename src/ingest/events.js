// Parse "+08:00" / "-05:00" → offset in hours
function parseOffsetHours(tz) {
  const m = String(tz).match(/^([+-])(\d{2}):(\d{2})$/)
  if (!m) return 8 // safe default: SGT
  return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) + parseInt(m[3]) / 60)
}

// Assign each event to the morning date of its shift (23:00-07:00 local hotel time)
function shiftDate(iso, tzOffsetHours = 8) {
  const dt = new Date(iso)
  const local = new Date(dt.getTime() + tzOffsetHours * 3600000)
  const h = local.getUTCHours()
  const dateStr = local.toISOString().slice(0, 10)
  // Events at/after 23:00 local time belong to the next morning's handover
  return h >= 23
    ? new Date(local.getTime() + 86400000).toISOString().slice(0, 10)
    : dateStr
}

function ingestEvents(rawData) {
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
  const tzHours = parseOffsetHours(data.hotel?.timezone || '+08:00')
  return data.events.map(evt => ({
    id: evt.id,
    source: 'events.json',
    shiftDate: shiftDate(evt.timestamp, tzHours),
    timestamp: evt.timestamp,
    type: evt.type,
    room: evt.room,
    guest: evt.guest,
    description: evt.description,
    status: evt.status
  }))
}

module.exports = { ingestEvents, shiftDate, parseOffsetHours }
