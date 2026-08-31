import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import { useAppStore } from './store/appStore';
import { WeekRail } from './components/WeekRail';
import { TaskTree } from './components/TaskTree';
import { KanbanView } from './components/KanbanView';
import { CurrentActions } from './components/CurrentActions';
import { FocusBanner } from './components/FocusBanner';
import { CommandPalette } from './components/CommandPalette';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { QueryView } from './components/QueryView';
import { StatisticsView } from './components/StatisticsView';
import { ToggleSwitch } from './components/QueryControls';
import { CreateWeekModal } from './components/CreateWeekModal';
import { UpdateModal } from './features/update/UpdateModal';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { CloseBehaviorModal } from './components/CloseBehaviorModal';
import { ShareModal } from './features/share/ShareModal';
import {
  checkForAppUpdate,
  exitApp,
  hideMainWindow,
  onCloseRequested,
  syncWebDavAutomatically,
} from './api/nativeBridge';
import {
  ChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  KanbanIcon,
  LogoIcon,
  NetworkIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
} from './components/ForestIcons';
import { descendantIds, incompleteOnlyVisibleIds } from './utils/tree';
import {
  isSyncDue,
  loadWebDavSettings,
  saveWebDavSettings,
  type WebDavSettings,
} from './features/settings/webdavSettings';
import { getSavedProxyConfig } from './features/settings/proxySettings';
import { loadCloseBehaviorSettings } from './features/settings/closeBehavior';
import { getAntdThemeConfig } from './utils/theme';
import type { Task, UpdateCheckResult } from './shared/contracts/types';
import {
  currentWeekId as currentWeekIdOf,
  formatCnRange,
  todayLabel,
  weekStatus,
} from './utils/weekFormat';

/** 防止启动同步与定时同步同时触发。 */
let webdavSyncInFlight = false;

const antdThemeConfig = getAntdThemeConfig('light');

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const tree = useAppStore((state) => state.tree);
  const allWeeks = useAppStore((state) => state.allWeeks);
  const groupColors = useAppStore((state) => state.groupColors);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const selectWeek = useAppStore((state) => state.selectWeek);

  // 视图模式：任务树 (tree) / 看板 (kanban)
  const [viewMode, setViewMode] = useState<'tree' | 'kanban'>('tree');
  // 栏目折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // 弹窗与抽屉状态
  const [queryOpen, setQueryOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeAskOpen, setCloseAskOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [preloadedUpdate, setPreloadedUpdate] = useState<UpdateCheckResult | null>(null);

  // 专注模式
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  // 详情抽屉（用于看板或全局指令调起）
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);

  // 每次点击「新建任务」递增，通知任务树打开根级新建输入行。
  const [newTaskRequest, setNewTaskRequest] = useState(0);
  // 右侧「当前行动」点击某行动时，在任务树中定位并高亮。
  const [locateRequest, setLocateRequest] = useState<{ taskId: number; nonce: number } | null>(
    null,
  );
  // 勾选后任务树仅显示未完成的任务（当前会话内有效）。
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  // 分享多选模式：进入后行首显示复选框，可选择多个任务一起生成分享图。
  const [shareMode, setShareMode] = useState(false);
  const [shareSelectedIds, setShareSelectedIds] = useState<Set<number>>(() => new Set());
  const [shareOpen, setShareOpen] = useState(false);

  // 全局快捷键监听 (Ctrl+K, Alt+[, Alt+])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 点击关闭按钮（×）时，按设置处理：询问 / 最小化到托盘 / 退出。
  useEffect(() => {
    return onCloseRequested(() => {
      const { behavior } = loadCloseBehaviorSettings();
      if (behavior === 'minimize-to-tray') {
        void hideMainWindow();
        return;
      }
      if (behavior === 'exit') {
        void exitApp();
        return;
      }
      setCloseAskOpen(true);
    });
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // 启动后静默检查更新：发现新版本时自动弹出更新提示。
  useEffect(() => {
    if (loading) {
      return;
    }
    let cancelled = false;
    void checkForAppUpdate(getSavedProxyConfig())
      .then((result) => {
        if (cancelled || !result.available || !result.version || !result.downloadUrl) {
          return;
        }
        setPreloadedUpdate(result);
        setUpdateOpen(true);
      })
      .catch(() => {
        // 启动静默检查失败时保持静默，不打断用户。
      });
    return () => {
      cancelled = true;
    };
  }, [loading]);

  // 启动时同步一次，并按小时间隔轮询定时同步。
  useEffect(() => {
    if (loading) {
      return;
    }
    const startup = loadWebDavSettings();
    if (
      startup.syncOnStartup &&
      !startup.autoSyncPausedAfterRestore &&
      startup.url &&
      startup.username
    ) {
      void runWebDavSync(startup);
    }
    const tick = window.setInterval(() => {
      const current = loadWebDavSettings();
      if (isSyncDue(current, new Date(), 60_000)) {
        void runWebDavSync(current);
      }
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [loading]);

  const runWebDavSync = async (settings: WebDavSettings) => {
    if (webdavSyncInFlight || !settings.url || !settings.username) {
      return;
    }
    webdavSyncInFlight = true;
    try {
      const result = await syncWebDavAutomatically(
        settings.url,
        settings.username,
        settings.backupRetention,
        settings.localBaselineMtime,
        settings.remoteBaselineMtime,
      );
      const nextSettings = {
        ...loadWebDavSettings(),
        lastSyncedAt: result.direction === 'skipped' ? settings.lastSyncedAt : new Date().toISOString(),
        lastSyncStatus: `${result.direction === 'skipped' ? '已跳过自动同步' : `同步完成（${result.direction}）`}${
          result.backupFiles.length > 0 ? `，备份 ${result.backupFiles.length} 个` : ''
        }${result.direction === 'skipped' ? `：${result.message}` : ''}`,
        localBaselineMtime: result.localBaselineMtime ?? settings.localBaselineMtime,
        remoteBaselineMtime: result.remoteBaselineMtime ?? settings.remoteBaselineMtime,
      };
      saveWebDavSettings(nextSettings);
      // 远端较新并已覆盖本地时，刷新当前界面数据。
      if (result.direction === 'download') {
        await initialize();
      }
    } catch (syncError) {
      const current = loadWebDavSettings();
      saveWebDavSettings({ ...current, lastSyncStatus: `同步失败：${String(syncError)}` });
    } finally {
      webdavSyncInFlight = false;
    }
  };

  const startShare = () => {
    setShareSelectedIds(new Set());
    setShareMode(true);
  };

  const exitShare = () => {
    setShareMode(false);
    setShareSelectedIds(new Set());
    setShareOpen(false);
  };

  const toggleShareSelect = (taskId: number) => {
    if (!tree) {
      return;
    }
    setShareSelectedIds((prev) => {
      const next = new Set(prev);
      const task = tree.tasks.find((item) => item.id === taskId);
      if (!task) {
        return next;
      }
      if (next.has(taskId)) {
        // 取消：连同该任务下已选的子树一起取消。
        next.delete(taskId);
        for (const id of descendantIds(tree.tasks, taskId)) {
          next.delete(id);
        }
      } else {
        // 选中：父任务自动带未关闭子树，视觉与分享图内容一致。
        next.add(taskId);
        if (task.status === 'in_progress') {
          const addOpenSubtree = (parentId: number) => {
            for (const child of tree.tasks) {
              if (child.parentId === parentId && child.status === 'in_progress') {
                next.add(child.id);
                addOpenSubtree(child.id);
              }
            }
          };
          addOpenSubtree(taskId);
        }
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    if (!tree) {
      return;
    }
    const visibleIds = showIncompleteOnly
      ? incompleteOnlyVisibleIds(tree.tasks)
      : new Set(tree.tasks.map((task) => task.id));
    setShareSelectedIds(visibleIds);
  };

  // 周步进器计算
  const sortedWeeks = useMemo(() => {
    return [...allWeeks].sort((a, b) => b.id.localeCompare(a.id));
  }, [allWeeks]);

  const currentWeekIndex = sortedWeeks.findIndex((w) => w.id === activeWeekId);
  const canGoPrev = currentWeekIndex < sortedWeeks.length - 1;
  const canGoNext = currentWeekIndex > 0;

  const handlePrevWeek = () => {
    if (canGoPrev) {
      void selectWeek(sortedWeeks[currentWeekIndex + 1].id);
    }
  };

  const handleNextWeek = () => {
    if (canGoNext) {
      void selectWeek(sortedWeeks[currentWeekIndex - 1].id);
    }
  };

  if (loading) {
    return <div className="loading-state">正在初始化数据…</div>;
  }

  const carriedCount = tree?.tasks.filter((task) => task.carriedFromTaskId != null).length ?? 0;
  const activeWeekStatus = weekStatus(activeWeekId);
  const currentWeek = currentWeekIdOf();
  const totalTasks = tree?.tasks.length ?? 0;
  const doneTasks = tree?.tasks.filter((task) => task.status === 'closed').length ?? 0;
  const openTasks = totalTasks - doneTasks;
  const doneRatio = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // 环形进度条参数: 2 * PI * 18 = 113.1
  const dialCircumference = 113.1;
  const dialOffset = dialCircumference * (1 - doneRatio / 100);

  const shellLayoutClass = [
    'app-shell',
    sidebarCollapsed && panelCollapsed
      ? 'both-collapsed'
      : sidebarCollapsed
        ? 'sidebar-collapsed'
        : panelCollapsed
          ? 'panel-collapsed'
          : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <div className={shellLayoutClass}>
        {/* ==================== 顶栏 Header (Scheme A: 全局系统栏) ==================== */}
        <header className="topbar">
          <div className="topbar-brand">
            <button
              type="button"
              className="btn btn-ghost btn-sm icon-btn"
              title={sidebarCollapsed ? '展开周列表' : '收起周列表'}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <PanelLeftIcon size={16} />
            </button>
            <span className="brand-glyph" onClick={() => void selectWeek(currentWeek)} title="回到本周">
              <LogoIcon size={22} />
            </span>
            <div className="topbar-title-group">
              <span className="topbar-title">周计划</span>
            </div>
          </div>

          <div className="topbar-center">
            {/* Global Search Trigger (Ctrl+K) */}
            <div
              className="topbar-search-trigger"
              onClick={() => setCommandPaletteOpen(true)}
              title="全局搜索任务与快捷指令 (Ctrl+K)"
            >
              <SearchIcon size={13} />
              <span>搜索所有任务或输入快捷指令...</span>
              <span className="search-kbd-hint">Ctrl K</span>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="today">{todayLabel()}</span>
            <span className="today-sep" />

            {/* Stats */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="统计 / 复盘"
              onClick={() => setStatsOpen(true)}
            >
              <ChartIcon size={15} />
              统计
            </button>

            {/* Settings */}
            <button
              type="button"
              className="btn btn-ghost btn-sm icon-btn"
              title="偏好设置"
              aria-label="打开设置"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon size={16} />
            </button>

            {/* Version */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPreloadedUpdate(null);
                setUpdateOpen(true);
              }}
            >
              v{__APP_VERSION__}
            </button>

            {/* Panel Collapse Toggle */}
            <button
              type="button"
              className="btn btn-ghost btn-sm icon-btn"
              title={panelCollapsed ? '展开行动面板' : '收起行动面板'}
              onClick={() => setPanelCollapsed((c) => !c)}
            >
              <PanelRightIcon size={16} />
            </button>
          </div>
        </header>

        {/* ==================== 左侧周列表 ==================== */}
        <WeekRail
          onOpenQuery={() => setQueryOpen(true)}
          onCreateWeek={() => setCreateOpen(true)}
        />

        {/* ==================== 主工作区 ==================== */}
        <main className="main">
          {error && <div className="error-state">{error}</div>}
          {!error && (
            <>
              {/* Pomodoro Focus Banner (if active) */}
              <FocusBanner task={focusTask} onClose={() => setFocusTask(null)} />

              {/* Unified Workspace Header (Scheme A) */}
              <section className="workspace-header">
                {/* 左侧：周步进选择器 + 日期区间 */}
                <div className="ws-head-left">
                  <div className="ws-stepper">
                    <button
                      type="button"
                      className="ws-stepper-btn"
                      disabled={!canGoPrev}
                      title="上一周"
                      onClick={handlePrevWeek}
                    >
                      <ChevronLeftIcon size={14} />
                    </button>
                    <div
                      className="ws-stepper-label"
                      onClick={() => void selectWeek(currentWeek)}
                      title="点击快速返回当前周"
                    >
                      <span>{activeWeekId}</span>
                      {activeWeekId === currentWeekId ? (
                        <span className="badge-now">本周</span>
                      ) : (
                        <span className={`chip ${activeWeekStatus.cls}`}>
                          {activeWeekStatus.label}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ws-stepper-btn"
                      disabled={!canGoNext}
                      title="下一周"
                      onClick={handleNextWeek}
                    >
                      <ChevronRightIcon size={14} />
                    </button>
                  </div>

                  <span className="ws-date-range">
                    {formatCnRange(activeWeekId)}
                    {tree?.week.carriedFromWeekId && (
                      <span className="ws-carry-hint">
                        自 {tree.week.carriedFromWeekId} 带入
                        {carriedCount > 0 ? ` (${carriedCount}项)` : ''}
                      </span>
                    )}
                  </span>
                </div>

                {/* 中间：视图模式切换 + 进度概览 */}
                <div className="ws-head-center">
                  <div className="ws-view-tabs">
                    <button
                      type="button"
                      className={`ws-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
                      onClick={() => setViewMode('tree')}
                    >
                      <NetworkIcon size={13} />
                      任务树
                    </button>
                    <button
                      type="button"
                      className={`ws-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                      onClick={() => setViewMode('kanban')}
                    >
                      <KanbanIcon size={13} />
                      看板
                    </button>
                  </div>

                  <div
                    className="ws-progress-wrap"
                    title={`共 ${totalTasks} 项任务 · 已完成 ${doneTasks} · 进行中 ${openTasks} · 完成度 ${doneRatio}%`}
                  >
                    <span className="ws-progress-text">
                      <b>{doneTasks}</b> / {totalTasks} 完成
                    </span>
                    <svg className="ws-dial-mini" viewBox="0 0 46 46">
                      <circle
                        cx="23"
                        cy="23"
                        r="18"
                        stroke="var(--border)"
                        strokeWidth="3.5"
                        fill="none"
                      />
                      <circle
                        cx="23"
                        cy="23"
                        r="18"
                        stroke="var(--success)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={dialCircumference}
                        strokeDashoffset={dialOffset}
                        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
                      />
                    </svg>
                  </div>
                </div>

                {/* 右侧：过滤与操作 */}
                <div className="ws-head-right">
                  {shareMode ? (
                    <>
                      <span className="ws-share-info">已选 {shareSelectedIds.size} 项</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={selectAllVisible}
                      >
                        全选可见
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={shareSelectedIds.size === 0}
                        onClick={() => setShareOpen(true)}
                      >
                        <ShareIcon size={14} />
                        生成分享图
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={exitShare}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {viewMode === 'tree' && (
                        <ToggleSwitch
                          label="仅看未完成"
                          checked={showIncompleteOnly}
                          onChange={setShowIncompleteOnly}
                        />
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        title="新建主任务"
                        onClick={() => setNewTaskRequest((request) => request + 1)}
                      >
                        <PlusIcon size={14} />
                        新建主任务
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="选择多个任务生成分享图"
                        onClick={startShare}
                      >
                        <ShareIcon size={14} />
                        分享
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* Main Task View (Tree vs Kanban) */}
              {viewMode === 'tree' ? (
                <section className="tree-card">
                  <div className="tree">
                    {tree && (
                      <TaskTree
                        tasks={tree.tasks}
                        newTaskRequest={newTaskRequest}
                        locateRequest={locateRequest}
                        showIncompleteOnly={showIncompleteOnly}
                        groupColors={groupColors}
                        selectionMode={shareMode}
                        selectedIds={shareSelectedIds}
                        onToggleSelect={toggleShareSelect}
                      />
                    )}
                  </div>
                </section>
              ) : (
                tree && (
                  <KanbanView
                    tasks={tree.tasks}
                    onSelectTask={(task) => setSelectedTaskForDetail(task)}
                    groupColors={groupColors}
                  />
                )
              )}
            </>
          )}
        </main>

        {/* ==================== 右侧行动面板 ==================== */}
        {tree && (
          <CurrentActions
            tasks={tree.tasks}
            onLocate={(taskId) => setLocateRequest({ taskId, nonce: Date.now() })}
            onStartFocus={(task) => setFocusTask(task)}
          />
        )}
      </div>

      {/* ==================== 弹窗与浮层 ==================== */}
      <QueryView open={queryOpen} onClose={() => setQueryOpen(false)} />
      <StatisticsView open={statsOpen} onClose={() => setStatsOpen(false)} />
      <CreateWeekModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDatabaseRestored={() => initialize()}
        onCheckUpdate={() => {
          setSettingsOpen(false);
          setPreloadedUpdate(null);
          setUpdateOpen(true);
        }}
      />
      <UpdateModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        preloaded={preloadedUpdate}
      />
      <CloseBehaviorModal open={closeAskOpen} onClose={() => setCloseAskOpen(false)} />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        tasks={tree?.tasks ?? []}
        weekId={activeWeekId}
        groupColors={groupColors}
        selectedIds={shareSelectedIds}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenStats={() => setStatsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCreateWeek={() => setCreateOpen(true)}
        onNewTask={() => setNewTaskRequest((request) => request + 1)}
        onLocateTask={(taskId) => setLocateRequest({ taskId, nonce: Date.now() })}
      />
      <TaskDetailPanel
        task={selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
      />
    </ConfigProvider>
  );
}
