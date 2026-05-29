## Knowledge Graph (long-term memory)

This project uses Multi-knowledgeGraph as persistent memory across sessions. Available MCP tools (prefix `mcp__knowledge-graph__`, or whatever name you registered it as):

- `search_memory` — hybrid search (vector + keyword + graph) ★ use BEFORE substantial actions
- `get_knowledge(ids)` — fetch full details after a compact `search_memory`
- `store_knowledge` — record principles (with `quote`), patterns, or inferences
- `connect_knowledge` — add causal edges (`must_precede`, `causes`, `requires_reading`...)
- `traverse_graph` — follow edges from a node
- `record_experience` / `recall_experience` — workflow episodes (success/failure/lesson)
- `maintain_graph` — prune / merge / validate / find orphans
- `memory_stats` — snapshot

Hooks auto-recall relevant knowledge on every user message and detect corrections. The search-enforcer hook may block write tools until you've called `search_memory` in the session.

**Anti-fabrication rules**:
- `principle` trust requires `quote` (verbatim user words)
- `inference` nodes cannot create `must_precede` / `reason_for` edges
- `fundamental` category never decays; `creative` category is challengeable
