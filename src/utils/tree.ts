import type { Task } from '../shared/contracts/types';

/** Children of `parentId` (`null` = top-level roots) in display order. */
export function sortedChildren(tasks: Task[], parentId: number | null): Task[] {
  return tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id);
}

/** All task ids in the subtree rooted at `rootId`, excluding `rootId` itself. */
export function descendantIds(tasks: Task[], rootId: number): Set<number> {
  const result = new Set<number>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const task of tasks) {
      if (task.parentId === current && !result.has(task.id)) {
        result.add(task.id);
        stack.push(task.id);
      }
    }
  }
  return result;
}

/** Number of tasks in the subtree rooted at `rootId`, including the root itself. */
export function subtreeSize(tasks: Task[], rootId: number): number {
  return 1 + descendantIds(tasks, rootId).size;
}

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Compute the target parent and sort index for dropping `draggedId` relative to
 * `target`. Returns `null` when the drop is not allowed (onto itself, into its
 * own subtree, or inside a closed task).
 */
export function computeDrop(
  tasks: Task[],
  draggedId: number,
  target: Task,
  position: DropPosition,
): { parentId: number | null; index: number } | null {
  if (target.id === draggedId || descendantIds(tasks, draggedId).has(target.id)) {
    return null;
  }

  if (position === 'inside') {
    if (target.status === 'closed') {
      return null;
    }
    const children = sortedChildren(tasks, target.id);
    const last = children[children.length - 1];
    return { parentId: target.id, index: last ? last.sortIndex + 1 : 0 };
  }

  // Reordering next to a child of a closed task would reparent under a closed
  // task, which the backend rejects.
  const parent = target.parentId != null ? tasks.find((task) => task.id === target.parentId) : undefined;
  if (parent?.status === 'closed') {
    return null;
  }

  const siblings = sortedChildren(tasks, target.parentId).filter(
    (task) => task.id !== draggedId,
  );
  const targetIndex = siblings.findIndex((task) => task.id === target.id);
  if (targetIndex < 0) {
    return null;
  }

  if (position === 'before') {
    const prev = targetIndex > 0 ? siblings[targetIndex - 1] : undefined;
    return {
      parentId: target.parentId,
      index: prev ? (prev.sortIndex + target.sortIndex) / 2 : target.sortIndex - 1,
    };
  }
  const next = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : undefined;
  return {
    parentId: target.parentId,
    index: next ? (target.sortIndex + next.sortIndex) / 2 : target.sortIndex + 1,
  };
}

/** Sort index that places `taskId` as the last child of `parentId`. */
export function appendIndex(tasks: Task[], parentId: number | null, taskId: number): number {
  const children = sortedChildren(tasks, parentId).filter((task) => task.id !== taskId);
  const last = children[children.length - 1];
  return last ? last.sortIndex + 1 : 0;
}

/** Title path from the root down to `taskId`, e.g. "目标 / 子任务". */
export function taskPath(tasks: Task[], taskId: number): string {
  const parts: string[] = [];
  let current = tasks.find((task) => task.id === taskId);
  while (current) {
    parts.unshift(current.title);
    current =
      current.parentId != null
        ? tasks.find((task) => task.id === current!.parentId)
        : undefined;
  }
  return parts.join(' / ');
}
