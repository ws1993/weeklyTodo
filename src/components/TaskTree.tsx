import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { computeDrop, descendantIds, sortedChildren, subtreeSize } from '../utils/tree';
import type { DropPosition } from '../utils/tree';
import {
  CheckIcon,
  ChevronRightIcon,
  CrossIcon,
  PlusIcon,
  RenameIcon,
  SettingsIcon,
  TrashIcon,
} from './ForestIcons';
import { TaskDetailPanel } from './TaskDetailPanel';

interface TaskTreeProps {
  tasks: Task[];
  /** 每次变化都视为一次「新建任务」请求，打开根级新建输入行。 */
  newTaskRequest?: number;
  /** 定位请求：滚动到该任务并高亮，同时展开其祖先节点。 */
  locateRequest?: { taskId: number; nonce: number } | null;
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
  getDraggingId: () => number | null;
  updateDrop: (indicator: DropIndicator | null) => void;
  handleDrop: (target: Task, position: DropPosition) => void;
  suppressNextClick: () => boolean;
}

export function TaskTree({ tasks, newTaskRequest = 0, locateRequest = null }: TaskTreeProps) {
  const addTask = useAppStore((state) => state.addTask);
  const moveTask = useAppStore((state) => state.moveTask);
  const treeRef = useRef<HTMLDivElement | null>(null);
  const [addingParentId, setAddingParentId] = useState<number | 'root' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  // Some browsers fire a click on the dragged row after the drag ends; swallow it.
  const suppressClickRef = useRef(false);
  // The HTML5 drag handlers run synchronously and cannot rely on React state
  // (setState inside dragstart is async), so mirror the dragged id in a ref.
  const draggingIdRef = useRef<number | null>(null);

  const rootTasks = useMemo(() => sortedChildren(tasks, null), [tasks]);

  const locateTargetId = locateRequest?.taskId ?? null;

  useEffect(() => {
    if (!locateRequest) {
      return;
    }
    // 等待祖先节点展开与 DOM 更新完成后再滚动。
    const timer = window.setTimeout(() => {
      const node = treeRef.current?.querySelector(`[data-node="${locateRequest.taskId}"]`);
      const row = node?.querySelector<HTMLElement>('.tree-row');
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('locate-flash');
        window.setTimeout(() => row.classList.remove('locate-flash'), 1800);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [locateRequest]);

  useEffect(() => {
    if (newTaskRequest > 0) {
      setAddingParentId('root');
      setDraftTitle('');
    }
  }, [newTaskRequest]);

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
    draggingIdRef.current = taskId;
    setDraggingId(taskId);
    setDropIndicator(null);
  };

  const endDrag = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropIndicator(null);
    suppressClickRef.current = true;
  };

  const getDraggingId = () => draggingIdRef.current;

  const updateDrop = (indicator: DropIndicator | null) => {
    setDropIndicator((prev) =>
      prev?.taskId === indicator?.taskId && prev?.position === indicator?.position
        ? prev
        : indicator,
    );
  };

  const handleDrop = (target: Task, position: DropPosition) => {
    const draggedId = draggingIdRef.current;
    if (draggedId === null) {
      return;
    }
    const drop = computeDrop(tasks, draggedId, target, position);
    if (drop) {
      void moveTask(draggedId, drop.parentId, drop.index);
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
    getDraggingId,
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
    <div ref={treeRef}>
      {rootTasks.map((task) => (
        <TaskNode
          key={task.id}
          task={task}
          allTasks={tasks}
          isTop
          depth={0}
          expandTargetId={locateTargetId}
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
  /** 定位目标任务 id：若在该节点的子树中，则自动展开。 */
  expandTargetId?: number | null;
  onOpenSettings: (task: Task) => void;
  drag: TreeDragProps;
}

function TaskNode({
  task,
  allTasks,
  isTop = false,
  depth = 0,
  expandTargetId = null,
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

  // 定位目标位于本节点子树内时，强制展开以便目标可见。
  useEffect(() => {
    if (expandTargetId != null && descendantIds(allTasks, task.id).has(expandTargetId)) {
      setExpanded(true);
    }
  }, [expandTargetId, allTasks, task.id]);

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
    hasChildren ? 'collapsible' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const draggedId = drag.getDraggingId();
    if (draggedId === null || draggedId === task.id) {
      return;
    }
    // Always allow the drop event to fire so we control the outcome and the
    // cursor (move vs no-drop) based on computeDrop, instead of leaving the
    // browser's default "forbidden" gesture.
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const position: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    const drop = computeDrop(allTasks, draggedId, task, position);
    if (!drop) {
      event.dataTransfer.dropEffect = 'none';
      drag.updateDrop(null);
      return;
    }
    event.dataTransfer.dropEffect = 'move';
    drag.updateDrop({ taskId: task.id, position });
  };

  // Some engines (e.g. WebView2) also require preventing default on dragenter
  // before dragover can enable the drop.
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    const draggedId = drag.getDraggingId();
    if (draggedId === null || draggedId === task.id) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
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
          // 行主体（复选框以前）作为收起/展开交互区，避免误触打开任务详情。
          if (hasChildren) {
            setExpanded((value) => !value);
          }
        }}
        draggable={!editing}
        onDragEnter={handleDragEnter}
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

        <span
          className="node-title-wrap"
          onClick={(event) => {
            // 编辑标题时点击输入框不应触发整行的收起/展开。
            if (editing) {
              event.stopPropagation();
            }
          }}
        >
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
            aria-label="重命名"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
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
