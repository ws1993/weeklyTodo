import { useAppStore } from '../store/appStore';
import { formatCnRange, isCurrentWeek, weekStatus } from '../utils/weekFormat';
import { GrassIcon, PlusIcon, SearchIcon, TrunkIcon } from './ForestIcons';

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
      <div className="rail-header">树干 · 最近四周</div>
      <div className="week-list">
        {recentWeeks.map((week) => (
          <div
            key={week.id}
            className={`week-item ${week.id === activeWeekId ? 'active' : ''}`}
            onClick={() => void selectWeek(week.id)}
          >
            <span className="week-trunk"><TrunkIcon size={26} /></span>
            <span className="week-body">
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
            </span>
          </div>
        ))}
        {recentWeeks.length === 0 && <div className="muted" style={{ padding: 12 }}>暂无周数据</div>}
      </div>
      <div className="rail-footer">
        <button className="btn btn-primary btn-wide" onClick={onCreateWeek}>
          <PlusIcon size={15} />
          种下新的一周
        </button>
        <button className="btn btn-ghost btn-wide" onClick={onOpenQuery}>
          <SearchIcon size={15} />
          查看所有周
          <span className="count">{allWeeks.length}</span>
        </button>
      </div>
      <div className="soil">
        <span className="soil-grass"><GrassIcon /></span>
        <span className="soil-note">已收尾的周沉入土层</span>
      </div>
    </aside>
  );
}
