import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { tokenize, ftsQuery, MIN_CJK_TERM } from '../lib/tokenize.js';

test('english still splits on whitespace', () => {
  assert.deepEqual(tokenize('windows godot hangs'), ['windows', 'godot', 'hangs']);
});

test('single characters are dropped', () => {
  assert.deepEqual(tokenize('a bb c'), ['bb']);
});

test('a chinese sentence becomes overlapping shingles, not one term', () => {
  // The bug: whitespace splitting made this a single term, so the query only
  // matched if the user's exact sentence appeared verbatim in a document.
  const terms = tokenize('地形成本');
  assert.deepEqual(terms, ['地形成', '形成本']);
});

test('shingles are three characters, because trigram cannot match two', () => {
  for (const term of tokenize('測試綠燈只證明斷言成立')) {
    assert.equal(term.length, MIN_CJK_TERM);
  }
});

test('a chinese run shorter than a trigram yields nothing', () => {
  assert.deepEqual(tokenize('綠燈'), []);
});

test('latin embedded in a chinese sentence survives as its own term', () => {
  assert.ok(tokenize('我在 Windows 上跑 Godot').includes('Windows'));
  assert.ok(tokenize('我在Windows上跑Godot').includes('Windows'));
});

test('duplicate shingles appear once', () => {
  const terms = tokenize('地形地形地形');
  assert.equal(new Set(terms).size, terms.length);
});

test('term count is capped', () => {
  assert.ok(tokenize('一二三四五六七八九十一二三四五六七八九十').length <= 12);
});

test('empty and nullish input are safe', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize(undefined), []);
});

test('ftsQuery ORs quoted terms', () => {
  assert.equal(ftsQuery('地形成本'), '"地形成" OR "形成本"');
});

test('ftsQuery is empty when there is nothing to match', () => {
  assert.equal(ftsQuery('a'), '');
});

test('quotes inside a term are escaped, not injected', () => {
  assert.equal(ftsQuery('sa"id'), '"sa""id"');
});

// --- the behaviour that actually matters -----------------------------------

function corpus() {
  const db = new Database(':memory:');
  db.exec(`CREATE VIRTUAL TABLE fts USING fts5(body, tokenize='trigram')`);
  db.prepare('INSERT INTO fts VALUES (?)').run(
    '測試綠燈只證明斷言成立,不證明你以為在測的東西真的被測到'
  );
  db.prepare('INSERT INTO fts VALUES (?)').run(
    'Blender 是 Z-up,腳底放 z=0,正面朝 -Y,轉出 glTF 之後正面會變成 +Z'
  );
  return db;
}

function hits(db, text) {
  const q = ftsQuery(text);
  if (!q) return 0;
  return db.prepare('SELECT count(*) c FROM fts WHERE fts MATCH ?').get(q).c;
}

test('a chinese question finds the document it is about', () => {
  const db = corpus();
  assert.ok(hits(db, '測試綠燈可以相信嗎') > 0);
  db.close();
});

test('an unrelated chinese question does not', () => {
  const db = corpus();
  assert.equal(hits(db, '音效要怎麼調整音量大小'), 0);
  db.close();
});

test('the whole-sentence query that used to be built matches nothing', () => {
  // What the old tokenizer produced. Kept as a regression: this is the exact
  // shape that made Chinese recall return zero.
  const db = corpus();
  const old = '"我想知道測試綠燈可以相信嗎"';
  assert.equal(db.prepare('SELECT count(*) c FROM fts WHERE fts MATCH ?').get(old).c, 0);
  db.close();
});
