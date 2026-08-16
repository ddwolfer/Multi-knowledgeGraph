import test from 'node:test';
import assert from 'node:assert/strict';

import { isCorpusEntry } from '../lib/corpus.js';

test('markdown entries are imported', () => {
  assert.ok(isCorpusEntry('deterministic-tick-sim.md'));
  assert.ok(isCorpusEntry('windows-toolchain.md'));
});

test('a README is not an entry', () => {
  // It describes how to write the entries, so it mentions all of their
  // vocabulary and outranks them on searches about any of it.
  assert.ok(!isCorpusEntry('README.md'));
  assert.ok(!isCorpusEntry('readme.md'));
  assert.ok(!isCorpusEntry('Readme.md'));
});

test('a file that merely starts with readme is still an entry', () => {
  assert.ok(isCorpusEntry('readme-driven-development.md'));
});

test('non-markdown is not an entry', () => {
  assert.ok(!isCorpusEntry('notes.txt'));
  assert.ok(!isCorpusEntry('diagram.png'));
});
