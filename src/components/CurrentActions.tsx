import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../shared/contracts/types';
import { activeLeaves, useAppStore } from '../store/appStore';
import { BoltIcon, ChevronRightIcon, LocateIcon } from './ForestIcons';
import { GROUP_COLOR_PENDING, groupColorMap } from '../utils/groupColors';

/** 完成按钮触发后，条目淡出动画的时长（毫秒）。 */
const COMPLETE_FADE_MS = 220;

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
  // 正在播放完成淡出动画的任务 id（卡片先淡出，再真正关闭）。
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());
  const leavingIdsRef = useRef<Set<number>>(new Set());
  const fadeTimersRef = useRef<number[]>([]);

  // 组件卸载时清理尚未触发的淡出定时器。
  useEffect(() => {
    const timers = fadeTimersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

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

  /**
   * 标记完成：先让卡片播放淡出动画，动画播完后再真正关闭任务，
   * 避免条目内容瞬间跳走。若用户已在动画期间切换周，则不误关其他周的任务。
   */
  const handleComplete = (taskId: number) => {
    if (leavingIdsRef.current.has(taskId)) {
      return;
    }
    leavingIdsRef.current.add(taskId);
    setLeavingIds(new Set(leavingIdsRef.current));
    const weekIdAtClick = useAppStore.getState().activeWeekId;

    const timer = window.setTimeout(() => {
      fadeTimersRef.current = fadeTimersRef.current.filter((id) => id !== timer);
      // 动画已播完，无论关闭结果如何都恢复该卡片，
      // 避免任务被重新打开后带着「leaving」状态不可见。
      leavingIdsRef.current.delete(taskId);
      setLeavingIds(new Set(leavingIdsRef.current));
      if (useAppStore.getState().activeWeekId !== weekIdAtClick) {
        return;
      }
      void toggleTask(taskId);
    }, COMPLETE_FADE_MS);
    fadeTimersRef.current.push(timer);
  };

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
            全部
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
              {group.title}
            </button>
          ))}
        </div>
      )}
      <div className="action-list">
        {entries.length === 0 && (
          <div className="lane-empty">
            <span className="empty-glyph"><BoltIcon size={30} /></span>
            <p>本周没有待办行动</p>
          </div>
        )}
        {visibleEntries.map((entry) => {
          const color = colorMap.get(entry.rootTitle) ?? GROUP_COLOR_PENDING;
          const fullPath = [...entry.parentTitles, entry.task.title];
          return (
            <div
              key={entry.task.id}
              className={`leaf-card${leavingIds.has(entry.task.id) ? ' leaving' : ''}`}
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
                  handleComplete(entry.task.id);
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
