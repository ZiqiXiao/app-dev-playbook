// @ts-check
/**
 * Text rendering: conditional markers, placeholders and dead-link pruning.
 *
 * Marker syntax (a condition is a comma-separated OR of terms; a term is a
 * `+`-joined AND of features; a feature prefixed with `!` is negated):
 *   - Block:  a line `<!-- if:COND -->` … a line `<!-- endif -->`
 *   - Line:   a line ending in ` <!-- if:COND -->` or ` # if:COND`
 */
import path from 'node:path';

/**
 * @param {string} cond
 * @param {Set<string>} features
 */
export function evaluate(cond, features) {
  return cond.split(',').some((term) =>
    term.split('+').every((f) => (f.startsWith('!') ? !features.has(f.slice(1)) : features.has(f))),
  );
}

const BLOCK_OPEN = /^\s*<!-- if:(\S+) -->\s*$/;
const BLOCK_CLOSE = /^\s*<!-- endif -->\s*$/;
const LINE_SUFFIX = /\s+(?:<!-- if:(\S+) -->|# if:(\S+))\s*$/;

/**
 * Applies conditional markers and removes the marker text.
 * @param {string} text
 * @param {Set<string>} features
 */
export function applyConditions(text, features) {
  const out = [];
  /** @type {boolean[]} */
  const stack = [];
  for (const line of text.split('\n')) {
    const open = line.match(BLOCK_OPEN);
    if (open) {
      stack.push(evaluate(open[1], features));
      continue;
    }
    if (BLOCK_CLOSE.test(line)) {
      if (!stack.length) throw new Error('unbalanced <!-- endif -->');
      stack.pop();
      continue;
    }
    if (stack.includes(false)) continue;
    const suffix = line.match(LINE_SUFFIX);
    if (suffix) {
      if (evaluate(suffix[1] ?? suffix[2], features)) out.push(line.replace(LINE_SUFFIX, ''));
      continue;
    }
    out.push(line);
  }
  if (stack.length) throw new Error('unclosed <!-- if:… --> block');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {string} text
 * @param {{name: string, slug: string, pascal: string, prefix: string}} names
 */
export function applyPlaceholders(text, names) {
  return text
    .replaceAll('<项目名>', names.name)
    .replaceAll('<Project>', names.pascal)
    .replaceAll('<project>', names.slug)
    .replaceAll('<PROJECT>', names.prefix);
}

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/**
 * Replaces relative Markdown links whose target is not available with plain text.
 * @param {string} text
 * @param {string} fromFile path of the document, relative to the project root (POSIX)
 * @param {(target: string) => boolean} exists
 */
export function pruneLinks(text, fromFile, exists) {
  return text.replace(LINK, (whole, label, href) => {
    if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('<')) return whole;
    const file = href.split('#')[0];
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), file));
    return exists(target) ? whole : label;
  });
}
