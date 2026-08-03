# 周计划（weeklytodo）

本地优先的 Windows 周任务树应用。以「周」为第一层级管理任务：每周一为新的周期，上周未完成的任务树自动带入本周，全部历史数据保存在你选择的本机目录（SQLite）。

## 核心概念

- **周为第一层级**：每周标识形如 `20260803-20260809`（周一至周日）。
- **自动建周**：每次启动检查是否需要创建当前周；如果几周未打开，从最近存储的一周带入未完成工作，避免数据丢失。
- **带入未完成分支**：未完成的任务树整体复制到新周（父-子结构保持不变）；分支内已完成节点作为只读上下文保留；完全完成的分支不带入。
- **手动创建**：可手动为指定周一创建新周，重复周会被拒绝。
- **数据查询**：左侧只展示最近 4 周；「查询全部」面板可按周范围、关键词、状态、是否带入筛选所有历史周的任务，点击结果可直接定位到对应周。
- **默认数据目录**：首次运行选择数据目录，之后可在设置中迁移（迁移前自动备份，原文件保留）。

## 技术栈

- 前端：React 19 + TypeScript + Rsbuild + Ant Design（参考 PrintAssist 技术栈）
- 桌面壳：Tauri 2（Rust），SQLite（rusqlite + bundled SQLite）
- 打包：NSIS 当前用户安装器
- 自动更新：GitHub Release（语义化版本比较），下载后等待应用退出再启动安装器

## 开发

```bash
npm install
npm run tauri:dev
```

## 测试

```bash
npm run lint          # 前端类型检查
npm test              # 前端测试（如已添加）
cd src-tauri && cargo test   # Rust 单元测试（周计算、带入、迁移等）
```

## 打包与发布

```bash
npm run tauri:build   # 生成 NSIS 安装器
```

打 `v*` 标签推送到 GitHub 后，[release.yml](.github/workflows/release.yml) 会自动构建并把安装器发布到 GitHub Release；应用内「检查更新」会从最新 Release 获取安装包。

## UI 原型

`prototypes/` 下有三套可点击的高保真 HTML 原型（设计方向 A/B/C），可直接在浏览器打开对比。
