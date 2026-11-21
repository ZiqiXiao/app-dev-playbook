// @ts-check
/**
 * Builds the list of files to write into a target project from the selected options.
 * Pure apart from reading the bundled content directory; writing happens in install.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyConditions, applyPlaceholders, evaluate, pruneLinks } from './render.js';
import { features, toPascal, toSlug } from './options.js';

export const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));
export const DOCS_DIR = 'docs/engineering';

/**
 * Documents copied from content/engineering to docs/engineering.
 * `when` is a marker condition; omitted means always.
 * @type {{src: string, when?: string}[]}
 */
export const DOCS = [
  { src: 'agents-md-guide.md' },
  { src: 'git-branching.md' },
  { src: 'worktrees.md' },
  { src: 'verify-and-merge.md' },
  { src: 'testing.md' },
  { src: 'technical-writing.md' },
  { src: 'scripts.md' },
  { src: 'env-config.md' },
  { src: 'python.md' },
  { src: 'emulators.md', when: 'mobile' },
  { src: 'release.md', when: 'release-please' },
  { src: 'design/principles.md', when: 'design' },
  { src: 'design/ui-flows.md', when: 'design' },
  { src: 'design/layout-spacing.md', when: 'design+mobile' },
  { src: 'aliyun/README.md', when: 'aliyun' },
  { src: 'aliyun/remote-dev-ecs.md', when: 'aliyun' },
  { src: 'aliyun/prod-release.md', when: 'aliyun' },
  { src: 'aliyun/supabase.md', when: 'aliyun+supabase' },
  { src: 'templates/README.md' },
  { src: 'templates/claude-settings.json' },
  { src: 'templates/codex-hooks.json' },
  { src: 'templates/pre-commit-config.yaml' },
  { src: 'templates/remote-dev.example.json', when: 'aliyun' },
];

/** Skill directories installed for both Codex (.agents) and Claude Code (.claude). */
export const SKILLS = ['xspec'];
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills'];

/**
 * @typedef {object} PlannedFile
 * @property {string} target   path relative to the project root (POSIX)
 * @property {string} content
 * @property {'create' | 'append'} mode  `append` adds a marked block to an existing file
 */

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files.sort();
}

/**
 * @param {import('./options.js').Options} options
 * @param {{targetDir?: string, version?: string}} [ctx]
 * @returns {PlannedFile[]}
 */
export function plan(options, ctx = {}) {
  const feats = features(options);
  const names = {
    name: options.name,
    pascal: toPascal(options.name) || options.name,
    slug: toSlug(options.name),
    prefix: options.prefix,
  };
  /** @param {string} rel */
  const read = (rel) => fs.readFileSync(path.join(CONTENT_DIR, rel), 'utf8');
  /** @param {string} text */
  const render = (text) => applyPlaceholders(applyConditions(text, feats), names);

  /** @type {PlannedFile[]} */
  const files = [];
  files.push({ target: 'AGENTS.md', content: render(read('AGENTS.template.md')).replace(/^<!--[\s\S]*?-->\n/, ''), mode: 'create' });
  files.push({ target: 'CLAUDE.md', content: read('engineering/templates/CLAUDE.md'), mode: 'create' });
  for (const doc of DOCS) {
    if (doc.when && !evaluate(doc.when, feats)) continue;
    files.push({ target: `${DOCS_DIR}/${doc.src}`, content: render(read(`engineering/${doc.src}`)), mode: 'create' });
  }
  files.push({ target: '.worktreeinclude', content: render(read('engineering/templates/worktreeinclude')), mode: 'create' });
  files.push({ target: '.gitignore', content: render(read('engineering/templates/gitignore-snippet')), mode: 'append' });

  for (const skill of SKILLS) {
    const base = path.join(CONTENT_DIR, 'skills', skill);
    for (const full of walk(base)) {
      const rel = path.relative(base, full).split(path.sep).join('/');
      const content = fs.readFileSync(full, 'utf8');
      for (const root of SKILL_ROOTS) files.push({ target: `${root}/${skill}/${rel}`, content, mode: 'create' });
    }
  }

  // Drop links to documents that are neither installed nor already present in the target.
  const planned = new Set(files.map((f) => f.target));
  /** @param {string} t */
  const exists = (t) => planned.has(t) || (ctx.targetDir ? fs.existsSync(path.join(ctx.targetDir, t)) : false);
  for (const f of files) {
    if (f.target.endsWith('.md') && !f.target.includes('/skills/')) f.content = pruneLinks(f.content, f.target, exists);
  }

  files.push({
    target: '.playbook.json',
    content: `${JSON.stringify({ version: ctx.version ?? '0.0.0', options, files: files.map((f) => f.target) }, null, 2)}\n`,
    mode: 'create',
  });
  return files;
}
