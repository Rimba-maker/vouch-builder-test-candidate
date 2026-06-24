const TYPE_CATEGORY = {
  maintenance: 'maintenance', facilities: 'facilities',
  compliance: 'compliance',
  deposit_issue: 'finance', finance_note: 'finance', no_show: 'finance',
  check_in_issue: 'identity', incident: 'incident', damage_report: 'damage',
  complaint: 'complaint', early_checkout_request: 'checkout',
  check_in: 'checkin', lost_keycard: 'keycard',
  walk_in: 'walkin', note: 'note', guest_message: 'message'
}

// Catches injection attempts — structural defense: service never executes, only classifies
const INJECTION_RE = /ignore\s+(all|previous|earlier|above)|system\s+note\s+to|report.*all\s+clear|add.*credit.*approved|disregard\s+(the\s+)?(previous|earlier|above|last)|override\s+(previous|earlier|the)|new\s+instructions?|reset\s+(all|previous)|mark\s+(all\s+)?rooms?\s+(as\s+)?clear/i

function issueKey(evt) {
  return `${evt.room || 'hotel'}:${TYPE_CATEGORY[evt.type] || evt.type}`
}

function getPriority(evt, nightsOpen = 0) {
  const cat = TYPE_CATEGORY[evt.type] || evt.type
  if (cat === 'compliance' && evt.status !== 'resolved') return 'critical'
  if (cat === 'finance' && evt.status === 'unresolved') return 'critical'
  if (['maintenance', 'facilities', 'incident', 'damage'].includes(cat) && evt.status !== 'resolved') return 'high'
  if (evt.status === 'pending') return nightsOpen >= 3 ? 'high' : 'medium'
  return 'low'
}

function nightsOpenCount(openSince, targetDate) {
  const ms = new Date(targetDate) - new Date(openSince)
  return Math.max(0, Math.round(ms / 86400000))
}

function reconcile(allEvents, targetDate) {
  const flagged = []
  const clean = []

  for (const evt of allEvents) {
    if (INJECTION_RE.test(evt.description || '')) {
      const match = (evt.description || '').match(INJECTION_RE)
      flagged.push({
        type: 'prompt_injection',
        room: evt.room,
        summary: `Suspected prompt injection in ${evt.id} — content ignored, not actioned`,
        detection_trigger: match ? match[0] : 'pattern match',
        original: evt.description,
        source: evt.id
      })
      continue // injection: excluded from reconciliation
    }
    if (evt.hasNonEnglish) {
      flagged.push({
        type: 'non_english',
        room: evt.room,
        summary: `Non-English content in ${evt.id} — room ${evt.room || 'unknown'} mentioned, manual review required`,
        original: evt.original || evt.description,
        source: evt.id
      })
    }
    clean.push(evt) // non-English: flagged for review AND still reconciled
  }

  // Group into issue threads by room + category
  const threads = {}
  for (const evt of clean) {
    const key = issueKey(evt)
    ;(threads[key] = threads[key] || []).push(evt)
  }
  for (const key in threads) {
    threads[key].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
  }

  const tonight = clean.filter(e => e.shiftDate === targetDate)
  const result = { on_fire: [], pending: [], fyi: [], newly_resolved: [], flagged }
  const seen = new Set()

  // Process tonight's events
  for (const evt of tonight) {
    const key = issueKey(evt)
    if (seen.has(key)) continue
    seen.add(key)

    const thread = threads[key] || []
    const prev = thread.filter(e => e.shiftDate < targetDate)
    const hadOpen = prev.some(e => e.status === 'unresolved' || e.status === 'pending')

    const openSince = hadOpen ? prev[0].shiftDate : targetDate
    const nights = nightsOpenCount(openSince, targetDate)
    const item = {
      room: evt.room,
      guest: evt.guest,
      summary: evt.description,
      verbatim: true,
      status: evt.status,
      priority: getPriority(evt, nights),
      open_since: openSince,
      nights_open: nights,
      thread_status: hadOpen && evt.status === 'resolved'
        ? 'newly_resolved'
        : hadOpen ? 'still_open' : 'new_tonight',
      sources: thread.map(e => e.id).filter(Boolean)
    }

    if (item.thread_status === 'newly_resolved') result.newly_resolved.push(item)
    else if (item.priority === 'critical' || item.priority === 'high') result.on_fire.push(item)
    else if (evt.status !== 'resolved') result.pending.push(item)
    else result.fyi.push(item)
  }

  // Carry-over: previous open issues with no update tonight
  for (const key in threads) {
    if (seen.has(key)) continue
    const thread = threads[key]
    const prev = thread.filter(e => e.shiftDate < targetDate)
    if (!prev.length) continue
    const last = prev[prev.length - 1]
    if (last.status !== 'unresolved' && last.status !== 'pending') continue

    seen.add(key)
    const openSince = prev.find(e => e.status === 'unresolved' || e.status === 'pending')?.shiftDate || last.shiftDate
    const nights = nightsOpenCount(openSince, targetDate)
    const item = {
      room: last.room,
      guest: last.guest,
      summary: last.description,
      verbatim: true,
      status: last.status,
      priority: getPriority(last, nights),
      open_since: openSince,
      nights_open: nights,
      thread_status: 'still_open',
      note: nights >= 3 ? `No update tonight — open ${nights} nights, escalated` : 'No update tonight',
      sources: thread.map(e => e.id).filter(Boolean)
    }

    if (item.priority === 'critical' || item.priority === 'high') result.on_fire.push(item)
    else result.pending.push(item)
  }

  const ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
  result.on_fire.sort((a, b) => (ORDER[a.priority] || 3) - (ORDER[b.priority] || 3))
  result.pending.sort((a, b) => (ORDER[a.priority] || 3) - (ORDER[b.priority] || 3))

  return result
}

module.exports = { reconcile }
