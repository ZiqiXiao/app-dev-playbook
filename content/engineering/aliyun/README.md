# 阿里云开发范式

适用于部署在阿里云、团队在国内网络环境开发的项目。

## 总体架构

| 环境 | 后端 | 数据库与平台 | 配置来源 |
| --- | --- | --- | --- |
| `local` | 本机 | 本机 Docker 参考栈（与云端同版本镜像，固定 digest） | 已忽略的 `.env.*`，仅合成数据 |
| `cloud` | 按量 ECS 远程开发机，见 [remote-dev-ecs.md](remote-dev-ecs.md) | 阿里云开发实例（如 ADB PostgreSQL 版 Supabase），VPC 内网访问，见 [supabase.md](supabase.md) | 密钥管理服务的 Development 环境 |
| staging / prod | SAE（容器），同一镜像 digest | 独立实例 | 运行平台 Secret 注入，见 [prod-release.md](prod-release.md) |

- 本机参考栈与云端实例的能力分别验证，不假定云端具备本机栈的能力（如 Branch API、自动建分支）。
- 业务迁移只有一条链（由后端框架管理），云端目录不另建迁移链。

## 授权约定（写进 AGENTS.md）

- 未经明确授权，Agent 不通过浏览器打开、查看或操作阿里云控制台，包括只读查看。授权须写明控制台范围和目的。
- 提供凭据、授权 CLI/API 检查、要求继续开发或告知配置完成，都不等于授权控制台操作。需要控制台配置时，Agent 列出项目、字段和步骤，由用户自行完成。
- 创建云资源、修改云端配置、初始化实例、部署、生产迁移分别需要授权；为开发会话启停已绑定的开发机属于 `cloud` 代号的默认授权。
- 本机 `aliyun` CLI 使用专用 profile（如 `<project>-dev`），凭据在 `~/.aliyun/config.json`，不进仓库。RAM 用户只授予所需操作，资源限定到具体实例。

## 国内网络要点

- Python 依赖默认索引设为阿里云 PyPI 镜像 `https://mirrors.aliyun.com/pypi/simple`，锁文件记录的地址都在镜像上；ECS 上把 `mirrors.aliyun.com` 解析到 VPC 内网镜像，`uv sync --frozen` 走内网。切换索引时比较锁定版本和文件哈希保持不变。
- 部分网络封锁出站 SSH 22 端口：sshd 同时监听 22 和 443，安全组放行 443。
- 本机 TUN 代理可能接管到实例的 SSH 连接（出现 `kex_exchange_identification: Connection closed`）：在代理中按端口设置直连。
- Workbench CLI 经 HTTPS 登录实例，不依赖 SSH，可作为初始化和排障通道。

## 文档

- [remote-dev-ecs.md](remote-dev-ecs.md)：按量 ECS 远程开发机
- [supabase.md](supabase.md)：阿里云 Supabase 连接、只读检查、云端集成测试
- [prod-release.md](prod-release.md)：SAE 部署、Secret 注入、迁移与回退
