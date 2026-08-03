import type { Task } from '../shared/contracts/types';
import { activeLeaves } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { BoltIcon, ChevronRightIcon } from './ForestIcons';
import { useState } from 'react';

interface CurrentActionsProps {
  tasks: Task[];
}

export function CurrentActions({ tasks }: CurrentActionsProps) {
  const leaves = activeLeaves(tasks);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <aside className="actions-pane collapsed">
        <div className="lane-head">
          <button className="panel-collapse" title="展开面板" onClick={() => setCollapsed(false)}>
            <ChevronRightIcon size={15} />
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="actions-pane">
      <div className="lane-head">
        <span className="lane-glyph"><BoltIcon size={15} /></span>
        <div>
          <div className="actions-pane-title">当前行动</div>
          <p className="lane-sub">可执行的叶子任务</p>
        </div>
        <span className="lane-count">{leaves.length}</span>
        <button className="panel-collapse" title="收起面板" onClick={() => setCollapsed(true)}>
          <ChevronRightIcon size={15} />
        </button>
      </div>
      <div className="action-list">
        {leaves.length === 0 && (
          <div className="lane-empty">
            <span className="empty-glyph"><BoltIcon size={30} /></span>
            <p>本周没有待办行动</p>
          </div>
        )}
        {leaves.map((task) => (
          <div
            key={task.id}
            className="leaf-card"
            onClick={() => void toggleTask(task.id)}
            title={task.title}
          >
            <span className="leaf-ic"><BoltIcon size={15} /></span>
            <span className="leaf-body">
              <span className="leaf-title">{task.title}</span>
              <span className="leaf-meta">{activeWeekId} · 本周</span>
            </span>
            <button
              className="pick-btn"
              title="标记完成"
              onClick={(event) => {
                event.stopPropagation();
                void toggleTask(task.id);
              }}
            >
              完成
            </button>
          </div>
        ))}
      </div>
      <div className="panel-foot">共 {leaves.length} 项待办</div>
    </aside>
  );
}
