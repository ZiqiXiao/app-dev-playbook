# 工作树管理

多个 Agent 会话（Claude Code、Codex）和开发者并行开发时，每个任务使用一个独立的 Git 工作树。本规范描述工作树的位置、准备、改名和移除，以及配套的钩子。参考实现是一个只用 Python 标准库的脚本 `scripts/dev/worktrees.py`，在依赖安装前即可用系统 `python3` 运行。

## 基本规则

- 每个工作树是独立的工程根目录，各自维护依赖目录（如 `backend/.venv`、`mobile/node_modules`）；语言运行时（Python 解释器、Node）由用户级工具统一安装，供各工作树共用。
- 工作树之间共享 Git 公共目录。需要跨工作树共享的本机状态（租约表、验证记录、远程开发机配置）放在 `<git common dir>/<project>/`，不进 Git。
- 新工作树需要的已忽略文件（只限不含秘密的本机绑定，如 `.infisical.json`、`.remote-dev.json`）列在根目录的 `.worktreeinclude`，语法同 `.gitignore`，新建时从主目录复制。

## 位置与命名

| 来源 | 位置 | 初始分支 |
| --- | --- | --- |
| Claude Code | `<主目录>/.claude/worktrees/<名字>`（`.claude/worktrees/` 由 Git 忽略） | `claude/<名字>`；名字本身是 `<type>/<描述>` 时直接作分支名 |
| Codex | `$CODEX_HOME/worktrees/<编号>/` | 分离 HEAD |
| 开发者手动 | 自定 | 自定 |

- 文件夹名取分支名，`/` 写作 `+`，例如 `feat/login-page` → `feat+login-page`。
- 起点为本地 `main`；最近一次拉取的 `origin/main` 严格领先时改用它。新建时不联网拉取。

## 准备

新工作树首次准备依次执行：

1. 检查编辑器命令（如 `code`）和项目专用 Profile，缺失时停止并提示，不自动创建
2. 按锁文件安装依赖（`uv sync --frozen`、`npm ci --ignore-scripts` 等）
3. 初始化代码索引（如 `codegraph init --local-only --yes`），失败只提示
4. 加入[编辑器工作区](#编辑器工作区)

完成后把各锁文件的摘要写入 `.build/worktree-setup.json`。之后再准备时：

- 锁文件未变 → 跳过
- 锁文件变化 → 只重装依赖
- 任一步骤失败 → 不写记录，下次重试；也可手动运行 `worktrees.py setup`

## 文件夹随分支改名

确定分支名后运行：

```bash
python3 scripts/dev/worktrees.py rename <type>/<描述>
```

它改分支名（分离 HEAD 时新建分支），立即移动文件夹，并更新编辑器工作区。之后改用它输出的新路径。

- 文件夹在原父目录内改名。旧路径保留为指向新文件夹的符号链接，记录了旧路径的桌面端仍可恢复会话、删除工作树。
- 依赖目录中写死旧路径的文件（venv 的脚本、`.pth`、安装记录）改为新路径；常驻守护进程（如索引服务）先停止，下次使用时在新路径重启。
- 用 `git branch -m` 或工具自带的“新建分支”改名时，文件夹在下次会话开始或 Stop 检查通过后移动。
- 不移动：临时分支（`claude/*`）、分离 HEAD、子代理的 `agent-*` 工作树、`git worktree lock` 锁定的、目标文件夹已存在的，以及桌面端自行创建、只按原路径删除的工作树。

## 移除

- 有未提交或未跟踪的改动 → 先存为 `refs/<project>/worktree-snapshots/<文件夹>-<时间>` 下的提交，再移除工作树。快照可用 `git checkout <快照引用> -- .` 在任一工作树中恢复。
- 删除指向它的符号链接，并从编辑器工作区去掉。
- 分支在本地 `main` 之外没有提交时一并删除，否则保留。
- 工作树的租约（模拟器、端口）在下次任一入口运行时回收，见 [模拟器](emulators.md#租用)。

## 编辑器工作区

主目录维护一个由 Git 忽略的 `.vscode/<project>.code-workspace`，列出主目录和全部工作树，名称取分支名，可在一个窗口查看所有任务。

- 主目录固定为第一项；分离 HEAD 显示为 `<文件夹>（未建分支）`
- 文件夹已不存在或已不是工作树 → 删除该项；手动加入的其他文件夹保留
- 子代理的 `agent-*` 工作树不加入
- 新建时写入设置：隐藏主目录下的 `.claude/worktrees/`，并排除在文件监听和搜索之外
- 文件无法解析 → 不改写并报告
- 工作区含未受信任的文件夹时，VS Code 进入受限模式，部分扩展（如 Ruff）会改用自带版本而报错。处理：信任该工作区，并把主目录和 Codex 工作树根目录加为受信任文件夹

## Agent 钩子

### Claude Code

在项目的 `.claude/settings.json` 注册四个钩子，统一调用 `scripts/dev/claude_hooks.py`，示例见 [templates/claude-settings.json](../templates/claude-settings.json)：

| 钩子 | 作用 |
| --- | --- |
| `WorktreeCreate` | 按上文规则新建工作树，复制 `.worktreeinclude` 中的文件 |
| `WorktreeRemove` | 快照后移除，见[移除](#移除) |
| `SessionStart` | 让文件夹跟随分支，准备依赖和索引，更新编辑器工作区；分支仍是临时名时提示 Agent 改名 |
| `Stop` | 运行质量检查（见 [验证与合并](verify-and-merge.md#agent-stop-质量检查)），通过后让文件夹跟随分支 |

- 桌面端从主目录读取 `WorktreeCreate`/`WorktreeRemove`，主目录须已受信任。桌面端调用钩子时只传名字，分支选择器的起点不生效；桌面端自行新建的工作树不经过钩子。
- 钩子脚本用 `$CLAUDE_PROJECT_DIR` 定位，按钩子输入的 `cwd` 找到会话所在工作树。

### Codex

- `.codex/environments/environment.toml` 定义本地环境：初始化脚本调用主目录的 `worktrees.py setup`，清理脚本先把改过名的文件夹移回 Codex 记录的路径、从工作区去掉，再由 Codex 快照并删除。清理脚本出错不阻止删除。
- `.codex/hooks.json` 的 `Stop` 钩子通过 `git rev-parse --git-common-dir` 找到主目录，调用其 `worktrees.py stop`。首次使用和钩子变更后，在 Codex CLI 的 `/hooks` 中审阅并信任。

## 测试

钩子和工作树工具在临时合成仓库中做回归：新建、准备、跟随分支、移除快照、编辑器工作区更新、钩子的工作树定位。
