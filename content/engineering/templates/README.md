# 配置模板

以下配置引用的脚本（如 `scripts/dev/claude_hooks.py`、`scripts/check-python.sh`）需要项目自行实现，所以 CLI 只把模板放在这里供参考，不直接启用。脚本就绪后复制到对应位置。

| 文件 | 复制到 |
| --- | --- |
| `claude-settings.json` | `.claude/settings.json`，需要 `scripts/dev/claude_hooks.py`，见 [工作树](../worktrees.md) |
| `codex-hooks.json` | `.codex/hooks.json`，需要 `scripts/dev/worktrees.py` |
| `pre-commit-config.yaml` | `.pre-commit-config.yaml`，需要 `scripts/check-python.sh` 和分支名检查脚本 |
| `remote-dev.example.json` | `.remote-dev.json`（由 Git 忽略，填实例信息），见 [远程开发机](../aliyun/remote-dev-ecs.md) |

CLI 已直接安装的文件：`CLAUDE.md`、`.worktreeinclude`、`.gitignore` 片段。
