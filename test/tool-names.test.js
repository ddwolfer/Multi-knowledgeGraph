import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bareToolName, isKgSearch, isKgRead, isKgWrite,
} from '../lib/tool-names.js';
import { gate, blankSession, MAX_BLOCKS } from '../lib/search-gate.js';

test('the server half of an mcp tool name is stripped', () => {
  assert.equal(bareToolName('mcp__knowledge-graph__search_memory'), 'search_memory');
  assert.equal(bareToolName('mcp__kg-craft__search_memory'), 'search_memory');
  assert.equal(bareToolName('mcp__kg-game__store_knowledge'), 'store_knowledge');
});

test('a plain host tool name is left alone', () => {
  assert.equal(bareToolName('Read'), 'Read');
  assert.equal(bareToolName('search_memory'), 'search_memory');
});

test('anything that is not a string is not a tool', () => {
  assert.equal(bareToolName(undefined), '');
  assert.equal(bareToolName(null), '');
});

test('the same engine is recognised under any server name', () => {
  // The bug: these were matched by a hardcoded `mcp__knowledge-graph__`
  // prefix, so a project that mounted the engine as kg-craft got a gate that
  // never saw a single search and blocked everything until it gave up.
  for (const server of ['knowledge-graph', 'kg-craft', 'kg-game', 'memory']) {
    assert.ok(isKgSearch(`mcp__${server}__search_memory`), server);
    assert.ok(isKgWrite(`mcp__${server}__store_knowledge`), server);
  }
});

test('get_knowledge reads', () => {
  // It was in neither list before, so it fell through to "write" and got
  // blocked -- on the one server name that was supposed to work.
  assert.ok(isKgRead('mcp__kg-craft__get_knowledge'));
  assert.ok(!isKgWrite('mcp__kg-craft__get_knowledge'));
});

test('fetching details you already have is not a search', () => {
  assert.ok(!isKgSearch('get_knowledge'));
  assert.ok(!isKgSearch('memory_stats'));
});

test('another server\'s tools are not ours', () => {
  assert.ok(!isKgSearch('mcp__github__search_issues'));
  assert.ok(!isKgWrite('mcp__ace-studio__generate_sfx'));
});

test('a search opens the gate', () => {
  const after = gate('mcp__kg-craft__search_memory', blankSession());
  assert.ok(after.allow);
  assert.ok(after.session.searched);
  assert.ok(gate('Write', after.session).allow);
});

test('a write before any search is blocked, with a reason', () => {
  const first = gate('Write', blankSession());
  assert.ok(!first.allow);
  assert.match(first.reason, /search_memory/);
});

test('storing knowledge is never blocked', () => {
  const after = gate('mcp__kg-game__store_knowledge', blankSession());
  assert.ok(after.allow);
  assert.ok(!after.session.searched, 'writing is not searching');
});

test('it gives up after MAX_BLOCKS rather than deadlock', () => {
  let session = blankSession();
  for (let i = 1; i <= MAX_BLOCKS; i++) {
    const step = gate('Write', session);
    assert.ok(!step.allow, `block ${i}`);
    session = step.session;
  }
  const relented = gate('Write', session);
  assert.ok(relented.allow, 'the next one goes through');
  assert.ok(gate('Edit', relented.session).allow, 'and it stays out of the way');
});

test('a search resets the block count', () => {
  const blocked = gate('Write', blankSession());
  const searched = gate('traverse_graph', blocked.session);
  assert.equal(searched.session.blockCount, 0);
});

test('the gate does not mutate the session it was given', () => {
  const session = blankSession();
  gate('Write', session);
  assert.deepEqual(session, { searched: false, blockCount: 0 });
});
