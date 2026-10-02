# Atlas · Software Observatory

**从系统架构，到一次请求，再到具体源码与数据库行。**

这是一个可运行的 v0.1 纵向原型，不是万能代码理解器。真实示例包含 **JavaScript 页面 → Go API → Python 服务 → SQLite**；工作台将架构、启动、请求、前端、数据、机制与源码放进同一套选择上下文。

## 运行

需要 Python 3.11+、Go 1.23+、Node.js 20+。Python 运行服务仅使用标准库。TypeScript 5.8.3 是 JS/TS 分析器依赖，Web UI 本身无需打包。

```sh
npm ci --ignore-scripts
python -m observatory
```

打开终端给出的地址，默认 `http://127.0.0.1:8765`。首次运行会编译两个**本仓库内置的** Go 程序：语法分析辅助器与示例 API。不会编译或执行上传的源码。

端口冲突可用 `python -m observatory --port 8766`。仅看静态结构可用 `--no-runtime`；缺少 Node/TypeScript 或 Go 时，相应分析能力会在诊断中标为不可用，而不是伪造结果。示例数据库位于 `.atlas/session/demo.sqlite`；使用 `--data-dir` 指向新的空目录可启动干净的数据集。

## 先这样体验

1. 在**架构地图**双击 Member API，进入接口层与 Client 层；点函数后选择“源码”。
2. 在**请求实验室**选择“首次 503 → 等待 → 重试”并发送 GET。真实 Go Client 会等待 120 ms 后再次请求 Python 服务。
3. 点击底部 SQL 步骤，再点“查看行快照”。这里是该次查询实际返回的行，不是事后重新查询。
4. 在**前端观察**填写姓名和测试邮箱并提交。会实际写入隔离示例数据库；点击成员行检查实际 DOM 布局。
5. 在**数据地图**查看 members/teams、实体源码以及当前行。POST 使用相同幂等键和资料会返回原记录。
6. 导入一个小型源码目录，或 Graphify 的 `graph.json`。导入后只显示该项目的静态结构，不混用示例运行记录。

## 已有能力与边界

| 部分 | v0.1 实现 | 不能当作 |
|---|---|---|
| 结构分析 | Python AST、Go parser、固定版本 TypeScript Compiler API | 全语言/全框架精确静态分析 |
| 图谱导入 | Graphify 的 nodes + edges/links JSON | 直接读取 Codebase Memory 私有数据库 |
| 渐进披露 | 进程、示例责任层、函数与依赖；图、检查器和源码联动 | 任意项目自动恢复业务分层 |
| 真实运行 | Go/Python 两个进程，HTTP 关联 ID、尝试、等待和 SQL 结果 | 通用自动插桩、逐指令调试或完整因果追踪 |
| 数据 | SQLite 表、实体和当前行；本次结果快照、提交状态 | 任意 ORM / JOIN 的行级血缘算法 |
| 前端 | 原生 JS 示例页面、真实操作、DOM 布局采样与源码绑定 | 已完成 React Fiber/全框架适配 |
| 机制 | 五项内置示例策略及可点击源码依据 | 对上传源码自动识别所有隐藏决策 |

分组、跨进程边和机制说明均标为**结构声明**；函数来自**静态提取**；真实执行的步骤标为**运行观测**。没有接入 LLM，不需要 API key，也不会生成未经证据支持的“作者意图”。Graphify / Codebase Memory 的完整底座接入仍需后续评估，本版没有暗中宣称已集成它们的执行引擎。

## 交付一个可离线打开的预览

先保持服务运行，再执行：

```sh
python tools/export_preview.py --out dist/atlas-preview.html
```

生成的单文件 HTML 可以直接打开。它包含当时采集到的结构、源码、启动记录和两个 GET 实验。**离线版仅回放记录，不发请求、不写数据库、不执行导入分析器。**

## 测试

```sh
python -m unittest discover -s tests -v
node --check web/app.js
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
# 服务需已在 8765 运行；测试会向示例库写入一个随机测试成员
python tests/browser_smoke.py
```

隔离浏览器环境限制网络导航时，可以验证导出的 UI：

```sh
python tests/browser_smoke.py --snapshot dist/atlas-preview.html --chromium /usr/bin/chromium
```

此模式不代替真实页面的浏览器端到端测试。具体测试证据与未验证事项见 [验收说明](docs/ACCEPTANCE.md)。

## 安全与范围

这是本地开发工具，不是可以直接暴露公网的服务。默认仅绑定 loopback，写请求做来源检查，接口实验只允许固定示例端点，上传文件仅在内存中解析。输入限制为 150 个文本文件 / 5 MB，图谱限制为 3000 节点 / 12000 边。不要上传生产秘密，不要将服务用于多租户环境。浏览器依赖选择与端口暴露需使用者明确配置。

## 目录

```text
observatory/     分析适配、示例模型、进程管理与本地 HTTP API
tools/           Go/TS 编译器适配器与离线预览导出器
web/             无构建依赖的交互工作台
demo/            真实运行的多语言示例
tests/           核心、跨进程、浏览器验收测试
docs/            第一版范围、架构、验收与研究入口
```
