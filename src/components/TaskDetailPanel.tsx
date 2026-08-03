import { useEffect, useState } from 'react';
import { Radio, Select } from 'antd';
import type { ExecutionMode, Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { CheckIcon, CrossIcon } from './ForestIcons';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

const priorityOptions = [
  { value: 0, label: 'P0 紧急' },
  { value: 1, label: 'P1 高' },
  { value: 2, label: 'P2 普通' },
  { value: 3, label: 'P3 低' },
];

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const editTask = useAppStore((state) => state.editTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const owners = useAppStore((state) => state.owners);
  const tags = useAppStore((state) => state.tags);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('self');
  const [ownerValue, setOwnerValue] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
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
    setTagNames(task.tags ?? []);
    setError(null);
  }, [task]);

  if (!task) {
    return null;
  }

  const ownerOptions = owners.map((owner) => ({ value: owner.name, label: owner.name }));
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
      await editTask(task.id, {
        title: trimmedTitle,
        description,
        priority,
        executionMode,
        ownerName: executionMode === 'follow_up' ? (ownerValue[0] ?? '') : '',
        tagNames,
      });
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
      onClose();
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
          设置执行方式、负责人与标签；输入新值会自动保存到选项库，供后续选择。
        </p>

        <div className="modal-body">
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
            />
          </div>

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

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => void toggleDone()} disabled={busy}>
              <CheckIcon size={14} />
              {task.status === 'closed' ? '重新打开' : '标记完成'}
            </button>
            <span className="action-spacer" />
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
