import type { Task } from '../shared/contracts/types';
import { activeLeaves } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { LeafIcon } from './ForestIcons';

interface CurrentActionsProps {
  tasks: Task[];
}

export function CurrentActions({ tasks }: CurrentActionsProps) {
  const leaves = activeLeaves(tasks);
  const activeWeekId = useAppStore((state) => state.activeWeekId);
  const toggleTask = useAppStore((state) => state.toggleTask);
  return (
    <aside className="actions-pane">
      <div className="lane-head">
        <span className="lane-glyph"><LeafIcon size={20} /></span>
        <div>
          <div className="actions-pane-title">当前行动</div>
          <p className="lane-sub">可摘取的果子 · {leaves.length}</p>
        </div>
      </div>
      <div className="action-list">
        {leaves.length === 0 && (
          <div className="lane-empty">
            <span className="empty-glyph"><LeafIcon size={56} /></span>
            <p>这一周还没有<br />可摘取的果子</p>
          </div>
        )}
        {leaves.map((task) => (
          <div
            key={task.id}
            className="leaf-card"
            onClick={() => void toggleTask(task.id)}
            title={task.title}
          >
            <span className="leaf-ic"><LeafIcon size={20} /></span>
            <span className="leaf-body">
              <span className="leaf-title">{task.title}</span>
              <span className="leaf-meta">{activeWeekId} · 行动叶</span>
            </span>
            <button
              className="pick-btn"
              title="标记完成"
              onClick={(event) => {
                event.stopPropagation();
                void toggleTask(task.id);
              }}
            >
              摘取
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
