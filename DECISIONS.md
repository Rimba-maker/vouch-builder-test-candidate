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
- Authentication — deliberately not added at the service level. This service is designed as an internal microservice: the caller (Vouch backend) fetches hotel-specific data from the database, then calls this service. Authentication and tenant isolation belong at the API gateway layer, not inside the transformation service. Adding a toy `X-API-Key` header check would create false confidence without solving the actual isolation problem.
- Multi-file night log ingestion — current parser handles one log file per shift date
- Full NLP for non-English text — see "Grounding" section below

## How reconciliation across nights works

Each event gets a `shiftDate` (the morning date it belongs to). Events at/after 23:00 **local hotel time** belong to the next calendar day's morning.

Timezone is read from `hotel.timezone` in the events payload (e.g. `"+08:00"` for Singapore, `"+07:00"` for Bangkok, `"+09:00"` for Tokyo). The offset is parsed to hours and applied before the 23:00 boundary check, so the same UTC timestamp produces different shift dates for hotels in different timezones. A Bangkok hotel and a Tokyo hotel receiving the same event at 2026-05-27T15:30Z would assign it to different mornings (22:30 Bangkok → same day; 00:30 Tokyo → next morning). Default falls back to `+08:00` if the field is missing.

Issues are grouped into threads by `room:category` key (e.g. `309:finance`, `hotel:compliance`). For each thread, the reconciler:

1. Looks at all previous-shift events in the thread
2. If the current shift has an event and there was a previous open event → `still_open`
3. If the current shift resolves a previously open thread → `newly_resolved`
4. If there's no prior open thread → `new_tonight`
5. If a thread has a previous open event but NO current-shift event → carry-over `still_open`

**Escalation:** Every output item carries a `nights_open` count (difference between `open_since` and `targetDate`). Carry-over items that have been open 3+ nights automatically escalate in priority (pending → high) and their note changes from "No update tonight" to "No update tonight — open N nights, escalated". The HTML view renders these with a red ⚠️ badge so the morning manager cannot miss a stale issue.

**Known limitation:** Issues with `room=null` (hotel-wide issues) share a category key (e.g. `hotel:complaint`). A WiFi complaint from Night 3 and a breakfast complaint from Night 4 share the key `hotel:complaint`, so they appear in the same thread. In production, thread identity would use a unique issue ID, not just room+category. Filed as GitHub issue #1.

## How grounding works and how I handled incomplete/contradictory input

**Grounding:** The service never generates text — it only reports what's in the source data. Every item in the handover has a `sources` array with exact event IDs (e.g. `evt_0007`) or nightlog refs (e.g. `nightlog-2026-05-28:bullet-5`). A reviewer can trace any statement back to its origin.

The grounding guarantee is: *output ↔ input*, not *input ↔ truth*. If a staff member logs "deposit settled" when it wasn't, the service faithfully reports that — and the `sources` array lets the morning manager verify against the original entry. This is intentionally different from an LLM summariser, which can invent facts with no traceable source. The responsibility for input accuracy sits with the staff, not the service.

To make this explicit in the output: every handover item carries `verbatim: true`, signalling to any consumer that the `summary` field is the staff's own words, not generated text. A frontend can use this to render a "verbatim" badge or tooltip.

**Incomplete input:**
- Events with `status: "unknown"` (from non-English nightlog lines) default to `pending` — the conservative choice. We don't assume something is resolved if we can't read it.
- Non-English entries are moved to the `flagged` section with the original text preserved for manual review.

**Contradictory input:**
- Room 312 no-show: nightlog (Night 3) says charge was settled, but `evt_0012` (Night 4) says guest disputes the charge. Both events appear in the thread sources. The output shows the most recent status (`pending`, from evt_0012), and the full source chain lets the manager see the contradiction.
- Room 205: `evt_0024` says guest is in-house; nightlog (Night 3) says room appears unoccupied. Both appear in sources for the incident thread. Flagged as a data inconsistency.

**Prompt injection:** `evt_0026` contains a guest-written note attempting to manipulate the handover output. Detected via regex on the description field, moved to `flagged`, never actioned. The original text is preserved so the morning manager can see and report it.

The regex was expanded beyond the sample data to cover rephrasing variants: `disregard the previous`, `override the earlier`, `new instructions`, `reset all`, `mark rooms as clear`, and others. Each flagged item also includes a `detection_trigger` field showing exactly which phrase triggered the flag, so a reviewer can audit false positives.

The real defence is structural: the service never executes instructions, it only classifies and reports. Even if an injection bypasses the regex, the worst outcome is a corrupted line in the report (visible to the manager) — not a silently actioned instruction. In production, the regex would be replaced or augmented with a dedicated classifier. Filed as a known limitation in GitHub issues (#2).

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

## Domain glossary

| Term | Definition |
|------|-----------|
| **Shift** | A night period running 23:00–07:00 local hotel time, spanning two calendar dates |
| **Shift date** / **Morning date** | The calendar date of the morning when the shift ends — the date a morning manager reads the handover |
| **Issue thread** | A sequence of events grouped by `room:category` representing the same ongoing problem across multiple nights |
| **Still open** | A thread with prior unresolved events; the issue persists into this morning |
| **Newly resolved** | A thread that was open in prior nights and received a resolved event during the most recent shift |
| **New tonight** | An issue with no prior history; appeared for the first time on the most recent shift |
| **Carry-over** | A previously open thread with no update on the most recent shift — implicitly still open |
| **nights_open** | The count of calendar days between `open_since` and the target morning date; drives escalation logic |
| **Escalation** | Automatic priority increase when `nights_open >= 3`; pending → high |
| **Grounding** | Every output statement traces to a specific source event ID or nightlog reference |
| **Verbatim** | The `summary` field contains the exact staff-written text, not generated or paraphrased content |
| **Prompt injection** | An entry (typically guest-authored) attempting to manipulate the handover output |
| **Non-English flag** | An entry containing CJK or other non-Latin characters, flagged for manual review with original text preserved |
| **Source trail** | The `sources` array on each output item listing all event IDs or nightlog refs that contributed to it |

## One thing that surprised me

The prompt injection in `evt_0026` was embedded inside a staff-logged note ("Guest handed in a typed note, logged verbatim as received: ...") — not a raw injection attempt. The staff member correctly filed it as an item for the morning team. This means the injection risk in production isn't just from compromised input pipelines; it comes from legitimate staff faithfully transcribing what guests hand them. The detection needs to run on the content of what's logged, not just on who logged it.
