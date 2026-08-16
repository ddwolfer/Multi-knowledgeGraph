#!/usr/bin/env node

/**
 * Search Enforcer hook (PreToolUse)
 * Blocks write operations until search_memory has been called in the current session.
 * Only active when .kg-enforcer-active flag exists.
 *
 * The decision lives in lib/search-gate.js, where it is tested. This file is
 * stdin, a state file and stdout.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

import { gate, blankSession } from '../lib/search-gate.js';

const FLAG_FILE = join(os.homedir(), '.claude', 'hooks', '.kg-enforcer-active');
const STATE_FILE = join(os.homedir(), '.claude', 'hooks', '.search-enforcer-state.json');

// Only active when flag file exists
if (!existsSync(FLAG_FILE)) {
  process.exit(0);
}

// Read stdin
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

let data;
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}

const toolName = data.tool_name || '';
const sessionId = data.session_id || '';

// Load state
let state = { sessions: {} };
try {
  state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
} catch { /* first run or corrupt */ }
if (!state.sessions) state.sessions = {};

const before = state.sessions[sessionId] || blankSession();
const result = gate(toolName, before);

if (result.session.searched !== before.searched ||
    result.session.blockCount !== before.blockCount) {
  state.sessions[sessionId] = result.session;
  saveState(state);
}

if (!result.allow) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    }
  }));
}

process.exit(0);

function saveState(s) {
  try {
    // Clean old sessions (keep last 10)
    const keys = Object.keys(s.sessions);
    if (keys.length > 10) {
      for (const k of keys.slice(0, keys.length - 10)) {
        delete s.sessions[k];
      }
    }
    writeFileSync(STATE_FILE, JSON.stringify(s));
  } catch { /* non-critical */ }
}
