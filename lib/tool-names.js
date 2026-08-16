/**
 * Recognising this engine's tools by name, whatever server they arrived on.
 *
 * MCP tool names carry the server name: `mcp__<server>__<tool>`. That server
 * name is chosen at registration time, and a project can mount this same
 * engine twice under two names -- godogen mounts `kg-craft` for the
 * cross-project corpus and `kg-game` for the current game. So anything that
 * matches on the server half only works on the machine it was written for.
 *
 * Match on the tool half instead. Those nine names are fixed by main.js and
 * are the same on every server a caller might mount.
 */

/** `mcp__kg-craft__search_memory` -> `search_memory`; `Read` -> `Read`. */
export function bareToolName(toolName) {
  if (typeof toolName !== 'string') return '';
  const parts = toolName.split('__');
  if (parts[0] === 'mcp' && parts.length >= 3) return parts.slice(2).join('__');
  return toolName;
}

// Calling one of these proves the graph was consulted. get_knowledge is not
// here on purpose: it fetches details for ids you already have, so it cannot
// be the call that discovered them.
export const KG_SEARCH_TOOLS = new Set([
  'search_memory',
  'traverse_graph',
  'recall_experience',
]);

// Every read. get_knowledge belongs here -- it was in neither list before,
// which quietly made reading a node count as a write.
export const KG_READ_TOOLS = new Set([
  ...KG_SEARCH_TOOLS,
  'get_knowledge',
  'memory_stats',
]);

// Writes to the graph itself. Always allowed: recording what you learned is
// the behaviour the enforcer exists to encourage.
export const KG_WRITE_TOOLS = new Set([
  'store_knowledge',
  'connect_knowledge',
  'record_experience',
  'maintain_graph',
]);

export function isKgSearch(toolName) {
  return KG_SEARCH_TOOLS.has(bareToolName(toolName));
}

export function isKgRead(toolName) {
  return KG_READ_TOOLS.has(bareToolName(toolName));
}

export function isKgWrite(toolName) {
  return KG_WRITE_TOOLS.has(bareToolName(toolName));
}
