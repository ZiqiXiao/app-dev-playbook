// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defaults } from '../src/options.js';
import { plan } from '../src/assemble.js';
import { install } from '../src/install.js';

const BIN = new URL('../bin/app-dev-playbook.js', import.meta.url).pathname;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-'));
/** @param {ReturnType<typeof plan>} files @param {string} t */
const get = (files, t) => files.find((f) => f.target === t);

/** Options combinations that must all render cleanly. */
const COMBOS = [
  defaults('my-app'),
  { ...defaults('my-app'), mobile: [], design: false, secrets: ['env'] },
  { ...defaults('my-app'), mobile: ['ios'], web: true, secrets: ['infisical'] },
  { ...defaults('my-app'), mobile: ['android'], design: true },
];

for (const [i, options] of COMBOS.entries()) {
  test(`combo ${i}: no leftover markers, project placeholders or dead links`, () => {
    const files = plan(options);
    const targets = new Set(files.map((f) => f.target));
    for (const f of files) {
      if (f.target.includes('/skills/')) continue;
      assert.doesNotMatch(f.content, /<!-- (if:|endif)|\s# if:/, `${f.target} has a marker`);
      assert.doesNotMatch(f.content, /<(项目名|Project|project|PROJECT)>/, `${f.target} has a placeholder`);
      if (!f.target.endsWith('.md')) continue;
      for (const [, href] of f.content.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('<')) continue;
        const t = path.posix.normalize(path.posix.join(path.posix.dirname(f.target), href.split('#')[0]));
        assert.ok(targets.has(t), `${f.target} links to missing ${href}`);
      }
    }
  });
}

test('feature selection controls documents and AGENTS rows', () => {
  const none = plan({ ...defaults('x'), mobile: [], design: false, secrets: ['env'] });
  const agents = get(none, 'AGENTS.md')?.content ?? '';
  assert.equal(get(none, 'docs/engineering/emulators.md'), undefined);
  assert.equal(get(none, 'docs/engineering/design/principles.md'), undefined);
  assert.doesNotMatch(agents, /模拟器|设计系统|Infisical/);
  assert.doesNotMatch(get(none, '.gitignore')?.content ?? '', /infisical|design\//);

  const full = plan(defaults('x'));
  assert.ok(get(full, 'docs/engineering/design/layout-spacing.md'));
  assert.match(get(full, 'AGENTS.md')?.content ?? '', /XAgent|X_Agent_/);
  assert.ok(get(full, '.agents/skills/xspec/SKILL.md'));
  assert.ok(get(full, '.claude/skills/xspec/references/templates/plan.md'));
  assert.match(get(full, 'docs/engineering/emulators.md')?.content ?? '', /Android 渲染参数/);

  const ios = plan({ ...defaults('x'), mobile: ['ios'] });
  assert.doesNotMatch(get(ios, 'docs/engineering/emulators.md')?.content ?? '', /Android 渲染参数/);
});

test('install skips existing files, appends .gitignore once, and backs up with --force', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'mine\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/');
  const files = plan(defaults('demo'), { targetDir: dir });
  const now = new Date('2026-01-02T03:04:05Z');

  let r = install(files, { targetDir: dir, now });
  assert.equal(r.find((x) => x.target === 'AGENTS.md')?.action, 'skipped');
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'mine\n');
  assert.equal(r.find((x) => x.target === '.gitignore')?.action, 'appended');
  const ignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  assert.ok(ignore.startsWith('node_modules/\n\n# >>> app-dev-playbook'));

  r = install(files, { targetDir: dir, now });
  assert.ok(r.filter((x) => x.target !== 'AGENTS.md' && x.target !== '.gitignore').every((x) => x.action === 'unchanged'));
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), ignore);

  r = install(files, { targetDir: dir, now, force: true });
  assert.equal(r.find((x) => x.target === 'AGENTS.md')?.backup, 'AGENTS.md.bak-20260102T030405');
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md.bak-20260102T030405'), 'utf8'), 'mine\n');
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), ignore);
});

test('CLI non-interactive run with flags', () => {
  const dir = tmp();
  const out = execFileSync('node', [BIN, 'init', dir, '--yes', '--name', 'ShopKit', '--mobile', 'ios', '--no-design', '--secrets', 'env'], { encoding: 'utf8' });
  assert.match(out, /新建\s+AGENTS\.md/);
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /^# ShopKit 开发约定/);
  assert.match(agents, /SHOP_KIT_ENV/);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, '.playbook.json'), 'utf8'));
  assert.deepEqual(meta.options.mobile, ['ios']);
  assert.equal(meta.options.design, false);
  assert.throws(() => execFileSync('node', [BIN, 'init', dir, '--yes', '--cloud', 'aws'], { stdio: 'pipe' }));
});

test('CLI dry run writes nothing', () => {
  const dir = tmp();
  execFileSync('node', [BIN, 'init', dir, '--yes', '--dry-run'], { encoding: 'utf8' });
  assert.deepEqual(fs.readdirSync(dir), []);
});
