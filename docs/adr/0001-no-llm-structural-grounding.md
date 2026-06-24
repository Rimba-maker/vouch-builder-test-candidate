# No LLM — grounding enforced structurally

The service runs across hundreds of hotels unattended. An LLM in the pipeline would produce fluent-sounding text that cannot be traced to a specific input line, breaking the grounding guarantee. We chose structural grounding instead: the service only reports what staff wrote, using keyword detection and regex for free-text parsing. Every output statement has an exact source reference. The trade-off is that non-English entries and ambiguous phrasing require manual review rather than best-effort translation — an acceptable cost given that a wrong-but-confident automated summary is worse than a flagged item a human reviews.

## Considered options

- **LLM summarisation**: produces readable output but introduces hallucination risk with no traceable source. Any error is invisible until a manager acts on false information.
- **LLM with citations**: possible, but adds latency, cost, API key dependency, and probabilistic grounding rather than structural grounding.
- **Current approach (structural)**: output is verbatim staff language with exact source IDs. Non-English and ambiguous entries are flagged rather than guessed.
