# app-dev-playbook

从过往项目沉淀的通用 App 开发约定。一个命令就能在新项目里装好 `AGENTS.md`、工程规范文档和 xspec skill，以后不用再向人或 AI Agent 重复说明这些规则。

## 快速开始

```bash
npx github:ZiqiXiao/app-dev-playbook init          # 发布到 npm 前，直接从 GitHub 运行
npx app-dev-playbook init                          # 发布到 npm 后
pnpm dlx app-dev-playbook init
npm i -g app-dev-playbook && app-dev-playbook init
```

不带参数时逐项交互式询问；带参数时跳过已指定的项，加 `--yes` 则完全不询问：

```bash
npx app-dev-playbook init ./my-app --yes \
  --name MyApp --mobile ios,android --no-web --design \
  --cloud aliyun --db supabase --release release-please --secrets infisical,env
```

| 选项 | 可选值 | 默认 |
| --- | --- | --- |
| `--name` / `--prefix` | 项目名 / 环境变量前缀 | 目录名 / 由项目名生成 |
| `--mobile` | `ios`、`android`，逗号分隔；`none` | `ios,android` |
| `--web` / `--no-web` | 是否包含 Web 前端 | 否 |
| `--design` / `--no-design` | 是否引入设计规范 | 是 |
| `--cloud` | `aliyun` | `aliyun` |
| `--db` | `supabase` | `supabase` |
| `--release` | `release-please` | `release-please` |
| `--secrets` | `infisical`、`env`，至少一项 | 两项 |
| `--force` | 覆盖已存在的文件，先备份为 `*.bak-<时间>` | 否 |
| `--dry-run` | 只显示将写入的文件 | 否 |

`app-dev-playbook list` 列出全部模块和启用条件。

## 安装结果

| 位置 | 内容 |
| --- | --- |
| `AGENTS.md` | 按选项生成的根约定：不适用的小节和“按任务读取”行会被去掉，项目名和前缀已替换 |
| `CLAUDE.md` | `@AGENTS.md` |
| `docs/engineering/` | 选中的规范文档；指向未安装文档的链接改为纯文本 |
| `docs/engineering/templates/` | 钩子和 pre-commit 模板，脚本就绪后再启用 |
| `.agents/skills/xspec/`、`.claude/skills/xspec/` | xspec skill，分别供 Codex 和 Claude Code 使用 |
| `.worktreeinclude`、`.gitignore` | 工作树复制清单；`.gitignore` 追加一段带标记的片段 |
| `.playbook.json` | 本次选项、版本和文件清单 |

已存在的文件默认跳过并在结果中列出，不会被覆盖；`.gitignore` 片段只追加一次。

## 内容

| 文档 | 内容 | 启用条件 |
| --- | --- | --- |
| [AGENTS.template.md](content/AGENTS.template.md) | 根约定模板 | 始终 |
| [agents-md-guide](content/engineering/agents-md-guide.md) | AGENTS.md 编写与拆分 | 始终 |
| [git-branching](content/engineering/git-branching.md) | 分支命名、提交信息、临时分支拦截 | 始终 |
| [worktrees](content/engineering/worktrees.md) | 多工作树并行开发与 Agent 钩子 | 始终 |
| [verify-and-merge](content/engineering/verify-and-merge.md) | 本机干净检出验证、pre-push、PR 核对 | 始终 |
| [testing](content/engineering/testing.md) | 检查范围、证据分层、结果记录 | 始终 |
| [env-config](content/engineering/env-config.md) | 环境变量命名、配置来源、秘密边界 | 始终 |
| [technical-writing](content/engineering/technical-writing.md)、[python](content/engineering/python.md)、[scripts](content/engineering/scripts.md) | 写作、Python、脚本组织 | 始终 |
| [emulators](content/engineering/emulators.md) | 模拟器统一入口、按工作树租用设备和端口 | 选了移动端 |
| [release](content/engineering/release.md) | release-please 分组件发版 | `release-please` |
| [design/principles](content/engineering/design/principles.md)、[design/ui-flows](content/engineering/design/ui-flows.md) | 设计原则、令牌结构、界面流程 | 设计规范 |
| [design/layout-spacing](content/engineering/design/layout-spacing.md) | 4pt 网格、页面边距 | 设计规范 + 移动端 |
| [aliyun/](content/engineering/aliyun/README.md) | 远程开发机、上线迁移 | `aliyun` |
| [aliyun/supabase](content/engineering/aliyun/supabase.md) | 阿里云 Supabase | `aliyun` + `supabase` |
| [skills/xspec](content/skills/xspec/SKILL.md) | 规格驱动开发 skill（scan / plan / sync） | 始终 |

## 维护

- 文档放在 `content/`，路径与安装后的 `docs/engineering/` 一致，文档之间用相对链接。
- 新增文档：放进 `content/engineering/`，在 [src/assemble.js](src/assemble.js) 的 `DOCS` 登记启用条件，并在 AGENTS 模板的“按任务读取”表加一行。
- 新增可选值：在 [src/options.js](src/options.js) 的 `CHOICES` 添加，再用条件标记区分内容。
- 检查：`npm run check`（类型检查 + 测试，测试会渲染多种选项组合，确认没有残留标记、占位符或死链）。

### 条件标记

条件是逗号分隔的“或”，每项用 `+` 连接表示“且”，`!` 表示“非”，特性名即选项值（`ios`、`android`、`mobile`、`web`、`design`、`aliyun`、`supabase`、`release-please`、`infisical`、`env`）。

```markdown
<!-- if:design+mobile -->
整段内容，条件不满足时删除
<!-- endif -->
| 表格行或单行内容 | <!-- if:infisical -->
```

非 Markdown 文件的单行条件写作行尾 `# if:<条件>`。安装时标记本身会被去掉。
