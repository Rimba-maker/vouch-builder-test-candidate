// Detects CJK and other non-Latin scripts
const NON_LATIN = /[　-鿿가-힯぀-ヿ]/

function extractRoom(text) {
  return (
    text.match(/\b[Rr]oom\s+(\d{3})\b/)?.[1] ||
    text.match(/^(\d{3})\s/)?.[1] ||
    text.match(/(\d{3})\s*房/)?.[1] ||
    text.match(/(?:noticed|in|at)\s+(\d{3})\b/i)?.[1] ||
    null
  )
}

function detectStatus(text) {
  const t = text.toLowerCase()
  if (/\b(resolved|settled|sorted|all\s+good|fine|done|closed)\b|settle\s*了/.test(t)) return 'resolved'
  if (/\b(still\s+not|not\s+fixed|needs|please|follow.?up|passing\s+it|no\s+deposit|out\s+of\s+order|urgent)\b/.test(t)) return 'unresolved'
  if (/\b(flagging|someone\s+should|reconcile|to\s+decide|for\s+the\s+morning|could\s+not\s+verify)\b/.test(t)) return 'pending'
  return 'unknown'
}

function detectType(text) {
  const t = text.toLowerCase()
  if (/aircon|compressor|repair|out\s+of\s+order|safe|保险箱|broken|faulty|damaged/.test(t)) return 'maintenance'
  if (/leak|corridor|drip|flood/.test(t)) return 'facilities'
  if (/deposit|card\s+declin|charge|no.show|booking\s+terms/.test(t)) return 'finance'
  if (/passport|immigration|scan|护照/.test(t)) return 'compliance'
  if (/check.?in|checked\s+in/.test(t)) return 'check_in'
  if (/door\s+ajar|unoccupied|no\s+luggage|nobody/.test(t)) return 'incident'
  if (/noise|complaint|angry/.test(t)) return 'complaint'
  if (/wifi|internet|dropping/.test(t)) return 'complaint'
  return 'note'
}

function ingestNightlog(text, shiftDateStr) {
  const events = []
  const flags = []

  const bullets = text
    .split('\n')
    .filter(l => l.trim().startsWith('- '))
    .map(l => l.trim().slice(2).trim())

  bullets.forEach((bullet, i) => {
    const isNonLatin = NON_LATIN.test(bullet)
    const room = extractRoom(bullet)
    const status = detectStatus(bullet)
    const type = detectType(bullet)
    const ref = `nightlog-${shiftDateStr}:bullet-${i + 1}`

    if (isNonLatin) {
      flags.push({ source: ref, room, original: bullet, flag: 'Non-English content — manual review required' })
    }

    events.push({
      id: ref,
      source: 'night-logs.md',
      shiftDate: shiftDateStr,
      timestamp: null,
      type,
      room,
      guest: null,
      description: isNonLatin && status === 'unknown'
        ? `[Non-English entry, room ${room || 'unknown'}] Original: "${bullet}"`
        : bullet,
      // Conservative default: unknown status → pending (don't assume resolved)
      status: status === 'unknown' ? 'pending' : status,
      hasNonEnglish: isNonLatin
    })
  })

  return { events, flags }
}

module.exports = { ingestNightlog }
