# 发布流程

适用于前后端分开发版的单仓库（如 `backend/` + `mobile/`）。版本号、标签和变更记录由在本机运行的 [release-please](https://github.com/googleapis/release-please) 维护，不依赖 CI。远端操作（发布 PR、标签、部署、商店提交）需要明确授权，生产发布和商店提交由仓库所有者本人执行。

## 组件与产物

| 组件 | 版本来源 | 标签 | 变更记录 | 产物 |
| --- | --- | --- | --- | --- |
| backend | `backend/pyproject.toml`（同步锁文件） | `backend-vX.Y.Z` | `backend/CHANGELOG.md` | 一个容器镜像，按 digest 部署为 api、worker、migrate |
| mobile | `mobile/package.json`（同步锁文件和 `app.config.ts`） | `mobile-vX.Y.Z` | `mobile/CHANGELOG.md` | iOS ipa、Android apk/aab，构建号取自 `mobile/release.json` |

配置放在根目录的 `release-please-config.json` 和 `.release-please-manifest.json`，固定 release-please 版本。

## 版本号

- 遵循 SemVer，由 Conventional Commits 计算：`fix` → 补丁，`feat` → 次版本，`!`/`BREAKING CHANGE` → 主版本。1.0.0 之前不兼容变更只升次版本（`bump-minor-pre-major`）。
- 提交按路径归属组件；同时改动两个组件的提交出现在两份记录中，所以一条提交尽量只改一个组件。`contracts/`、`scripts/`、`docs/` 等不进入任何变更记录。
- 后端镜像构建参数 `<PROJECT>_RELEASE_REVISION` 取 `backend-<版本>-<7 位 commit>`，日志和诊断据此定位版本。
- 移动端构建号是 `mobile/release.json` 中的正整数，同时写入 iOS `buildNumber` 和 Android `versionCode`。每个提交给 TestFlight、内测平台或商店的构建都必须使用更大的构建号，同一版本重新构建也要增加：

```sh
./scripts/release.sh build-number          # 查看
./scripts/release.sh build-number --bump   # 加 1，随发版提交一起提交
```

## 分支

- 日常在 `main` 上集成，功能分支短期存在。
- 已发布版本需要修复而 `main` 上有尚不能发布的改动 → 从对应标签创建 `release/<组件>-X.Y`。修复先合入 `main`，再 `git cherry-pick -x` 到发布分支，在发布分支上发补丁版本。

## 步骤

前提：`gh` 已用仓库所有者账号登录。脚本首次运行时在 `scripts/release/` 安装锁定版本的 CLI；GitHub token 从 `gh auth token` 读取，只传给 release-please 进程，不出现在命令行参数或输出中。

1. 预览并创建发布 PR（每个组件一个，内容是版本号文件和变更记录）：

   ```sh
   ./scripts/release.sh pr --dry-run
   ./scripts/release.sh pr
   ```

   release-please 读取 `origin/main`，本机未推送的提交不计入。
2. 对发布 PR 的 head 提交运行验证并发布状态（见 [验证与合并](verify-and-merge.md)）：

   ```sh
   git fetch origin <发布 PR 分支>
   npm run verify -- FETCH_HEAD
   npm run verify:publish
   ```

3. 在 GitHub 合并发布 PR，然后创建标签和 GitHub Release：

   ```sh
   ./scripts/release.sh publish --dry-run
   ./scripts/release.sh publish
   ```

4. 构建与部署：后端按同一 commit 构建一个不可变镜像 digest；移动端按同一 commit 为每个明确的环境分别构建，签名和渠道配置独立。部署与商店分发分别审批，阿里云上的做法见 [阿里云上线](aliyun/prod-release.md)。

## 兼容

- 后端必须在兼容窗口内同时支持已分发 App 的请求格式；移除旧接口在单独的发布中进行。
- 后端回退不能替代已分发 App 的修复。
