<!--
AGENTS.md 模板，由 app-dev-playbook CLI 按所选模块生成。手工使用时替换尖括号占位符，删除不适用的内容、条件标记和本注释。
条件标记语法见仓库 README 的“条件标记”一节。
-->
# <项目名> 开发约定

## 仓库与协作

- 主工作目录为 `<主工作目录绝对路径>`。
- 同一仓库已注册的 Git 工作树是各自任务的工程根目录。Git 与工程命令从当前任务对应的根目录执行，不在父级或子目录另建仓库。工作树规则见 [工作树](docs/engineering/worktrees.md)。
- 产品方案与设计评审在 `<飞书/Notion/...>` 维护。
<!-- if:design -->
- 界面原型使用 `<Pencil/Figma>`，文件放在 `design/`，不进 Git。新页面与新样式先在原型确认。
<!-- endif -->
- 规格由 xspec 维护（`/xspec scan | plan | sync`）：`specs/SPEC.md` 是项目总览，`specs/ARCHITECTURE.md` 是总体架构，`specs/<module>/SPEC.md` 是模块规格。规格客观描述当前实现，开发以其为参考，实际行为变化时更新。
- 开发任务的临时计划和验收位于 `specs/<module>/tasks/<task>/`，由 `xspec plan` 建立，`xspec sync` 合并回规格并经用户确认后删除。有进行中的任务时，实现参照其 `PLAN.md`；范围变化时同步修改 `PLAN.md` 和 `ACCEPTANCE.md`，验证结果记入 `ACCEPTANCE.md`。
- 技术基线与待定项以工程入口为准，历史设计不代替当前决定。
- 编辑前检查 Git 状态和相关差异，保留已有暂存及未提交工作，不自行 reset、覆盖或撤销。遇到与任务冲突的未知改动，先报告再处理。
- 确定分支名后按 [分支命名](docs/engineering/git-branching.md) 改名；Agent 的临时分支名（如 `claude/*`）在首次提交前必须改掉。
- 可进入 Git：代码、工程文档、契约、测试、工程配置、依赖清单、无秘密模板和必要运行资源。
- 不上 Git：产品企划、设计资料、真实数据和秘密。不以 `git add -f` 绕过边界。
- 每次修改兼顾用户体验、开发体验和 AI Agent 的使用体验，且不破坏现有功能。

## 授权与远端操作

- 操作以用户已给出的授权为准，本文件不扩大授权。
- 未经明确授权，禁止：提交、推送、发布、重写历史、写入外部应用、创建云资源、启用 CI/CD、部署，以及自行创建历史副本或新备份。
<!-- if:aliyun -->
- 未经明确授权，禁止通过浏览器打开、查看或操作任何阿里云控制台页面，包括只读查看。授权须明确控制台范围与操作目的。提供凭据、授权 CLI/API 检查或“继续开发”都不等于授权控制台操作；未取得授权时，列出需要用户配置的项目、字段和步骤，由用户自行操作。
<!-- endif -->
- 获准远端操作后，先核对账号 `<GitHub 账号>` 与仓库 `<仓库 URL>`。不新建同名仓库，不强制推送。

## 本机环境与安全

- 不修改全局 Git 身份、系统开发者路径、安全设置或 Agent 私有配置。
- 运行时配置使用进程环境变量。`<PROJECT>_ENV` 表示部署层级（`dev`、`staging`、`prod`）。配置来源、命名和加载规则见 [环境变量规范](docs/engineering/env-config.md)。
<!-- if:infisical -->
- 日常云端开发从当前工程绑定的 Infisical Development 读取配置。项目绑定文件 `.infisical.json` 由 Git 忽略，只含项目 ID 和域名。
<!-- endif -->
<!-- if:env -->
- 本机合成栈由一份已忽略的 `.env.*` 文件描述，只承载合成数据。Git 只跟踪 `.env*.example` 占位模板，模板不含真实实例标识、环境专用地址或凭据。
<!-- endif -->
- 默认不读取真实配置内容。获得对特定来源与用途的授权后，由运行入口在内存中加载并按用途传给目标进程。
- 不得通过 `cat`、环境转储、日志或回复展示秘密。登录材料和 CLI 身份不进 Git，也不注入应用进程。
- 客户端只持有可公开的 key；数据库密码和服务端 key 只属于后端。
- 遇到登录、管理员密码、新许可或权限扩展时先报告，不绕过。资料清理采用可恢复方式，不永久删除用户资料。
- 远程平台必须使用 HTTPS，远程数据库连接使用 TLS。
<!-- if:supabase -->
- 业务表、约束和 trigger 由后端 migrations 管理，放在私有 schema；`PUBLIC`、`anon`、`authenticated` 不得直接访问，用户级授权由后端执行。见 [阿里云 Supabase](docs/engineering/aliyun/supabase.md)。
<!-- endif -->

## 运行环境代号

用户用 `local` 或 `cloud` 指定开发环境，未指定时用 `<默认代号>`。会话输出 `<就绪标志>` 且 `<健康检查地址>` 返回 200 即为就绪。

| 代号 | 后端 | 数据库与平台 | 数据 | 启动 |
| --- | --- | --- | --- | --- |
| `local` | 本机 | 本机 Docker 栈 | 仅合成数据 | `npm run dev:local` |
| `cloud` | 阿里云 ECS 远程开发机 | 阿里云开发实例，VPC 内网访问 | 云端开发库 | `npm run dev:cloud` | <!-- if:aliyun -->

- 不同环境的验证结果分别报告，`local` 的结果不能证明云端行为。
<!-- if:aliyun -->
- 指定 `cloud` 即允许为开发会话启动、同步和停止已绑定的实例；初始化实例、更换实例和修改云端配置仍需单独授权。见 [远程开发机](docs/engineering/aliyun/remote-dev-ecs.md)。
- `cloud` 不可用时报告原因并询问是否改用其他方式，不自行切换。
<!-- endif -->
- 任务结束时停止本工作树启动的会话（`npm run dev:stop`）。

## 按任务读取

- 全仓必守的规则留在本文件；目录专属约束放在对应目录的局部 `AGENTS.md`；专题规范通过下表引用。
- 编辑目标路径前，读取其路径上存在的局部 `AGENTS.md`。Markdown 链接不会自动加载正文，开始相关工作前打开下表中匹配的文档；跨模块时读取所有匹配项。局部规则和引用不扩大授权。

| 触发条件 | 必读文档 |
| --- | --- |
| 了解现有功能，规划或实现开发任务 | `specs/SPEC.md`、受影响模块的规格及进行中任务的 `PLAN.md` |
| 编写或修改 AGENTS.md | [AGENTS 编写指南](docs/engineering/agents-md-guide.md) |
| 编写或修改技术文档、排障记录、验证报告 | [技术文档写作](docs/engineering/technical-writing.md) |
| 新增或修改环境变量、配置加载 | [环境变量规范](docs/engineering/env-config.md) |
| 新建分支、提交、推送、合并 | [分支命名](docs/engineering/git-branching.md)、[验证与合并](docs/engineering/verify-and-merge.md) |
| 新建、改名或移除工作树 | [工作树](docs/engineering/worktrees.md) |
| 新增或修改工程脚本、npm 别名 | [脚本组织](docs/engineering/scripts.md) |
| 选择检查范围、记录验证结果 | [测试说明](docs/engineering/testing.md) |
| 修改 Python 源码或检查配置 | [Python 规范](docs/engineering/python.md) |
| 修改界面文案、交互或可见流程 | [界面与流程规范](docs/engineering/design/ui-flows.md) | <!-- if:design -->
| 新建或修改界面视觉、组件、颜色、字号、动效 | [设计系统](docs/engineering/design/principles.md) | <!-- if:design -->
| 新建或调整页面布局和间距 | [布局与间距规范](docs/engineering/design/layout-spacing.md) | <!-- if:design+mobile -->
| 启动模拟器、移动端验收 | [模拟器](docs/engineering/emulators.md) | <!-- if:mobile -->
| 修改 Web 前端 | `<Web 前端说明>` | <!-- if:web -->
| 使用或排查远程开发机 | [阿里云 ECS 远程开发机](docs/engineering/aliyun/remote-dev-ecs.md) | <!-- if:aliyun -->
| 部署、生产迁移、回退 | [阿里云上线](docs/engineering/aliyun/prod-release.md) | <!-- if:aliyun -->
| 修改数据库连接、迁移或云端集成测试 | [阿里云 Supabase](docs/engineering/aliyun/supabase.md) | <!-- if:supabase -->
| 发版、版本号、变更记录 | [发布流程](docs/engineering/release.md) | <!-- if:release-please -->

## 代码检索

- 查找符号定义、梳理调用链或评估改动影响时，优先使用当前工作树的代码索引工具（如 CodeGraph：`codegraph explore "<问题>"`；缺索引时 `codegraph init --local-only`）。索引目录由 Git 忽略。
- 精确文本、文档和索引未覆盖的内容用 `rg` 检索。

## 验证

- 按改动风险执行必要检查，命令和触发条件见 [测试说明](docs/engineering/testing.md)。区分纯逻辑、内存替身、真实基础设施、构建与实际运行的证据。
- 推送受保护分支前运行 `./scripts/verify.sh run`；未经用户明确要求不使用 `--no-verify`。见 [验证与合并](docs/engineering/verify-and-merge.md)。
<!-- if:mobile -->
- 模拟器只用 `npm run emulator:start -- --platform <平台>` 启动或复用，只使用入口创建的 `<Project>_Agent_*` 设备；设备与 Metro 端口按工作树租用，不操作其他工作树的设备、端口和会话。任务结束关闭本工作树启动的实例。见 [模拟器](docs/engineering/emulators.md)。
<!-- endif -->
- 明确报告未运行、失败和受阻的检查。不能以模板或单一层次检查通过宣称整个平台已就绪。
