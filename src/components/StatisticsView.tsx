import { useEffect, useMemo, useState } from 'react';
import { statisticsOverview } from '../api/nativeBridge';
import { useAppStore } from '../store/appStore';
import type {
  NamedCount,
  PriorityStat,
  StatisticsOverview,
  Week,
  WeekTrendStat,
} from '../shared/contracts/types';
import { formatCnDay, formatCnRange } from '../utils/weekFormat';
import { EmptyState } from './EmptyState';
import { BoltIcon, ChartIcon, ClockIcon, CrossIcon } from './ForestIcons';
import { DropdownSelect, SegmentedControl } from './QueryControls';

interface StatisticsViewProps {
  open: boolean;
  onClose: () => void;
}

/** 快捷时间范围档位。 */
type RangeKey = '4w' | '12w' | 'all' | 'custom';

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '4w', label: '近4周' },
  { value: '12w', label: '近12周' },
  { value: 'all', label: '全部' },
  { value: 'custom', label: '自定义' },
];

/** 默认展示近 12 周，覆盖大多数复盘场景且避免信息过载。 */
const DEFAULT_RANGE: RangeKey = '12w';

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

function NamedRow({
  item,
  max,
  muted,
  self,
}: {
  item: NamedCount;
  max: number;
  muted?: boolean;
  /** 自己的任务（无负责人）：显示「自己」徽章，置顶且加粗高亮。 */
  self?: boolean;
}) {
  return (
    <div className={`stats-dist-row${muted ? ' muted' : ''}${self ? ' self' : ''}`}>
      <span className="stats-dist-name" title={self ? '自己' : item.name}>
        {self ? <span className="tag tag-self">自己</span> : item.name || '未指定'}
      </span>
      <CountBar count={item.count} max={max} />
      <span className="stats-dist-meta">{item.count}</span>
    </div>
  );
}

/** 周完成率柱状图：柱高 = 当周完成率，悬停显示明细。 */
function TrendBars({ weeks }: { weeks: WeekTrendStat[] }) {
  return (
    <div className="stats-trend-bars">
      {weeks.map((week) => {
        const completion = ratio(week.done, week.total);
        const [startDate] = week.weekId.split('-');
        const tip = `${formatCnRange(week.weekId)}：${week.done}/${week.total} 完成（${completion}%），带入 ${week.carried} 项`;
        return (
          <div className="stats-trend-bar" key={week.weekId} title={tip}>
            <span className="stats-trend-pct">{completion}%</span>
            <span className="stats-trend-track">
              <span
                className={`stats-trend-fill${completion >= 80 ? ' good' : completion >= 50 ? ' mid' : ' low'}`}
                style={{ height: `${Math.max(completion, 2)}%` }}
              />
            </span>
            <span className="stats-trend-week">{startDate ? formatCnDay(startDate) : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 总览区：四个累计数字 + 完成率。 */
function OverviewStats({ data }: { data: StatisticsOverview }) {
  const completion = ratio(data.totalDone, data.totalTasks);
  return (
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
          <span>范围完成率</span>
          <span className="stats-completion-pct">{completion}%</span>
        </div>
        <span className="stats-completion-track">
          <span
            className="stats-completion-fill"
            style={{ width: `${completion}%` }}
          />
        </span>
        <span className="stats-completion-note">
          已完成 {data.totalDone} 项，其中带入完成可查看周趋势明细
        </span>
      </div>
    </section>
  );
}

/** 复盘问题区：直接暴露"在拖 / 积压"的指标。 */
function IssueCards({ data }: { data: StatisticsOverview }) {
  const overdueRate = ratio(data.carriedOpen, data.totalOpen);
  const p0Stat = data.byPriority.find((item) => item.priority === 0);
  const p0Open = p0Stat ? p0Stat.count - p0Stat.done : 0;
  return (
    <section className="stats-issues">
      <div className="stats-issue">
        <span className="stats-issue-glyph warning">
          <ClockIcon size={14} />
        </span>
        <div className="stats-issue-text">
          <span className="stats-issue-label">拖期未完成</span>
          <span className="stats-issue-value warning">{data.carriedOpen}</span>
        </div>
        <span className="stats-issue-hint">带入但未关闭的任务</span>
      </div>
      <div className="stats-issue">
        <span className="stats-issue-glyph warning">
          <ClockIcon size={14} />
        </span>
        <div className="stats-issue-text">
          <span className="stats-issue-label">拖期率</span>
          <span className="stats-issue-value warning">{overdueRate}%</span>
        </div>
        <span className="stats-issue-hint">拖期未完成占进行中的比例</span>
      </div>
      <div className="stats-issue">
        <span className="stats-issue-glyph danger">
          <BoltIcon size={14} />
        </span>
        <div className="stats-issue-text">
          <span className="stats-issue-label">P0 未关闭</span>
          <span className={`stats-issue-value${p0Open > 0 ? ' danger' : ' success'}`}>{p0Open}</span>
        </div>
        <span className="stats-issue-hint">范围内优先级最高的任务积压</span>
      </div>
    </section>
  );
}

export function StatisticsView({ open, onClose }: StatisticsViewProps) {
  const allWeeks = useAppStore((state) => state.allWeeks);
  const [data, setData] = useState<StatisticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>(DEFAULT_RANGE);
  const [customStartWeekId, setCustomStartWeekId] = useState('');
  const [customEndWeekId, setCustomEndWeekId] = useState('');

  // 按开始日期升序，供快捷范围取最近 N 周。
  const sortedWeeks = useMemo<Week[]>(
    () => [...allWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [allWeeks],
  );

  const weekOptions = useMemo(
    () =>
      [...sortedWeeks]
        .reverse()
        .map((week) => ({ value: week.id, label: formatCnRange(week.id) })),
    [sortedWeeks],
  );

  // 由档位解析出实际请求的起止周；自定义档位直接取用户选择。
  const effectiveRange = useMemo(() => {
    const lastN = (count: number) => {
      const selected = sortedWeeks.slice(-count);
      return {
        startWeekId: selected.length > 0 ? selected[0].id : undefined,
        endWeekId: selected.length > 0 ? selected[selected.length - 1].id : undefined,
      };
    };
    switch (rangeKey) {
      case '4w':
        return lastN(4);
      case '12w':
        return lastN(12);
      case 'custom':
        return {
          startWeekId: customStartWeekId || undefined,
          endWeekId: customEndWeekId || undefined,
        };
      case 'all':
      default:
        return { startWeekId: undefined, endWeekId: undefined };
    }
  }, [rangeKey, sortedWeeks, customStartWeekId, customEndWeekId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void statisticsOverview(effectiveRange.startWeekId, effectiveRange.endWeekId)
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
  }, [open, effectiveRange.startWeekId, effectiveRange.endWeekId]);

  if (!open) {
    return null;
  }

  const maxTag = Math.max(0, ...(data?.byTag ?? []).map((item) => item.count));
  const maxOwner = Math.max(0, ...(data?.byOwner ?? []).map((item) => item.count));
  const maxAssigner = Math.max(0, ...(data?.byAssigner ?? []).map((item) => item.count));
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
        <div className="stats-toolbar">
          <SegmentedControl
            label="时间范围"
            options={RANGE_OPTIONS}
            value={rangeKey}
            onChange={setRangeKey}
          />
          {rangeKey === 'custom' && (
            <div className="stats-toolbar-range">
              <DropdownSelect
                label="开始周"
                options={weekOptions}
                value={customStartWeekId}
                onChange={setCustomStartWeekId}
                allowAll={false}
              />
              <span className="stats-toolbar-sep">至</span>
              <DropdownSelect
                label="结束周"
                options={weekOptions}
                value={customEndWeekId}
                onChange={setCustomEndWeekId}
                allowAll={false}
              />
            </div>
          )}
        </div>

        {loading && <div className="loading-state">正在汇总统计数据…</div>}
        {!loading && error && <div className="modal-error">{error}</div>}
        {!loading && !error && !hasData && (
          <EmptyState
            icon={<ChartIcon size={22} />}
            title={rangeKey === 'all' && allWeeks.length === 0 ? '暂无统计数据' : '该时间段暂无数据'}
            sub="新建并完成任务后，这里会展示周趋势与各维度分布"
          />
        )}
        {!loading && !error && hasData && data && (
          <>
            <OverviewStats data={data} />

            <section className="stats-panel">
              <h3 className="stats-panel-title">
                周完成率趋势
                <span className="stats-panel-sub">{data.weeks.length} 周</span>
              </h3>
              {data.weeks.length > 0 ? (
                <TrendBars weeks={data.weeks} />
              ) : (
                <span className="stats-dist-empty">该时间段暂无周数据</span>
              )}
            </section>

            <IssueCards data={data} />

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
                    <NamedRow
                      key={item.name || '__self__'}
                      item={item}
                      max={maxOwner}
                      self={item.name === ''}
                    />
                  ))}
                  {data.byOwner.length === 0 && (
                    <span className="stats-dist-empty">暂无数据</span>
                  )}
                </div>
              </div>

              <div className="stats-panel">
                <h3 className="stats-panel-title">按分派人</h3>
                <div className="stats-dist">
                  {data.byAssigner.map((item) => (
                    <NamedRow key={item.name} item={item} max={maxAssigner} muted={item.name === ''} />
                  ))}
                  {data.byAssigner.length === 0 && (
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
