// @ts-check
/** Command-line entry: `init` (interactive or flags) and `list`. */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CHOICES, defaults, parseList, parseOne, toPrefix } from './options.js';
import { DOCS, SKILLS, plan } from './assemble.js';
import { install } from './install.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `app-dev-playbook ${pkg.version}

用法:
  app-dev-playbook init [目录] [选项]   在目标项目中安装开发约定、文档和 skill
  app-dev-playbook list                 列出可选模块和文档
  app-dev-playbook --help | --version

init 选项（不传则交互式询问；加 --yes 时未传的项使用默认值）:
  --name <名称>          项目名，默认取目录名
  --prefix <前缀>        环境变量前缀，默认由项目名生成（如 MY_APP）
  --mobile <列表>        ios,android | none（默认 ios,android）
  --web / --no-web       是否包含 Web 前端（默认否）
  --design / --no-design 是否引入设计规范（默认是）
  --cloud <厂商>         ${CHOICES.cloud.join(' | ')}（默认 aliyun）
  --db <数据库>          ${CHOICES.db.join(' | ')}（默认 supabase）
  --release <方式>       ${CHOICES.release.join(' | ')}（默认 release-please）
  --secrets <列表>       infisical,env 中的一项或两项（默认两项）
  -y, --yes              不询问，未指定的项用默认值
  --force                覆盖已存在的文件（先备份为 *.bak-<时间>）
  --dry-run              只显示将写入的文件
`;

/** @param {string[]} argv */
export async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      prefix: { type: 'string' },
      mobile: { type: 'string' },
      web: { type: 'boolean' },
      'no-web': { type: 'boolean' },
      design: { type: 'boolean' },
      'no-design': { type: 'boolean' },
      cloud: { type: 'string' },
      db: { type: 'string' },
      release: { type: 'string' },
      secrets: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  if (values.version) return void console.log(pkg.version);
  const [command, dirArg] = positionals;
  if (values.help || !command) return void console.log(HELP);
  if (command === 'list') return void list();
  if (command !== 'init') throw new Error(`unknown command "${command}"\n\n${HELP}`);

  const targetDir = path.resolve(dirArg ?? '.');
  if (!fs.existsSync(targetDir)) throw new Error(`目录不存在: ${targetDir}`);
  const base = defaults(path.basename(targetDir));

  /** @type {Partial<import('./options.js').Options>} */
  const given = {};
  if (values.name !== undefined) given.name = values.name;
  if (values.prefix !== undefined) given.prefix = values.prefix;
  if (values.mobile !== undefined) given.mobile = parseList('mobile', values.mobile);
  if (values.web || values['no-web']) given.web = Boolean(values.web && !values['no-web']);
  if (values.design || values['no-design']) given.design = Boolean(values.design && !values['no-design']);
  if (values.cloud !== undefined) given.cloud = parseOne('cloud', values.cloud);
  if (values.db !== undefined) given.db = parseOne('db', values.db);
  if (values.release !== undefined) given.release = parseOne('release', values.release);
  if (values.secrets !== undefined) {
    given.secrets = parseList('secrets', values.secrets);
    if (!given.secrets.length) throw new Error('--secrets: 至少选择一项');
  }

  const interactive = !values.yes && process.stdin.isTTY && process.stdout.isTTY;
  const options = interactive ? await ask(base, given) : { ...base, ...given };
  if (given.name !== undefined && given.prefix === undefined) options.prefix = toPrefix(options.name);

  const files = plan(options, { targetDir, version: pkg.version });
  const results = install(files, { targetDir, force: values.force, dryRun: values['dry-run'] });
  report(results, targetDir, Boolean(values['dry-run']));
}

/**
 * @param {import('./options.js').Options} base
 * @param {Partial<import('./options.js').Options>} given
 */
async function ask(base, given) {
  const p = await import('@clack/prompts');
  /** @template T @param {T | symbol} v @returns {T} */
  const ok = (v) => {
    if (p.isCancel(v)) {
      p.cancel('已取消');
      process.exit(1);
    }
    return /** @type {T} */ (v);
  };
  p.intro(`app-dev-playbook ${pkg.version}`);
  const name = given.name ?? ok(await p.text({ message: '项目名', initialValue: base.name }));
  const prefix = given.prefix ?? ok(await p.text({ message: '环境变量前缀', initialValue: toPrefix(name) }));
  const mobile =
    given.mobile ??
    ok(await p.multiselect({ message: '移动端平台（空格切换，可不选）', options: [{ value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }], initialValues: base.mobile, required: false }));
  const web = given.web ?? ok(await p.confirm({ message: '包含 Web 前端？', initialValue: base.web }));
  const design = given.design ?? ok(await p.confirm({ message: '引入设计规范？', initialValue: base.design }));
  const cloud = given.cloud ?? ok(await p.select({ message: '云服务商', options: [{ value: 'aliyun', label: '阿里云' }], initialValue: base.cloud }));
  const db = given.db ?? ok(await p.select({ message: '数据库', options: [{ value: 'supabase', label: 'Supabase' }], initialValue: base.db }));
  const release = given.release ?? ok(await p.select({ message: '版本发布管理', options: [{ value: 'release-please', label: 'release-please' }], initialValue: base.release }));
  const secrets =
    given.secrets ??
    ok(await p.multiselect({ message: '密钥管理', options: [{ value: 'infisical', label: 'Infisical' }, { value: 'env', label: 'env 文件' }], initialValues: base.secrets, required: true }));
  p.outro('开始安装');
  return { name, prefix, mobile, web, design, cloud, db, release, secrets };
}

function list() {
  console.log('选项与可选值:');
  for (const [k, v] of Object.entries(CHOICES)) console.log(`  --${k.padEnd(8)} ${v.join(', ')}`);
  console.log('  --web / --design  开关\n\n文档（docs/engineering/，括号内为启用条件）:');
  for (const d of DOCS) console.log(`  ${d.src}${d.when ? `  (${d.when})` : ''}`);
  console.log(`\n始终安装: AGENTS.md, CLAUDE.md, .worktreeinclude, .gitignore 片段, .playbook.json\nSkill: ${SKILLS.join(', ')} → .agents/skills/ 与 .claude/skills/`);
}

/**
 * @param {ReturnType<typeof install>} results
 * @param {string} targetDir
 * @param {boolean} dryRun
 */
function report(results, targetDir, dryRun) {
  const label = { created: '新建', unchanged: '无变化', skipped: '已存在，跳过', overwritten: '已覆盖', appended: '已追加', updated: '已更新' };
  console.log(`${dryRun ? '[预览] ' : ''}${targetDir}`);
  for (const r of results) console.log(`  ${label[r.action].padEnd(8)} ${r.target}${r.backup ? `（备份 ${r.backup}）` : ''}`);
  const skipped = results.filter((r) => r.action === 'skipped');
  if (skipped.length) console.log(`\n${skipped.length} 个文件已存在且内容不同，未覆盖。需要覆盖时加 --force。`);
  console.log('\n下一步：打开 AGENTS.md，替换剩余的 <占位符>；用 /xspec scan 建立项目规格。');
}
