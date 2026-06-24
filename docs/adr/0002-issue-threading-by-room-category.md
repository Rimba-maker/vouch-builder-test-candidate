# Issue threads identified by room:category composite key

Issue Threads are grouped by the composite key `room:category` (e.g. `309:finance`, `hotel:compliance`). This was chosen because the input data — structured events and free-text night logs — contains no stable issue ID. The key is derivable from any event without coordination between shifts or systems.

The known limitation: two distinct problems in the same room with the same category (e.g. two separate finance disputes in room 312 across different nights) collapse into one thread. Likewise, hotel-wide issues of the same category share one thread regardless of whether they are actually related. This is documented in GitHub issue #1.

## Considered options

- **Stable issue IDs assigned at first occurrence**: correct but requires write access to a store that persists across shifts, which is out of scope for a stateless transformation service.
- **room:category composite key (current)**: stateless, derivable from input alone, works for the common case. Thread collision is a known edge case, not a silent failure — it surfaces in the handover rather than disappearing.

## Consequences

If thread collision causes problems in production, the fix is to introduce a persistence layer that assigns stable IDs at first occurrence and references them in subsequent events. The reconciliation logic would remain unchanged; only the key derivation would change.
