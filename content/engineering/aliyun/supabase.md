# 阿里云 Supabase（AnalyticDB PostgreSQL 版）

适用于后端（如 Django）+ 阿里云 ADB PostgreSQL 版 Supabase 的项目。Supabase 提供 PostgreSQL、Auth 和 Storage；客户端通过后端访问私有业务数据。

## 访问边界

- 业务表、约束和 trigger 放在私有 schema（如 `app`），由后端框架的 migrations 唯一管理，不另建迁移链。
- `PUBLIC`、`anon`、`authenticated` 不得直接访问私有 schema；用户级授权由后端执行。
- 客户端只持有可公开的 key（anon 或 publishable，按实际类型选择）；数据库密码和服务端 key 只属于后端。

## 数据库连接

- API、worker、迁移和环境检查统一使用一个 `SUPABASE_DB_URL`，填实例提供的数据库管理员连接。不创建业务专用登录，不配置按用途覆盖的连接变量（实践表明多套账号带来的权限迁移成本大于收益）。
- 连接串中的密码须 URL 编码。
- TLS：远程连接省略 `sslmode` 时默认 `require`；显式 `require`/`verify-ca`/`verify-full` 及 `sslrootcert` 原样生效，空或不支持的模式拒绝。默认值只进入连接参数，不改写来源文件。`require` 只保证加密，`verify-full` 才校验域名。
- `SUPABASE_URL` 使用 HTTPS。Auth issuer、算法和 audience 与实例配置一致；签名验证不能用简单 `decode` 代替。
- 同 VPC 的 ECS 可通过 `<项目ID>-vpc.supabase.opentrust.net` 内网地址访问，见 [远程开发机的 hostAliases](remote-dev-ecs.md#绑定文件)。项目白名单同时作用于公网和内网地址。

## 迁移

```sh
./scripts/env-run --infisical backend -- python scripts/check_cloud_prerequisites.py --env dev   # 只读检查
./scripts/env-run --infisical backend -- python backend/manage.py migrate --noinput             # 写入，需授权
```

- 日常开发启动只检查迁移状态（`migrate --check`），不自动迁移；应用迁移走显式入口，执行前核对实例和授权。
- 常驻进程（api、worker）启动时不自动迁移，迁移是单独的作业。

## 开发环境检查（只读）

首次接入、连接配置变化、服务升级或连接故障排查时运行，日常无需人工执行。

- 强制只读事务：查询数据库版本、当前账号能力、schema 和扩展。
- 探测 Auth / Storage 健康接口。
- 报告写入已忽略的 `.build/cloud/<项目>/`，不输出连接串、密码或 key。

## 云端集成测试

迁移、事务、认证、权限或平台配置变化时，通过显式入口运行，不随日常启动或本机测试执行。

```sh
python scripts/check_cloud_foundation.py --env-file <文件> --expected-project <已核对的项目ID>
```

- 创建随机临时数据库 `<project>_test_<UUID>`，用同一管理员账号执行迁移、数据库及最小认证验证。不创建或删除实例级角色，不修改原数据库。
- Auth 验证使用公开 key 和合成账号；实例未开启邮箱自动确认 → 停止，不发送验证邮件。合成账号保留供开发复用。
- 结束后退出 Auth 会话，核对运行标记并清理临时数据库，失败时也清理；标记不匹配 → 停止删除并报错。
- 报告记录验证和清理结果。

## 本机参考栈

- 本机与 CI 参考栈固定 PG / Auth / Storage 的版本和镜像 digest，按工作树和 CI run 隔离项目名、端口、凭据和命名卷。
- 一份已忽略的 env 文件完整描述一个栈（`stack init` 生成），只承载合成数据；`up` → `bootstrap`（迁移 + 合成账号）→ `serve`。`bootstrap` 只允许通过合成栈校验的文件，避免把合成数据写入其他库。
- 多工作树需独立项目名和端口；只改 Supabase CLI 的 `project_id` 不会隔离端口。
- `down` 默认保留数据；清除合成数据用显式参数。

## 测试账号

本机栈、CI 栈和云端开发使用同一组固定测试账号和固定验证码，不发送短信。账号由后端配置声明（如 `<PROJECT>_TEST_LOGIN_ACCOUNTS`），只在 `dev` 环境生效；云端开发的值放在密钥管理的 Development。
