import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryTaskRow, Task, Week, WeekSummary } from '../shared/contracts/types';
import {
  deleteTask,
  getWeekTree,
  queryAllTasks,
  queryGroupOptions,
  updateTask,
  weekSummaries,
} from '../api/nativeBridge';
import { useAppStore } from '../store/appStore';
import { formatDateDay } from '../utils/formatDateTime';
import { formatCnRange, isCurrentWeek, weekStatus } from '../utils/weekFormat';
import { subtreeSize } from '../utils/tree';
import { EmptyState } from './EmptyState';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  RenameIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
  TrashIcon,
} from './ForestIcons';
import { ChipMultiSelect, DropdownSelect, SearchField, SegmentedControl, ToggleSwitch } from './QueryControls';
import { TaskDetailPanel } from './TaskDetailPanel';

type StatusFilter = '' | 'in_progress' | 'closed';

interface QueryViewProps {
  open: boolean;
  onClose: () => void;
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

export function QueryView({ open, onClose }: QueryViewProps) {
  const allWeeks = useAppStore((state) => state.allWeeks);
  const owners = useAppStore((state) => state.owners);
  const assigners = useAppStore((state) => state.assigners);
  const tags = useAppStore((state) => state.tags);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const refreshMetadata = useAppStore((state) => state.refreshMetadata);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [weekId, setWeekId] = useState('');
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusFilter>('');
  const [carriedOnly, setCarriedOnly] = useState(false);
  const [ownerId, setOwnerId] = useState<number | undefined>();
  const [assignerId, setAssignerId] = useState<number | undefined>();
  const [tagId, setTagId] = useState<number | undefined>();
  const [results, setResults] = useState<QueryTaskRow[]>([]);
  const [summaries, setSummaries] = useState<WeekSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<QueryTaskRow | null>(null);
  const [detailTasks, setDetailTasks] = useState<Task[] | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  // 批量勾选：key（`${weekId}-${taskId}`）-> 行数据，供多选复制按当前列表顺序取用。
  const [selectedRows, setSelectedRows] = useState<Map<string, QueryTaskRow>>(() => new Map());
  const [batchNumbered, setBatchNumbered] = useState(false);
  const [batchCopied, setBatchCopied] = useState(false);
  // 按周缓存整棵任务树，供删除确认数量与详情上下文复用。
  const weekTreesCache = useRef(new Map<string, Task[]>());

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
        leafOnly: true,
        ownerId,
        assignerId,
        tagId,
      });
      setResults(rows);
      const summariesData = await weekSummaries();
      setSummaries(summariesData);
    } finally {
      setLoading(false);
    }
  }, [open, debouncedKeyword, weekId, status, carriedOnly, ownerId, assignerId, tagId]);

  useEffect(() => {
    void runQuery();
  }, [runQuery]);

  const loadGroupOptions = useCallback(
    async (targetWeekId: string) => {
      const options = await queryGroupOptions(targetWeekId || undefined);
      setGroupOptions(options);
      // 切到某个周后，只保留该周仍存在的项目选择，避免出现「筛选出空结果」的困惑。
      setGroupFilters((prev) => {
        const kept = prev.filter((name) => options.includes(name));
        return kept.length === prev.length ? prev : kept;
      });
    },
    [],
  );

  useEffect(() => {
    void loadGroupOptions(weekId);
  }, [weekId, loadGroupOptions]);

  // 打开详情前先拿到行所在周的整棵任务树作为上下文。
  useEffect(() => {
    if (!detailRow) {
      setDetailTasks(null);
      return;
    }
    const cached = weekTreesCache.current.get(detailRow.weekId);
    if (cached) {
      setDetailTasks(cached);
      return;
    }
    let cancelled = false;
    void getWeekTree(detailRow.weekId).then((tree) => {
      if (cancelled) {
        return;
      }
      weekTreesCache.current.set(detailRow.weekId, tree.tasks);
      setDetailTasks(tree.tasks);
    });
    return () => {
      cancelled = true;
    };
  }, [detailRow]);

  /** 详情面板保存 / 完成 / 删除后统一刷新查询结果与相关缓存。 */
  const handleDetailMutated = useCallback(async () => {
    await runQuery();
    await refreshMetadata();
    if (detailRow && detailRow.weekId === activeWeekId) {
      await refreshTree();
    }
    await loadGroupOptions(weekId);
  }, [runQuery, refreshMetadata, refreshTree, loadGroupOptions, detailRow, activeWeekId, weekId]);

  const openDetail = (row: QueryTaskRow) => {
    setRenamingId(null);
    setConfirmingDeleteId(null);
    setDetailRow(row);
  };

  const commitRename = async (row: QueryTaskRow) => {
    const title = renameDraft.trim();
    if (title && title !== row.task.title) {
      await updateTask({ weekId: row.weekId, taskId: row.task.id, title });
      await runQuery();
      if (row.weekId === activeWeekId) {
        await refreshTree();
      }
      await refreshMetadata();
      await loadGroupOptions(weekId);
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const armDelete = async (row: QueryTaskRow) => {
    setConfirmingDeleteId(row.task.id);
    setDeleteCount(0);
    try {
      const cached = weekTreesCache.current.get(row.weekId);
      const treeTasks = cached ?? (await getWeekTree(row.weekId)).tasks;
      weekTreesCache.current.set(row.weekId, treeTasks);
      setDeleteCount(subtreeSize(treeTasks, row.task.id));
    } catch {
      // 获取子树数量失败时仍可删除，确认文案退化为通用提示。
    }
    window.setTimeout(() => setConfirmingDeleteId(null), 4000);
  };

  const doDelete = async (row: QueryTaskRow) => {
    setConfirmingDeleteId(null);
    await deleteTask(row.weekId, row.task.id);
    await runQuery();
    if (row.weekId === activeWeekId) {
      await refreshTree();
    }
    await refreshMetadata();
    await loadGroupOptions(weekId);
  };

  const handleCopyTitle = async (event: React.MouseEvent, title: string, id: number) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(title);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1500);
    } catch (error) {
      console.error('复制任务标题失败:', error);
    }
  };

  /** 各项目的命中数：按其它筛选条件（周 / 状态 / 负责人等）过滤后的完整结果集统计。 */
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of results) {
      map.set(row.rootTitle, (map.get(row.rootTitle) ?? 0) + 1);
    }
    return map;
  }, [results]);

  /** 项目多选在前端生效：空集合 = 全部项目。 */
  const groupFilteredResults = useMemo(
    () =>
      groupFilters.length === 0
        ? results
        : results.filter((row) => groupFilters.includes(row.rootTitle)),
    [results, groupFilters],
  );

  /** 当前可见结果里已勾选的数量，供批量条的「全选」判断。 */
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const row of groupFilteredResults) {
      if (selectedRows.has(`${row.weekId}-${row.task.id}`)) {
        count += 1;
      }
    }
    return count;
  }, [groupFilteredResults, selectedRows]);

  /** 切换单行勾选；key 与列表渲染 key 一致。 */
  const toggleSelect = useCallback((row: QueryTaskRow) => {
    const key = `${row.weekId}-${row.task.id}`;
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, row);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Map());
  }, []);

  /** 批量条上的全选框：可见结果已全选时取消，否则全选当前可见结果。 */
  const toggleSelectAllVisible = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Map(prev);
      const allSelected =
        groupFilteredResults.length > 0 &&
        groupFilteredResults.every((row) => prev.has(`${row.weekId}-${row.task.id}`));
      if (allSelected) {
        for (const row of groupFilteredResults) {
          next.delete(`${row.weekId}-${row.task.id}`);
        }
      } else {
        for (const row of groupFilteredResults) {
          next.set(`${row.weekId}-${row.task.id}`, row);
        }
      }
      return next;
    });
  }, [groupFilteredResults]);

  /** 项目标签多选切换。 */
  const toggleGroup = useCallback((name: string) => {
    setGroupFilters((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }, []);

  /** 复制选中任务标题：按当前列表顺序分行，可选「1. 」编号前缀。 */
  const copySelected = useCallback(async () => {
    const ordered: QueryTaskRow[] = [];
    const taken = new Set<string>();
    for (const row of groupFilteredResults) {
      const key = `${row.weekId}-${row.task.id}`;
      if (selectedRows.has(key)) {
        ordered.push(row);
        taken.add(key);
      }
    }
    // 已被筛选条件隐藏但仍勾选的行按勾选顺序补在后面。
    for (const [key, row] of selectedRows) {
      if (!taken.has(key)) {
        ordered.push(row);
      }
    }
    if (ordered.length === 0) {
      return;
    }
    const text = ordered
      .map((row, index) => (batchNumbered ? `${index + 1}. ${row.task.title}` : row.task.title))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setBatchCopied(true);
      window.setTimeout(() => setBatchCopied((cur) => (cur ? false : cur)), 1500);
    } catch (error) {
      console.error('批量复制任务失败:', error);
    }
  }, [groupFilteredResults, selectedRows, batchNumbered]);

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

  /** Chip 全集：项目选项 ∪ 当前结果中出现的根任务；计数来自 groupCounts。 */
  const chipOptions = useMemo(() => {
    const names = new Set<string>(groupOptions);
    for (const row of results) {
      names.add(row.rootTitle);
    }
    return [...names].map((name) => ({
      value: name,
      label: name,
      count: groupCounts.get(name) ?? 0,
    }));
  }, [groupOptions, results, groupCounts]);

  const ownerOptions = owners.map((owner) => ({ value: String(owner.id), label: owner.name }));

  const assignerOptions = assigners.map((assigner) => ({
    value: String(assigner.id),
    label: assigner.name,
  }));
  const tagOptions = tags.map((tag) => ({ value: String(tag.id), label: tag.name }));

  const activeWeek = allWeeks.find((week) => week.id === weekId);

  if (!open) {
    return null;
  }

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
          <span className="query-overlay-hint">双击结果打开任务详情 · 悬停行查看操作</span>
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
                label="分派人"
                options={assignerOptions}
                value={assignerId !== undefined ? String(assignerId) : ''}
                onChange={(value) => setAssignerId(value ? Number(value) : undefined)}
              />
              <DropdownSelect
                label="标签"
                options={tagOptions}
                value={tagId !== undefined ? String(tagId) : ''}
                onChange={(value) => setTagId(value ? Number(value) : undefined)}
              />
            </div>
            <div className="query-toolbar-row query-toolbar-row-chips">
              <ChipMultiSelect
                label="项目"
                options={chipOptions}
                selected={groupFilters}
                onToggle={toggleGroup}
                onClear={() => setGroupFilters([])}
              />
            </div>
          </div>

          <div className="query-results-head">
            <span>
              找到 <b>{groupFilteredResults.length}</b> 条任务

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

            {!loading && groupFilteredResults.length === 0 && (

              <EmptyState
                icon={<SearchIcon size={24} />}
                title="没有找到匹配的任务"
                sub="试试调整筛选条件，或清空关键词"
              />
            )}

            {!loading &&
              groupFilteredResults.map((row) => (
                <div
                  key={`${row.weekId}-${row.task.id}`}
                  className="query-row"
                  role="button"
                  tabIndex={0}
                  onDoubleClick={() => openDetail(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      openDetail(row);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    className="query-row-check"
                    aria-label={`选择任务：${row.task.title}`}
                    checked={selectedRows.has(`${row.weekId}-${row.task.id}`)}
                    onChange={() => toggleSelect(row)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.stopPropagation();
                      }
                    }}
                  />

                  <span
                    className={`query-row-dot${row.task.status === 'closed' ? ' closed' : ''}`}
                  />
                  <span className="query-row-main">
                    <span className="query-row-titleline">
                      {renamingId === row.task.id ? (
                        <input
                          autoFocus
                          className="task-title-input"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => void commitRename(row)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              void commitRename(row);
                            } else if (event.key === 'Escape') {
                              setRenamingId(null);
                              setRenameDraft('');
                            }
                          }}
                        />
                      ) : (
                        <span
                          className={`query-row-title${row.task.status === 'closed' ? ' closed' : ''}${copiedId === row.task.id ? ' copied' : ''}`}
                          title="点击复制任务标题，双击查看任务详情"
                          onClick={(event) => handleCopyTitle(event, row.task.title, row.task.id)}
                        >
                          <span className="title-text">{row.task.title}</span>
                          {copiedId === row.task.id && (
                            <span className="query-row-copy-badge">
                              <CheckIcon size={10} />
                              已复制
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="query-row-path">{row.path}</span>
                  </span>
                  {renamingId !== row.task.id && (
                    <span
                      className="query-row-times"
                      title={
                        row.task.status === 'closed' && row.task.closedAt
                          ? `开始 ${formatDateDay(row.task.createdAt)} · 完成 ${formatDateDay(row.task.closedAt)}`
                          : `开始 ${formatDateDay(row.task.createdAt)}`
                      }
                    >
                      <ClockIcon size={12} />
                      <span className="time-date">
                        {formatDateDay(row.task.createdAt)}
                      </span>
                      {row.task.status === 'closed' && row.task.closedAt && (
                        <>
                          <span className="time-arrow">→</span>
                          <span className="time-date">
                            {formatDateDay(row.task.closedAt)}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                  <span className="query-row-tags">
                    {row.task.carriedFromTaskId != null && (
                      <span className="tag tag-carry">带入</span>
                    )}
                    <span className={`tag tag-priority p${row.task.priority}`}>
                      P{row.task.priority}
                    </span>
                    {!row.hasChildren && row.task.executionMode === 'self' && (
                      <span className="tag tag-self">自己</span>
                    )}
                    {!row.hasChildren && row.task.assignerName && (
                      <span className="tag tag-assign-combo">分派·{row.task.assignerName}</span>
                    )}
                    {!row.hasChildren &&
                      row.task.executionMode === 'follow_up' &&
                      row.task.ownerName && (
                        <span className="tag tag-follow-combo">跟进·{row.task.ownerName}</span>
                      )}
                    {row.task.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag tag-label">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="query-row-week">{row.weekLabel}</span>
                  <span className="query-row-actions">
                    <button
                      className="edit-btn"
                      title="重命名"
                      aria-label="重命名"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmingDeleteId(null);
                        setRenamingId(row.task.id);
                        setRenameDraft(row.task.title);
                      }}
                    >
                      <RenameIcon size={14} />
                    </button>
                    <button
                      className="edit-btn"
                      title="任务设置"
                      aria-label="打开任务设置"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(row);
                      }}
                    >
                      <SettingsIcon size={14} />
                    </button>
                    <button
                      className={`edit-btn danger ${confirmingDeleteId === row.task.id ? 'armed' : ''}`}
                      title={
                        confirmingDeleteId === row.task.id
                          ? `再次点击确认删除${deleteCount > 0 ? `（含 ${deleteCount} 项）` : ''}`
                          : '删除任务'
                      }
                      aria-label="删除任务"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (confirmingDeleteId === row.task.id) {
                          void doDelete(row);
                        } else {
                          void armDelete(row);
                        }
                      }}
                    >
                      {confirmingDeleteId === row.task.id ? (
                        <CrossIcon size={14} />
                      ) : (
                        <TrashIcon size={14} />
                      )}
                    </button>
                  </span>
                </div>
              ))}
            {selectedRows.size > 0 && (
              <div className="query-batch-bar">
                <div className="query-batch-inner">
                  <input
                    type="checkbox"
                    className="query-row-check"
                    aria-label="全选当前结果"
                    checked={
                      groupFilteredResults.length > 0 &&
                      selectedVisibleCount === groupFilteredResults.length
                    }
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          selectedVisibleCount > 0 &&
                          selectedVisibleCount < groupFilteredResults.length;
                      }
                    }}
                    onChange={toggleSelectAllVisible}
                  />
                  <span className="query-batch-count">
                    已选 <b>{selectedRows.size}</b> 条
                  </span>
                  <span className="query-batch-sep" />
                  <ToggleSwitch label="加编号" checked={batchNumbered} onChange={setBatchNumbered} />
                  <span className="query-batch-spacer" />
                  <button
                    type="button"
                    className="query-batch-btn"
                    aria-label="清空选择"
                    onClick={clearSelection}
                  >
                    <CrossIcon size={12} />
                    清空
                  </button>
                  <button
                    type="button"
                    className="query-batch-btn primary"
                    aria-label="复制选中任务"
                    onClick={() => void copySelected()}
                  >
                    {batchCopied ? <CheckIcon size={12} /> : <ShareIcon size={12} />}
                    {batchCopied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {detailRow && detailTasks && (
        <TaskDetailPanel
          task={detailRow.task}
          tasks={detailTasks}
          weekId={detailRow.weekId}
          onClose={() => setDetailRow(null)}
          onMutated={() => void handleDetailMutated()}
        />
      )}
    </div>
  );
}
