# CLAUDE.md — Vouch Handover Service

## What this service does

Generates a night-shift handover report for hotel morning managers.
Ingests structured events (JSON) + free-text night logs (Markdown), reconciles issues across multiple nights, and returns an action-first JSON report.

## Project structure

```
src/
  index.js          — Express server, two endpoints
  logger.js         — Winston JSON logger (hotel + night in every log line)
  ingest/
    events.js       — Parse events.json, assign each event to its shift morning date
    nightlog.js     — Parse free-text night-logs.md, detect non-English content
  reconcile.js      — Cross-night issue threading (still_open / newly_resolved / new_tonight)
  handover.js       — Build action-first output from reconciled threads
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

- **Shift date**: A shift runs 23:00–07:00 SGT. Events at or after 23:00 local are assigned to the NEXT morning's date.
- **Issue threading**: Issues are grouped by `room:category`. Same room + same type category = same thread across nights.
- **Grounding**: Every output item has a `sources` array of event IDs or `nightlog-DATE:bullet-N` refs. Nothing is stated without a source.
- **Prompt injection**: Descriptions matching `/ignore\s+all|system\s+note\s+to|report.*all\s+clear|add.*credit.*approved/i` are moved to `flagged`, never actioned.
- **Non-English text**: Lines with CJK characters are flagged. Room numbers are extracted; status defaults to `pending` (conservative).

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
