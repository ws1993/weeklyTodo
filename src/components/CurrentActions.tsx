import { useEffect, useMemo, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { activeLeaves, useAppStore } from '../store/appStore';
import { EmptyState } from './EmptyState';
import { BoltIcon, ChevronRightIcon, LocateIcon } from './ForestIcons';
import { GROUP_COLOR_PENDING, groupColorMap } from '../utils/groupColors';

interface CurrentActionsProps {
  tasks: Task[];
  /** 点击某行动时，在左侧任务树中定位并高亮。 */
  onLocate: (taskId: number) => void;
}

interface LeafEntry {
  task: Task;
  /** 顶层根任务标题，即分组名。 */
  rootTitle: string;
  /** 祖先标题（不含自身），用于路径展示。 */
  parentTitles: string[];
}

/** 把叶子任务展开为带根路径的结构。 */
function buildLeafEntries(tasks: Task[]): LeafEntry[] {
  return activeLeaves(tasks).map((task) => {
    const chain: Task[] = [];
    let current: Task | undefined = task;
    while (current) {
      chain.unshift(current);
      current =
        current.parentId != null
          ? tasks.find((item) => item.id === current!.parentId)
          : undefined;
    }
    return {
      task,
      rootTitle: chain[0].title,
      parentTitles: chain.slice(0, -1).map((item) => item.title),
    };
  });
}

export function CurrentActions({ tasks, onLocate }: CurrentActionsProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const groupColors = useAppStore((state) => state.groupColors);
  const ensureGroupColor = useAppStore((state) => state.ensureGroupColor);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const entries = useMemo(() => buildLeafEntries(tasks), [tasks]);
  const colorMap = useMemo(() => groupColorMap(groupColors), [groupColors]);

  // 分组按叶子首次出现顺序排列，附带叶子数。
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    const order = new Map<string, number>();
    entries.forEach((entry, index) => {
      counts.set(entry.rootTitle, (counts.get(entry.rootTitle) ?? 0) + 1);
      if (!order.has(entry.rootTitle)) {
        order.set(entry.rootTitle, index);
      }
    });
    return [...counts.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => (order.get(a.title) ?? 0) - (order.get(b.title) ?? 0));
  }, [entries]);

  // 过滤的分组已无叶子时回到「全部」。
  useEffect(() => {
    if (activeGroup != null && !groups.some((group) => group.title === activeGroup)) {
      setActiveGroup(null);
    }
  }, [groups, activeGroup]);

  // 为尚未分配颜色的分组自动取色（后端取第一个未用色）。
  useEffect(() => {
    const missing = groups
      .filter((group) => !colorMap.has(group.title))
      .map((group) => group.title);
    if (missing.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const title of missing) {
        if (cancelled) {
          return;
        }
        try {
          await ensureGroupColor(title);
        } catch {
          // 单次失败忽略，下次渲染会重试。
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groups, colorMap, ensureGroupColor]);

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

  const visibleEntries =
    activeGroup == null ? entries : entries.filter((entry) => entry.rootTitle === activeGroup);

  return (
    <aside className="actions-pane">
      <div className="lane-head">
        <span className="lane-glyph"><BoltIcon size={15} /></span>
        <span className="actions-pane-title">当前行动</span>
        <span className="lane-count">{entries.length}</span>
        <button className="panel-collapse" title="收起面板" onClick={() => setCollapsed(true)}>
          <ChevronRightIcon size={15} />
        </button>
      </div>
      {entries.length > 0 && (
        <div className="group-chips">
          <button
            className={`g-chip${activeGroup == null ? ' active' : ''}`}
            onClick={() => setActiveGroup(null)}
          >
            <span className="g-chip-dot" style={{ background: GROUP_COLOR_PENDING }} />
            <span className="g-chip-text">全部</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.title}
              className={`g-chip${activeGroup === group.title ? ' active' : ''}`}
              onClick={() => setActiveGroup(group.title)}
              title={`${group.title} · ${group.count} 项`}
            >
              <span
                className="g-chip-dot"
                style={{ background: colorMap.get(group.title) ?? GROUP_COLOR_PENDING }}
              />
              <span className="g-chip-text">{group.title}</span>
            </button>
          ))}
        </div>
      )}
      <div className="action-list">
        {entries.length === 0 && (
          <EmptyState
            compact
            icon={<BoltIcon size={19} />}
            title="本周没有待办行动"
            sub="在任务树中新建任务，或给已有分支添加子任务"
          />
        )}
        {visibleEntries.map((entry) => {
          const color = colorMap.get(entry.rootTitle) ?? GROUP_COLOR_PENDING;
          const fullPath = [...entry.parentTitles, entry.task.title];
          return (
            <div
              key={entry.task.id}
              className="leaf-card"
              onClick={() => onLocate(entry.task.id)}
              title={fullPath.join(' › ')}
            >
              <span className="leaf-dot" style={{ background: color }} />
              <span className="leaf-body">
                <span className="leaf-title">{entry.task.title}</span>
                {entry.parentTitles.length > 0 && (
                  <span className="leaf-path">
                    {entry.parentTitles.map((title, index) => (
                      <span key={`${title}-${index}`} className="path-seg">
                        {title}
                        <span className="path-sep">›</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <button
                className="locate-btn"
                title="在任务树中定位"
                onClick={(event) => {
                  event.stopPropagation();
                  onLocate(entry.task.id);
                }}
              >
                <LocateIcon size={14} />
              </button>
              <button
                className="pick-btn"
                title="标记完成"
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleTask(entry.task.id);
                }}
              >
                完成
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel-foot">共 {entries.length} 项待办</div>
    </aside>
  );
}
