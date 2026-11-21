# App 开发手册（app-dev-playbook）

从过往项目沉淀的通用开发约定，供新项目直接复用，避免每次向人或 AI Agent 重复说明。内容与具体产品无关；项目专属的事实（产品名、端口、账号、实例 ID 等）在项目自己的 `AGENTS.md` 和文档中填写。

## 用法

1. 把 [`AGENTS.template.md`](AGENTS.template.md) 复制为新项目根目录的 `AGENTS.md`，替换全部 `<占位符>`，删除不适用的小节。需要 Claude Code 读取时，再建一个只含 `@AGENTS.md` 的 `CLAUDE.md`。
2. 按项目技术栈从 `docs/`、`aliyun/` 中挑选需要的文档，复制到项目的 `docs/engineering/`（推荐，便于随项目演进），并在 `AGENTS.md` 的“按任务读取”表中登记。
3. `templates/` 中的配置片段（钩子、pre-commit、绑定文件）按需复制并改名。
4. 项目里对规范的修改如果对其他项目也成立，回写到本手册。

## 目录

| 文档 | 内容 | 适用 |
| --- | --- | --- |
| [AGENTS.template.md](AGENTS.template.md) | 根约定模板：协作、授权边界、秘密安全、运行环境代号、按任务读取、代码检索、验证 | 所有项目 |
| [docs/agents-md-guide.md](docs/agents-md-guide.md) | 如何编写和拆分 AGENTS.md：根文件与局部文件、路由表、写法 | 所有项目 |
| [docs/git-branching.md](docs/git-branching.md) | 分支命名、提交信息、临时分支拦截 | 所有项目 |
| [docs/worktrees.md](docs/worktrees.md) | 多工作树并行开发：新建、准备、随分支改名、移除快照、编辑器工作区、Agent 钩子 | 多 Agent 并行开发 |
| [docs/emulators.md](docs/emulators.md) | iOS/Android 模拟器统一入口、设备命名、按工作树租用设备和端口 | 移动端 |
| [docs/verify-and-merge.md](docs/verify-and-merge.md) | 本机干净检出验证、pre-push 拦截、PR 核对、Agent Stop 质量检查 | 所有项目 |
| [docs/release.md](docs/release.md) | 分组件发版、SemVer、构建号、修复分支 | 有发版的项目 |
| [docs/env-config.md](docs/env-config.md) | 环境变量命名、配置来源、加载规则、秘密边界 | 所有项目 |
| [docs/testing.md](docs/testing.md) | 按改动选择检查范围、证据分层、结果记录 | 所有项目 |
| [docs/technical-writing.md](docs/technical-writing.md) | 技术文档写作规范 | 所有项目 |
| [docs/python.md](docs/python.md) | Python 注释与质量检查 | Python 项目 |
| [docs/scripts.md](docs/scripts.md) | 工程脚本与 npm 别名的组织方式 | 所有项目 |
| [docs/design/principles.md](docs/design/principles.md) | 设计原则、令牌结构、动效、无障碍、组件规格写法 | 有界面的项目 |
| [docs/design/layout-spacing.md](docs/design/layout-spacing.md) | 4pt 网格、页面边距类型、纵向节奏 | 移动端 |
| [docs/design/ui-flows.md](docs/design/ui-flows.md) | 界面表达、流程控制、异步结果、流程回归 | 有界面的项目 |
| [aliyun/README.md](aliyun/README.md) | 阿里云开发范式总览与授权约定 | 阿里云项目 |
| [aliyun/remote-dev-ecs.md](aliyun/remote-dev-ecs.md) | 按量 ECS 远程开发机：节省停机、Mutagen、Workbench、空闲自停 | 阿里云项目 |
| [aliyun/supabase.md](aliyun/supabase.md) | 阿里云 Supabase（ADB PG）连接、TLS、只读检查、云端集成测试 | 阿里云 + Supabase |
| [aliyun/prod-release.md](aliyun/prod-release.md) | SAE 部署、Secret 注入、expand/contract 迁移、回退 | 阿里云上线 |
