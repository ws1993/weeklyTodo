import { useMemo, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import {
  CheckIcon,
  ChevronRightIcon,
  CrossIcon,
  EditIcon,
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

  const rootTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.parentId === null)
        .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id),
    [tasks],
  );

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
          onOpenSettings={setSelectedTask}
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
  onOpenSettings: (task: Task) => void;
}

function TaskNode({ task, allTasks, isTop = false, onOpenSettings }: TaskNodeProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const editTask = useAppStore((state) => state.editTask);
  const addTask = useAppStore((state) => state.addTask);
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineDraft, setInlineDraft] = useState('');

  const children = useMemo(
    () =>
      allTasks
        .filter((child) => child.parentId === task.id)
        .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id),
    [allTasks, task.id],
  );
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
            />
          ))}
        </div>
      )}

      {showInlineAdd && !closed && (
        <div className="add-inline">
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
