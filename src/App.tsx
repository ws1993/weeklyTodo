import { useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import { useAppStore } from './store/appStore';
import { WeekRail } from './components/WeekRail';
import { TaskTree } from './components/TaskTree';
import { CurrentActions } from './components/CurrentActions';
import { QueryView } from './components/QueryView';
import { CreateWeekModal } from './components/CreateWeekModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { UpdateModal } from './features/update/UpdateModal';
import { LeafIcon } from './components/ForestIcons';
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

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#7FB069',
          colorTextBase: '#EDEAE2',
          colorBgBase: '#101614',
          borderRadius: 10,
          fontFamily:
            '"Segoe UI Variable Text", "Segoe UI", system-ui, "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="brand-glyph"><LeafIcon size={21} /></span>
            <span className="topbar-title">周计划</span>
            <span className="brand-dot" />
            <span className="topbar-subtitle">专注森林周流</span>
          </div>
          <div className="topbar-actions">
            <span className="today">{todayLabel()}</span>
            <span className="today-sep" />
            <span className="now-week mono">{currentWeek} · 本周</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSettingsOpen(true)}>
              数据目录
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
              <div className="week-header">
                <div className="week-header-title">
                  <span className="week-header-id">{activeWeekId}</span>
                  <span className="week-header-range">
                    {formatCnRange(activeWeekId)}
                  </span>
                  <span className={`chip ${activeWeekStatus.cls}`}>{activeWeekStatus.label}</span>
                  {activeWeekId === currentWeekId && <span className="badge-now">本周</span>}
                </div>
                <div className="week-header-meta">
                  {tree?.week.carriedFromWeekId && (
                    <span>承接自 {tree.week.carriedFromWeekId}</span>
                  )}
                  <span>{carriedCount} 个分支从上周带入</span>
                </div>
              </div>

              <div className="tree">{tree && <TaskTree tasks={tree.tasks} />}</div>
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
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UpdateModal open={updateOpen} onClose={() => setUpdateOpen(false)} />
    </ConfigProvider>
  );
}
