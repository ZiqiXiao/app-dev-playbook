# 验证、推送与合并

目标：受保护分支（`main`、`release*`）上的每个提交都在干净检出中通过全部检查，而不依赖付费 CI。检查在本机运行，GitHub 只核对结果。

## 三层检查

| 层 | 时机 | 范围 |
| --- | --- | --- |
| pre-commit | 每次提交 | 只检查暂存文件的快速项（格式、lint、分支名），失败阻止提交，不自动修复暂存区 |
| Agent Stop 钩子 | Agent 每轮结束 | 全仓格式、lint、类型检查，可安全修复，见[下文](#agent-stop-质量检查) |
| verify | 推送受保护分支前、合并前 | 在临时干净检出中运行全部检查，写入通过记录 |

## verify 入口

```bash
./scripts/verify.sh run [<提交>] [--native]   # 默认 HEAD
./scripts/verify.sh status                     # 查看通过记录
./scripts/verify.sh publish                    # 写入 GitHub 提交状态
./scripts/verify.sh clean                      # 清理残留检出
./scripts/verify.sh install-hook               # 安装 pre-push hook（各工作树共用）
```

- `run` 把提交检出到 `.build/verify/<run-id>/checkout`，不包含当前工作树的未提交修改。每个步骤的完整输出写入 `.build/verify/<run-id>/logs/`；失败时保留检出供排查。
- 全部步骤及测试栈、镜像收尾通过后，通过记录写入共享 Git 目录 `<project>-verify/<sha>.json`，各工作树共用。
- 原生构建（iOS/Android development 包）只在提交触及原生路径（如 `app.config.ts`、`plugins/`、构建脚本、构建号文件）时运行，也可用 `--native` 显式开启。Release 构建、签名和商店上传属于发布流程。

## pre-push hook

- 开发分支自由推送，不检查。
- 推送 `main` 或 `release*` 时按远端目标分支衡量：已在目标分支上的提交不检查；先推到开发分支、之后落到受保护分支的提交仍需通过记录；触及原生路径但缺少双平台构建记录同样拒绝，并给出补跑命令。
- `--no-verify` 会绕过 hook，只在用户明确要求时使用。

## 合并流程

1. 开发分支按需推送。
2. 合并前运行 `npm run verify`。
3. `git push` 推送该提交。
4. `npm run verify:publish`：核对 GitHub 账号与仓库后写入 `local/checks` 提交状态；有原生构建记录时另写 `local/native`，并自动重跑失败的 PR 检查。
5. 在 GitHub 合并。期间 base 分支前移 → 先 merge 或 rebase `origin/<base>`，重复第 2–4 步。

PR 的 `Local verification` workflow 只核对 head 提交上的 `local/checks`、原生变更时的 `local/native`，以及 head 是否与 base 同步，不重新执行检查。GitHub 免费版中它只能展示，不能阻止合并。

## Agent Stop 质量检查

Claude Code 和 Codex 的 `Stop` 钩子调用同一个质量脚本，运行全仓 Python 质量检查和移动端的 `format:check`、`lint`、`typecheck`。

- 可写模式首次检查失败 → 对当前工作树已暂存、未暂存或未忽略的新文件应用格式化和安全修复（只限仓库内、未经符号链接的普通文件），然后重新检查。类型错误需要修改代码。钩子不自动暂存或提交。
- 规划模式、无法识别写入权限或已由 Stop 续跑的轮次只读检查，失败以 JSON 警告报告。
- 可写检查后仍有诊断 → 最多请求一次续跑，避免无限循环。
- 工具缺失或命令超时 → 报告原因，不阻塞。
- 检查通过后，工作树文件夹跟随分支改名（见 [工作树](worktrees.md)）。

## 报告要求

- 评审记录包含代码版本、环境、命令、覆盖场景和结果。
- 失败、跳过和未运行的检查分别标明。
- 不以单一层次检查通过宣称整个平台已就绪。
