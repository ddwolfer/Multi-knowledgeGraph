## Knowledge Graph (long-term memory)

This project uses Multi-knowledgeGraph as persistent memory. Available MCP tools through Codex (the exact tool prefix depends on how the server is registered — typically `knowledge-graph__<tool>`):

- `search_memory` — hybrid search (vector + keyword + graph) ★ use BEFORE substantial actions
- `get_knowledge(ids)` — fetch full details after a compact search
- `store_knowledge` — record principles (with `quote`), patterns, or inferences
- `connect_knowledge` — add causal edges (`must_precede`, `causes`, `requires_reading`...)
- `traverse_graph` — follow edges
- `record_experience` / `recall_experience` — workflow episodes
- `maintain_graph`, `memory_stats` — housekeeping

Codex CLI doesn't have Claude Code's hook system, so auto-recall and search-enforcer don't apply. Call `search_memory` explicitly at the start of substantial tasks.

**Anti-fabrication**: `principle` trust requires verbatim user `quote`; `inference` cannot create `must_precede` / `reason_for` edges.

Note: this project lives under `.codex/config.toml` (project-level MCP). You must trust this directory once via `codex auth trust .` (or your equivalent) before Codex will load the server.
