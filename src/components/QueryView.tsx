import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryTaskRow, Week, WeekSummary } from '../shared/contracts/types';
import { queryAllTasks, weekSummaries } from '../api/nativeBridge';
import { useAppStore } from '../store/appStore';
import { formatCnRange, isCurrentWeek, weekStatus } from '../utils/weekFormat';
import { CalendarIcon, ChevronRightIcon, CrossIcon, SearchIcon } from './ForestIcons';
import { DropdownSelect, SearchField, SegmentedControl, ToggleSwitch } from './QueryControls';

type StatusFilter = '' | 'in_progress' | 'closed';

interface QueryViewProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (weekId: string) => void;
}

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: '全部' },
  { value: 'in_progress', label: '未完成' },
  { value: 'closed', label: '已完成' },
];

interface WeekProgress {
  total: number;
  done: number;
}

export function QueryView({ open, onClose, onNavigate }: QueryViewProps) {
  const allWeeks = useAppStore((state) => state.allWeeks);
  const owners = useAppStore((state) => state.owners);
  const tags = useAppStore((state) => state.tags);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [weekId, setWeekId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [carriedOnly, setCarriedOnly] = useState(false);
  const [ownerId, setOwnerId] = useState<number | undefined>();
  const [tagId, setTagId] = useState<number | undefined>();
  const [results, setResults] = useState<QueryTaskRow[]>([]);
  const [summaries, setSummaries] = useState<WeekSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // 关键词防抖：避免每个按键都触发一次跨库查询。
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 260);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const runQuery = useCallback(async () => {
    if (!open) {
      return;
    }
    setLoading(true);
    try {
      const rows = await queryAllTasks({
        keyword: debouncedKeyword || undefined,
        weekId: weekId || undefined,
        status: status || undefined,
        carriedOverOnly: carriedOnly || undefined,
        ownerId,
        tagId,
      });
      setResults(rows);
      const summariesData = await weekSummaries();
      setSummaries(summariesData);
    } finally {
      setLoading(false);
    }
  }, [open, debouncedKeyword, weekId, status, carriedOnly, ownerId, tagId]);

  useEffect(() => {
    void runQuery();
  }, [runQuery]);

  const progressByWeek = useMemo(() => {
    const map = new Map<string, WeekProgress>();
    for (const [id, total, openCount] of summaries) {
      map.set(id, { total, done: total - openCount });
    }
    return map;
  }, [summaries]);

  const weeksByYear = useMemo(() => {
    const groups: Array<{ year: string; weeks: Week[] }> = [];
    for (const week of allWeeks) {
      const year = week.id.slice(0, 4);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.year === year) {
        lastGroup.weeks.push(week);
      } else {
        groups.push({ year, weeks: [week] });
      }
    }
    return groups;
  }, [allWeeks]);

  const ownerOptions = owners.map((owner) => ({ value: String(owner.id), label: owner.name }));
  const tagOptions = tags.map((tag) => ({ value: String(tag.id), label: tag.name }));

  const activeWeek = allWeeks.find((week) => week.id === weekId);

  if (!open) {
    return null;
  }

  const handleNavigate = (targetWeekId: string) => {
    onNavigate(targetWeekId);
    onClose();
  };

  return (
    <div className="query-overlay">
      <header className="query-overlay-header">
        <div className="query-overlay-title">
          <span className="query-overlay-glyph">
            <CalendarIcon size={17} />
          </span>
          查看所有周
        </div>
        <div className="query-overlay-actions">
          <span className="query-overlay-hint">点击结果跳转到对应周</span>
          <button className="query-overlay-close" title="关闭" onClick={onClose}>
            <CrossIcon size={15} />
          </button>
        </div>
      </header>

      <div className="query-shell">
        <aside className="query-sidebar">
          <div className="query-sidebar-head">
            <span className="query-sidebar-title">全部周</span>
            <span className="query-sidebar-count">{allWeeks.length} 周</span>
          </div>

          <div className="query-week-list">
            <button
              type="button"
              className={`query-week-item all${weekId === '' ? ' selected' : ''}`}
              onClick={() => setWeekId('')}
            >
              <span className="query-week-top">
                <span className="query-week-id">全部</span>
              </span>
              <span className="query-week-range">跨周检索所有任务分支</span>
            </button>

            {weeksByYear.map((group) => (
              <div key={group.year} className="query-year-group">
                <div className="query-year-head">{group.year}</div>
                {group.weeks.map((week) => {
                  const status = weekStatus(week.id);
                  const progress = progressByWeek.get(week.id);
                  const ratio = progress && progress.total > 0
                    ? Math.round((progress.done / progress.total) * 100)
                    : 0;
                  return (
                    <button
                      key={week.id}
                      type="button"
                      className={`query-week-item${weekId === week.id ? ' selected' : ''}`}
                      onClick={() => setWeekId(weekId === week.id ? '' : week.id)}
                    >
                      <span className="query-week-top">
                        <span className="query-week-id">{week.id}</span>
                        {isCurrentWeek(week.id) && <span className="badge-now">本周</span>}
                        <span className={`chip ${status.cls}`}>{status.label}</span>
                      </span>
                      <span className="query-week-range">{formatCnRange(week.id)}</span>
                      {progress && progress.total > 0 ? (
                        <span className="query-week-meta">
                          <span className="query-week-progress">
                            <span
                              className="query-week-progress-bar"
                              style={{ width: `${ratio}%` }}
                            />
                          </span>
                          <span className="query-week-count">
                            {progress.done}/{progress.total}
                          </span>
                        </span>
                      ) : (
                        <span className="query-week-empty">暂无任务</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <main className="query-content">
          <div className="query-toolbar">
            <div className="query-toolbar-row">
              <SearchField
                value={keyword}
                onChange={setKeyword}
                placeholder="搜索任务名或路径…"
              />
              <ToggleSwitch
                label="只看带入任务"
                checked={carriedOnly}
                onChange={setCarriedOnly}
              />
            </div>
            <div className="query-toolbar-row">
              <SegmentedControl
                label="状态"
                options={statusOptions}
                value={status}
                onChange={setStatus}
              />
              <span className="query-toolbar-sep" />
              <DropdownSelect
                label="负责人"
                options={ownerOptions}
                value={ownerId !== undefined ? String(ownerId) : ''}
                onChange={(value) => setOwnerId(value ? Number(value) : undefined)}
              />
              <DropdownSelect
                label="标签"
                options={tagOptions}
                value={tagId !== undefined ? String(tagId) : ''}
                onChange={(value) => setTagId(value ? Number(value) : undefined)}
              />
            </div>
          </div>

          <div className="query-results-head">
            <span>
              找到 <b>{results.length}</b> 条分支
              {activeWeek && <span className="query-results-scope"> · {activeWeek.id}</span>}
            </span>
            <span className="query-results-meta">
              {summaries.length} 个周 · 仅保存在本机
            </span>
          </div>

          <div className="query-results">
            {loading && (
              <div className="query-skeleton" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="query-skeleton-row" key={index}>
                    <span className="skeleton-dot" />
                    <span className="skeleton-lines">
                      <span className="skeleton-line skeleton-line-title" />
                      <span className="skeleton-line skeleton-line-sub" />
                    </span>
                    <span className="skeleton-chip" />
                  </div>
                ))}
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="query-empty">
                <span className="query-empty-icon">
                  <SearchIcon size={26} />
                </span>
                <span className="query-empty-title">没有找到匹配的分支</span>
                <span className="query-empty-sub">试试调整筛选条件，或清空关键词</span>
              </div>
            )}

            {!loading &&
              results.map((row) => (
                <div
                  key={`${row.weekId}-${row.task.id}`}
                  className="query-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNavigate(row.weekId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNavigate(row.weekId);
                    }
                  }}
                >
                  <span
                    className={`query-row-dot${row.task.status === 'closed' ? ' closed' : ''}`}
                  />
                  <span className="query-row-main">
                    <span
                      className={`query-row-title${row.task.status === 'closed' ? ' closed' : ''}`}
                    >
                      {row.task.title}
                    </span>
                    <span className="query-row-path">{row.path}</span>
                  </span>
                  <span className="query-row-tags">
                    {row.task.carriedFromTaskId != null && (
                      <span className="tag tag-carry">带入</span>
                    )}
                    <span className={`tag tag-priority p${row.task.priority}`}>
                      P{row.task.priority}
                    </span>
                    {row.task.executionMode === 'self' && (
                      <span className="tag tag-self">自己</span>
                    )}
                    {row.task.executionMode === 'follow_up' && (
                      <span className="tag tag-follow">跟进</span>
                    )}
                    {row.task.executionMode === 'follow_up' && row.task.ownerName && (
                      <span className="tag tag-owner">{row.task.ownerName}</span>
                    )}
                    {row.task.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag tag-label">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="query-row-week">{row.weekLabel}</span>
                  <span className="query-row-go">
                    <ChevronRightIcon size={14} />
                  </span>
                </div>
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
