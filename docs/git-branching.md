# Git 分支与提交

## 分支命名

格式：`<type>/<描述>`

- `type` 取 [Conventional Commits](https://www.conventionalcommits.org/) 类型：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`build`、`ci`、`style`、`revert`。
- 描述用小写字母、数字和短横线，说明要做的事，例如 `feat/login-page`、`fix/android-keyboard-offset`、`docs/release-flow`。
- 不在分支名中写日期、人名、工单号以外的编号或 Agent 名称。

| 分支 | 用途 |
| --- | --- |
| `main` | 日常集成分支，推送前必须通过本机验证 |
| `<type>/<描述>` | 功能分支，短期存在，可自由推送 |
| `release/<组件>-X.Y` | 已发布版本的修复分支，见 [发布流程](release.md#分支) |

## Agent 临时分支

Claude Code 等工具新建工作树时会给出临时名（如 `claude/<随机名>`）。规则：

- 临时名只用于开工，确定任务内容后、首次提交前必须改成 `<type>/<描述>`。
- 改名用项目的工作树脚本（如 `python3 scripts/dev/worktrees.py rename <type>/<描述>`），不直接 `git branch -m`，这样工作树文件夹会跟随改名。详见 [工作树](worktrees.md#文件夹随分支改名)。
- pre-commit 加一个钩子拒绝在临时分支上提交，示例见 [templates/pre-commit-config.yaml](../templates/pre-commit-config.yaml)：

```python
# scripts/dev/check_branch.py 的核心逻辑
import re, subprocess, sys
branch = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True).stdout.strip()
if branch.startswith("claude/"):
    sys.exit(f"当前分支 {branch} 是临时名，先运行 worktrees.py rename <type>/<描述>")
if branch and branch not in ("main",) and not re.fullmatch(r"[a-z]+/[a-z0-9][a-z0-9-]*(/[a-z0-9-]+)*", branch):
    sys.exit(f"分支名 {branch} 不符合 <type>/<描述>")
```

## 提交信息

- 使用 Conventional Commits：`<type>(<范围>): <说明>`，例如 `feat(mobile): align the auth page with shared gutters`。
- `fix` → 补丁版本，`feat` → 次版本，`!` 或 `BREAKING CHANGE` → 主版本（release-please 据此计算版本，见 [发布流程](release.md)）。
- 一条提交尽量只改一个组件（如只改 `backend/` 或只改 `mobile/`），否则会同时进入两份变更记录。

## 协作边界

- 编辑前检查 `git status` 和相关差异，保留已有暂存和未提交工作。
- 不自行 reset、强制推送或重写已推送的历史。
- 合并前 base 分支前移 → 先 merge 或 rebase `origin/<base>`，再重新验证。
