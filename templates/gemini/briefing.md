## Knowledge Graph (long-term memory)

This project uses Multi-knowledgeGraph as persistent memory. Available MCP tools via Gemini CLI (tool prefix per `mcpServers` key — typically `knowledge-graph__<tool>`):

- `search_memory` — hybrid search (vector + keyword + graph) ★ use BEFORE substantial actions
- `get_knowledge(ids)` — fetch full details after a compact search
- `store_knowledge` — record principles (with `quote`), patterns, or inferences
- `connect_knowledge` — add causal edges
- `traverse_graph`, `record_experience`, `recall_experience`, `maintain_graph`, `memory_stats`

Gemini CLI doesn't have Claude Code's hook system, so auto-recall doesn't apply. Call `search_memory` explicitly at the start of substantial tasks.

**Anti-fabrication**: `principle` trust requires verbatim user `quote`; `inference` cannot create `must_precede` / `reason_for` edges.
