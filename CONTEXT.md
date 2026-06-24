# Night-Shift Handover

The domain covering what happens between the end of a hotel night shift and the morning manager's first action. The service ingests shift records, reconstructs the history of open issues across nights, and produces a prioritised action list.

## Language

### Time

**Shift**:
The night period running 23:00–07:00 in a hotel's local timezone, spanning two calendar dates. A shift belongs to the morning it ends on, not the evening it starts.
_Avoid_: Night, overnight period, duty

**Shift Date**:
The calendar date of the morning a shift ends on — the date that identifies which handover an event belongs to. An event logged at 23:30 on May 27 has a shift date of May 28.
_Avoid_: Morning date, handover date, target date

### Input

**Event**:
A single recorded occurrence during a shift, regardless of origin. Structured system events (from `events.json`) and parsed nightlog bullets both become Events after ingest. An Event has a room, a type, a status, and a shift date.
_Avoid_: Log entry, record, item (too generic)

**Night Log**:
Free-text written by relief staff when the system is unavailable. Parsed into Events during ingest. May contain non-Latin script.
_Avoid_: Free-text log, manual log, staff notes

**Shift Date Assignment**:
The process of determining which Shift Date an Event belongs to, based on its timestamp and the hotel's timezone. Events at or after 23:00 local time are assigned to the following morning's Shift Date.
_Avoid_: Date bucketing, time bucketing

### Issue Tracking

**Issue Thread**:
The sequence of Events across multiple nights that relate to the same ongoing problem, identified by the composite key `room:category`. A thread has a status, an age, and a priority.
_Avoid_: Issue, ticket, thread, case

**Thread Status**:
The classification of an Issue Thread relative to the current morning: `still_open` (carried from prior nights with no resolution), `newly_resolved` (resolved during the most recent shift), or `new_tonight` (no prior history).
_Avoid_: Status, state

**Carry-over**:
A `still_open` Issue Thread that received no update during the most recent shift. Appears in the handover with a note indicating how many nights it has been open.
_Avoid_: Stale issue, lingering issue, unactioned item

**nights_open**:
The number of calendar days between an Issue Thread's first open event and the current Shift Date. Drives escalation.
_Avoid_: Age, duration, days open

**Escalation**:
The automatic promotion of an Issue Thread's priority when `nights_open` reaches 3 or more. A `pending` thread becomes `high` priority. Signals carry-over fatigue without hiding the item.
_Avoid_: Auto-escalation, priority bump

### Output

**Handover**:
The action-first morning report produced for a given Shift Date. Organised into sections by urgency. A manager should be able to identify what needs action within 60 seconds.
_Avoid_: Report, summary, briefing

**Priority**:
The urgency classification assigned to each Issue Thread item: `critical`, `high`, `medium`, or `low`. Determined by issue category, resolution status, and nights_open.
_Avoid_: Severity, urgency level

**Act Now**:
The handover section containing `critical` and `high` priority items — things requiring immediate action before the morning shift proceeds. Represented as `on_fire` in the JSON API.
_Avoid_: on_fire (in domain language; acceptable in code/API context)

### Trust and Safety

**Grounding**:
The guarantee that every statement in the Handover traces directly to a specific Event in the input. The service reports what staff wrote; it does not generate, infer, or paraphrase.
_Avoid_: Factual accuracy, truthfulness (grounding is output↔input, not input↔truth)

**Verbatim**:
A flag on each Handover item indicating the summary is the staff's exact words, unmodified. Consumers can use this to render attribution UI or audit trails.
_Avoid_: Original text, raw input

**Source Trail**:
The `sources` array on each Handover item listing the exact Event IDs or nightlog references that contributed to it. Enables a morning manager to verify any statement against its origin.
_Avoid_: References, citations, audit trail

**Prompt Injection**:
An Event whose description contains language attempting to manipulate the Handover output (e.g. "ignore all previous instructions"). Moved to the `flagged` section and never actioned. Original text preserved.
_Avoid_: Injection attack, manipulation attempt

**Non-English Flag**:
An Event containing non-Latin script (CJK and similar). Flagged for manual review; original text preserved unchanged. Status defaults to `pending` — the service never assumes a non-English entry is resolved.
_Avoid_: Foreign language entry, untranslated entry
