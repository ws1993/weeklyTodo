import { describe, expect, it } from 'vitest';
import type { Task } from '../shared/contracts/types';
import {
  appendIndex,
  computeDrop,
  descendantIds,
  incompleteOnlyVisibleIds,
  sortedChildren,
  subtreeSize,
  taskPath,
} from './tree';

function makeTask(partial: Partial<Task> & { id: number; title: string }): Task {
  return {
    weekId: '20260803-20260809',
    parentId: null,
    description: '',
    status: 'in_progress',
    priority: 2,
    sortIndex: 0,
    createdAt: '',
    updatedAt: '',
    executionMode: 'self',
    ownerId: null,
    ownerName: null,
    tags: [],
    ...partial,
  };
}

function buildForest(): Task[] {
  return [
    makeTask({ id: 1, title: '根A', parentId: null, sortIndex: 0 }),
    makeTask({ id: 2, title: '子A1', parentId: 1, sortIndex: 0 }),
    makeTask({ id: 3, title: '孙A1', parentId: 2, sortIndex: 0 }),
    makeTask({ id: 4, title: '根B', parentId: null, sortIndex: 1 }),
  ];
}

describe('sortedChildren', () => {
  it('orders children by sortIndex then id', () => {
    const tasks = [
      makeTask({ id: 9, title: 'b', parentId: 1, sortIndex: 1 }),
      makeTask({ id: 8, title: 'a', parentId: 1, sortIndex: 0 }),
    ];
    expect(sortedChildren(tasks, 1).map((task) => task.id)).toEqual([8, 9]);
  });
});

describe('descendantIds', () => {
  it('collects the whole subtree except the root', () => {
    const ids = descendantIds(buildForest(), 1);
    expect([...ids].sort()).toEqual([2, 3]);
  });
});

describe('subtreeSize', () => {
  it('counts the root and all descendants', () => {
    expect(subtreeSize(buildForest(), 1)).toBe(3);
    expect(subtreeSize(buildForest(), 4)).toBe(1);
  });
});

describe('computeDrop', () => {
  const tasks = buildForest();

  it('drops inside a target appending to its children', () => {
    // 根B (id 4) becomes the last child of 子A1 (id 2), after 孙A1 (id 3, sortIndex 0).
    const result = computeDrop(tasks, 4, tasks[1], 'inside');
    expect(result).toEqual({ parentId: 2, index: 1 });
  });

  it('drops before a target among its siblings', () => {
    const result = computeDrop(tasks, 4, tasks[0], 'before');
    expect(result).toEqual({ parentId: null, index: -1 });
  });

  it('drops after a target at the end of its siblings', () => {
    const result = computeDrop(tasks, 1, tasks[3], 'after');
    expect(result).toEqual({ parentId: null, index: 2 });
  });

  it('rejects dropping a task into its own subtree', () => {
    expect(computeDrop(tasks, 1, tasks[2], 'inside')).toBeNull();
    expect(computeDrop(tasks, 2, tasks[2], 'before')).toBeNull();
  });

  it('rejects dropping onto itself', () => {
    expect(computeDrop(tasks, 1, tasks[0], 'inside')).toBeNull();
  });

  it('rejects dropping inside a closed task', () => {
    const closed = makeTask({ id: 99, title: '已完成', status: 'closed' });
    expect(computeDrop(tasks, 1, closed, 'inside')).toBeNull();
  });

  it('rejects dropping next to a child of a closed task', () => {
    const forest = [
      makeTask({ id: 10, title: '已完成根', status: 'closed' }),
      makeTask({ id: 11, title: '仍打开的孙', parentId: 10 }),
      makeTask({ id: 12, title: '游离任务', parentId: null }),
    ];
    expect(computeDrop(forest, 12, forest[1], 'before')).toBeNull();
    expect(computeDrop(forest, 12, forest[1], 'after')).toBeNull();
  });
});

describe('appendIndex', () => {
  it('appends after the last child of the new parent', () => {
    const tasks = [
      makeTask({ id: 1, title: '根A', parentId: null, sortIndex: 0 }),
      makeTask({ id: 2, title: '子A1', parentId: 1, sortIndex: 3 }),
      makeTask({ id: 3, title: '子A2', parentId: 1, sortIndex: 6 }),
    ];
    expect(appendIndex(tasks, 1, 4)).toBe(7);
    expect(appendIndex(tasks, null, 4)).toBe(1);
  });
});

describe('taskPath', () => {
  it('joins ancestor titles from root to task', () => {
    expect(taskPath(buildForest(), 3)).toBe('根A / 子A1 / 孙A1');
    expect(taskPath(buildForest(), 4)).toBe('根B');
  });
});

describe('incompleteOnlyVisibleIds', () => {
  it('keeps incomplete tasks and completed ancestors that still contain incomplete descendants', () => {
    const tasks = [
      makeTask({ id: 1, title: '根', parentId: null }),
      makeTask({ id: 2, title: '已完成分组', parentId: 1, status: 'closed' }),
      makeTask({ id: 3, title: '未完成子任务', parentId: 2 }),
      makeTask({ id: 4, title: '已完成叶子', parentId: 2, status: 'closed' }),
    ];
    expect([...incompleteOnlyVisibleIds(tasks)].sort()).toEqual([1, 2, 3]);
  });

  it('hides fully completed subtrees and completed leaves', () => {
    const tasks = [
      makeTask({ id: 1, title: '已完成根', parentId: null, status: 'closed' }),
      makeTask({ id: 2, title: '已完成子', parentId: 1, status: 'closed' }),
      makeTask({ id: 3, title: '未完成根', parentId: null }),
    ];
    expect([...incompleteOnlyVisibleIds(tasks)].sort()).toEqual([3]);
  });

  it('keeps incomplete nodes even when all of their children are completed', () => {
    const tasks = [
      makeTask({ id: 1, title: '未完成根', parentId: null }),
      makeTask({ id: 2, title: '已完成子', parentId: 1, status: 'closed' }),
    ];
    expect([...incompleteOnlyVisibleIds(tasks)].sort()).toEqual([1]);
  });

  it('marks every incomplete sibling, not only the first one', () => {
    const tasks = [
      makeTask({ id: 1, title: '根A', parentId: null }),
      makeTask({ id: 2, title: '子A1', parentId: 1 }),
      makeTask({ id: 3, title: '子A2', parentId: 1 }),
      makeTask({ id: 4, title: '根B', parentId: null }),
      makeTask({ id: 5, title: '子B1', parentId: 4 }),
      makeTask({ id: 6, title: '子B2', parentId: 4 }),
    ];
    expect([...incompleteOnlyVisibleIds(tasks)].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns an empty set when there are no tasks', () => {
    expect(incompleteOnlyVisibleIds([]).size).toBe(0);
  });
});
