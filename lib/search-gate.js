/**
 * The search-enforcer's decision, as a pure function.
 *
 * Kept out of the hook script so it can be tested: the hook itself is stdin,
 * a state file, and stdout, and none of that is where the bugs were.
 */

import { isKgRead, isKgSearch, isKgWrite } from './tool-names.js';

// Host tools that only look. Bash is here because blocking it would stop the
// agent reading anything through a shell -- which also means this gate is a
// nudge and not a boundary, since Bash can write too. It is meant to remind,
// not to contain.
export const BUILTIN_READ_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'Bash',
  'Agent', 'Task',  // same tool, two names across Claude Code versions
]);

// Blocks before giving up. Without this the agent can deadlock: some hosts
// surface a denial in a way it cannot act on, and it retries forever.
export const MAX_BLOCKS = 3;

export function blankSession() {
  return { searched: false, blockCount: 0 };
}

/**
 * @param {string} toolName  as the host reports it, e.g. `mcp__kg-game__store_knowledge`
 * @param {{searched: boolean, blockCount: number}} session
 * @returns {{allow: boolean, session: object, reason?: string}}
 */
export function gate(toolName, session = blankSession()) {
  const next = { ...blankSession(), ...session };

  if (isKgSearch(toolName)) {
    return { allow: true, session: { searched: true, blockCount: 0 } };
  }
  if (isKgRead(toolName) || isKgWrite(toolName) || BUILTIN_READ_TOOLS.has(toolName)) {
    return { allow: true, session: next };
  }
  if (next.searched) {
    return { allow: true, session: next };
  }

  const blockCount = next.blockCount + 1;
  if (blockCount > MAX_BLOCKS) {
    // Give up rather than deadlock, and stay out of the way for the rest of
    // the session -- a reminder that fires on every write is not a reminder.
    return { allow: true, session: { searched: true, blockCount: 0 } };
  }
  return {
    allow: false,
    session: { searched: false, blockCount },
    reason:
      `[Search Enforcer] 請先用 search_memory 查詢相關知識再操作。` +
      `（${blockCount}/${MAX_BLOCKS} 次擋住，第 ${MAX_BLOCKS + 1} 次自動放行）`,
  };
}
