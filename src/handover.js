const { reconcile } = require('./reconcile')

function generateHandover({ events, hotel, targetDate }) {
  const sections = reconcile(events, targetDate)
  return {
    hotel: hotel.id,
    hotel_name: hotel.name,
    handover_for: `morning of ${targetDate}`,
    generated_at: new Date().toISOString(),
    summary: {
      on_fire: sections.on_fire.length,
      pending: sections.pending.length,
      fyi: sections.fyi.length,
      newly_resolved: sections.newly_resolved.length,
      flagged: sections.flagged.length
    },
    handover: sections
  }
}

module.exports = { generateHandover }
