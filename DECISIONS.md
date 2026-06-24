# DECISIONS.md

## What I built and what I skipped

**Built:**
- Node.js + Express backend with three endpoints: `GET /handover/:date` (JSON), `GET /handover/:date/view` (HTML for morning managers), `POST /handover` (generalized, accepts custom hotel data)
- Ingest layer for both `events.json` and `night-logs.md` into a unified normalized format
- Cross-night reconciliation: classifies each issue as `still_open`, `newly_resolved`, or `new_tonight`
- Action-first output sorted by priority (critical → high → medium → low) — readable in under 60 seconds
- Grounding: every output item includes a `sources` array pointing to exact event IDs or nightlog line refs
- Prompt injection detection and flagging
- Non-English (Mandarin) detection with conservative fallback — flag + manual review, original text preserved
- Winston structured logging with `hotel`, `night`, and `step` fields on every line
- 35 automated tests covering shiftDate logic, reconciliation threads, nightlog parsing, and prompt injection

**Skipped:**
- Database — data is bundled for this test; in production this would be a DB query
- Authentication — not in scope for this test
- Multi-file night log ingestion — current parser handles one log file per shift date
- Full NLP for non-English text — see "Grounding" section below

## How reconciliation across nights works

Each event gets a `shiftDate` (the morning date it belongs to). Events at/after 23:00 SGT belong to the next calendar day's morning.

Issues are grouped into threads by `room:category` key (e.g. `309:finance`, `hotel:compliance`). For each thread, the reconciler:

1. Looks at all previous-shift events in the thread
2. If the current shift has an event and there was a previous open event → `still_open`
3. If the current shift resolves a previously open thread → `newly_resolved`
4. If there's no prior open thread → `new_tonight`
5. If a thread has a previous open event but NO current-shift event → carry-over `still_open`

**Known limitation:** Issues with `room=null` (hotel-wide issues) share a category key (e.g. `hotel:complaint`). A WiFi complaint from Night 3 and a breakfast complaint from Night 4 share the key `hotel:complaint`, so they appear in the same thread. In production, thread identity would use a unique issue ID, not just room+category.

## How grounding works and how I handled incomplete/contradictory input

**Grounding:** The service never generates text — it only reports what's in the source data. Every item in the handover has a `sources` array with exact event IDs (e.g. `evt_0007`) or nightlog refs (e.g. `nightlog-2026-05-28:bullet-5`). A reviewer can trace any statement back to its origin.

**Incomplete input:**
- Events with `status: "unknown"` (from non-English nightlog lines) default to `pending` — the conservative choice. We don't assume something is resolved if we can't read it.
- Non-English entries are moved to the `flagged` section with the original text preserved for manual review.

**Contradictory input:**
- Room 312 no-show: nightlog (Night 3) says charge was settled, but `evt_0012` (Night 4) says guest disputes the charge. Both events appear in the thread sources. The output shows the most recent status (`pending`, from evt_0012), and the full source chain lets the manager see the contradiction.
- Room 205: `evt_0024` says guest is in-house; nightlog (Night 3) says room appears unoccupied. Both appear in sources for the incident thread. Flagged as a data inconsistency.

**Prompt injection:** `evt_0026` contains a guest-written note attempting to manipulate the handover output. Detected via regex on the description field, moved to `flagged`, never actioned. The original text is preserved so the morning manager can see and report it.

**No LLM used.** Every statement traces directly to input data. Grounding is structural, not probabilistic.

## Where AI helped most, and where it got in the way

**Helped most:**
- Planning the reconciliation logic and edge cases (this conversation)
- Catching the prompt injection test case in the data
- Identifying the Chinese-language entries as a real grounding risk

**Got in the way:**
- Early in planning, I initially over-estimated the need for an LLM API for parsing. The actual data was structured enough that regex + keyword detection handles the English portions cleanly.
- The WebFetch tool used to preview the nightlog auto-translated the Chinese text, masking the real challenge until we read the raw file.

## What I'd do in hours 3–6

1. **Proper issue IDs** — replace `room:category` key with stable issue IDs, written at first occurrence and referenced on updates. Eliminates the hotel:complaint collision bug.
2. **Slack view** — a Slack block payload endpoint so the handover arrives in the team channel automatically
3. **LLM for non-English** — add an optional LLM step (configurable via env var) that translates non-Latin nightlog entries before parsing. Every translated field would be marked `translated: true` to keep grounding honest.
4. **Multi-hotel support** — parameterize hotel config; load data from a DB query instead of bundled files
5. **Contradiction detection** — explicit cross-check: if a thread goes unresolved → resolved → unresolved across nights, surface it as a contradiction flag rather than silently using the latest status

## One thing that surprised me

The prompt injection in `evt_0026` was embedded inside a staff-logged note ("Guest handed in a typed note, logged verbatim as received: ...") — not a raw injection attempt. The staff member correctly filed it as an item for the morning team. This means the injection risk in production isn't just from compromised input pipelines; it comes from legitimate staff faithfully transcribing what guests hand them. The detection needs to run on the content of what's logged, not just on who logged it.
