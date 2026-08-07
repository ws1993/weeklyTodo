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

/**
 * Ids of tasks to render when the tree is filtered to incomplete tasks only.
 * Incomplete tasks are always visible; completed tasks are kept only as
 * structural parents when they still have an incomplete descendant.
 */
export function incompleteOnlyVisibleIds(tasks: Task[]): Set<number> {
  const childrenByParent = new Map<number | null, Task[]>();
  for (const task of tasks) {
    const siblings = childrenByParent.get(task.parentId);
    if (siblings) {
      siblings.push(task);
    } else {
      childrenByParent.set(task.parentId, [task]);
    }
  }

  const visible = new Set<number>();

  const markSubtreeIfVisible = (task: Task): boolean => {
    const children = childrenByParent.get(task.id) ?? [];
    // 不能用 Array.some 短路：一旦提前返回，剩余的同级子任务就不会被标记。
    let subtreeHasIncomplete = false;
    for (const child of children) {
      if (markSubtreeIfVisible(child)) {
        subtreeHasIncomplete = true;
      }
    }
    if (subtreeHasIncomplete || task.status === 'in_progress') {
      visible.add(task.id);
      return true;
    }
    return false;
  };

  for (const root of childrenByParent.get(null) ?? []) {
    markSubtreeIfVisible(root);
  }
  return visible;
}

/** Number of tasks in the subtree rooted at `rootId`, including the root itself. */
export function subtreeSize(tasks: Task[], rootId: number): number {
  return 1 + descendantIds(tasks, rootId).size;
}

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Compute the target parent and sort index for dropping `draggedId` relative to
 * `target`. Returns `null` when the drop is not allowed (onto itself, into its
 * own subtree).
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
    // Dropping inside a closed task is allowed: the backend reopens the node
    // (and its ancestors) so the new open child keeps the tree consistent.
    const children = sortedChildren(tasks, target.id);
    const last = children[children.length - 1];
    return { parentId: target.id, index: last ? last.sortIndex + 1 : 0 };
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
