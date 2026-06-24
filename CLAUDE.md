# CLAUDE.md — Vouch Handover Service

## What this service does

Generates a night-shift handover report for hotel morning managers.
Ingests structured events (JSON) + free-text night logs (Markdown), reconciles issues across multiple nights, and returns an action-first JSON report.

## Project structure

```
src/
  app.js            — Express app factory: routes, data loading, validation (shared by index.js and netlify function)
  index.js          — Thin entry point: require('./app') + listen on PORT
  logger.js         — Winston JSON logger (hotel + night in every log line)
  ingest/
    index.js        — Single seam: ingest({ eventsData, nightlogText, nightlogDate }) → Event[] (unified interface)
    events.js       — Parse events.json into normalized events; imports shiftDate internally
    shiftDate.js    — shiftDate(iso, tzOffsetHours) + parseOffsetHours(tz); own module, own tests
    nightlog.js     — Parse free-text night-logs.md, detect non-English content
  reconcile.js      — Cross-night issue threading (still_open / newly_resolved / new_tonight)
  handover.js       — Build action-first output from reconciled threads
  render.js         — HTML view; all user input escaped via esc() before insertion
netlify/
  functions/api.js  — Thin serverless-http wrapper: require('../../src/app')
data/
  events.json       — Bundled sample data (Lumen Boutique Hotel)
  night-logs.md     — Bundled free-text log (Night 3, contains Mandarin)
```

## Endpoints

```
GET  /handover/:date          Uses bundled sample data. date = morning date YYYY-MM-DD
POST /handover                Accepts custom data in body (see below)
GET  /                        Health check
```

### POST body schema

```json
{
  "date": "2026-05-30",
  "events": { /* events.json shape, optional, falls back to sample */ },
  "nightLog": "free text string, optional",
  "nightLogDate": "YYYY-MM-DD morning date for the night log",
  "hotel": { "id": "...", "name": "...", "timezone": "+08:00" }
}
```

## Key design decisions

- **Shift date**: A shift runs 23:00–07:00 **local hotel time** (read from `hotel.timezone`, e.g. `+08:00`). Events at or after 23:00 local are assigned to the NEXT morning's date.
- **Issue threading**: Issues are grouped by `room:category`. Same room + same type category = same thread across nights.
- **Grounding**: Every output item has a `sources` array of event IDs or `nightlog-DATE:bullet-N` refs. Nothing is stated without a source. `verbatim: true` signals the summary is the staff's exact words.
- **Prompt injection**: Descriptions matching `/ignore\s+(all|previous|earlier|above)|system\s+note\s+to|report.*all\s+clear|add.*credit.*approved|disregard\s+(the\s+)?(previous|earlier|above|last)|override\s+(previous|earlier|the)|new\s+instructions?|reset\s+(all|previous)|mark\s+(all\s+)?rooms?\s+(as\s+)?clear/i` are moved to `flagged`, never actioned. Each flagged item includes `detection_trigger`.
- **Non-English text**: Lines with CJK characters are flagged. Room numbers are extracted; status defaults to `pending` (conservative).
- **Escalation**: Items open 3+ nights (`nights_open >= 3`) auto-escalate priority and display a ⚠️ badge in the HTML view.
- **Night log date**: For GET routes, night log shift date is auto-derived as `targetDate - 1 day`. POST callers may supply `nightLogDate` explicitly; if omitted it also defaults to `targetDate - 1`.
- **Unified ingest seam**: `ingest({ eventsData, nightlogText, nightlogDate })` returns a flat `Event[]`. Non-English flagging moved into `reconcile()` alongside injection detection — callers never handle `flags` separately.
- **generateHandover interface**: `({ events, hotel, targetDate })` — 3 keys, no internal implementation details exposed.
- **Date validation**: All endpoints reject non-`YYYY-MM-DD` date strings with a 400 before any processing.
- **XSS prevention**: All user-controlled strings (summary, note, room, guest, hotel_name) are HTML-escaped via `esc()` in render.js before insertion into the HTML view.
- **Data loading**: Sample data is loaded once at startup inside a try/catch in `src/app.js`; failure exits with a logged error rather than crashing silently mid-request.

## Running locally

```bash
npm install
npm start          # port 3000 by default
PORT=8080 npm start
```

## Environment variables

| Var   | Default | Purpose          |
|-------|---------|------------------|
| PORT  | 3000    | HTTP listen port |
