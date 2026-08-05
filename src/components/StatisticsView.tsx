import { useEffect, useState } from 'react';
import { statisticsOverview } from '../api/nativeBridge';
import type { NamedCount, PriorityStat, StatisticsOverview, WeekTrendStat } from '../shared/contracts/types';
import { formatCnRange } from '../utils/weekFormat';
import { EmptyState } from './EmptyState';
import { ChartIcon, CrossIcon } from './ForestIcons';

interface StatisticsViewProps {
  open: boolean;
  onClose: () => void;
}

/** 趋势图展示的最近周数。 */
const TREND_WEEKS = 12;

function ratio(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** 相对最大值归一化的横向条形。 */
function CountBar({ count, max, className }: { count: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max((count / max) * 100, 2) : 0;
  return (
    <span className="stats-bar">
      <span
        className={`stats-bar-fill${className ? ` ${className}` : ''}`}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

function PriorityRow({ stat, max }: { stat: PriorityStat; max: number }) {
  return (
    <div className="stats-dist-row">
      <span className={`tag tag-priority p${stat.priority}`}>P{stat.priority}</span>
      <CountBar count={stat.done} max={max} className="done" />
      <span className="stats-dist-meta">
        <b>{stat.done}</b>/{stat.count}
      </span>
    </div>
  );
}

function NamedRow({ item, max, muted }: { item: NamedCount; max: number; muted?: boolean }) {
  return (
    <div className={`stats-dist-row${muted ? ' muted' : ''}`}>
      <span className="stats-dist-name" title={item.name}>
        {item.name || '未指定'}
      </span>
      <CountBar count={item.count} max={max} />
      <span className="stats-dist-meta">{item.count}</span>
    </div>
  );
}

function WeekRow({ week }: { week: WeekTrendStat }) {
  const completion = ratio(week.done, week.total);
  return (
    <div className="stats-week-row">
      <span className="stats-week-id">{week.weekId}</span>
      <span className="stats-week-range">{formatCnRange(week.weekId)}</span>
      <span className="stats-week-track">
        <span className="stats-week-progress">
          <span className="stats-week-progress-bar" style={{ width: `${completion}%` }} />
        </span>
      </span>
      <span className="stats-week-meta">
        <b>{week.done}</b>/{week.total}
        {week.carried > 0 && (
          <span className="stats-week-carried" title={`带入 ${week.carried} 项，完成 ${week.carriedDone} 项`}>
            带入 {week.carried}
          </span>
        )}
      </span>
    </div>
  );
}

export function StatisticsView({ open, onClose }: StatisticsViewProps) {
  const [data, setData] = useState<StatisticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void statisticsOverview(TREND_WEEKS)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(String(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const maxTag = Math.max(0, ...(data?.byTag ?? []).map((item) => item.count));
  const maxOwner = Math.max(0, ...(data?.byOwner ?? []).map((item) => item.count));
  const maxPriority = Math.max(0, ...(data?.byPriority ?? []).map((item) => item.count));
  const hasData = data != null && (data.totalTasks > 0 || data.weeks.length > 0);

  return (
    <div className="query-overlay stats-overlay">
      <header className="query-overlay-header">
        <div className="query-overlay-title">
          <span className="query-overlay-glyph">
            <ChartIcon size={17} />
          </span>
          统计 / 复盘
        </div>
        <div className="query-overlay-actions">
          <span className="query-overlay-hint">数据仅保存在本机</span>
          <button className="query-overlay-close" title="关闭" onClick={onClose}>
            <CrossIcon size={15} />
          </button>
        </div>
      </header>

      <div className="stats-body">
        {loading && <div className="loading-state">正在汇总统计数据…</div>}
        {!loading && error && <div className="modal-error">{error}</div>}
        {!loading && !error && !hasData && (
          <EmptyState
            icon={<ChartIcon size={22} />}
            title="暂无统计数据"
            sub="新建并完成任务后，这里会展示周趋势与各维度分布"
          />
        )}
        {!loading && !error && hasData && data && (
          <>
            <section className="stats-overview">
              <div className="stats-stat">
                <span className="stats-stat-label">累计任务</span>
                <span className="stats-stat-value">{data.totalTasks}</span>
              </div>
              <div className="stats-stat">
                <span className="stats-stat-label">已完成</span>
                <span className="stats-stat-value success">{data.totalDone}</span>
              </div>
              <div className="stats-stat">
                <span className="stats-stat-label">进行中</span>
                <span className="stats-stat-value">{data.totalOpen}</span>
              </div>
              <div className="stats-stat">
                <span className="stats-stat-label">带入累计</span>
                <span className="stats-stat-value warning">{data.totalCarried}</span>
              </div>
              <div className="stats-completion">
                <div className="stats-completion-head">
                  <span>历史完成率</span>
                  <span className="stats-completion-pct">{ratio(data.totalDone, data.totalTasks)}%</span>
                </div>
                <span className="stats-completion-track">
                  <span
                    className="stats-completion-fill"
                    style={{ width: `${ratio(data.totalDone, data.totalTasks)}%` }}
                  />
                </span>
              </div>
            </section>

            <section className="stats-panel">
              <h3 className="stats-panel-title">近 {data.weeks.length} 周完成率</h3>
              <div className="stats-week-list">
                {data.weeks.map((week) => (
                  <WeekRow key={week.weekId} week={week} />
                ))}
              </div>
            </section>

            <section className="stats-grid">
              <div className="stats-panel">
                <h3 className="stats-panel-title">按优先级</h3>
                <div className="stats-dist">
                  {data.byPriority.map((stat) => (
                    <PriorityRow key={stat.priority} stat={stat} max={maxPriority} />
                  ))}
                  {data.byPriority.length === 0 && (
                    <span className="stats-dist-empty">暂无数据</span>
                  )}
                </div>
              </div>

              <div className="stats-panel">
                <h3 className="stats-panel-title">按标签</h3>
                <div className="stats-dist">
                  {data.byTag.map((item) => (
                    <NamedRow key={item.name} item={item} max={maxTag} />
                  ))}
                  {data.byTag.length === 0 && (
                    <span className="stats-dist-empty">暂无标签</span>
                  )}
                </div>
              </div>

              <div className="stats-panel">
                <h3 className="stats-panel-title">按负责人</h3>
                <div className="stats-dist">
                  {data.byOwner.map((item) => (
                    <NamedRow key={item.name} item={item} max={maxOwner} muted={item.name === ''} />
                  ))}
                  {data.byOwner.length === 0 && (
                    <span className="stats-dist-empty">暂无数据</span>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
