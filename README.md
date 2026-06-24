# Vouch Night-Shift Handover Service

Generates an action-first morning handover report for hotel front desk managers. Ingests structured events and free-text night logs, reconciles issues across multiple nights, and returns a grounded report — every statement traces back to a source event.

## Quick start

```bash
npm install
npm start        # runs on port 3000
npm test         # 44 tests — shiftDate, reconciliation, nightlog parsing, prompt injection
```

## Deployed

```
https://vouch-builder-test-candidate.netlify.app
```

**View in browser (morning manager view):**
```
https://vouch-builder-test-candidate.netlify.app/handover/2026-05-30/view
```

**Sample curl command:**
```bash
curl https://vouch-builder-test-candidate.netlify.app/handover/2026-05-30
```

**POST with custom data:**
```bash
curl -X POST https://vouch-builder-test-candidate.netlify.app/handover \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-05-30",
    "hotel": { "id": "my-hotel", "name": "My Hotel", "timezone": "+08:00" }
  }'
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/handover/:date` | JSON handover for morning date YYYY-MM-DD |
| `GET` | `/handover/:date/view` | HTML view — readable in 60 seconds |
| `POST` | `/handover` | Custom data: `{ date, events?, nightLog?, nightLogDate?, hotel? }` |
| `GET` | `/` | Health check |

## Output shape

```json
{
  "hotel_name": "Lumen Boutique Hotel",
  "handover_for": "morning of 2026-05-30",
  "summary": { "on_fire": 10, "pending": 2, "fyi": 4, "flagged": 3 },
  "handover": {
    "on_fire": [
      {
        "room": "309",
        "summary": "Deposit SGD 100 never collected — guest checks out today.",
        "verbatim": true,
        "priority": "critical",
        "thread_status": "still_open",
        "open_since": "2026-05-27",
        "nights_open": 3,
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

Every item carries:
- `sources` — exact event IDs or `nightlog-DATE:bullet-N` refs. Nothing stated without a source.
- `verbatim: true` — summary is the staff's exact words, not generated text.
- `nights_open` — days the issue has been open. Items open 3+ nights auto-escalate priority.

## How it works

**1. Ingest** — `events.json` parsed directly. `night-logs.md` split by bullet point with keyword detection for status, type, and room number. Timezone read from `hotel.timezone` (e.g. `+08:00`, `+07:00`, `+09:00`) so the 23:00 shift boundary is evaluated in local hotel time, not hardcoded SGT.

**2. Reconcile** — Issues grouped into threads by `room:category`. Each thread classified as `still_open` (carried over), `newly_resolved` (closed tonight), or `new_tonight`. Items open 3+ nights escalate in priority automatically.

**3. Prioritise** — compliance/finance unresolved → `critical`; maintenance/facilities/incident unresolved → `high`; pending 3+ nights → `high`; else `medium`/`low`.

**4. Flag** — Prompt injection attempts detected via regex, moved to `flagged` with `detection_trigger` field, never actioned. Non-English (CJK) entries flagged for manual review, original text preserved, status defaults to `pending`.

## No LLM, no API key needed

Runs entirely on Node.js. Grounding is structural — output can only say what the input says. See `DECISIONS.md` for full reasoning.

## Structured logs

Every request emits JSON with `hotel`, `night`, `step` fields:

```json
{"hotel":"lumen-sg","night":"2026-05-30","step":"ingest","events":26,"nightlogBullets":7}
```

## Tests

```bash
npm test   # node --test, no extra dependencies
```

44 tests across three files:
- `tests/shiftDate.test.js` — timezone-aware shift boundary (SGT, Bangkok, Tokyo, Dubai)
- `tests/reconcile.test.js` — thread status, priority, prompt injection, sources, escalation
- `tests/nightlog.test.js` — room extraction, status detection, Chinese text, type detection
