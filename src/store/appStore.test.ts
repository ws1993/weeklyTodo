import { describe, expect, it } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { activeLeaves, flattenTasks, taskDepth } from './appStore';

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

describe('flattenTasks', () => {
  it('returns tasks in parent-then-children display order', () => {
    const tasks = [
      makeTask({ id: 1, title: 'root', parentId: null, sortIndex: 0 }),
      makeTask({ id: 2, title: 'child', parentId: 1, sortIndex: 0 }),
      makeTask({ id: 3, title: 'root2', parentId: null, sortIndex: 1 }),
    ];
    expect(flattenTasks(tasks).map((task) => task.id)).toEqual([1, 2, 3]);
  });
});

describe('taskDepth', () => {
  it('counts ancestor levels', () => {
    const tasks = [
      makeTask({ id: 1, title: 'a', parentId: null }),
      makeTask({ id: 2, title: 'b', parentId: 1 }),
      makeTask({ id: 3, title: 'c', parentId: 2 }),
    ];
    expect(taskDepth(tasks, 1)).toBe(0);
    expect(taskDepth(tasks, 2)).toBe(1);
    expect(taskDepth(tasks, 3)).toBe(2);
  });
});

describe('activeLeaves', () => {
  it('includes open tasks without open children and excludes closed and parented-open', () => {
    const tasks = [
      makeTask({ id: 1, title: 'open root', parentId: null }),
      makeTask({ id: 2, title: 'open child', parentId: 1 }),
      makeTask({ id: 3, title: 'closed leaf', parentId: null, status: 'closed' }),
    ];
    const leaves = activeLeaves(tasks).map((task) => task.id);
    // Task 1 has an open child (2), so it is not an active leaf; 2 is.
    expect(leaves).toEqual([2]);
  });
});
