import { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useAppStore } from './store/appStore';
import { WeekRail } from './components/WeekRail';
import { TaskTree } from './components/TaskTree';
import { CurrentActions } from './components/CurrentActions';
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
import { ChartIcon, LogoIcon, PlusIcon, SettingsIcon, ShareIcon } from './components/ForestIcons';
import { descendantIds, incompleteOnlyVisibleIds } from './utils/tree';
import {
  isSyncDue,
  loadWebDavSettings,
  saveWebDavSettings,
  type WebDavSettings,
} from './features/settings/webdavSettings';
import { getSavedProxyConfig } from './features/settings/proxySettings';
import { loadCloseBehaviorSettings } from './features/settings/closeBehavior';
import type { UpdateCheckResult } from './shared/contracts/types';
import {
  currentWeekId as currentWeekIdOf,
  formatCnRange,
  todayLabel,
  weekStatus,
} from './utils/weekFormat';

/** 防止启动同步与定时同步同时触发。 */
let webdavSyncInFlight = false;

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const tree = useAppStore((state) => state.tree);
  const groupColors = useAppStore((state) => state.groupColors);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const currentWeekId = useAppStore((state) => state.currentWeekId);

  const [queryOpen, setQueryOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeAskOpen, setCloseAskOpen] = useState(false);
  const [preloadedUpdate, setPreloadedUpdate] = useState<UpdateCheckResult | null>(null);
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
      const result = await syncWebDavAutomatically(settings.url, settings.username, settings.backupRetention);
      const nextSettings = {
        ...loadWebDavSettings(),
        lastSyncedAt: result.direction === 'skipped' ? settings.lastSyncedAt : new Date().toISOString(),
        lastSyncStatus: `${result.direction === 'skipped' ? '已跳过自动同步' : `同步完成（${result.direction}）`}${
          result.backupFiles.length > 0 ? `，备份 ${result.backupFiles.length} 个` : ''
        }${result.direction === 'skipped' ? `：${result.message}` : ''}`,
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

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1557D0',
          colorTextBase: '#172033',
          colorBgBase: '#FFFFFF',
          borderRadius: 4,
          fontFamily:
            '"Segoe UI Variable", "Microsoft YaHei UI", -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
        },
      }}
    >
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="brand-glyph"><LogoIcon size={26} /></span>
            <span className="topbar-title">周计划</span>
            <span className="brand-dot" />
            <span className="topbar-subtitle">以周为单位的高效执行</span>
          </div>
          <div className="topbar-actions">
            <span className="today">{todayLabel()}</span>
            <span className="today-sep" />
            <span className="now-week">{currentWeek} · 本周</span>
            <button
              className="btn btn-ghost btn-sm"
              title="统计 / 复盘"
              onClick={() => setStatsOpen(true)}
            >
              <ChartIcon size={15} />
              统计
            </button>
            <button
              className="btn btn-ghost btn-sm icon-btn"
              title="设置"
              aria-label="打开设置"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon size={17} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPreloadedUpdate(null);
                setUpdateOpen(true);
              }}
            >
              v{__APP_VERSION__}
            </button>
          </div>
        </header>

        <WeekRail onOpenQuery={() => setQueryOpen(true)} onCreateWeek={() => setCreateOpen(true)} />

        <main className="main">
          {error && <div className="error-state">{error}</div>}
          {!error && (
            <>
              <section className="week-card">
                <div className="week-header-title">
                  <div className="week-line1">
                    <span className="week-header-id">{activeWeekId}</span>
                    <span className={`chip ${activeWeekStatus.cls}`}>
                      {activeWeekStatus.label}
                    </span>
                    {activeWeekId === currentWeekId && <span className="badge-now">本周</span>}
                  </div>
                  <span className="week-header-range">
                    {formatCnRange(activeWeekId)}
                    {tree?.week.carriedFromWeekId && ` · 承接自 ${tree.week.carriedFromWeekId}`}
                  </span>
                </div>
                <div className="week-header-right">
                  <div className="week-stats">
                    <div className="week-stats-line">
                      <b>{totalTasks}</b> 项任务 · <b>{doneTasks}</b> 已完成 · <b>{openTasks}</b> 进行中
                      {carriedCount > 0 && <span> · {carriedCount} 带入</span>}
                    </div>
                    <div className="week-progress">
                      <div className="week-progress-bar" style={{ width: `${doneRatio}%` }} />
                    </div>
                  </div>
                  <button
                    className={`btn btn-ghost btn-sm${shareMode ? ' active' : ''}`}
                    title="选择多个任务一起生成分享图"
                    onClick={shareMode ? exitShare : startShare}
                  >
                    <ShareIcon size={15} />
                    {shareMode ? '取消分享' : '分享'}
                  </button>
                </div>
              </section>

              <section className="tree-card">
                <div className="tree-toolbar">
                  {shareMode ? (
                    <>
                      <span className="tree-title">已选 {shareSelectedIds.size} 项</span>
                      <span className="tree-hint">勾选要分享的任务 · 父任务自动带上未关闭子任务</span>
                      <button className="btn btn-ghost btn-sm" onClick={selectAllVisible}>
                        全选可见
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={shareSelectedIds.size === 0}
                        onClick={() => setShareOpen(true)}
                      >
                        <ShareIcon size={15} />
                        生成分享图
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tree-title">任务树</span>
                      <span className="tree-hint">点击复选框切换完成状态 · 拖拽行调整层级与顺序 · 悬停行查看操作</span>
                      <ToggleSwitch
                        label="仅看未完成"
                        checked={showIncompleteOnly}
                        onChange={setShowIncompleteOnly}
                      />
                      <button
                        className="btn btn-primary"
                        title="新建任务"
                        onClick={() => setNewTaskRequest((request) => request + 1)}
                      >
                        <PlusIcon size={15} />
                        新建任务
                      </button>
                    </>
                  )}
                </div>
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
            </>
          )}
        </main>
        {tree && (
          <CurrentActions
            tasks={tree.tasks}
            onLocate={(taskId) => setLocateRequest({ taskId, nonce: Date.now() })}
          />
        )}
      </div>

      <QueryView
        open={queryOpen}
        onClose={() => setQueryOpen(false)}
      />
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
    </ConfigProvider>
  );
}
