# 研究入口与复用边界

- Graphify: https://github.com/Graphify-Labs/graphify — 本版仅实现其常见 nodes/edges JSON 导入，不嵌入其分析引擎。
- Codebase Memory: https://github.com/DeusData/codebase-memory-mcp — 后续结构索引候选，本版没有假设其内部存储格式。
- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API — 使用固定 5.8.3 API。
- Go parser: https://pkg.go.dev/go/parser — Go 语法分析，不等于完整调用解析。
- Python ast: https://docs.python.org/3/library/ast.html — Python 结构提取。
- AppMap: https://appmap.io/docs/reference/guides/reverse-engineering.html — 请求、源码和 SQL 的体验参考。
- C4: https://c4model.com/ — 高层进程和资源展示参考。
- OpenTelemetry: https://opentelemetry.io/docs/concepts/context-propagation/ — 后续运行适配接口方向。本版的示例关联 ID 不宣称符合 OTel trace 格式。

前置 v3 产品讨论的结论已经写入 PRD 和架构；本仓库首版是局部能力实现，不把调研表中的未来能力列为已交付。
