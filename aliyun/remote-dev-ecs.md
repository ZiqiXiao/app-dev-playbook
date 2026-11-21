# 阿里云 ECS 远程开发机

开发代号 `cloud`：把后端 API 和 worker 放到一台按量付费的 ECS 上运行，Metro、模拟器和代码编辑仍在本机。ECS 与云端开发数据库位于同一地域和 VPC，数据库往返从跨公网缩短为内网（实测单次 `SELECT 1` 中位数从约 15ms 降到 0.2ms，建连从 160ms 降到 34ms）。本机改动由 Mutagen 实时同步，不打包镜像。实例空闲后以节省停机模式自动停止，停止期间不收计算和公网 IP 费用。

## 工作方式

```text
本机                                          ECS（与数据库同 VPC）
编辑器 / Agent ── Mutagen 单向同步 ──────▶ ~/<project>/<工作树>
Process Compose                               uv sync、migrate --check
  api    ── SSH（转发 127.0.0.1:<端口>）──▶ runner → devserver ──内网──▶ 数据库
  worker ── SSH ──────────────────────────▶ runner → worker
  metro（本机）
模拟器 → 127.0.0.1:<端口>
```

- **启停**：会话启动时实例已停止 → 调 `StartInstance` 并等待运行和公网 IP。`remote:down` 和空闲停机都用 `StopCharging`（节省停机）。在系统内 `shutdown` 不会进入节省停机，规格照常计费。
- **SSH**：节省停机会释放公网 IP，每次地址不同。`up` 在 Git 公共目录生成 `ssh`/`scp` 包装脚本，把别名 `<project>-remote` 指向当前地址；主机密钥按实例 ID 记录在专用 `known_hosts`，首次 accept-new，之后换 IP 仍校验同一密钥。
- **同步**：每个工作树一个 Mutagen 会话，单向同步到 `~/<project>/<工作树>`，远端多出的文件被删除。忽略 `.git`、`.build/`、虚拟环境、`mobile/`、`node_modules/`、缓存，以及全部 `.env*` 和 `.envrc`：真实 env 文件不离开本机。会话名带“同步设置摘要”，忽略规则变化时自动重建会话。Mutagen 使用仓库专用守护进程（`MUTAGEN_DATA_DIRECTORY` 指向 Git 公共目录下），不影响本机其他会话。
- **运行**：Process Compose 按 `remote-prepare`（`uv sync --frozen`）→ `migrate-check` → `api`、`worker` 启动，每个组件一条 SSH 连接，日志写本机 `.build/logs/`。远端 runner 在 SSH 关闭时（stdin 结束）停止进程组，不留孤儿进程。`api` 连接同时把远端回环端口转发到本机同一端口，模拟器访问地址与本机模式相同。
- **热重载**：远端 runner 轮询源码目录，变化稳定 0.3 秒后重启整个进程组；进程自行退出（如导入错误）→ 记录退出码，等下一次改动。
- **配置**：远端进程仍通过 `env-run --infisical` 读取 Development。会话令牌经 SSH `SendEnv` 传入（sshd `AcceptEnv`），只存在于远端进程内存，不落盘、不出现在命令行参数中。这台 ECS 只供开发者本人使用。
- **空闲停机**：实例每分钟检查一次。存在 runner 进程、有带终端的登录、或存在 `/run/<project>-remote/hold` 算作活动。连续 `idleMinutes` 无活动 → 通过实例 RAM 角色以 `StopCharging` 停止自身。Mutagen 和 VS Code Remote-SSH 等无终端连接不算活动。

## 首次准备

### 控制台配置（由开发者完成）

| 项目 | 要求 |
| --- | --- |
| 实例 | 按量付费；地域和 VPC 与数据库相同；x86 2 vCPU / 4 GiB。不选 t 系列突发性能实例（积分在停机时一次性收费）和带本地盘的规格（不支持节省停机）。抢占式更便宜但可能被回收 |
| 镜像 | Ubuntu 24.04+ 64 位（初始化脚本只支持 apt） |
| 系统盘 | ESSD Entry 或 PL0，40 GiB |
| 公网 | 分配公网 IPv4，按流量计费。EIP 可固定地址，但停机期间继续计费 |
| 安全组 | 入方向放行 `sshPort`（如 443），来源为本机出口 IP/32；TCP 22 保留给 Workbench，来源可收窄到 `100.104.0.0/16` |
| 登录 | `ecs-user`（免密 sudo，阿里云 Ubuntu 镜像默认满足）。不必绑定密钥对，初始化脚本会授权本机公钥 |
| 数据库白名单 | 加入实例私网 IP 或交换机网段（节省停机后私网 IP 不变）。未加入时 5432 和 443 均超时 |

实例 RAM 角色（可信实体为 ECS），挂载到实例，供空闲自停：

```json
{"Version":"1","Statement":[{"Effect":"Allow","Action":"ecs:StopInstance","Resource":"acs:ecs:<地域ID>:<主账号ID>:instance/<实例ID>"}]}
```

本机 RAM 用户（`aliyun` CLI 和 Workbench CLI 共用）：

```json
{"Version":"1","Statement":[{"Effect":"Allow","Action":["ecs:StartInstance","ecs:StopInstance"],"Resource":"acs:ecs:<地域ID>:<主账号ID>:instance/<实例ID>"},{"Effect":"Allow","Action":"ecs:DescribeInstances","Resource":"*"},{"Effect":"Allow","Action":"ecs-workbench:*","Resource":"*"}]}
```

`ecs-workbench:*` 供 Workbench CLI 免密登录实例；其登录类操作尚未逐项公开，官方要求保留通配符。

### 本机工具

```bash
brew install mutagen-io/mutagen/mutagen aliyun-cli
aliyun configure --profile <project>-dev
curl -fsSL https://workbench-cli.oss-cn-hangzhou.aliyuncs.com/install.sh | bash
```

Workbench CLI 复用 `aliyun` profile，不另存 AccessKey。不要在 Agent 会话中运行交互式 `workbench config`，直接写配置文件（CLI 要求权限 0600）：

```bash
mkdir -p ~/.workbench
cat > ~/.workbench/config.json <<'EOF'
{"current":"default","profiles":{"default":{"mode":"AliyunCLI","aliyun_profile":"<project>-dev"}}}
EOF
chmod 600 ~/.workbench/config.json
workbench list ecs --region <地域ID>
workbench exec -i <实例ID> -u ecs-user -c 'sudo -n true && echo sudo-ok'
```

Workbench 要点：每次 `exec` 是独立的 `/bin/sh`（Ubuntu 上为 dash），`cd`/`export` 不跨调用保留，需要 bash 语法时 `bash -c` 包一层；默认超时 30 秒；`upload`/`download` 单文件；不提供字节流通道和端口转发，不能替代 SSH 承载同步和 API 转发。

### 绑定文件

工程根目录已忽略的 `.remote-dev.json`，只含实例标识，不含凭据，列入 `.worktreeinclude` 供新工作树复制：

```json
{
  "regionId": "cn-hangzhou",
  "instanceId": "i-REPLACE_ME",
  "sshUser": "ecs-user",
  "sshPort": 443,
  "sshPublicKey": "~/.ssh/id_ed25519.pub",
  "aliyunProfile": "<project>-dev",
  "ramRoleName": "<实例 RAM 角色>",
  "idleMinutes": 30,
  "hostAliases": {
    "<公网主机名>": "<VPC 内网主机名>"
  }
}
```

`hostAliases` 让连接串原样走内网：实例在 `/etc/hosts` 中把公网主机名解析为内网主机名的当前地址，连接仍以公网主机名发起，`sslmode=verify-full` 按该名称校验证书。前提是两个地址端口相同；启用前在实例上确认内网地址的 5432 和 443 都可用。

### 初始化实例（需授权）

```bash
./scripts/remote-dev.sh bootstrap
```

1. 实例停止时启动并等待运行。
2. 经 Workbench 上传初始化脚本到 `/tmp/<project>-bootstrap-<随机串>.sh`，以 `sudo -n` 执行（超时 20 分钟），结束后删除并输出日志。
3. 生成 SSH 包装脚本，等待 `sshPort` 可登录。

脚本可重复执行，结果相同，安装：本机公钥加入 `authorized_keys`；与本机同版本的 uv、密钥管理 CLI 和项目固定的 Python；阿里云 CLI 及 `EcsRamRole` profile；sshd 同时监听 22 和 `sshPort`、`AcceptEnv` 令牌变量、`ClientAliveInterval 30`；空闲检查 timer 和 hosts 别名服务；内网 PyPI 镜像解析。修改 `sshPort`、`idleMinutes`、`hostAliases`、`ramRoleName` 后重新执行。

## 日常使用

| 命令 | 用途 |
| --- | --- |
| `npm run dev:cloud` | 启动或复用实例，同步当前工作树，启动远端 API、worker 和本机 Metro |
| `npm run dev:stop` | 停止会话；实例空闲期满后自动停止 |
| `npm run remote:status` | 实例状态、地址和同步状态 |
| `npm run remote:ssh` | 在远端工作树副本中打开终端（计为活动） |
| `npm run remote:down` | 暂停同步并立即节省停机（影响所有工作树，用户要求时才运行） |

- 临时阻止空闲停机：在实例上 `sudo touch /run/<project>-remote/hold`，完成后删除。
- 锁文件、Python 版本、配置加载脚本或密钥管理中的值变化 → `npm run dev:cloud -- --force-restart`。
- 多个工作树共用一台实例，各自使用独立远端目录、同步会话和随机 API 端口。

## 费用与限制

- 运行期间收规格、系统盘和公网流量费；节省停机期间只收系统盘、快照和已绑定 EIP 的费用。
- 节省停机后启动不保证成功（可用区库存不足返回 `NoStock`）。
- 抢占式实例被释放会丢失系统盘上的工作区和工具，需重建并 bootstrap；代码以本机为准。
- 每次 API 请求仍有一次跨公网 SSH 往返；节省的是请求内的多次数据库往返和 Auth 校验。

## 排障

| 现象 | 处理 |
| --- | --- |
| `.remote-dev.json is missing` | 按[绑定文件](#绑定文件)创建 |
| `aliyun ... failed` | 核对 profile、RAM 权限和地域；`NoStock` 需等待或更换规格 |
| `SSH login failed`，直连也超时 | `nc -vz -b en0 -G 8 <IP> 22` 绕过 TUN 测试；`github.com:22` 也超时 → 网络封锁出站 22，改 `sshPort` 为 443、放行安全组、重新 bootstrap（经 Workbench，不需要 SSH） |
| `kex_exchange_identification: Connection closed` | 本机 TUN 代理接管了连接（`route -n get <IP>` 显示 `utun`）：在代理中按端口设置直连，安全组来源用直连出口 IP |
| SSH 不可用但要排查 | `workbench exec -i <实例ID> -u ecs-user -c 'sudo journalctl -u ssh --since "30 min ago" --no-pager \| tail -30'` |
| Workbench `NoPermission` | 核对 `~/.workbench/config.json` 的 profile 及 `ecs-workbench:*`、`ecs:DescribeInstances` 权限 |
| 迁移检查 `connection timeout expired` | 数据库白名单未加入实例私网 IP |
| 迁移检查提示缺少认证 | 令牌未传到远端：重新 bootstrap 写入 `AcceptEnv`，确认本机登录有效 |
| 依赖下载缓慢 | 确认锁文件地址为 `mirrors.aliyun.com`，实例上 `getent hosts mirrors.aliyun.com` 返回 `100.100.x.x` |
| 实例不自动停止 | `systemctl status <project>-remote-idle.timer`；检查终端登录或 `hold` 文件 |
| 实例很快被停止 | 空闲计时从启动开始；`up` 后未启动会话也无终端登录时到期即停 |

## 测试

启停调用、SSH 包装、同步参数、runner 重启与退出在 tooling 测试中用替身验证；初始化脚本用 `bash -n` 和 `shellcheck`；端到端在真实实例上记录启动到 API 就绪耗时、热重载耗时和停止后无残留进程。
