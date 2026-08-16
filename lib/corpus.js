/**
 * What counts as an entry when importing a corpus directory.
 *
 * Lives here rather than in scripts/import-skills.js because that file parses
 * argv and runs main() on import -- there is no way to ask it a question
 * without running it.
 */

import { extname } from 'path';

/**
 * A README describes the directory it sits in: how to write entries, what the
 * categories mean, which frontmatter is required. Importing it makes the style
 * guide compete with the entries in every search, and it wins often, because
 * it is the one document that mentions all of their vocabulary.
 *
 * @param {string} filename  a bare filename, not a path
 */
export function isCorpusEntry(filename) {
  return extname(filename) === '.md' && filename.toLowerCase() !== 'readme.md';
}
