# weeklyTodo 技术栈参考文档

> 面向「后续开发类似技术栈应用」的参考手册：记录 weeklyTodo 的实现方式、约束与设计取舍。
> 与规则的关系：`.cursor/rules/tauri-react-stack-common.mdc`（通用可复用约束）、`.cursor/rules/weeklytodo-project.mdc`（项目专属约束）为精简可执行版；本文档为详细版，含决策依据与已知问题。
> 基线：版本 0.9.9（package.json / Cargo.toml / Cargo.lock / tauri.conf.json 四文件一致）。

---

## 1. 项目概览

本地优先的 Windows 周任务树应用：以「周」为第一层级管理任务，每周一自动建新周期，上周未完成任务树自动带入；全部历史数据保存在用户自选的本机目录（SQLite 单文件）。

- 产品特性：无限层级任务树（拖拽排序）、当前行动面板（叶子任务）、全历史查询、WebDAV 可选同步、GitHub Release 自动更新、系统托盘常驻。
- 红线：**本地优先**——不引入服务端/账号体系，同步只走 WebDAV。

## 2. 技术栈与版本

| 层 | 技术 | 版本 / 关键点 |
|---|---|---|
| 前端框架 | React + TypeScript | React 19.2.8，TS 7.0.2，strict 模式 |
| 构建 | Rsbuild + @rsbuild/plugin-react | 2.1.x；`npm run build` 输出 `dist/` |
| UI 组件库 | Ant Design | 6.5.1（`ConfigProvider` 定制 token） |
| 图标 | lucide-react | 1.25.0 |
| 状态管理 | zustand | 5.x，单 store |
| 前端测试 | vitest + @testing-library/react + jsdom | 4.x |
| 桌面壳 | Tauri 2（Rust） | edition 2021，rust-version 1.81，toolchain 锁定 1.97.1 |
| 存储 | rusqlite（bundled SQLite） | 0.40；WAL；`PRAGMA user_version` 迁移，当前 SCHEMA_VERSION=4 |
| HTTP | reqwest | 0.12；features: json / rustls-tls / stream |
| 凭据 | keyring | 3.x；windows-native（Windows Credential Manager） |
| WebDAV 测试服务器 | tiny_http | 0.12（dev-dependencies，内存式） |
| 打包 | NSIS | currentUser 安装器，Windows 10+ |
| 自动更新 | GitHub Release API | 自研语义化版本比较 |
| 依赖管理 | npm | 11.6.2（packageManager 锁定）；Node ^24（engines） |
| CI | GitHub Actions | windows-latest；`v*` tag 触发 |

## 3. 目录结构

```
weeklyTodo/
├── src/                      # 前端（React）
│   ├── api/nativeBridge.ts   # invoke 包装层 + isTauriRuntime 守卫
│   ├── shared/contracts/types.ts  # 与 Rust contracts.rs 镜像的 TS 类型
│   ├── store/appStore.ts     # zustand 单 store + 树工具函数
│   ├── utils/                # weekFormat / tree / groupColors 纯函数
│   ├── components/           # 周栏、任务树、查询、弹窗等
│   ├── features/             # settings（webdav/proxy/closeBehavior）、update
│   └── styles.css            # 全局样式（CSS 变量亮色主题）
├── src-tauri/                # Tauri 2 + Rust
│   ├── src/
│   │   ├── main.rs           # 仅调用 lib::run()
│   │   ├── lib.rs            # Builder、插件、托盘、invoke_handler 注册
│   │   ├── commands.rs       # 薄层：参数解析 → 开库 → 调领域函数
│   │   ├── contracts.rs      # serde 出入参结构体（camelCase）
│   │   ├── db.rs             # 打开库 + 迁移（schema 唯一 owner）
│   │   ├── domain.rs         # 业务逻辑（周/任务/带入/排序/审计事件）
│   │   ├── queries.rs        # 跨周查询 + 周统计
│   │   ├── storage.rs        # 数据目录解析与迁移
│   │   ├── sync.rs           # WebDAV 整库同步引擎
│   │   ├── webdav.rs         # WebDAV HTTP 客户端 + 内存测试服务器
│   │   ├── credentials.rs    # keyring 密码存取
│   │   ├── updater.rs        # 更新检查 / 下载 / 安装
│   │   └── tray.rs           # 托盘 + 关闭拦截 + 单实例唤醒
│   ├── tauri.conf.json       # 窗口、bundle、CSP（当前 null）
│   └── rust-toolchain.toml   # channel 1.97.1 + msvc target
├── .github/workflows/release.yml  # v* tag → 构建 + 发布
├── .cursor/rules/            # 本项目维护的 AI 规则
├── .cursor/skills/release-version/ # 发版流程技能
└── docs/                     # 优化计划、本参考文档、aegis 计划
```

## 4. 架构分层与数据流

### 分层

```
React UI (src/)
  │  nativeBridge.ts（invoke 包装、类型化、运行时守卫）
  ▼
Tauri IPC（#[tauri::command]，注册于 lib.rs）
  │
  ▼
commands.rs（薄层：resolve_storage → open_conn → 调用）
  │
  ▼
domain.rs / queries.rs / sync.rs / updater.rs（纯 Rust 业务函数，接收 &Connection）
  │
  ▼
db.rs（schema 与迁移唯一 owner）→ SQLite（WAL）
```

### 数据流要点

- 前端**不直接写库**；所有读写走命令。写命令返回新实体（如 `Task`），前端刷新整树。
- 命令错误统一 `Result<T, String>`，中文可读；前端 `String(error)` 展示。
- 序列化统一 `#[serde(rename_all = "camelCase")]`，TS 类型手工镜像。

## 5. 前后端契约

- Rust `contracts.rs`：`AppStatePayload`、`WeekTreePayload`、`QueryFilter`、`UpdateCheckResult`、`ProxyConfig`、`MigrateResult`、`SyncResult`、`RemoteDatabaseVersion`、`RestoreDatabaseVersionResult` 等。
- TS `shared/contracts/types.ts`：同名镜像，全部 camelCase。
- `nativeBridge.ts` 每个函数：`invokeCommand<T>(name, args)` + 关键函数带 `isTauriRuntime()` 守卫（`window.__TAURI_INTERNALS__`），浏览器环境下更新/下载相关函数返回空值或抛错，保证 `rsbuild preview` 可跑。
- 事件通道：`app-close-requested`（关闭按钮）、`update-download-progress`（下载进度）。订阅返回取消函数，用 `disposed` 标记防异步竞态。
- `__APP_VERSION__` 由 Rsbuild `define` 从 package.json 注入（`src/types/globals.d.ts` 声明），注意与 Rust 侧 `CARGO_PKG_VERSION` 是两个来源（见 §12 版本同步）。

## 6. 数据库设计

### 表结构（SCHEMA_VERSION = 4）

- `weeks(id TEXT PK, start_date, end_date, created_at, carried_from_week_id)`
- `tasks(id PK AUTOINCREMENT, week_id REFERENCES weeks ON DELETE CASCADE, parent_id REFERENCES tasks ON DELETE CASCADE, title, description, status, priority, sort_index REAL, origin_week_id, carried_from_task_id, created_at, updated_at, closed_at, execution_mode, owner_id)`
  - 索引：`(week_id, parent_id)`、`carried_from_task_id`。
- `task_events(id, week_id, task_id, event_type, payload, created_at)`：审计日志。
- `owners(id, name UNIQUE)`、`tags(id, name UNIQUE)`、`task_tags(task_id, tag_id, PK 复合)`。
- `group_colors(name PK, color, is_manual)`：根任务分组颜色映射。

### 迁移约定

- `PRAGMA user_version` 递增，每个版本一个事务；只增不改旧版本块。
- 打开库固定：`foreign_keys=ON` + `journal_mode=WAL`。
- 迁移示例：v1 建周/任务/事件；v2 加 owners/tags/task_tags/execution_mode/owner_id；v3 加 group_colors；v4 回填父任务派生优先级（数据迁移，无表结构变更）。

### 排序设计

- `sort_index REAL`：新增取 `MAX+1`；拖拽用相邻中点 `(a+b)/2`，无需重排整表；同 sort_index 时以 id 兜底。
- 前端 `sortedChildren` 与后端查询均按 `sort_index, id` 排序，两侧保持一致。

## 7. 核心业务逻辑

### 周模型

- 周 id = `YYYYMMDD-YYYYMMDD`（周一至周日），本地时区；`monday_of()` 计算周一。
- `ensure_current_week`：启动时调用，幂等；缺失则创建并从「最近一个 start_date ≤ 今天的周」带入。
- 手动建周只接受周一日期，重复周报错。

### 带入（carry_over）

- 只复制「未完成分支」：开放任务全复制；开放分支内的已关闭节点作为只读上下文保留；完全关闭的顶层分支丢弃。
- 新任务带 `carried_from_task_id`（溯源）与 `origin_week_id`（首个来源周）。
- 标签关联复制（`copy_task_tags`）；写入 `carry_over` 审计事件。
- 前端据此显示「带入」标记，查询面板可筛选「只看带入任务」。

### 状态机

- 仅 `in_progress` / `closed`。关闭任务时若某祖先的所有子任务都关闭则级联关闭祖先；重开时级联重开祖先。
- `follow_up` 执行方式必须指定负责人；`self` 可不指定。
- 优先级 clamp 到 0..3。
- **优先级联动**（v4）：父任务及其所有祖先的优先级不由手动设置，而是取「未完成直接子任务」的最高优先级（P0 最小）；子任务全关闭或删除时回落到 P2。改子任务优先级、关闭/重开、删除、移动、新建子任务都会自底向上重算整条祖先链并写入库（`recompute_ancestor_priorities`，审计为带 `autoPriority` 的 update 事件）；无子任务的任务仍可手动设置。v4 迁移会一次性回填存量数据。
- **非叶子不承载执行信息**：含子任务的任务（子任务是否已完成均算）不显示也不可编辑执行方式 / 负责人——任务树与查询面板隐藏「自己 / 跟进 / 负责人」徽章，详情面板隐藏对应编辑区且保存不提交；后端 `update_task` 对非叶子任务静默忽略 execution_mode / owner 变更（双端校验）。数据保留，任务变回叶子后恢复显示与可编辑。查询契约 `QueryTaskRow.hasChildren` 供查询面板判断。
- 树防护：不能移动到自身/子树/已关闭节点；已关闭节点不能新增子任务；前端 `computeDrop` 与后端 domain 双重校验。

### 审计事件

- create / update / close / reopen / carry_over / delete 均写 `task_events`；delete 因行先删，事件以 NULL task_id + payload（JSON）记录。

### 分组颜色

- 12 色高区分度色板，后端自动分配（第一个未用色），用户可手动换色（`is_manual=1`）与重置。
- **色板在 Rust `domain.rs` 与 TS `groupColors.ts` 各有一份，必须手动保持同步**（代码注释已互相提示）。

## 8. 存储与配置

- 配置：`%APPDATA%\weeklytodo\weeklytodo-config.json`（`data_dir` + `schema_version`）。
- 默认数据目录：exe 旁 `data/`（可写探测通过则用，便携优先）否则 `%APPDATA%\weeklytodo\data`。
- 迁移数据目录：目标必须可写且不含已有数据库（防覆盖）；源库先备份 `weeklytodo.db.pre-migration.bak`；迁移后源文件保留。
- 前端设置（localStorage key `weeklyTodo.*`）：`webdavSettings`、`proxySettings`、`closeBehavior`；统一「默认值合并 + 字段校验 + try/catch」防御性加载，保存失败静默。

## 9. WebDAV 同步设计

### 同步粒度与策略

- 文件级整库同步（整个 `weeklytodo.db`），后写覆盖：比较本地/远端 mtime（**秒级**，与 HTTP-date 精度对齐，避免毫秒偏差反复翻转）。
- 被覆盖方先备份到远端：`weeklytodo.db.YYYYMMDD-HHMMSS.bak`（UTC）。备份文件名用 `next_available_backup_filename` 探测防冲突（最多 60 秒滑动窗口）。
- 上传/下载后校准本地 mtime 与远端一致（`filetime::set_file_mtime`），防止下次误判。

### 安全防呆（数据安全优先）

- 自动同步（启动/定时）空库保护：本地缺库或无内容（tasks/owners/tags 全空）且远端存在 → 返回 `skipped`，不 PUT。
- 下载前校验内容魔数 `SQLite format 3\0` + 下载后再 `PRAGMA integrity_check`，防服务器返回 HTML 错误页。
- 原子替换：临时文件 `.synctmp` + fsync + rename；替换后清理陈旧 `-wal`/`-shm`。
- 恢复版本流程：文件名白名单校验（防路径穿越）→ 确认选中版本存在于列表 → checkpoint 本地 → 先上传本地当前库为新备份 → 下载选中版本替换。
- 同步前 `PRAGMA wal_checkpoint(TRUNCATE)` 合并 WAL，保证上传的是完整库。

### 认证与凭据

- basic auth；密码经 keyring 存 Windows Credential Manager（service=`weeklytodo`），Rust 侧读写；前端只传 url/username。
- WebDAV 目录不存在时自动 MKCOL 创建（404→MKCOL，405 视为已存在）。
- XML 解析为手写 namespace 无关解析器（无第三方 XML 依赖），PROPFIND Depth 0/1。

### 测试策略

- `tiny_http` 内存式测试服务器模拟 WebDAV：上传→noop→冲突备份→下载→空库保护→恢复顺序，均有集成测试覆盖。

## 10. 自动更新与发布

### 更新检查

- GET `https://api.github.com/repos/ws1993/weeklytodo/releases/latest`，对比 `tag_name`（剥 `v`）与 `env!("CARGO_PKG_VERSION")`。
- 自研 `compare_versions`：点分数字、缺段补 0。
- 404（无 Release）→ `available: false`；代理可配置（system / none / custom，支持 socks）。

### 下载与安装

- 安装包匹配 `-setup.exe` / `_x64-setup.exe` asset；下载到 `%TEMP%\weeklytodo_update\`。
- 进度事件 `update-download-progress`：`percent` 封顶 99，直到文件 `sync_all` 完成才结束，避免 UI 显示 100% 而文件未落盘。
- 安装：`exit_app_for_update` 退出应用 → PowerShell helper（`launch_installer.ps1`，`ShellExecuteW` 启动、脱离进程树）等待主进程退出（90s 超时）后启动 NSIS 安装器；安装包大小 <1024B 拒绝。

### 发版流程

- 五处版本号同步：package.json、package-lock.json、Cargo.toml、Cargo.lock、tauri.conf.json。
- 流程：`python .cursor/skills/release-version/scripts/bump_version.py X.Y.Z` → commit（仅版本文件）→ 注释 tag `vX.Y.Z` → push 分支 + tag。
- `.github/workflows/release.yml`：`windows-latest`、setup-node 24 + npm cache、rust-toolchain 1.97.1、`npm install`（非 npm ci）、`npm run build`、`npm run tauri:build`、`softprops/action-gh-release` 发布 NSIS 安装包。

## 11. 桌面壳

- 单实例插件：再次启动唤醒主窗口（`show_main_window`）。
- 关闭拦截：`intercept_close_request` 中 `prevent_close()` + emit `app-close-requested`，前端按设置询问 / 最小化托盘 / 退出。
- 托盘：左键 toggle 窗口，右键菜单「显示主界面 / 退出」。
- `#[cfg(desktop)]` 段设置窗口图标；`#[cfg(not(debug_assertions))] windows_subsystem = "windows"` 隐藏控制台。

## 12. 版本同步与已知坑

- 版本来源有两个：前端 `__APP_VERSION__`（package.json，Rsbuild define 注入）与更新检查 `CARGO_PKG_VERSION`（Cargo.toml）。历史上曾出现 package.json 0.9.8 vs Cargo 0.9.9 漂移（见 `docs/optimization-plan.md` R1），现基线已统一为 0.9.9。

## 13. 测试与质量门槛

```bash
npm run lint           # tsc --noEmit（strict）
npm test               # vitest（node 环境；组件测试文件头 @vitest-environment jsdom）
npm run build          # Rsbuild 生产构建
cd src-tauri && cargo test
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo fmt --check
```

- Rust 测试用 `db::open_in_memory()`（跑全部迁移）；覆盖周计算、带入、关闭级联、查询过滤、存储迁移、同步方向决策、WebDAV 集成（tiny_http）等。
- 前端：纯函数/store 测试 mock `nativeBridge`（`vi.mock` + `vi.hoisted`）；组件测试用 jsdom。

## 14. 已知问题 / 待改进

> 以下为「现状但非规范」或「明确缺陷」，开发时避免照抄；完整优化清单见 `docs/optimization-plan.md`。

| 编号 | 问题 | 现状 | 备注 |
|---|---|---|---|
| S1 | CSP 未配置 | `tauri.conf.json` 中 `"csp": null` | 官方推荐显式 CSP；当前不加载远程内容，风险低 |
| I1 | `Ctrl K` 提示无实现 | `WeekRail` 渲染 `<kbd>Ctrl K</kbd>`，全库无监听 | 实现全局快捷键或移除提示 |
| F7 | README 与实现不符 | README 声称「首次运行选择数据目录」，实际自动选择 | 首启无引导页 |
| F2 | 无导出/手动备份出口 | 仅 WebDAV 同步与迁移时 `.pre-migration.bak` | 本地优先的底线缺口 |
| F1 | 任务无取消/归档状态 | 仅 in_progress/closed；未完成任务无条件带入 | 无法表达「本周不再做」 |
| I3 | 删除无撤销 | `delete_task` 级联删除整棵子树，仅 4 秒二次确认 | 误删不可恢复 |
| U1 | 无深色模式 | `ConfigProvider` 固定 `defaultAlgorithm`，`:root` 亮色变量 | |
| I2 | 无键盘导航体系 | 除新建/查询输入框外无快捷键 | |
| F6 | 无统计/复盘视图 | 仅顶部周进度条 + 查询面板周完成数 | |
| R1 | 版本来源双轨 | 前端显示 package.json，更新检查用 Cargo.toml | 已有历史漂移，靠 release-version 流程兜底 |
| - | 无 `.nvmrc` | `npm-lockfile-ci.mdc` 规则提到三处对齐，仓库实际只有 engines/packageManager 与 setup-node | 建议补 `.nvmrc` 对齐本地开发 |
| F9 | 描述纯文本 | 无 Markdown/链接渲染 | 引入渲染需注意 CSP/注入 |
| F4 | 任务无计划日期 | 无「哪天做什么」字段 | 影响「当前行动」分组 |

## 15. 关键设计决策记录

- **整库文件同步而非增量**：简单可靠，代价是冲突合并缺失（后写覆盖 + 远端备份兜底），适合单人低频使用。
- **mtime 秒级比较**：HTTP-date 只有秒精度，统一粒度避免毫秒偏差导致反复翻转；上传/下载后回写本地 mtime 对齐。
- **`npm install` 而非 `npm ci`**：Windows 上 npm 重写 lockfile 会剪掉跨平台 optional 依赖（如 @emnapi/*），`npm ci` 严格校验会 EUSAGE 失败；CI 用 `npm install` 自动补齐，产物等价。详见 `.cursor/rules/npm-lockfile-ci.mdc`。
- **手写 WebDAV XML 解析**：避免引入 XML 依赖，用 namespace 无关的标签扫描，代价是解析鲁棒性需测试覆盖（已有测试）。
- **`sort_index REAL` 中点排序**：拖拽 O(1) 重排，避免整表 index 重写。
- **审计事件表**：为将来统计/复盘/撤销留溯源基础。
- **`#[serde(rename_all = "camelCase")]` + 手写 TS 镜像**：无代码生成，契约显式、可读，代价是两侧同步靠纪律（rules 已约束）。

## 16. 参考资料

- 优化方向清单：`docs/optimization-plan.md`
- WebDAV 安全恢复设计：`docs/aegis/plans/2026-08-04-webdav-safe-restore.md`
- 通用技术栈规则：`.cursor/rules/tauri-react-stack-common.mdc`
- 项目专属规则：`.cursor/rules/weeklytodo-project.mdc`
- npm lockfile / CI 规则：`.cursor/rules/npm-lockfile-ci.mdc`
- 发版流程：`.cursor/skills/release-version/SKILL.md`
