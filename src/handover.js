const { reconcile } = require('./reconcile')

function generateHandover({ events, nightlogEvents, nonEnglishFlags, hotel, targetDate }) {
  const sections = reconcile([...events, ...nightlogEvents], targetDate)

  // Append non-English flags to flagged section
  for (const f of nonEnglishFlags) {
    sections.flagged.push({
      type: 'non_english',
      room: f.room,
      summary: `Non-English content in ${f.source} — room ${f.room || 'unknown'} mentioned, manual review required`,
      original: f.original,
      source: f.source
    })
  }

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
