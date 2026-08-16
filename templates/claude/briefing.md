## Knowledge Graph (long-term memory)

This project uses Multi-knowledgeGraph as persistent memory across sessions. Tools arrive as `mcp__<server>__<tool>`, where `<server>` is whatever this project registered it under — and there may be more than one, e.g. `kg-craft` for a corpus shared across projects alongside `kg-game` for this repo. Check the tool list you were given rather than assuming a name. The tool halves:

- `search_memory` — hybrid search (vector + keyword + graph) ★ use BEFORE substantial actions
- `get_knowledge(ids)` — fetch full details after a compact `search_memory`
- `store_knowledge` — record principles (with `quote`), patterns, or inferences
- `connect_knowledge` — add causal edges (`must_precede`, `causes`, `requires_reading`...)
- `traverse_graph` — follow edges from a node
- `record_experience` / `recall_experience` — workflow episodes (success/failure/lesson)
- `maintain_graph` — prune / merge / validate / find orphans
- `memory_stats` — snapshot

Hooks auto-recall relevant knowledge on every user message and detect corrections.

**Nothing forces you to search.** The search-enforcer hook is off unless both the hook is wired and `~/.claude/hooks/.kg-enforcer-active` exists, and even then it gives up after three blocks. Not being stopped is not evidence that you checked.

**Anti-fabrication rules**:
- `principle` trust requires `quote` (verbatim user words)
- `inference` nodes cannot create `must_precede` / `reason_for` edges
- `fundamental` category never decays; `creative` category is challengeable
