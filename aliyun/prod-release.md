# 阿里云上线：部署、迁移与回退

生产资源、Secrets、迁移、部署和商店分发分别需要目标明确的授权。版本号和标签见 [发布流程](../docs/release.md)。

## 配置注入

- 密钥管理服务按环境隔离：Development、Staging、Production。角色权限只能覆盖整个项目时，用三个项目隔离，每个机器身份只加入对应项目。
- 启用 GitHub Actions 发布后，可用 OIDC 把机器身份绑定到仓库的受保护环境，在发布任务中读取目标环境的 `/backend`（[Infisical GitHub Actions](https://infisical.com/docs/integrations/cicd/githubactions)）。
- 部署到 SAE：把后端字段同步到目标命名空间的 Secret，由平台注入 api、worker、migrate 的进程环境。轮换字段后发布对应配置，应用在新进程中读取（[SAE 环境变量](https://www.alibabacloud.com/help/en/sae/configure-environment-variables-2-0)）。
- 移动端构建只读取目标环境 `/mobile` 的公开字段。生产配置不经过本机加载器。

## 同镜像

- 每个 commit 构建一个不可变镜像（固定基础镜像版本/digest，`uv sync --frozen`），按 digest 部署。
- 同一镜像分别以 `api`、`worker`、`migrate` 启动；迁移不随常驻进程自动运行。
- 镜像构建参数写入版本标识（如 `backend-<版本>-<短 commit>`），日志和诊断据此定位。
- 本机先做同镜像运行验证：健康探针、停止时的租约释放、SIGTERM 处理。
- staging 用 prod 将要部署的同一镜像预演上线。

## 迁移顺序（expand / contract）

1. 核对账号、环境、数据库和平台身份，以运行时 Secret 注入数据库连接、Auth/Storage 参数和版本标识。
2. 用同一镜像执行只读 migration plan，核对锁、数据规模、可逆性及旧 App 的契约。
3. 单作业执行 expand migration（只加不删）。大数据变更拆成有进度记录、可暂停、按主键分页的有界 backfill，检查失败率和锁等待后继续。
4. 兼容窗口内同时支持已分发 App 的请求和回执格式。确认旧版本退出使用后，在另一个独立发布中执行 contract。回滚镜像不能撤销已发生的数据损失。

## 回退

- 镜像回退只限兼容当前数据库 schema 的 digest。
- 迁移失败 → 先停止后续发布，核验事务和实际 schema，再选择兼容的修复镜像。
- 破坏性变更需要隔离的数据恢复流程：数据库与对象存储按同一恢复点核对，恢复前隔离入口。
- 后端回退不能替代已分发 App 的修复；移动端修复版不得降级本机数据 schema。
- iOS/Android 商店分发与后端部署分别审批。

## 可观测性

- 结构化日志不含秘密和个人数据；接入 SLS 时验证通道、告警接收和留存。
- worker 有私有心跳，便于发现停滞。
- 未验证的项（如 SLS 告警、云端容量）在文档中标为“未运行”，不写成已就绪。
