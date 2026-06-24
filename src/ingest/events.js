const { shiftDate, parseOffsetHours } = require('./shiftDate')

function ingestEvents(rawData) {
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
  if (!Array.isArray(data.events)) throw new Error('events must be an array')
  const tzHours = parseOffsetHours(data.hotel?.timezone || '+08:00')
  return data.events
    .filter(evt => evt.timestamp)
    .map(evt => ({
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

module.exports = { ingestEvents }
