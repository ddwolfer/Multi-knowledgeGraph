/**
 * Turn a prompt into FTS5 terms.
 *
 * Two things were broken here, and the first one hid the second.
 *
 * Splitting on whitespace is fine for English and useless for Chinese, which
 * has none: the whole prompt became one term, so a query only matched when
 * the user's exact sentence appeared verbatim. Measured before this existed,
 * 「我加了一個技能但玩家說完全沒感覺」 recalled nothing, while the same question
 * written with spaces recalled four entries.
 *
 * Fixing only that is not enough. The index used the unicode61 tokenizer,
 * which treats an unbroken CJK run as a single token -- a document holding
 * 「測試綠燈只證明斷言成立」 does not match 「測試綠燈」. fts_nodes is now built
 * with tokenize='trigram', which indexes every 3-character substring.
 *
 * So CJK runs are emitted as overlapping 3-character shingles. Two characters
 * will not match a trigram index; three is the floor.
 */

// CJK ideographs, extension A, compatibility, and kana -- scripts that do not
// separate words with spaces.
const CJK_CLASS = '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';
const CJK = new RegExp(`[${CJK_CLASS}]`);
const CJK_RUN = new RegExp(`[${CJK_CLASS}]+`, 'g');

/** trigram indexes 3-character substrings; anything shorter cannot match. */
export const MIN_CJK_TERM = 3;
export const MAX_TERMS = 12;

export function tokenize(text, maxTerms = MAX_TERMS) {
  const terms = [];

  for (const chunk of String(text ?? '').split(/\s+/)) {
    if (!chunk) continue;

    if (!CJK.test(chunk)) {
      if (chunk.length >= 2) terms.push(chunk);
      continue;
    }

    // Latin embedded in a CJK sentence ("Windows 的坑") is still a good term.
    for (const latin of chunk.split(CJK_RUN)) {
      if (latin.length >= 2) terms.push(latin);
    }

    for (const run of chunk.match(CJK_RUN) || []) {
      if (run.length < MIN_CJK_TERM) continue;
      for (let i = 0; i + MIN_CJK_TERM <= run.length; i++) {
        terms.push(run.slice(i, i + MIN_CJK_TERM));
      }
    }
  }

  return [...new Set(terms)].slice(0, maxTerms);
}

/** Quote each term and OR them into an FTS5 MATCH expression. */
export function ftsQuery(text, maxTerms = MAX_TERMS) {
  return tokenize(text, maxTerms)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(' OR ');
}
