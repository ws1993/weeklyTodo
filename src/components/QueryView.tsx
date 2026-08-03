import { useCallback, useEffect, useState } from 'react';
import type { QueryTaskRow } from '../shared/contracts/types';
import { queryAllTasks, weekSummaries } from '../api/nativeBridge';
import type { WeekSummary } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { CrossIcon } from './ForestIcons';

interface QueryViewProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (weekId: string) => void;
}

export function QueryView({ open, onClose, onNavigate }: QueryViewProps) {
  const allWeeks = useAppStore((state) => state.allWeeks);
  const owners = useAppStore((state) => state.owners);
  const tags = useAppStore((state) => state.tags);
  const [keyword, setKeyword] = useState('');
  const [weekId, setWeekId] = useState('');
  const [status, setStatus] = useState('');
  const [carriedOnly, setCarriedOnly] = useState(false);
  const [ownerId, setOwnerId] = useState<number | undefined>();
  const [tagId, setTagId] = useState<number | undefined>();
  const [results, setResults] = useState<QueryTaskRow[]>([]);
  const [summaries, setSummaries] = useState<WeekSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const runQuery = useCallback(async () => {
    if (!open) {
      return;
    }
    setLoading(true);
    try {
      const rows = await queryAllTasks({
        keyword: keyword || undefined,
        weekId: weekId || undefined,
        status: status || undefined,
        carriedOverOnly: carriedOnly || undefined,
        ownerId: ownerId || undefined,
        tagId: tagId || undefined,
      });
      setResults(rows);
      const summariesData = await weekSummaries();
      setSummaries(summariesData);
    } finally {
      setLoading(false);
    }
  }, [open, keyword, weekId, status, carriedOnly, ownerId, tagId]);

  useEffect(() => {
    void runQuery();
  }, [runQuery]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">查看所有周</h2>
        <p className="modal-sub">跨周检索任务分支，点击结果直接跳转到对应的一周。</p>

        <div className="query-filters">
          <div className="filter-group">
            <span className="f-label">周</span>
            <select value={weekId} onChange={(event) => setWeekId(event.target.value)}>
              <option value="">全部周</option>
              {allWeeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.id}
                </option>
              ))}
            </select>
            <span className="f-sep">|</span>
            <span className="f-label">状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="in_progress">未完成</option>
              <option value="closed">已完成</option>
            </select>
            <label className="check">
              <input
                type="checkbox"
                checked={carriedOnly}
                onChange={(event) => setCarriedOnly(event.target.checked)}
              />
              仅看带入
            </label>
          </div>
          <div className="filter-group">
            <span className="f-label">负责人</span>
            <select value={ownerId ?? ''} onChange={(event) => setOwnerId(event.target.value ? Number(event.target.value) : undefined)}>
              <option value="">全部负责人</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <span className="f-sep">|</span>
            <span className="f-label">标签</span>
            <select value={tagId ?? ''} onChange={(event) => setTagId(event.target.value ? Number(event.target.value) : undefined)}>
              <option value="">全部标签</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="f-label">关键词</span>
            <input
              type="text"
              placeholder="任务名或路径…"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>

        <div className="query-results-head">
          <span>找到 {results.length} 条分支 · {summaries.length} 个周</span>
        </div>

        <div className="query-results">
          {loading && <div className="query-empty">查询中…</div>}
          {!loading && results.length === 0 && (
            <div className="query-empty">
              没有找到匹配的分支
              <br />
              试试调整筛选条件
            </div>
          )}
          {!loading &&
            results.map((row) => (
              <div
                key={`${row.weekId}-${row.task.id}`}
                className="query-row"
                onClick={() => {
                  onNavigate(row.weekId);
                  onClose();
                }}
              >
                <span className={`r-dot ${row.task.status === 'closed' ? 'closed' : 'open'}`} />
                <span className="r-main">
                  <span className={`r-title ${row.task.status === 'closed' ? 'closed' : ''}`}>
                    {row.task.title}
                  </span>
                  <span className="r-path">{row.path}</span>
                </span>
                {row.task.carriedFromTaskId != null && <span className="tag tag-carry">带入</span>}
                <span className={`tag tag-priority p${row.task.priority}`}>P{row.task.priority}</span>
                {row.task.executionMode === 'self' && <span className="tag tag-self">自己</span>}
                {row.task.executionMode === 'follow_up' && (
                  <span className="tag tag-follow">跟进</span>
                )}
                {row.task.executionMode === 'follow_up' && row.task.ownerName && (
                  <span className="tag tag-owner">{row.task.ownerName}</span>
                )}
                {row.task.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag tag-label">{tag}</span>
                ))}
                <span className="r-week">{row.weekLabel}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
