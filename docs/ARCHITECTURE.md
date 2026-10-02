# Architecture / v0.1

## 组件

工作台服务采用 Python 标准库 HTTPServer。前端是原生 ES 模块与 SVG/DOM，避免为评审样机引入打包和大量运行依赖。TS Compiler API 是分析器依赖，不是 UI 框架。

上传文本 → Python AST / Go parser / TS Compiler API → 统一结构 JSON → 渐进层级投影 → 图和源码检查器。

可信示例：JS 页面 → 工作台固定端点代理 → Go gateway → Python MemberStore → SQLite。进程由 Runtime 显式启动和终止；上传项目从不进入这条执行路径。

## 证据模型

Node 有 id、label、kind、parent、language、summary、source、evidence；Edge 保留 source、target、relation、evidence。分类为 extracted、declared、inferred、imported、observed、unresolved。

Run 与静态图分开。每个请求拥有关联 ID、状态、响应快照和边界事件；事件保留服务、符号、状态、源码及实际测量耗时。返回的平铺事件用于语义回放，不声称它是分布式精确全序或完整执行树。播放的 800 ms UI 步长不是运行耗时。

Read 事件保存本次 SQL、结果行和示例字段映射；写入事件在 commit 后才标 committed。数据库浏览器读取当前数据，明确区别于旧 Read 事件。示例的 fields→table 映射不是通用自动血缘。

## 分析边界

Python 使用 ast，只解析源码。直接名称调用仅做有限词法解析，动态/成员调用保留未解析；不具有完整别名、描述符和全程序分析。

Go helper 使用 go/parser 和 go/ast，分析上传 JSON 内文本。仅同文件直接名称调用建立推断边；不进行 go/types 或依赖构建，不强行解析 selector/接口动态派发。

JS/TS helper 使用锁定的 TypeScript 5.8.3 与只读取上传虚拟文件的 CompilerHost。借助签名绑定跨文件调用；未加载项目 tsconfig、外部库类型和框架。没有 TypeScript 时保留文件层及诊断。

Graphify JSON 导入保留有向关系和置信标签。导入不执行网络下载、不读取 source_file 指定的本地文件，不继承示例运行能力。限制大小，拒绝悬空边、重复 ID 与 parent 循环。

## 后续扩展接口

替换结构索引源时以节点、边和来源适配，不绑定供应商内部数据库。Graphify 与 Codebase Memory 是候选；运行适配器可另行导入 OTel/DAP；框架语义和策略识别独立于基础语法；数据库模式、实体映射与实际行观察分别扩展。

## 已记录的技术取舍

- v0.1 用 stdlib + 单机 SQLite + 原生 JS，减少安装门槛；并非否定后续 React UI。
- 使用真实两进程 HTTP 示例，优于内存假 trace；示例显式采集不冒充通用自动插桩。
- 示例如实暴露没有 jitter、没有全局总 deadline、幂等键没有 TTL 等缺口。机制存在不等于生产策略完整。
- 只接受固定 demo 请求，不将请求编辑器变成任意 URL 代理。
- 保持 main 初始化稳定；通过功能分支 PR 评审，不自动合并。
