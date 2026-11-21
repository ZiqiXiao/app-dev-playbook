# 模拟器与 Metro 端口

多个工作树（含并行的 Agent 会话）同时开发和验收移动端时，iOS 模拟器和 Android 模拟器遵守同一套规范：由一个统一入口启动、复用和关闭，设备与端口按工作树租用。参考实现：`scripts/emulator.sh` → `scripts/dev/{emulator,simulator,android,leases}.py`。

## 统一入口

```bash
npm run emulator:start -- --platform ios       # 复用本工作树的设备，或租用、创建并启动下一台
npm run emulator:start                          # 同上，Android（默认平台）
npm run emulator:start -- --platform ios --device <名称或 UDID>   # 改用开发者自己的设备；Android 用 --avd
npm run emulator:status -- --platform ios      # 列出设备、租用工作树、占用空间和启动归属
npm run emulator:stop -- --platform ios        # 关闭本工作树启动的设备，数据和租约保留
npm run emulator:stop -- --platform ios --release   # 同时归还设备租约
```

- 不手写 `xcrun simctl boot/create` 或 `emulator -avd` 命令。
- 本机开发和验收默认打开窗口；`--headless` 只用于无人值守的自动化回归。
- 任务结束用 `emulator:stop` 关闭本工作树启动的实例。`stop` 只关闭启动记录中的实例；iOS 只关机，不抹除、不删除。
- 窗口使用 IDE 自带入口：iOS 用 Xcode 的设备窗口，Android 用 Android Studio 的 Running Devices 或入口打开的窗口。

## 命名

- Agent 设备名：`<Project>_Agent_<平台><系统版本>[_<序号>]`，例如 `MyApp_Agent_iOS27`、`MyApp_Agent_API37`；并行的第二台起为 `_2`、`_3`。
- 名称只表示用途和系统版本，不包含任务、功能、日期或工作树。
- 只有该前缀的设备由入口创建。Agent 不另建按任务命名的设备；其他设备归开发者，Agent 不创建、改名、修改、抹除或删除，只在显式 `--device` 时使用。
- 设备不存在时按固定配置创建一次，之后一直复用，数据保留。升级系统版本时使用新名称，旧设备由开发者确认后处理。

## 租用

- 租约表位于 `<git common dir>/<project>/leases.json`，所有工作树共用，不进 Git，读写加文件锁。
- 端口和设备按 Git 工作树租用，同一工作树的会话共享。工作树目录删除后，下次任一入口运行时回收其租约；工作树改名时租约随之转到新路径。
- **Metro 端口**：主工作区固定 iOS 8081、Android 8082。其他工作树首次使用时从一个保留区间（如 8301–8398）租一对相邻端口（iOS 奇数、Android 偶数），之后不变。开发包在打开时才指定 Metro 地址（iOS 用启动参数 `--initialUrl`，Android 用深链 `?url=`），端口不写进原生构建，所以换端口不需要重新构建。
- **设备**：每个工作树每个平台租一台。选择顺序：显式 `--device` → 本工作树已租用的 → 第一个未被其他工作树租用、且不是他人正在运行的 Agent 设备 → 新建。
- 其他工作树租用的设备、端口和会话：不启动、不安装、不打开、不关闭、不复用。
- 同平台有未登记的设备在运行（手工启动或租用前遗留）时，启动新设备需要 `--parallel`。内存紧张时先停止本工作树的设备，改为串行验收。
- 端口被其他进程占用 → 报告 PID 和所在目录后停止，不自动换端口，也不结束他人进程。

## 默认设备配置

| 平台 | 配置 |
| --- | --- |
| iOS | 当前主力机型（如 iPhone 17）+ 已安装的最新 iOS 运行时 |
| Android | 最新 API 的 Google Play arm64 镜像，1080×2400 @ 420 dpi，2 核，4 GB 内存，6 GB 数据分区，硬件渲染，快速启动 |

### Android 渲染参数（Apple Silicon）

- 新实例使用 `-gpu host -feature VulkanNativeSwapchain`：客户机用 ANGLE，经 Vulkan → MoltenVK → Metal 使用 Mac GPU，提供新 API 要求的 GLES 3.1。macOS 普通硬件渲染经 OpenGL 4.1 只能提供 GLES 3.0，`-gpu auto` 会回退为 CPU 渲染，单实例占用多个核心。
- 不使用 `-gpu swiftshader`、`-read-only` 或 `-no-snapshot`。目标 AVD 已在运行 → 复用，同一 AVD 不运行第二个实例。
- 硬件渲染崩溃或画面异常 → 改用 `--software`（CPU 渲染，刷新率限制 30 Hz）。启动结束时输出客户机 EGL 驱动和 GLES 版本，硬件模式应为 `angle` 和 3.1。
- 启动记录和模拟器日志写入 `.build/emulator/`，iOS 写入 `.build/simulator/`。

## 与开发会话的配合

- `npm run dev` 启动时打印本工作树的 Metro 端口；安装、打开、e2e 和故障验证脚本默认使用本工作树的端口，显式 `--metro-port` 优先。
- 主工作区的 8081/8082 被其他工作树占用时，用 `--emulator none` 只启动后端并告知用户。
