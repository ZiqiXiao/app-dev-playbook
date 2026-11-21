# 工程脚本组织

## 目录

```
scripts/
  <入口>.sh / env-run      根目录只放需要稳定调用的操作入口
  dev/                     开发会话、工作树、模拟器、钩子
  config/                  配置加载、环境白名单、原子文件写入
  remote/                  远程开发机
  cloud/                   云端检查
  release/                 发布工具（自带 package.json 和锁文件）
  testing/                 测试夹具和验证工具
```

## 维护约定

- 新实现放入对应用途目录；根目录只增加需要稳定调用的入口。
- 跨目录用 `scripts.<目录>.<模块>` 导入。兼容入口只转发，不复制实现；实现不导入兼容入口。
- 脚本按工程根目录定位资源，不依赖调用者的工作目录。Node 依赖和锁文件保留在所属工具目录。
- 工作树、钩子等需要在依赖安装前运行的脚本只用标准库。
- 移动入口时同步更新调用、导入、文档和测试；兼容入口的参数、退出码和异常处理保持一致。
- 删除废弃脚本前核对工程调用、编辑器动作、操作文档及替代入口，完成回归后再移除。
- 写入文件时用临时文件原子替换，保留原权限。
- 需要授权的操作（迁移 apply、云资源初始化）默认预览，显式 `--apply` 才执行。

## npm 别名

根目录 `package.json` 只提供常用入口的 `npm run` 别名，脚本本体仍是规范入口；根目录不声明依赖，不在根目录 `npm install`。

| 前缀 | 示例 |
| --- | --- |
| `dev` | `dev`、`dev:local`、`dev:cloud`、`dev:stop`、`dev:status`、`dev:logs` |
| `emulator` | `emulator:start`、`emulator:status`、`emulator:stop` |
| `remote` | `remote:up`、`remote:down`、`remote:status`、`remote:ssh` |
| `stack` | `stack:init`、`stack:up`、`stack:down`、`stack:bootstrap` |
| `verify` | `verify`、`verify:native`、`verify:status`、`verify:publish` |
| `check` / `fix` / `test` | `check:python`、`fix:python`、`check:mobile`、`test:api` |

有意不设别名：参数无默认值的命令、内部步骤、需要显式授权的操作（迁移 apply、云实例初始化、云端检查）、一次性工具。

## 开发会话

用 Process Compose 编排日常会话：迁移检查 → API、worker 按依赖启动，Metro 与后端独立。迁移检查失败时 API 和 worker 不启动、Metro 继续；异常退出的进程有限次自动重启。日志写入 `.build/logs/`。会话按工作树隔离，提供 `start/stop/status/logs` 和 `--force-restart`。
