import { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useAppStore } from './store/appStore';
import { WeekRail } from './components/WeekRail';
import { TaskTree } from './components/TaskTree';
import { CurrentActions } from './components/CurrentActions';
import { QueryView } from './components/QueryView';
import { CreateWeekModal } from './components/CreateWeekModal';
import { UpdateModal } from './features/update/UpdateModal';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { SettingsIcon, WorkbenchLogoIcon } from './components/ForestIcons';
import {
  currentWeekId as currentWeekIdOf,
  formatCnRange,
  todayLabel,
  weekStatus,
} from './utils/weekFormat';

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const tree = useAppStore((state) => state.tree);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const selectWeek = useAppStore((state) => state.selectWeek);

  const [queryOpen, setQueryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

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
            <span className="brand-glyph"><WorkbenchLogoIcon size={15} /></span>
            <span className="topbar-title">周计划</span>
            <span className="brand-dot" />
            <span className="topbar-subtitle">精密工作台</span>
          </div>
          <div className="topbar-actions">
            <span className="today">{todayLabel()}</span>
            <span className="today-sep" />
            <span className="now-week">{currentWeek} · 本周</span>
            <button
              className="btn btn-ghost btn-sm icon-btn"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setUpdateOpen(true)}>
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
                </div>
              </section>

              <section className="tree-card">
                <div className="tree-toolbar">
                  <span className="tree-title">任务树</span>
                  <span className="tree-hint">点击复选框切换完成状态 · 悬停行查看操作</span>
                </div>
                <div className="tree">{tree && <TaskTree tasks={tree.tasks} />}</div>
              </section>
            </>
          )}
        </main>
        {tree && <CurrentActions tasks={tree.tasks} />}
      </div>

      <QueryView
        open={queryOpen}
        onClose={() => setQueryOpen(false)}
        onNavigate={(weekId) => void selectWeek(weekId)}
      />
      <CreateWeekModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UpdateModal open={updateOpen} onClose={() => setUpdateOpen(false)} />
    </ConfigProvider>
  );
}
