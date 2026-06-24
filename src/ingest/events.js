// Assign each event to the morning date of its shift (23:00-07:00 SGT)
function shiftDate(iso) {
  const dt = new Date(iso)
  const sgt = new Date(dt.getTime() + 8 * 3600000) // UTC+8
  const h = sgt.getUTCHours()
  const dateStr = sgt.toISOString().slice(0, 10)
  // Events at/after 23:00 belong to the next morning's handover
  return h >= 23
    ? new Date(sgt.getTime() + 86400000).toISOString().slice(0, 10)
    : dateStr
}

function ingestEvents(rawData) {
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
  return data.events.map(evt => ({
    id: evt.id,
    source: 'events.json',
    shiftDate: shiftDate(evt.timestamp),
    timestamp: evt.timestamp,
    type: evt.type,
    room: evt.room,
    guest: evt.guest,
    description: evt.description,
    status: evt.status
  }))
}

module.exports = { ingestEvents, shiftDate }
