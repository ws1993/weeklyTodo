import { useAppStore } from '../store/appStore';
import { formatCnRange, isCurrentWeek, weekStatus } from '../utils/weekFormat';
import { EmptyState } from './EmptyState';
import { CalendarIcon, PlusIcon, SearchIcon } from './ForestIcons';

interface WeekRailProps {
  onOpenQuery: () => void;
  onCreateWeek: () => void;
}

export function WeekRail({ onOpenQuery, onCreateWeek }: WeekRailProps) {
  const recentWeeks = useAppStore((state) => state.recentWeeks);
  const allWeeks = useAppStore((state) => state.allWeeks);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const selectWeek = useAppStore((state) => state.selectWeek);

  return (
    <aside className="rail">
      <div className="rail-header">
        <span className="rail-title">周列表</span>
        <span className="rail-count">{allWeeks.length} 周</span>
      </div>
      <div className="week-list">
        {recentWeeks.map((week) => (
          <button
            key={week.id}
            type="button"
            className={`week-item ${week.id === activeWeekId ? 'active' : ''}`}
            onClick={() => void selectWeek(week.id)}
          >
            <span className="week-line1">
              <span className="week-item-id">{week.id}</span>
              {isCurrentWeek(week.id) && <span className="badge-now">本周</span>}
            </span>
            <span className="week-item-range">
              {formatCnRange(week.id)} · {weekStatus(week.id).label}
            </span>
            {week.carriedFromWeekId && (
              <span className="carry-hint">自 {week.carriedFromWeekId} 带入</span>
            )}
          </button>
        ))}
        {recentWeeks.length === 0 && (
          <EmptyState
            compact
            icon={<CalendarIcon size={18} />}
            title="暂无周数据"
            sub="启动应用后会自动创建本周"
          />
        )}
      </div>
      <div className="rail-footer">
        <button className="search-entry" type="button" onClick={onOpenQuery}>
          <SearchIcon size={15} />
          查询全部
          <kbd>Ctrl K</kbd>
        </button>
        <button className="btn btn-primary btn-wide" onClick={onCreateWeek}>
          <PlusIcon size={15} />
          新建周
        </button>
      </div>
    </aside>
  );
}
