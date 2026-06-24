// Design hybrid: Linear (structure/dark header/spacing) + Airbnb (coral accent) + Notion (Inter type/pastel tints/light canvas)

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
  const nights = i.nights_open || 0
  const isEscalated = nights >= 3 && i.thread_status === 'still_open'
  const ageText = i.thread_status === 'still_open'
    ? (isEscalated ? `⚠ ${nights} nights` : nightsLabel(nights))
    : ''
  const sources = (i.sources || [i.source]).filter(Boolean)

  return `
    <div class="item${isEscalated ? ' escalated' : ''}">
      <div class="item-head">
        <span class="room">${i.room ? `Room ${esc(i.room)}` : 'Hotel-wide'}</span>
        ${i.guest ? `<span class="guest">· ${esc(i.guest)}</span>` : ''}
        <span class="badge badge-${i.thread_status}">${threadLabel(i.thread_status)}</span>
        ${ageText ? `<span class="age${isEscalated ? ' age-hot' : ''}">${ageText}</span>` : ''}
      </div>
      <p class="desc">${esc(i.summary)}</p>
      ${i.note ? `<p class="item-note">${esc(i.note)}</p>` : ''}
      <details class="src">
        <summary>Source trail</summary>
        <span class="src-list">${sources.map(s => `<code>${esc(s)}</code>`).join(' ')}</span>
      </details>
    </div>`
}

function section(emoji, title, accent, bg, items) {
  if (!items || !items.length) return ''
  return `
    <section class="block" style="--accent:${accent};--bg:${bg}">
      <div class="block-head">
        <span class="block-icon">${emoji}</span>
        <h2 class="block-title">${title}</h2>
        <span class="block-count">${items.length}</span>
      </div>
      <div class="items">${items.map(item).join('')}</div>
    </section>`
}

function renderHTML(handover) {
  const { hotel_name, handover_for, generated_at, summary, handover: h } = handover
  const genTime = new Date(generated_at).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short'
  })

  const chips = [
    summary.on_fire     ? `<span class="chip chip-fire">🔴 ${summary.on_fire} act now</span>` : '',
    summary.pending     ? `<span class="chip chip-warn">🟡 ${summary.pending} pending</span>` : '',
    summary.fyi         ? `<span class="chip chip-ok">🟢 ${summary.fyi} FYI</span>` : '',
    summary.newly_resolved ? `<span class="chip chip-ok">✅ ${summary.newly_resolved} resolved</span>` : '',
    summary.flagged     ? `<span class="chip chip-flag">🚨 ${summary.flagged} flagged</span>` : '',
  ].filter(Boolean).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Handover — ${esc(hotel_name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  /* ── tokens ───────────────────────────────────────────────────
     Linear:  dark canvas #010102, hairline #23252a, radius 12px
     Airbnb:  Rausch coral #ff385c for on-fire urgency
     Notion:  Inter, 1.55 body line-height, pastel section tints
  ────────────────────────────────────────────────────────────── */
  :root {
    --canvas:   #010102;
    --surface:  #ffffff;
    --hairline: #e4e4e7;
    --text:     #18181b;
    --muted:    #71717a;
    --subtle:   #a1a1aa;
    --fire:     #ff385c;   /* Airbnb Rausch */
    --warn:     #f59e0b;
    --ok:       #16a34a;
    --flag:     #7c3aed;
    --fire-bg:  #fff1f2;
    --warn-bg:  #fffbeb;
    --ok-bg:    #f0fdf4;
    --flag-bg:  #faf5ff;
    --radius-card: 12px;   /* Linear lg */
    --radius-badge: 9999px;/* Linear pill */
    --radius-btn:  8px;    /* Linear md */
    --base: 4px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1.55; /* Notion body */
    color: var(--text);
    background: #f4f4f5;
  }

  /* ── header (Linear dark canvas) ───────────────────────────── */
  .header {
    background: var(--canvas);
    padding: 28px 32px 24px;
    border-bottom: 1px solid #23252a;
  }
  .header-inner { max-width: 760px; margin: 0 auto }
  .header h1 {
    font-size: 22px;
    font-weight: 600;
    color: #f7f8f8;            /* Linear ink */
    letter-spacing: -0.6px;    /* Linear headline tracking */
    margin-bottom: 4px;
  }
  .header p { font-size: 13px; color: #8a8f98 } /* Linear ink-subtle */

  /* ── summary chips ─────────────────────────────────────────── */
  .chips {
    max-width: 760px; margin: 0 auto;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-top: none;
    border-radius: 0 0 var(--radius-card) var(--radius-card);
    padding: 12px 20px;
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-bottom: 28px;
  }
  .chip {
    display: inline-flex; align-items: center;
    font-size: 12px; font-weight: 500;
    padding: 3px 10px;
    border-radius: var(--radius-badge);
    letter-spacing: 0;
  }
  .chip-fire { background: #fff1f2; color: #be123c }
  .chip-warn { background: #fffbeb; color: #92400e }
  .chip-ok   { background: #f0fdf4; color: #15803d }
  .chip-flag { background: #faf5ff; color: #6d28d9 }

  /* ── layout ─────────────────────────────────────────────────── */
  .wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 48px }

  /* ── section block ─────────────────────────────────────────── */
  .block { margin-bottom: 24px }
  .block-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px;
  }
  .block-icon { font-size: 16px; line-height: 1 }
  .block-title {
    font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--accent, var(--muted));
  }
  .block-count {
    font-size: 11px; font-weight: 500;
    color: var(--subtle);
    background: #f4f4f5;
    padding: 1px 7px;
    border-radius: var(--radius-badge);
  }

  /* ── item card (Linear feature-card) ──────────────────────── */
  .item {
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    padding: 14px 16px;
    margin-bottom: 8px;
    border-left: 3px solid var(--accent, var(--hairline));
    transition: box-shadow 0.15s;
  }
  .item.escalated {
    border-left-color: var(--fire);
    background: #fff8f8;
  }
  .item:hover { box-shadow: 0 1px 8px rgba(0,0,0,0.07) }

  .item-head {
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap; margin-bottom: 6px;
  }
  .room { font-weight: 600; font-size: 14px; color: var(--text) }
  .guest { font-size: 13px; color: var(--muted) }

  /* Linear status-badge: pill, surface-2 bg */
  .badge {
    font-size: 11px; font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-badge);
    letter-spacing: 0.2px;
    text-transform: uppercase;
  }
  .badge-still_open    { background: #fef3c7; color: #92400e }
  .badge-new_tonight   { background: #dbeafe; color: #1e40af }
  .badge-newly_resolved{ background: #dcfce7; color: #15803d }

  .age {
    font-size: 12px; color: var(--subtle);
    margin-left: auto;
  }
  .age-hot { color: var(--fire); font-weight: 600 }

  .desc {
    font-size: 14px; color: #3f3f46;
    line-height: 1.6;
  }
  .item-note {
    font-size: 12px; color: var(--subtle);
    margin-top: 4px; font-style: italic;
  }

  /* source trail (Linear mono style) */
  .src { margin-top: 8px }
  .src summary {
    font-size: 11px; color: var(--subtle);
    cursor: pointer; user-select: none;
    list-style: none;
  }
  .src summary:hover { color: var(--muted) }
  .src-list {
    display: block; margin-top: 4px;
    font-size: 11px; color: var(--muted);
  }
  .src-list code {
    font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', monospace;
    font-size: 10px;
    background: #f4f4f5;
    padding: 1px 5px;
    border-radius: 4px;
    margin-right: 4px;
  }

  /* ── footer ─────────────────────────────────────────────────── */
  .footer {
    text-align: center;
    font-size: 11px; color: var(--subtle);
    padding-top: 8px;
    border-top: 1px solid var(--hairline);
    margin-top: 8px;
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <h1>${esc(hotel_name)}</h1>
    <p>Morning handover · ${esc(handover_for)}</p>
  </div>
</div>

<div class="chips">${chips}</div>

<div class="wrap">
  ${section('🔴', 'Act Now', 'var(--fire)', 'var(--fire-bg)', h.on_fire)}
  ${section('🟡', 'Pending — Handle Today', 'var(--warn)', 'var(--warn-bg)', h.pending)}
  ${section('✅', 'Resolved Tonight', 'var(--ok)', 'var(--ok-bg)', h.newly_resolved)}
  ${section('🟢', 'FYI', 'var(--ok)', 'var(--ok-bg)', h.fyi)}
  ${section('🚨', 'Flagged — Review Required', 'var(--flag)', 'var(--flag-bg)', h.flagged)}

  <p class="footer">Generated ${genTime} · All summaries are verbatim staff input</p>
</div>

</body>
</html>`
}

module.exports = { renderHTML }
