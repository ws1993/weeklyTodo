import { useEffect, useRef, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import {
  BranchIcon,
  CheckIcon,
  CrossIcon,
  EditIcon,
  LeafIcon,
  PlusIcon,
  SettingsIcon,
} from './ForestIcons';
import { TaskDetailPanel } from './TaskDetailPanel';

interface TaskTreeProps {
  tasks: Task[];
}

export function TaskTree({ tasks }: TaskTreeProps) {
  const addTask = useAppStore((state) => state.addTask);
  const [addingParentId, setAddingParentId] = useState<number | 'root' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const rootTasks = tasks
    .filter((task) => task.parentId === null)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id);

  const submitDraft = async () => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    await addTask({ title, parentId: addingParentId === 'root' ? null : addingParentId });
    setDraftTitle('');
    setAddingParentId(null);
  };

  if (tasks.length === 0 && addingParentId === null) {
    return (
      <div className="empty-forest">
        <span className="empty-glyph"><BranchIcon size={74} /></span>
        <p>这一周还没有种下任务</p>
        <p className="empty-sub">为这一周种下第一棵任务树吧</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 6 }}
          onClick={() => setAddingParentId('root')}
        >
          <PlusIcon size={15} />
          种下第一个任务
        </button>
      </div>
    );
  }

  return (
    <div>
      {rootTasks.map((task) => (
        <TaskNode
          key={task.id}
          task={task}
          allTasks={tasks}
          isTop
          onOpenSettings={setSelectedTask}
        />
      ))}

      {addingParentId === null ? (
        <div className="add-inline" style={{ marginTop: 10 }}>
          <span className="node-glyph"><LeafIcon size={17} /></span>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingParentId('root')}>
            <PlusIcon size={13} />
            新建根分支
          </button>
        </div>
      ) : (
        <div className="add-inline">
          <span className="node-glyph"><LeafIcon size={17} /></span>
          <input
            autoFocus
            placeholder="输入新分支，回车确认…"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submitDraft();
              } else if (event.key === 'Escape') {
                setAddingParentId(null);
                setDraftTitle('');
              }
            }}
          />
          <button
            className="ok-btn"
            title="确认"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void submitDraft()}
          >
            <CheckIcon size={13} />
          </button>
          <button
            className="no-btn"
            title="取消"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setAddingParentId(null);
              setDraftTitle('');
            }}
          >
            <CrossIcon size={13} />
          </button>
        </div>
      )}

      <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

interface TaskNodeProps {
  task: Task;
  allTasks: Task[];
  isTop?: boolean;
  onOpenSettings: (task: Task) => void;
}

function TaskNode({ task, allTasks, isTop = false, onOpenSettings }: TaskNodeProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const editTask = useAppStore((state) => state.editTask);
  const addTask = useAppStore((state) => state.addTask);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineDraft, setInlineDraft] = useState('');
  const childrenRef = useRef<HTMLDivElement>(null);

  const children = allTasks
    .filter((child) => child.parentId === task.id)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id);
  const hasChildren = children.length > 0;
  const closed = task.status === 'closed';

  const saveEdit = async () => {
    const title = draft.trim();
    if (title && title !== task.title) {
      await editTask(task.id, { title });
    }
    setEditing(false);
  };

  const visibleTags = task.tags.slice(0, 3);
  const extraTagCount = task.tags.length - visibleTags.length;

  const commitInline = async () => {
    const title = inlineDraft.trim();
    if (!title) {
      setShowInlineAdd(false);
      setInlineDraft('');
      return;
    }
    await addTask({ title, parentId: task.id });
    setShowInlineAdd(false);
    setInlineDraft('');
  };

  return (
    <div className={`tree-node ${closed ? 'closed' : ''}`} data-node={task.id}>
      <div
        className={`tree-row ${closed ? 'closed' : ''} ${isTop ? 'top' : ''}`}
        onClick={() => onOpenSettings(task)}
      >
        <button
          className={`toggle-node ${closed ? 'done' : ''}`}
          title={closed ? '重新打开' : '标记完成'}
          onClick={(event) => {
            event.stopPropagation();
            void toggleTask(task.id);
          }}
        >
          {closed && <CheckIcon size={10} />}
        </button>

        <span className={`node-glyph ${hasChildren ? 'gi-branch' : 'gi-leaf'}`}>
          {hasChildren ? <BranchIcon size={17} /> : <LeafIcon size={17} />}
        </span>

        <span className="node-title-wrap" onClick={(event) => event.stopPropagation()}>
          {editing ? (
            <input
              autoFocus
              className="task-title-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => void saveEdit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void saveEdit();
                } else if (event.key === 'Escape') {
                  setEditing(false);
                  setDraft(task.title);
                }
              }}
            />
          ) : (
            <span className="node-title" onDoubleClick={() => setEditing(true)}>
              {task.title}
            </span>
          )}
        </span>

        {task.carriedFromTaskId != null && <span className="tag tag-carry">带入</span>}
        {closed && <span className="tag tag-closed">已完成</span>}
        <span className={`tag tag-priority ${task.priority === 0 ? 'p0' : ''}`}>
          P{task.priority}
        </span>
        {task.executionMode === 'follow_up' && task.ownerName && (
          <span className="tag tag-owner">{task.ownerName}</span>
        )}
        {visibleTags.map((tag) => (
          <span key={tag} className="tag tag-label">{tag}</span>
        ))}
        {extraTagCount > 0 && <span className="tag tag-extra">+{extraTagCount}</span>}

        <span className="row-spacer" />
        <span className="task-actions">
          {!closed && (
            <button
              className="add-btn"
              title="添加分支"
              onClick={(event) => {
                event.stopPropagation();
                setShowInlineAdd(true);
              }}
            >
              <PlusIcon size={12} />
              分支
            </button>
          )}
          <button
            className="edit-btn"
            title="重命名"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
          >
            <EditIcon size={14} />
          </button>
          <button
            className="edit-btn"
            title="任务设置"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings(task);
            }}
          >
            <SettingsIcon size={14} />
          </button>
        </span>
      </div>

      {(hasChildren || showInlineAdd) && (
        <div
          className={`tree-children ${closed ? 'dormant' : ''}`}
          ref={childrenRef}
        >
          {hasChildren &&
            children.map((child) => (
              <TaskNode
                key={child.id}
                task={child}
                allTasks={allTasks}
                onOpenSettings={onOpenSettings}
              />
            ))}

          {showInlineAdd && !closed && (
            <div className="add-inline">
              <span className="node-glyph"><LeafIcon size={17} /></span>
              <input
                autoFocus
                placeholder="输入新分支，回车确认…"
                value={inlineDraft}
                onChange={(event) => setInlineDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void commitInline();
                  } else if (event.key === 'Escape') {
                    setShowInlineAdd(false);
                    setInlineDraft('');
                  }
                }}
              />
              <button
                className="ok-btn"
                title="确认"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void commitInline()}
              >
                <CheckIcon size={13} />
              </button>
              <button
                className="no-btn"
                title="取消"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setShowInlineAdd(false);
                  setInlineDraft('');
                }}
              >
                <CrossIcon size={13} />
              </button>
            </div>
          )}

          <ChildrenConnector
            containerRef={childrenRef}
            childrenCount={children.length + (showInlineAdd && !closed ? 1 : 0)}
          />
        </div>
      )}
    </div>
  );
}

interface ChildrenConnectorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  childrenCount: number;
}

/** 有机连接线：在 children 容器内测量每行位置并绘制枝干与芽点。 */
function ChildrenConnector({ containerRef, childrenCount }: ChildrenConnectorProps) {
  const [rows, setRows] = useState<{ y: number; dim: boolean }[]>([]);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const measure = () => {
      const cRect = container.getBoundingClientRect();
      setHeight(Math.max(container.scrollHeight, 12));
      const items = Array.from(container.children).filter(
        (child) => child instanceof HTMLElement && child.classList.contains('tree-node'),
      ) as HTMLElement[];
      setRows(
        items.map((item) => {
          const rowEl = item.querySelector(':scope > .tree-row') as HTMLElement | null;
          const rect = rowEl ? rowEl.getBoundingClientRect() : item.getBoundingClientRect();
          return {
            y: rect.top - cRect.top + rect.height / 2,
            dim: item.classList.contains('closed'),
          };
        }),
      );
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [containerRef, childrenCount]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <svg className="connector" width={30} height={height} aria-hidden="true">
      <path
        d={`M13 0 V${Math.max(height - 6, 8)}`}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      {rows.map((row, index) => (
        <g key={index}>
          <path
            d={`M13 ${row.y} C 13 ${row.y + 7}, 27 ${row.y - 4}, 30 ${row.y}`}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity={row.dim ? '0.35' : '0.8'}
          />
          <circle
            cx="13"
            cy={row.y}
            r="2.2"
            className={`bud ${row.dim ? 'dim' : ''}`}
          />
        </g>
      ))}
    </svg>
  );
}
