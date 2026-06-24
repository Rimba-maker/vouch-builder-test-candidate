const TYPE_CATEGORY = {
  maintenance: 'maintenance', facilities: 'facilities',
  compliance: 'compliance',
  deposit_issue: 'finance', finance_note: 'finance', no_show: 'finance',
  check_in_issue: 'identity', incident: 'incident', damage_report: 'damage',
  complaint: 'complaint', early_checkout_request: 'checkout',
  check_in: 'checkin', lost_keycard: 'keycard',
  walk_in: 'walkin', note: 'note', guest_message: 'message'
}

// ponytail: catches injection attempts in raw event descriptions
const INJECTION_RE = /ignore\s+all|system\s+note\s+to|report.*all\s+clear|add.*credit.*approved/i

function issueKey(evt) {
  return `${evt.room || 'hotel'}:${TYPE_CATEGORY[evt.type] || evt.type}`
}

function getPriority(evt) {
  const cat = TYPE_CATEGORY[evt.type] || evt.type
  if (cat === 'compliance' && evt.status !== 'resolved') return 'critical'
  if (cat === 'finance' && evt.status === 'unresolved') return 'critical'
  if (['maintenance', 'facilities', 'incident', 'damage'].includes(cat) && evt.status !== 'resolved') return 'high'
  if (evt.status === 'pending') return 'medium'
  return 'low'
}

function reconcile(allEvents, targetDate) {
  const flagged = []
  const clean = []

  for (const evt of allEvents) {
    if (INJECTION_RE.test(evt.description || '')) {
      flagged.push({
        type: 'prompt_injection',
        room: evt.room,
        summary: `Suspected prompt injection in ${evt.id} — content ignored, not actioned`,
        original: evt.description,
        source: evt.id
      })
    } else {
      clean.push(evt)
    }
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

    const item = {
      room: evt.room,
      guest: evt.guest,
      summary: evt.description,
      status: evt.status,
      priority: getPriority(evt),
      open_since: hadOpen ? prev[0].shiftDate : targetDate,
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
    const item = {
      room: last.room,
      guest: last.guest,
      summary: last.description,
      status: last.status,
      priority: getPriority(last),
      open_since: prev.find(e => e.status === 'unresolved' || e.status === 'pending')?.shiftDate || last.shiftDate,
      thread_status: 'still_open',
      note: 'No update tonight',
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
