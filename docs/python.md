# Python 规范

适用于全仓 Python 源码、测试和质量检查配置。编辑器、提交钩子和后端检查共用根目录的 `ruff.toml`。

## 质量检查

```bash
./scripts/check-python.sh          # lint、导入排序、模块说明、Google docstring、格式
./scripts/check-python.sh --fix    # Ruff 安全修复和格式化，仍有问题时返回非零
pre-commit run --all-files
```

- 修改 Python 或质量检查配置后，结束任务前运行 `check-python.sh` 并处理失败。
- `ruff.toml` 固定 `required-version`，编辑器扩展使用同一版本。
- pre-commit 只检查暂存文件，失败阻止提交，修复后由开发者重新暂存。Ruff、依赖或钩子配置变化时执行全量检查。
- 用 `uv` 管理解释器和依赖：解释器版本写在 `.python-version`，安装到 uv 用户级目录供各工作树共用；依赖用 `uv sync --frozen` 按锁文件安装。

## 注释与 docstring

- 按 [Google Python 注释规范](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)。模块开头写明职责和使用约束；空包入口、生成的迁移和含义明确的测试模块可省略。
- 类的 docstring 说明实例的含义、职责和使用约束；需要解释的公开属性放在 `Attributes:`。对外 API、逻辑复杂或行为不直观的函数需要 docstring。
- docstring 用三双引号、以简短摘要开头；按需使用 `Args:`、`Returns:`/`Yields:`、`Raises:`。重点说明参数语义、单位、返回约定、副作用、调用者需处理的异常，以及权限、事务、并发、重试或资源生命周期约束。签名已表达的类型不重复。
- 行内注释解释原因、不变量和非直观实现，不逐行翻译代码。行为变化时同步更新。
- 含义明确的测试方法、使用 `@override` 且保持基类契约的简单覆盖可省略说明；复杂 fixture、额外副作用或外部依赖须说明。
