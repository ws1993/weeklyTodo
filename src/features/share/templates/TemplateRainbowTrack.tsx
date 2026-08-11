import type { ReactNode } from 'react';
import type { ShareData, ShareTaskRow } from '../shareData';
import type { ShareSettings } from '../shareSettings';

interface TemplateRainbowTrackProps {
  data: ShareData;
  settings: ShareSettings;
}

function priorityBadge(priority: number): string {
  return `P${priority}`;
}

function trackCount(rowCount: number, doneCount: number): string {
  return `${rowCount} 项 · ${doneCount} 完成`;
}

/**
 * 分享图卡片：任务按分组分卡展示，徽章承载优先级、负责人和标签。
 */
export function TemplateRainbowTrack({ data, settings }: TemplateRainbowTrackProps) {
  // 按轨道分组（rows 已按根任务顺序连续排列）。
  const tracks: { title: string; color?: string; rows: ShareTaskRow[] }[] = [];
  for (const row of data.rows) {
    const current = tracks[tracks.length - 1];
    if (current && current.title === row.groupTitle) {
      current.rows.push(row);
    } else {
      tracks.push({ title: row.groupTitle, color: row.groupColor, rows: [row] });
    }
  }

  return (
    <div className="share-card">
      {settings.showWeekHeader && (
        <div className="share-card-header">
          <div className="share-card-header-top">
            <span className="share-week-id">{data.weekId}</span>
            <span className="share-week-range">{data.weekRangeCn}</span>
          </div>
          <div className="share-week-title">「周计划 · {data.weekId}」</div>
          <div className="share-stats">
            <div className="share-stat">
              <b>{data.doneTasks}</b>
              <span>完成</span>
            </div>
            <div className="share-stat">
              <b>{data.totalTasks}</b>
              <span>任务总数</span>
            </div>
            <div className="share-stat">
              <b>{data.doneRatio}%</b>
              <span>完成率</span>
            </div>
            <div className="share-stat">
              <b>{data.groupCount}</b>
              <span>分组轨道</span>
            </div>
          </div>
        </div>
      )}

      <div className="share-tracks">
        {tracks.map((track) => {
          const doneCount = track.rows.filter((row) => row.closed).length;
          return (
            <div className="share-track" key={track.title}>
              {settings.showGroupColors && (
                <div className="share-track-head">
                  <span
                    className="share-track-dot"
                    style={{ background: track.color ?? '#8B95A7' }}
                  />
                  <span className="share-track-name">{track.title}</span>
                  <span className="share-track-count">
                    {trackCount(track.rows.length, doneCount)}
                  </span>
                </div>
              )}
              {track.rows.map((row) => (
                <TaskRow key={row.id} row={row} settings={settings} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="share-card-footer">
        <span className="share-footer-dot" />
        <span>来自「周计划」 · 任务分享</span>
        <span className="share-footer-divider" />
      </div>
    </div>
  );
}

function TaskRow({ row, settings }: { row: ShareTaskRow; settings: ShareSettings }) {
  const meta: ReactNode[] = [];
  if (settings.showPriority) {
    meta.push(
      <span className={`share-badge p${row.priority}`} key="priority">
        {priorityBadge(row.priority)}
      </span>,
    );
  }
  if (settings.showAssignments && !row.hasChildren) {
    if (row.assignerName) {
      meta.push(
        <span className="share-badge assigner" key="assigner">
          分派·{row.assignerName}
        </span>,
      );
    }
    if (row.executionMode === 'follow_up' && row.ownerName) {
      meta.push(
        <span className="share-badge owner" key="owner">
          跟进·{row.ownerName}
        </span>,
      );
    } else if (row.executionMode === 'self') {
      meta.push(
        <span className="share-badge self" key="self">
          自己
        </span>,
      );
    }
  }
  if (settings.showTags) {
    row.tags.slice(0, 4).forEach((tag) => {
      meta.push(
        <span className="share-badge tag" key={tag}>
          {tag}
        </span>,
      );
    });
  }

  return (
    <div className={`share-task-row depth-${Math.min(row.depth, 4)}`}>
      <span className="share-tree-guide">
        {row.depth === 0 ? '◆' : row.depth === 1 ? '├─' : row.depth === 2 ? '└─' : '·'}
      </span>
      <span className={`share-task-title${row.closed ? ' closed' : ''}`}>
        {row.title}
        {settings.showDescription && row.description && (
          <span className="share-task-desc">{row.description}</span>
        )}
      </span>
      {meta.length > 0 && <span className="share-task-meta">{meta}</span>}
    </div>
  );
}
