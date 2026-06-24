function nightsLabel(nights) {
  if (nights === 0) return 'tonight'
  if (nights === 1) return 'since last night'
  return `open ${nights} nights`
}

function threadLabel(t) {
  if (t === 'still_open') return 'Carried over'
  if (t === 'new_tonight') return 'New tonight'
  if (t === 'newly_resolved') return 'Resolved tonight'
  return ''
}

function item(i) {
  const roomLabel = i.room ? `Room ${i.room}` : 'Hotel-wide'
  const nights = i.nights_open || 0
  const ageText = i.thread_status === 'still_open'
    ? (nights >= 3 ? `⚠️ ${nights} nights unresolved` : nightsLabel(nights))
    : ''
  const age = ageText ? `<span class="age${nights >= 3 ? ' escalated' : ''}">${ageText}</span>` : ''
  const tag = `<span class="tag ${i.thread_status}">${threadLabel(i.thread_status)}</span>`
  const sources = (i.sources || [i.source]).filter(Boolean)

  return `
    <div class="item">
      <div class="item-head">
        <span class="room">${roomLabel}</span>
        ${i.guest ? `<span class="guest">${i.guest}</span>` : ''}
        ${tag}${age}
      </div>
      <p class="desc">${i.summary}</p>
      <details class="src-detail">
        <summary>Source trail</summary>
        <span class="srcs">${sources.join(' · ')}</span>
      </details>
    </div>`
}

function block(emoji, title, color, items) {
  if (!items.length) return ''
  return `
    <section>
      <h2 class="section-title" style="border-color:${color};color:${color}">
        ${emoji} ${title} <span class="count">${items.length}</span>
      </h2>
      ${items.map(item).join('')}
    </section>`
}

function renderHTML(handover) {
  const { hotel_name, handover_for, generated_at, summary, handover: h } = handover
  const genTime = new Date(generated_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Handover — ${hotel_name}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f4f4f4; color:#1a1a1a; font-size:15px; line-height:1.5 }
  .wrap { max-width:720px; margin:0 auto; padding:24px 16px }

  /* Header */
  .header { background:#111827; color:#fff; padding:20px 24px; border-radius:8px 8px 0 0 }
  .header h1 { font-size:22px; font-weight:700; letter-spacing:-0.3px }
  .header p { color:#9ca3af; font-size:13px; margin-top:4px }

  /* Summary strip */
  .strip { background:#fff; border:1px solid #e5e7eb; border-top:none; padding:12px 20px; border-radius:0 0 8px 8px; display:flex; gap:16px; flex-wrap:wrap; font-size:13px; margin-bottom:24px }
  .dot { font-weight:600 }
  .dot.fire { color:#dc2626 }
  .dot.pend { color:#d97706 }
  .dot.ok   { color:#16a34a }
  .dot.flag { color:#7c3aed }

  /* Section */
  section { margin-bottom:20px }
  .section-title { font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; border-left:4px solid; padding-left:10px; margin-bottom:10px }
  .count { font-weight:400; opacity:.7 }

  /* Item */
  .item { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:14px 16px; margin-bottom:8px }
  .item-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px }
  .room { font-weight:700; font-size:15px }
  .guest { color:#6b7280; font-size:13px }
  .tag { font-size:11px; font-weight:600; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:.4px }
  .tag.still_open  { background:#fef3c7; color:#92400e }
  .tag.new_tonight { background:#dbeafe; color:#1e40af }
  .tag.newly_resolved { background:#dcfce7; color:#166534 }
  .age { font-size:12px; color:#9ca3af; margin-left:auto }
  .age.escalated { color:#dc2626; font-weight:600 }
  .desc { color:#374151; line-height:1.6 }

  /* Source trail */
  .src-detail { margin-top:8px }
  .src-detail summary { font-size:12px; color:#9ca3af; cursor:pointer; user-select:none }
  .src-detail summary:hover { color:#6b7280 }
  .srcs { font-size:11px; font-family:monospace; color:#6b7280; display:block; margin-top:4px }

  /* Footer */
  .footer { font-size:12px; color:#9ca3af; text-align:center; margin-top:24px }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>${hotel_name}</h1>
    <p>Morning handover · ${handover_for}</p>
  </div>
  <div class="strip">
    <span class="dot fire">🔴 ${summary.on_fire} need action</span>
    <span class="dot pend">🟡 ${summary.pending} pending</span>
    <span class="dot ok">🟢 ${summary.fyi} FYI</span>
    ${summary.newly_resolved ? `<span class="dot ok">✅ ${summary.newly_resolved} resolved tonight</span>` : ''}
    ${summary.flagged ? `<span class="dot flag">🚨 ${summary.flagged} flagged</span>` : ''}
  </div>

  ${block('🔴', 'Act Now', '#dc2626', h.on_fire)}
  ${block('🟡', 'Pending — Handle Today', '#d97706', h.pending)}
  ${summary.newly_resolved ? block('✅', 'Resolved Tonight', '#16a34a', h.newly_resolved) : ''}
  ${block('🟢', 'FYI', '#16a34a', h.fyi)}
  ${block('🚨', 'Flagged — Review Required', '#7c3aed', h.flagged)}

  <p class="footer">Generated ${genTime} · Lumen Boutique Hotel</p>
</div>
</body>
</html>`
}

module.exports = { renderHTML }
