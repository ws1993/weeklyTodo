import { useEffect, useMemo, useState } from 'react';
import { Radio, Select } from 'antd';
import type { ExecutionMode, Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { formatDateTimeMinute } from '../utils/formatDateTime';
import { appendIndex, descendantIds, subtreeSize, taskPath } from '../utils/tree';
import { CheckIcon, CrossIcon, TrashIcon } from './ForestIcons';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
  /** 所在周的任务树（上级任务下拉 / 删除数量等上下文）。缺省取当前激活周 store 数据。 */
  tasks?: Task[];
  /** 操作目标周；缺省取当前激活周。查询页跨周编辑时传入行所在周。 */
  weekId?: string;
  /** 保存 / 完成 / 删除成功后的回调，用于查询页刷新结果。 */
  onMutated?: () => void | Promise<void>;
}

const priorityOptions = [
  { value: 0, label: 'P0 紧急' },
  { value: 1, label: 'P1 高' },
  { value: 2, label: 'P2 普通' },
  { value: 3, label: 'P3 低' },
];

export function TaskDetailPanel({ task, onClose, tasks, weekId, onMutated }: TaskDetailPanelProps) {
  const editTask = useAppStore((state) => state.editTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const moveTask = useAppStore((state) => state.moveTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const owners = useAppStore((state) => state.owners);
  const assigners = useAppStore((state) => state.assigners);
  const tags = useAppStore((state) => state.tags);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const storeTreeTasks = useAppStore((state) => state.tree?.tasks ?? []);
  const treeTasks = tasks ?? storeTreeTasks;
  const targetWeekId = weekId ?? activeWeekId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('self');
  const [ownerValue, setOwnerValue] = useState<string[]>([]);
  const [assignerValue, setAssignerValue] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [parentValue, setParentValue] = useState<string>('none');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      return;
    }
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setExecutionMode(task.executionMode ?? 'self');
    setOwnerValue(task.ownerName ? [task.ownerName] : []);
    setAssignerValue(task.assignerName ? [task.assignerName] : []);
    setTagNames(task.tags ?? []);
    setParentValue(task.parentId == null ? 'none' : String(task.parentId));
    setConfirmingDelete(false);
    setError(null);
  }, [task]);

  const parentOptions = useMemo(() => {
    if (!task) {
      return [];
    }
    const excluded = new Set([task.id, ...descendantIds(treeTasks, task.id)]);
    return [
      { value: 'none', label: '（无上级 · 顶层任务）' },
      ...treeTasks
        .filter((item) => !excluded.has(item.id))
        .map((item) => ({
          value: String(item.id),
          label: taskPath(treeTasks, item.id),
          // 已关闭的父节点可选：保存后由后端自动重开该节点及其祖先链。
        })),
    ];
  }, [treeTasks, task]);

  if (!task) {
    return null;
  }

  const hasChildren = treeTasks.some((item) => item.parentId === task.id);
  const ownerOptions = owners.map((owner) => ({ value: owner.name, label: owner.name }));
  const assignerOptions = assigners.map((assigner) => ({
    value: assigner.name,
    label: assigner.name,
  }));
  const tagOptions = tags.map((tag) => ({ value: tag.name, label: tag.name }));

  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('任务标题不能为空');
      return;
    }
    if (executionMode === 'follow_up' && ownerValue.length === 0) {
      setError('跟进任务需要指定负责人');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const newParentId = parentValue === 'none' ? null : Number(parentValue);
      if (newParentId !== task.parentId) {
        // 行所在周的任务树已作为上下文传入，appendIndex 与落库都按目标周处理。
        await moveTask(task.id, newParentId, appendIndex(treeTasks, newParentId, task.id), targetWeekId);
      }
      await editTask(
        task.id,
        {
          title: trimmedTitle,
          description,
          // 父任务优先级由未完成子任务自动联动，不手动提交。
          priority: hasChildren ? undefined : priority,
          // 非叶子任务的执行方式 / 负责人不展示也不可编辑，保持原值。
          executionMode: hasChildren ? undefined : executionMode,
          ownerName: hasChildren ? undefined : executionMode === 'follow_up' ? (ownerValue[0] ?? '') : '',
          assignerName: hasChildren ? undefined : (assignerValue[0] ?? ''),
          tagNames,
        },
        targetWeekId,
      );
      await onMutated?.();
      onClose();
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async () => {
    setBusy(true);
    try {
      await toggleTask(task.id);
      await onMutated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTask(task.id);
      await onMutated?.();
      onClose();
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal task-detail"
        style={{ width: 640 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">任务详情</h2>
        <p className="modal-sub">
          设置执行方式、负责人、分派人与标签；输入新值会自动保存到选项库，供后续选择。
        </p>

        <div className="modal-body">
          <div className="task-time">
            <span className="task-time-label">创建</span>
            <time dateTime={task.createdAt}>{formatDateTimeMinute(task.createdAt)}</time>
            {task.status === 'closed' && task.closedAt && (
              <>
                <span className="task-time-sep">·</span>
                <span className="task-time-label">完成</span>
                <time dateTime={task.closedAt}>{formatDateTimeMinute(task.closedAt)}</time>
              </>
            )}
          </div>

          <div className="field">
            <label>标题</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="任务标题…"
            />
          </div>

          <div className="field">
            <label>描述</label>
            <textarea
              className="detail-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="补充说明、背景、验收标准…"
              rows={4}
            />
          </div>

          <div className="field">
            <label>优先级</label>
            <Select
              value={priority}
              options={priorityOptions}
              onChange={(value: number) => setPriority(value)}
              style={{ width: '100%' }}
              disabled={hasChildren}
            />
            {hasChildren && (
              <p className="modal-hint">
                含子任务：优先级自动取未完成子任务的最高级（P0 最急），不可手动设置；子任务完成或改级后自动联动。
              </p>
            )}
          </div>

          {!hasChildren && (
            <>
              <div className="field">
                <label>执行方式</label>
                <Radio.Group
                  value={executionMode}
                  onChange={(event) => setExecutionMode(event.target.value as ExecutionMode)}
                  options={[
                    { value: 'self', label: '自己执行' },
                    { value: 'follow_up', label: '需要跟进' },
                  ]}
                />
              </div>

              {executionMode === 'follow_up' && (
                <div className="field">
                  <label>负责人（可输入新名字自动创建）</label>
                  <Select
                    mode="tags"
                    maxCount={1}
                    allowClear
                    showSearch
                    value={ownerValue}
                    options={ownerOptions}
                    onChange={(value: string[]) => setOwnerValue(value)}
                    placeholder="选择或输入负责人，回车确认…"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div className="field">
                <label>分派人（可选，可输入新名字自动创建）</label>
                <Select
                  mode="tags"
                  maxCount={1}
                  allowClear
                  showSearch
                  value={assignerValue}
                  options={assignerOptions}
                  onChange={(value: string[]) => setAssignerValue(value)}
                  placeholder="选择或输入分派人，回车确认…"
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          {hasChildren && (
            <p className="modal-hint">
              含子任务：执行方式、负责人与分派人由叶子子任务承载，此处不显示、不可编辑。
            </p>
          )}

          <div className="field">
            <label>标签（可输入新标签自动创建）</label>
            <Select
              mode="tags"
              allowClear
              showSearch
              value={tagNames}
              options={tagOptions}
              onChange={(value: string[]) => setTagNames(value)}
              placeholder="选择或输入标签，回车确认…"
              style={{ width: '100%' }}
            />
          </div>

          <div className="field">
            <label>上级任务（修改层级，保存后生效）</label>
            <Select
              showSearch
              value={parentValue}
              options={parentOptions}
              onChange={(value: string) => setParentValue(value)}
              placeholder="选择新的上级任务…"
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => void toggleDone()} disabled={busy}>
              <CheckIcon size={14} />
              {task.status === 'closed' ? '重新打开' : '标记完成'}
            </button>
            <span className="action-spacer" />
            <button
              className={`btn btn-danger ${confirmingDelete ? 'armed' : ''}`}
              onClick={() => {
                if (confirmingDelete) {
                  void doDelete();
                } else {
                  setConfirmingDelete(true);
                  window.setTimeout(() => setConfirmingDelete(false), 4000);
                }
              }}
              disabled={busy}
            >
              <TrashIcon size={14} />
              {confirmingDelete
                ? `确认删除（含 ${subtreeSize(treeTasks, task.id)} 项）`
                : '删除任务'}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
