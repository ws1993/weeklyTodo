import { useMemo, useRef, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { computeDrop, sortedChildren, subtreeSize } from '../utils/tree';
import type { DropPosition } from '../utils/tree';
import {
  CheckIcon,
  ChevronRightIcon,
  CrossIcon,
  EditIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from './ForestIcons';
import { TaskDetailPanel } from './TaskDetailPanel';

interface TaskTreeProps {
  tasks: Task[];
}

interface DropIndicator {
  taskId: number;
  position: DropPosition;
}

interface TreeDragProps {
  draggingId: number | null;
  dropIndicator: DropIndicator | null;
  startDrag: (taskId: number) => void;
  endDrag: () => void;
  updateDrop: (indicator: DropIndicator | null) => void;
  handleDrop: (target: Task, position: DropPosition) => void;
  suppressNextClick: () => boolean;
}

export function TaskTree({ tasks }: TaskTreeProps) {
  const addTask = useAppStore((state) => state.addTask);
  const moveTask = useAppStore((state) => state.moveTask);
  const [addingParentId, setAddingParentId] = useState<number | 'root' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  // Some browsers fire a click on the dragged row after the drag ends; swallow it.
  const suppressClickRef = useRef(false);

  const rootTasks = useMemo(() => sortedChildren(tasks, null), [tasks]);

  const submitDraft = async () => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    await addTask({ title, parentId: addingParentId === 'root' ? null : addingParentId });
    setDraftTitle('');
    setAddingParentId(null);
  };

  const startDrag = (taskId: number) => {
    setDraggingId(taskId);
    setDropIndicator(null);
  };

  const endDrag = () => {
    setDraggingId(null);
    setDropIndicator(null);
    suppressClickRef.current = true;
  };

  const updateDrop = (indicator: DropIndicator | null) => {
    setDropIndicator((prev) =>
      prev?.taskId === indicator?.taskId && prev?.position === indicator?.position
        ? prev
        : indicator,
    );
  };

  const handleDrop = (target: Task, position: DropPosition) => {
    if (draggingId === null) {
      return;
    }
    const drop = computeDrop(tasks, draggingId, target, position);
    if (drop) {
      void moveTask(draggingId, drop.parentId, drop.index);
    }
    endDrag();
  };

  const suppressNextClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  };

  const dragProps: TreeDragProps = {
    draggingId,
    dropIndicator,
    startDrag,
    endDrag,
    updateDrop,
    handleDrop,
    suppressNextClick,
  };

  if (tasks.length === 0 && addingParentId === null) {
    return (
      <div className="empty-forest">
        <span className="empty-glyph"><PlusIcon size={28} /></span>
        <p>本周还没有任务</p>
        <p className="empty-sub">点击「新建任务」开始规划</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 6 }}
          onClick={() => setAddingParentId('root')}
        >
          <PlusIcon size={15} />
          新建任务
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
          depth={0}
          onOpenSettings={setSelectedTask}
          drag={dragProps}
        />
      ))}

      {addingParentId === null ? (
        <div className="add-inline" style={{ marginTop: 10, paddingLeft: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingParentId('root')}>
            <PlusIcon size={13} />
            新建任务
          </button>
        </div>
      ) : (
        <div className="add-inline" style={{ paddingLeft: 14 }}>
          <input
            autoFocus
            placeholder="输入任务名称，回车确认…"
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
  depth?: number;
  onOpenSettings: (task: Task) => void;
  drag: TreeDragProps;
}

function TaskNode({
  task,
  allTasks,
  isTop = false,
  depth = 0,
  onOpenSettings,
  drag,
}: TaskNodeProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const editTask = useAppStore((state) => state.editTask);
  const addTask = useAppStore((state) => state.addTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineDraft, setInlineDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const children = useMemo(() => sortedChildren(allTasks, task.id), [allTasks, task.id]);
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

  const isDragging = drag.draggingId === task.id;
  const drop = drag.dropIndicator?.taskId === task.id ? drag.dropIndicator.position : null;
  const depthClass = depth > 0 ? `depth-${Math.min(depth, 5)}` : '';
  const nodeClass = [
    'tree-node',
    closed ? 'closed' : '',
    depthClass,
  ]
    .filter(Boolean)
    .join(' ');
  const rowClass = [
    'tree-row',
    closed ? 'closed' : '',
    isTop ? 'top' : '',
    depthClass,
    isDragging ? 'dragging' : '',
    drop ? `drop-${drop}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (drag.draggingId === null || drag.draggingId === task.id) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const position: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    if (!computeDrop(allTasks, drag.draggingId, task, position)) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    drag.updateDrop({ taskId: task.id, position });
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    if (drag.dropIndicator?.taskId === task.id) {
      drag.updateDrop(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const position: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    drag.handleDrop(task, position);
  };

  const deleteSubtreeSize = subtreeSize(allTasks, task.id);

  return (
    <div className={nodeClass} data-node={task.id}>
      <div
        className={rowClass}
        onClick={() => {
          if (drag.suppressNextClick()) {
            return;
          }
          onOpenSettings(task);
        }}
        draggable={!editing}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(task.id));
          drag.startDrag(task.id);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={drag.endDrag}
      >
        <button
          className={`task-toggle ${hasChildren ? (expanded ? 'open' : '') : 'leaf'}`}
          title={hasChildren ? (expanded ? '折叠' : '展开') : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) {
              setExpanded((value) => !value);
            }
          }}
        >
          {hasChildren && <ChevronRightIcon size={15} />}
        </button>

        <button
          className={`task-check ${closed ? 'done' : ''}`}
          title={closed ? '重新打开' : '标记完成'}
          onClick={(event) => {
            event.stopPropagation();
            void toggleTask(task.id);
          }}
        >
          {closed && <CheckIcon size={12} />}
        </button>

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
        <span className={`tag tag-priority p${task.priority}`}>P{task.priority}</span>
        {task.executionMode === 'self' && <span className="tag tag-self">自己</span>}
        {task.executionMode === 'follow_up' && <span className="tag tag-follow">跟进</span>}
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
              title="添加子任务"
              onClick={(event) => {
                event.stopPropagation();
                setShowInlineAdd(true);
              }}
            >
              <PlusIcon size={12} />
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
          <button
            className={`edit-btn danger ${confirmingDelete ? 'armed' : ''}`}
            title={
              confirmingDelete
                ? `再次点击确认删除（含 ${deleteSubtreeSize} 项）`
                : '删除任务'
            }
            onClick={(event) => {
              event.stopPropagation();
              if (confirmingDelete) {
                void deleteTask(task.id);
              } else {
                setConfirmingDelete(true);
                window.setTimeout(() => setConfirmingDelete(false), 3000);
              }
            }}
            onMouseLeave={() => {
              if (confirmingDelete) {
                setConfirmingDelete(false);
              }
            }}
          >
            {confirmingDelete ? <CrossIcon size={14} /> : <TrashIcon size={14} />}
          </button>
        </span>
      </div>

      {hasChildren && expanded && (
        <div className="tree-children">
          {children.map((child) => (
            <TaskNode
              key={child.id}
              task={child}
              allTasks={allTasks}
              onOpenSettings={onOpenSettings}
              depth={depth + 1}
              drag={drag}
            />
          ))}
        </div>
      )}

      {showInlineAdd && !closed && (
        <div className={`add-inline ${depthClass}`}>
          <input
            autoFocus
            placeholder="输入子任务名称，回车确认…"
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
    </div>
  );
}
