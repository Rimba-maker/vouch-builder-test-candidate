const { ingestEvents } = require('./events')
const { ingestNightlog } = require('./nightlog')

// Single seam: both event sources → one flat normalized array
function ingest({ eventsData, nightlogText, nightlogDate }) {
  const events = ingestEvents(eventsData)
  const { events: nlEvents } = ingestNightlog(nightlogText, nightlogDate)
  return [...events, ...nlEvents]
}

module.exports = { ingest }
