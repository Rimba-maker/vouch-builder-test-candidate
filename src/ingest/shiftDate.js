function parseOffsetHours(tz) {
  const m = String(tz).match(/^([+-])(\d{2}):(\d{2})$/)
  if (!m) return 8 // safe default: SGT
  return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) + parseInt(m[3]) / 60)
}

// Assign event to the morning date of its shift (23:00-07:00 local hotel time)
function shiftDate(iso, tzOffsetHours = 8) {
  const dt = new Date(iso)
  const local = new Date(dt.getTime() + tzOffsetHours * 3600000)
  const h = local.getUTCHours()
  const dateStr = local.toISOString().slice(0, 10)
  return h >= 23
    ? new Date(local.getTime() + 86400000).toISOString().slice(0, 10)
    : dateStr
}

module.exports = { shiftDate, parseOffsetHours }
