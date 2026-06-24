# Vouch Night-Shift Handover Service

Generates an action-first morning handover report for hotel front desk managers. Ingests structured events and free-text night logs, reconciles issues across multiple nights, and returns a grounded report — every statement traces back to a source event.

## Quick start

```bash
npm install
npm start        # runs on port 3000
```

## Endpoints

### View in browser (human-readable)
```
GET /handover/:date/view
```
```bash
curl http://localhost:3000/handover/2026-05-30/view
# open in browser for formatted HTML
```

### Get JSON (machine-readable)
```
GET /handover/:date
```
```bash
curl http://localhost:3000/handover/2026-05-30
```

### POST with custom data (generalizable to any hotel)
```
POST /handover
```
```bash
curl -X POST http://localhost:3000/handover \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-05-30",
    "events": { ...events.json shape... },
    "nightLog": "free text log...",
    "nightLogDate": "2026-05-28",
    "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel", "timezone": "+08:00" }
  }'
```

## Output shape

```json
{
  "hotel": "lumen-sg",
  "handover_for": "morning of 2026-05-30",
  "summary": { "on_fire": 8, "pending": 4, "fyi": 4, "flagged": 3 },
  "handover": {
    "on_fire": [
      {
        "room": "309",
        "summary": "Deposit SGD 100 never collected — guest checks out today.",
        "priority": "critical",
        "thread_status": "still_open",
        "open_since": "2026-05-27",
        "sources": ["evt_0007", "nightlog-2026-05-28:bullet-5", "evt_0014"]
      }
    ],
    "pending": [...],
    "fyi": [...],
    "newly_resolved": [...],
    "flagged": [...]
  }
}
```

Every item has a `sources` array pointing to exact event IDs or `nightlog-DATE:bullet-N` references — nothing is stated without a source.

## How it works

1. **Ingest** — `events.json` is parsed directly; `night-logs.md` is parsed by bullet point with keyword detection for status and type. Non-English entries (Mandarin in the sample data) are flagged with the original text preserved.

2. **Reconcile** — Issues are grouped into threads by `room:category`. Each thread is classified as `still_open` (carried over), `newly_resolved` (closed tonight), or `new_tonight`.

3. **Prioritise** — compliance and finance issues that are unresolved → `critical`; maintenance, facilities, incidents → `high`; everything else by status.

4. **Flag** — Prompt injection attempts in event descriptions are detected and moved to `flagged`, never actioned. Non-English entries are also flagged for manual review.

## No LLM, no API key needed

The service runs entirely on Node.js with no external API calls. Grounding is structural — the output can only say what the input data says. See `DECISIONS.md` for the full reasoning.

## Structured logs

Every request logs `hotel`, `night`, and `step` fields in JSON for easy debugging:

```json
{"hotel":"lumen-sg","night":"2026-05-30","step":"ingest","events":26,"nightlogBullets":7}
```
