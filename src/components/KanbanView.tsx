import { useMemo } from 'react';
import type { GroupColor, Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { taskPath } from '../utils/tree';
import { groupColorMap } from '../utils/groupColors';
import { fireConfetti } from '../utils/confetti';
import { CheckIcon, ClockIcon, PersonIcon, TagIcon, ZapIcon } from './ForestIcons';

interface KanbanViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  groupColors?: GroupColor[];
}

export function KanbanView({ tasks, onSelectTask, groupColors = [] }: KanbanViewProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const colorMap = useMemo(() => groupColorMap(groupColors), [groupColors]);

  const columns = useMemo(() => {
    // 找出所有作为父节点的任务 ID，仅保留纯叶子节点（具体执行项）
    const parentIds = new Set(
      tasks.map((t) => t.parentId).filter((id): id is number => id != null),
    );
    const leafTasks = tasks.filter((t) => !parentIds.has(t.id));

    const todo: Task[] = [];
    const highPriority: Task[] = [];
    const following: Task[] = [];
    const closed: Task[] = [];

    leafTasks.forEach((task) => {
      if (task.status === 'closed') {
        closed.push(task);
      } else if (task.executionMode === 'follow_up') {
        following.push(task);
      } else if (task.priority <= 1) {
        highPriority.push(task);
      } else {
        todo.push(task);
      }
    });

    // Sort by priority and index
    const sorter = (a: Task, b: Task) => a.priority - b.priority || a.sortIndex - b.sortIndex;

    return {
      highPriority: highPriority.sort(sorter),
      todo: todo.sort(sorter),
      following: following.sort(sorter),
      closed: closed.sort(sorter),
    };
  }, [tasks]);

  const handleToggle = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (task.status !== 'closed') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    await toggleTask(task.id, task.weekId, task.status);
  };

  const renderCard = (task: Task) => {
    const path = taskPath(tasks, task.id);
    const rootTask = tasks.find((item) => {
      let cur: Task | undefined = task;
      while (cur && cur.parentId != null) {
        cur = tasks.find((p) => p.id === cur!.parentId);
      }
      return cur ? cur.id === item.id : false;
    });
    const rootColor = rootTask ? colorMap.get(rootTask.title) : undefined;

    return (
      <div
        key={task.id}
        className={`kanban-card ${task.status === 'closed' ? 'closed' : ''}`}
        onClick={() => onSelectTask(task)}
        role="button"
        tabIndex={0}
      >
        <div className="kanban-card-top">
          <button
            type="button"
            className={`task-check ${task.status === 'closed' ? 'done' : ''}`}
            onClick={(e) => void handleToggle(e, task)}
            title={task.status === 'closed' ? '重新打开任务' : '标记为已完成'}
          >
            <CheckIcon size={12} />
          </button>
          <span className="kanban-card-title">{task.title}</span>
        </div>

        <div className="kanban-card-meta">
          <span className={`tag tag-priority-${task.priority}`}>P{task.priority}</span>
          {task.executionMode === 'follow_up' && (
            <span className="tag tag-mode-follow">跟进</span>
          )}
          {task.ownerName && (
            <span className="tag" style={{ gap: '3px' }}>
              <PersonIcon size={12} />
              {task.ownerName}
            </span>
          )}
          {task.tags && task.tags.length > 0 && (
            <span className="tag" style={{ gap: '3px' }}>
              <TagIcon size={11} />
              {task.tags[0]}
            </span>
          )}
        </div>

        {path !== task.title && (
          <div className="kanban-card-path" title={path}>
            {rootColor && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: rootColor,
                  marginRight: '4px',
                }}
              />
            )}
            {path}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="kanban-view-container">
      {/* Col 1: 高优进行中 (P0/P1) */}
      <div className="kanban-column">
        <div className="kanban-col-head">
          <div className="kanban-col-title-wrap">
            <ZapIcon size={15} />
            <span style={{ color: 'var(--brand)' }}>高优聚焦 (P0 / P1)</span>
          </div>
          <span className="kanban-col-count">{columns.highPriority.length}</span>
        </div>
        <div className="kanban-cards-scroll">
          {columns.highPriority.map(renderCard)}
          {columns.highPriority.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-4)', fontSize: '12px' }}>
              暂无高优任务
            </div>
          )}
        </div>
      </div>

      {/* Col 2: 普通待办 (To Do) */}
      <div className="kanban-column">
        <div className="kanban-col-head">
          <div className="kanban-col-title-wrap">
            <ClockIcon size={14} />
            <span>日常待办 (To Do)</span>
          </div>
          <span className="kanban-col-count">{columns.todo.length}</span>
        </div>
        <div className="kanban-cards-scroll">
          {columns.todo.map(renderCard)}
          {columns.todo.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-4)', fontSize: '12px' }}>
              暂无常规待办
            </div>
          )}
        </div>
      </div>

      {/* Col 3: 需跟进 (Following) */}
      <div className="kanban-column">
        <div className="kanban-col-head">
          <div className="kanban-col-title-wrap">
            <PersonIcon size={15} />
            <span style={{ color: 'var(--purple)' }}>跟进协作 (Following)</span>
          </div>
          <span className="kanban-col-count">{columns.following.length}</span>
        </div>
        <div className="kanban-cards-scroll">
          {columns.following.map(renderCard)}
          {columns.following.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-4)', fontSize: '12px' }}>
              暂无跟进任务
            </div>
          )}
        </div>
      </div>

      {/* Col 4: 已完成 (Closed) */}
      <div className="kanban-column">
        <div className="kanban-col-head">
          <div className="kanban-col-title-wrap">
            <CheckIcon size={15} />
            <span style={{ color: 'var(--success)' }}>已完成 (Closed)</span>
          </div>
          <span className="kanban-col-count" style={{ color: 'var(--success)', background: 'var(--success-soft)' }}>
            {columns.closed.length}
          </span>
        </div>
        <div className="kanban-cards-scroll">
          {columns.closed.map(renderCard)}
          {columns.closed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-4)', fontSize: '12px' }}>
              暂无已完成任务
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
